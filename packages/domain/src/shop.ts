import { createHash } from "node:crypto";
import type { PrismaClient } from "@farmquest/database";
import { canFitInventory } from "@farmquest/game-rules";
import { DomainError } from "./errors.js";

export type ShopBuyInput = Readonly<{
  actorUserId: string;
  farmId: string;
  offerId: string;
  quantity: number;
  idempotencyKey: string;
}>;

function hashInput(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function buyFromShop(
  prisma: PrismaClient,
  input: ShopBuyInput
): Promise<Record<string, unknown>> {
  return prisma.$transaction(async (tx) => {
    const scope = "farm.shop.buy";
    const requestHash = hashInput({
      farmId: input.farmId,
      offerId: input.offerId,
      quantity: input.quantity
    });

    await tx.$executeRaw`
      INSERT INTO farmquest.idempotency_record
        (actor_user_id, scope, key, request_hash)
      VALUES
        (${input.actorUserId}::uuid, ${scope}, ${input.idempotencyKey}, ${requestHash})
      ON CONFLICT (actor_user_id, scope, key) DO NOTHING
    `;

    const idem = await tx.idempotencyRecord.findUnique({
      where: {
        actorUserId_scope_key: {
          actorUserId: input.actorUserId,
          scope,
          key: input.idempotencyKey
        }
      }
    });

    if (!idem) throw new Error("IDEMPOTENCY_RECORD_MISSING");
    if (idem.requestHash !== requestHash) {
      throw new DomainError("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD");
    }
    if (idem.completedAt && idem.responseJson) {
      return idem.responseJson as Record<string, unknown>;
    }

    await tx.$queryRaw`
      SELECT id
      FROM farmquest.farm
      WHERE id = ${input.farmId}::uuid
      FOR NO KEY UPDATE
    `;

    const farm = await tx.farm.findUnique({
      where: { id: input.farmId },
      include: { user: true, membership: true, streamer: true }
    });

    if (!farm || farm.userId !== input.actorUserId) {
      throw new DomainError("FARM_NOT_FOUND");
    }
    if (farm.status === "SOLD") throw new DomainError("FARM_SOLD");
    if (farm.user.status !== "ACTIVE") throw new DomainError("USER_BANNED");
    if (!farm.membership || farm.membership.status !== "ACTIVE") {
      throw new DomainError("FARM_ACCESS_REMOVED");
    }
    if (farm.streamer.approvalStatus === "SUSPENDED") {
      throw new DomainError("FARM_STREAMER_SUSPENDED");
    }

    const nowRows = await tx.$queryRaw<Array<{ linearized_at: string }>>`
      SELECT clock_timestamp()::text AS linearized_at
    `;
    const nowText = nowRows[0]?.linearized_at;
    if (!nowText) throw new Error("LINEARIZED_AT_MISSING");
    const now = new Date(nowText);

    const offer = await tx.shopOffer.findUnique({
      where: { id: input.offerId },
      include: { item: true }
    });

    if (!offer || !offer.enabled || !offer.item.enabled) {
      throw new DomainError("SHOP_OFFER_NOT_FOUND");
    }
    if (farm.level < offer.minLevel) {
      throw new DomainError("SHOP_OFFER_LOCKED_BY_LEVEL");
    }

    const noneQuality = await tx.itemQualityDefinition.findUnique({
      where: { code: "NONE" }
    });
    if (!noneQuality) throw new Error("NONE_QUALITY_MISSING");

    const inventory = await tx.inventoryItem.findMany({
      where: { farmId: farm.id }
    });

    const inventoryKey = `${offer.itemDefinitionId}:${noneQuality.id}`;
    const fits = canFitInventory({
      stacks: inventory.map((item) => ({
        key: `${item.itemDefinitionId}:${item.qualityId}`,
        quantity: item.quantity
      })),
      additions: [{
        key: inventoryKey,
        quantity: BigInt(input.quantity)
      }],
      stackLimit: farm.stackLimit,
      inventorySlots: farm.inventorySlots
    });

    if (!fits) throw new DomainError("INVENTORY_FULL");

    const coinsSpent = offer.buyPrice * BigInt(input.quantity);
    const debitRows = await tx.$queryRaw<Array<{ coins: bigint }>>`
      UPDATE farmquest.farm
      SET coins = coins - ${coinsSpent}
      WHERE id = ${farm.id}::uuid
        AND coins >= ${coinsSpent}
      RETURNING coins
    `;

    const debit = debitRows[0];
    if (!debit) throw new DomainError("INSUFFICIENT_COINS");

    const key = {
      farmId_itemDefinitionId_qualityId: {
        farmId: farm.id,
        itemDefinitionId: offer.itemDefinitionId,
        qualityId: noneQuality.id
      }
    };

    const existing = await tx.inventoryItem.findUnique({ where: key });
    const added = BigInt(input.quantity);

    const updatedInventory = existing
      ? await tx.inventoryItem.update({
          where: key,
          data: { quantity: { increment: added } }
        })
      : await tx.inventoryItem.create({
          data: {
            farmId: farm.id,
            itemDefinitionId: offer.itemDefinitionId,
            qualityId: noneQuality.id,
            quantity: added,
            reservedQuantity: 0n
          }
        });

    await tx.coinLedger.create({
      data: {
        farmId: farm.id,
        userId: farm.userId,
        delta: -coinsSpent,
        balanceAfter: debit.coins,
        reason: "SHOP_BUY",
        referenceType: "SHOP_OFFER",
        referenceId: offer.id,
        idempotencyKey: input.idempotencyKey
      }
    });

    await tx.itemLedger.create({
      data: {
        farmId: farm.id,
        itemDefinitionId: offer.itemDefinitionId,
        qualityId: noneQuality.id,
        quantityDelta: added,
        reservedDelta: 0n,
        quantityAfter: updatedInventory.quantity,
        reservedAfter: updatedInventory.reservedQuantity,
        reason: "SHOP_BUY",
        referenceType: "SHOP_OFFER",
        referenceId: offer.id,
        idempotencyKey: input.idempotencyKey
      }
    });

    await tx.outboxMessage.create({
      data: {
        topic: "realtime.farm.updated",
        schemaVersion: 1,
        aggregateType: "FARM",
        aggregateId: farm.id,
        payloadJson: {
          farmId: farm.id,
          action: "SHOP_BUY",
          linearizedAt: now.toISOString()
        }
      }
    });

    const response = {
      code: "SHOP_BUY_OK",
      coinsSpent: coinsSpent.toString(),
      coinsAfter: debit.coins.toString(),
      itemsAdded: input.quantity,
      linearizedAt: now.toISOString()
    };

    await tx.idempotencyRecord.update({
      where: { id: idem.id },
      data: {
        responseJson: response,
        linearizedAt: now,
        completedAt: now
      }
    });

    return response;
  }, { timeout: 10_000 });
}
