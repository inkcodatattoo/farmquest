import { createHash } from "node:crypto";
import type { PrismaClient } from "@farmquest/database";
import { calculateQuickSell } from "@farmquest/game-rules";
import { DomainError } from "./errors.js";

export type QuickSellInput = Readonly<{
  actorUserId: string;
  farmId: string;
  inventoryItemId: string;
  quantity: number;
  idempotencyKey: string;
}>;

function hashInput(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function quickSell(
  prisma: PrismaClient,
  input: QuickSellInput
): Promise<Record<string, unknown>> {
  return prisma.$transaction(async (tx) => {
    const scope = "farm.market.quick-sell";
    const requestHash = hashInput({
      farmId: input.farmId,
      inventoryItemId: input.inventoryItemId,
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

    const inventoryItem = await tx.inventoryItem.findUnique({
      where: { id: input.inventoryItemId },
      include: { item: true, quality: true }
    });

    if (!inventoryItem || inventoryItem.farmId !== farm.id) {
      throw new DomainError("INVENTORY_INSUFFICIENT");
    }
    if (inventoryItem.quality.code === "ROTTEN") {
      throw new DomainError("ITEM_ROTTEN");
    }
    if (!inventoryItem.item.npcSellable) {
      throw new DomainError("ITEM_NOT_SELLABLE");
    }

    const quantity = BigInt(input.quantity);
    const available =
      inventoryItem.quantity - inventoryItem.reservedQuantity;
    if (available < quantity) {
      throw new DomainError("INVENTORY_INSUFFICIENT");
    }

    const sale = calculateQuickSell({
      quantity,
      unitPrice: inventoryItem.item.basePrice,
      sellMultiplierBps: BigInt(inventoryItem.quality.sellMultiplierBps),
      feeBps: 200n
    });

    if (sale.payout <= 0n) {
      throw new DomainError("ITEM_NOT_SELLABLE");
    }

    const inventoryRows = await tx.$queryRaw<
      Array<{ quantity: bigint; reserved_quantity: bigint }>
    >`
      UPDATE farmquest.inventory_item
      SET quantity = quantity - ${quantity}
      WHERE id = ${inventoryItem.id}::uuid
        AND farm_id = ${farm.id}::uuid
        AND quantity - reserved_quantity >= ${quantity}
      RETURNING quantity, reserved_quantity
    `;

    const inventoryAfter = inventoryRows[0];
    if (!inventoryAfter) {
      throw new DomainError("INVENTORY_INSUFFICIENT");
    }

    const coinRows = await tx.$queryRaw<Array<{ coins: bigint }>>`
      UPDATE farmquest.farm
      SET coins = coins + ${sale.payout}
      WHERE id = ${farm.id}::uuid
      RETURNING coins
    `;

    const coinAfter = coinRows[0];
    if (!coinAfter) throw new Error("FARM_COIN_UPDATE_FAILED");

    await tx.itemLedger.create({
      data: {
        farmId: farm.id,
        itemDefinitionId: inventoryItem.itemDefinitionId,
        qualityId: inventoryItem.qualityId,
        quantityDelta: -quantity,
        reservedDelta: 0n,
        quantityAfter: inventoryAfter.quantity,
        reservedAfter: inventoryAfter.reserved_quantity,
        reason: "QUICK_SELL",
        referenceType: "IDEMPOTENCY",
        referenceId: idem.id.toString(),
        idempotencyKey: input.idempotencyKey
      }
    });

    await tx.coinLedger.create({
      data: {
        farmId: farm.id,
        userId: farm.userId,
        delta: sale.payout,
        balanceAfter: coinAfter.coins,
        reason: "QUICK_SELL",
        referenceType: "IDEMPOTENCY",
        referenceId: idem.id.toString(),
        idempotencyKey: input.idempotencyKey
      }
    });

    const xpDefinition = await tx.actionXpDefinition.findFirst({
      where: {
        actionType: "NPC_SELL",
        activeFrom: { lte: now },
        OR: [{ activeTo: null }, { activeTo: { gt: now } }]
      },
      orderBy: { activeFrom: "desc" }
    });

    const xpGranted = xpDefinition?.xpAmount ?? 0n;
    const newXp = farm.xp + xpGranted;
    const levelDefinitions = await tx.levelDefinition.findMany({
      orderBy: { level: "asc" }
    });

    let newLevel = 1;
    for (const level of levelDefinitions) {
      if (newXp >= level.xpRequiredTotal) newLevel = level.level;
    }

    await tx.farm.update({
      where: { id: farm.id },
      data: {
        xp: newXp,
        level: newLevel
      }
    });

    if (xpGranted > 0n) {
      await tx.progressLedger.create({
        data: {
          farmId: farm.id,
          track: "LEVEL_XP",
          delta: xpGranted,
          valueAfter: newXp,
          reason: "NPC_SELL",
          referenceType: "IDEMPOTENCY",
          referenceId: idem.id.toString()
        }
      });
    }

    if (
      inventoryAfter.quantity === 0n &&
      inventoryAfter.reserved_quantity === 0n
    ) {
      await tx.inventoryItem.delete({
        where: { id: inventoryItem.id }
      });
    }

    await tx.outboxMessage.create({
      data: {
        topic: "realtime.farm.updated",
        schemaVersion: 1,
        aggregateType: "FARM",
        aggregateId: farm.id,
        payloadJson: {
          farmId: farm.id,
          action: "QUICK_SELL",
          linearizedAt: now.toISOString()
        }
      }
    });

    const response = {
      code: "QUICK_SELL_OK",
      quantitySold: input.quantity,
      grossValue: sale.grossValue.toString(),
      feeValue: sale.feeValue.toString(),
      payout: sale.payout.toString(),
      coinsAfter: coinAfter.coins.toString(),
      xpGranted: xpGranted.toString(),
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
