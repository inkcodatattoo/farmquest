import { createHash } from "node:crypto";
import type { PrismaClient } from "@farmquest/database";
import { quickSellValues, stackSlots } from "@farmquest/game-rules";
import { DomainError } from "./errors.js";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

type EconomicInputBase = Readonly<{
  actorUserId: string;
  farmId: string;
  idempotencyKey: string;
}>;

export type ShopBuyInput = EconomicInputBase & Readonly<{
  offerId: string;
  quantity: number;
}>;

export type QuickSellInput = EconomicInputBase & Readonly<{
  inventoryItemId: string;
  quantity: number;
}>;

export type DiscardInput = EconomicInputBase & Readonly<{
  inventoryItemId: string;
  quantity: number;
}>;

function hashInput(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function beginIdempotency(
  tx: Tx,
  input: Readonly<{
    actorUserId: string;
    scope: string;
    key: string;
    requestHash: string;
  }>
) {
  await tx.$executeRaw`
    INSERT INTO farmquest.idempotency_record
      (actor_user_id, scope, key, request_hash)
    VALUES
      (${input.actorUserId}::uuid, ${input.scope}, ${input.key}, ${input.requestHash})
    ON CONFLICT (actor_user_id, scope, key) DO NOTHING
  `;

  const record = await tx.idempotencyRecord.findUnique({
    where: {
      actorUserId_scope_key: {
        actorUserId: input.actorUserId,
        scope: input.scope,
        key: input.key
      }
    }
  });

  if (!record) throw new Error("IDEMPOTENCY_RECORD_MISSING");
  if (record.requestHash !== input.requestHash) {
    throw new DomainError("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD");
  }

  return record;
}

async function lockAndLoadFarm(
  tx: Tx,
  actorUserId: string,
  farmId: string
) {
  await tx.$queryRaw`
    SELECT id
    FROM farmquest.farm
    WHERE id = ${farmId}::uuid
    FOR NO KEY UPDATE
  `;

  const farm = await tx.farm.findUnique({
    where: { id: farmId },
    include: {
      user: true,
      membership: true,
      streamer: true
    }
  });

  if (!farm || farm.userId !== actorUserId) {
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

  return farm;
}

async function linearizedNow(tx: Tx): Promise<Date> {
  const rows = await tx.$queryRaw<Array<{ linearized_at: string }>>`
    SELECT clock_timestamp()::text AS linearized_at
  `;
  const value = rows[0]?.linearized_at;
  if (!value) throw new Error("LINEARIZED_AT_MISSING");
  return new Date(value);
}

async function levelForXp(tx: Tx, xp: bigint): Promise<number> {
  const levels = await tx.levelDefinition.findMany({
    orderBy: { level: "asc" }
  });

  let result = 1;
  for (const level of levels) {
    if (xp >= level.xpRequiredTotal) result = level.level;
  }
  return result;
}

async function xpForAction(
  tx: Tx,
  actionType: string,
  now: Date
): Promise<bigint> {
  const definition = await tx.actionXpDefinition.findFirst({
    where: {
      actionType,
      activeFrom: { lte: now },
      OR: [{ activeTo: null }, { activeTo: { gt: now } }]
    },
    orderBy: { activeFrom: "desc" }
  });

  return definition?.xpAmount ?? 0n;
}

async function finishIdempotency(
  tx: Tx,
  id: bigint,
  response: Record<string, unknown>,
  linearizedAt: Date
) {
  await tx.idempotencyRecord.update({
    where: { id },
    data: {
      responseJson: response,
      linearizedAt,
      completedAt: linearizedAt
    }
  });
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

    const idem = await beginIdempotency(tx, {
      actorUserId: input.actorUserId,
      scope,
      key: input.idempotencyKey,
      requestHash
    });

    if (idem.completedAt && idem.responseJson) {
      return idem.responseJson as Record<string, unknown>;
    }

    const farm = await lockAndLoadFarm(tx, input.actorUserId, input.farmId);
    const now = await linearizedNow(tx);

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

    const quantity = BigInt(input.quantity);
    const totalPrice = offer.buyPrice * quantity;

    const currentInventory = await tx.inventoryItem.findMany({
      where: { farmId: farm.id }
    });

    const existing = currentInventory.find(
      (entry) =>
        entry.itemDefinitionId === offer.itemDefinitionId &&
        entry.qualityId === noneQuality.id
    );

    const usedBefore = currentInventory.reduce(
      (sum, entry) =>
        sum + stackSlots(entry.quantity, BigInt(farm.stackLimit)),
      0
    );

    const existingSlotsBefore = existing
      ? stackSlots(existing.quantity, BigInt(farm.stackLimit))
      : 0;
    const existingSlotsAfter = stackSlots(
      (existing?.quantity ?? 0n) + quantity,
      BigInt(farm.stackLimit)
    );
    const usedAfter =
      usedBefore - existingSlotsBefore + existingSlotsAfter;

    if (usedAfter > farm.inventorySlots) {
      throw new DomainError("INVENTORY_FULL");
    }

    const debit = await tx.$queryRaw<Array<{ coins: bigint }>>`
      UPDATE farmquest.farm
      SET coins = coins - ${totalPrice}
      WHERE id = ${farm.id}::uuid
        AND coins >= ${totalPrice}
      RETURNING coins
    `;
    const debited = debit[0];
    if (!debited) throw new DomainError("INSUFFICIENT_COINS");

    const inventoryAfter = existing
      ? await tx.inventoryItem.update({
          where: { id: existing.id },
          data: { quantity: { increment: quantity } }
        })
      : await tx.inventoryItem.create({
          data: {
            farmId: farm.id,
            itemDefinitionId: offer.itemDefinitionId,
            qualityId: noneQuality.id,
            quantity,
            reservedQuantity: 0n
          }
        });

    await tx.coinLedger.create({
      data: {
        farmId: farm.id,
        userId: farm.userId,
        delta: -totalPrice,
        balanceAfter: debited.coins,
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
        quantityDelta: quantity,
        reservedDelta: 0n,
        quantityAfter: inventoryAfter.quantity,
        reservedAfter: inventoryAfter.reservedQuantity,
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
      itemDefinitionId: offer.itemDefinitionId,
      quantity: input.quantity,
      coinsSpent: totalPrice.toString(),
      coinsAfter: debited.coins.toString(),
      itemQuantityAfter: inventoryAfter.quantity.toString(),
      linearizedAt: now.toISOString()
    };

    await finishIdempotency(tx, idem.id, response, now);
    return response;
  }, { timeout: 10_000 });
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

    const idem = await beginIdempotency(tx, {
      actorUserId: input.actorUserId,
      scope,
      key: input.idempotencyKey,
      requestHash
    });

    if (idem.completedAt && idem.responseJson) {
      return idem.responseJson as Record<string, unknown>;
    }

    const farm = await lockAndLoadFarm(tx, input.actorUserId, input.farmId);
    const now = await linearizedNow(tx);

    const inventory = await tx.inventoryItem.findFirst({
      where: {
        id: input.inventoryItemId,
        farmId: farm.id
      },
      include: {
        item: true,
        quality: true
      }
    });

    if (!inventory) throw new DomainError("INVENTORY_INSUFFICIENT");
    if (!inventory.item.npcSellable) {
      throw new DomainError("ITEM_NOT_SELLABLE");
    }
    if (inventory.quality.code === "ROTTEN") {
      throw new DomainError("ITEM_ROTTEN");
    }

    const quantity = BigInt(input.quantity);
    if (inventory.quantity - inventory.reservedQuantity < quantity) {
      throw new DomainError("INVENTORY_INSUFFICIENT");
    }

    const values = quickSellValues({
      quantity,
      unitBasePrice: inventory.item.basePrice,
      qualitySellMultiplierBps: BigInt(
        inventory.quality.sellMultiplierBps
      ),
      feeBps: 200n
    });

    if (values.payout <= 0n) {
      throw new DomainError("ITEM_NOT_SELLABLE");
    }

    const inventoryRows = await tx.$queryRaw<
      Array<{ quantity: bigint; reserved_quantity: bigint }>
    >`
      UPDATE farmquest.inventory_item
      SET quantity = quantity - ${quantity}
      WHERE id = ${inventory.id}::uuid
        AND quantity - reserved_quantity >= ${quantity}
      RETURNING quantity, reserved_quantity
    `;
    const inventoryAfter = inventoryRows[0];
    if (!inventoryAfter) {
      throw new DomainError("INVENTORY_INSUFFICIENT");
    }

    const coinRows = await tx.$queryRaw<Array<{ coins: bigint }>>`
      UPDATE farmquest.farm
      SET coins = coins + ${values.payout}
      WHERE id = ${farm.id}::uuid
      RETURNING coins
    `;
    const coinAfter = coinRows[0];
    if (!coinAfter) throw new Error("FARM_CREDIT_FAILED");

    await tx.itemLedger.create({
      data: {
        farmId: farm.id,
        itemDefinitionId: inventory.itemDefinitionId,
        qualityId: inventory.qualityId,
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
        delta: values.payout,
        balanceAfter: coinAfter.coins,
        reason: "QUICK_SELL",
        referenceType: "IDEMPOTENCY",
        referenceId: idem.id.toString(),
        idempotencyKey: input.idempotencyKey
      }
    });

    const xpGranted = await xpForAction(tx, "NPC_SELL", now);
    const newXp = farm.xp + xpGranted;
    const newLevel = await levelForXp(tx, newXp);

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
          reason: "QUICK_SELL",
          referenceType: "IDEMPOTENCY",
          referenceId: idem.id.toString()
        }
      });
    }

    if (
      inventoryAfter.quantity === 0n &&
      inventoryAfter.reserved_quantity === 0n
    ) {
      await tx.inventoryItem.delete({ where: { id: inventory.id } });
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
      grossValue: values.grossValue.toString(),
      feeValue: values.feeValue.toString(),
      payout: values.payout.toString(),
      coinsAfter: coinAfter.coins.toString(),
      xpGranted: xpGranted.toString(),
      newLevel,
      linearizedAt: now.toISOString()
    };

    await finishIdempotency(tx, idem.id, response, now);
    return response;
  }, { timeout: 10_000 });
}

export async function discardInventory(
  prisma: PrismaClient,
  input: DiscardInput
): Promise<Record<string, unknown>> {
  return prisma.$transaction(async (tx) => {
    const scope = "farm.inventory.discard";
    const requestHash = hashInput({
      farmId: input.farmId,
      inventoryItemId: input.inventoryItemId,
      quantity: input.quantity
    });

    const idem = await beginIdempotency(tx, {
      actorUserId: input.actorUserId,
      scope,
      key: input.idempotencyKey,
      requestHash
    });

    if (idem.completedAt && idem.responseJson) {
      return idem.responseJson as Record<string, unknown>;
    }

    const farm = await lockAndLoadFarm(tx, input.actorUserId, input.farmId);
    const now = await linearizedNow(tx);

    const inventory = await tx.inventoryItem.findFirst({
      where: {
        id: input.inventoryItemId,
        farmId: farm.id
      },
      include: {
        item: true
      }
    });

    if (!inventory || !inventory.item.discardable) {
      throw new DomainError("INVENTORY_INSUFFICIENT");
    }

    const quantity = BigInt(input.quantity);
    if (inventory.quantity - inventory.reservedQuantity < quantity) {
      throw new DomainError("INVENTORY_INSUFFICIENT");
    }

    const rows = await tx.$queryRaw<
      Array<{ quantity: bigint; reserved_quantity: bigint }>
    >`
      UPDATE farmquest.inventory_item
      SET quantity = quantity - ${quantity}
      WHERE id = ${inventory.id}::uuid
        AND quantity - reserved_quantity >= ${quantity}
      RETURNING quantity, reserved_quantity
    `;
    const after = rows[0];
    if (!after) throw new DomainError("INVENTORY_INSUFFICIENT");

    await tx.itemLedger.create({
      data: {
        farmId: farm.id,
        itemDefinitionId: inventory.itemDefinitionId,
        qualityId: inventory.qualityId,
        quantityDelta: -quantity,
        reservedDelta: 0n,
        quantityAfter: after.quantity,
        reservedAfter: after.reserved_quantity,
        reason: "DISCARD",
        referenceType: "IDEMPOTENCY",
        referenceId: idem.id.toString(),
        idempotencyKey: input.idempotencyKey
      }
    });

    if (after.quantity === 0n && after.reserved_quantity === 0n) {
      await tx.inventoryItem.delete({ where: { id: inventory.id } });
    }

    await tx.outboxMessage.create({
      data: {
        topic: "realtime.inventory.updated",
        schemaVersion: 1,
        aggregateType: "FARM",
        aggregateId: farm.id,
        payloadJson: {
          farmId: farm.id,
          action: "DISCARD",
          linearizedAt: now.toISOString()
        }
      }
    });

    const response = {
      code: "DISCARD_OK",
      inventoryItemId: inventory.id,
      quantityDiscarded: input.quantity,
      quantityAfter: after.quantity.toString(),
      linearizedAt: now.toISOString()
    };

    await finishIdempotency(tx, idem.id, response, now);
    return response;
  }, { timeout: 10_000 });
}
