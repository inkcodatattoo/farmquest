import { createHash } from "node:crypto";
import type { PrismaClient } from "@farmquest/database";
import { DomainError } from "./errors.js";

export type DiscardInventoryInput = Readonly<{
  actorUserId: string;
  farmId: string;
  inventoryItemId: string;
  quantity: number;
  idempotencyKey: string;
}>;

function hashInput(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function discardInventoryItem(
  prisma: PrismaClient,
  input: DiscardInventoryInput
): Promise<Record<string, unknown>> {
  return prisma.$transaction(async (tx) => {
    const scope = "farm.inventory.discard";
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
      include: { item: true }
    });

    if (!inventoryItem || inventoryItem.farmId !== farm.id) {
      throw new DomainError("INVENTORY_INSUFFICIENT");
    }
    if (!inventoryItem.item.discardable) {
      throw new DomainError("ITEM_NOT_DISCARDABLE");
    }

    const quantity = BigInt(input.quantity);
    const rows = await tx.$queryRaw<
      Array<{ quantity: bigint; reserved_quantity: bigint }>
    >`
      UPDATE farmquest.inventory_item
      SET quantity = quantity - ${quantity}
      WHERE id = ${inventoryItem.id}::uuid
        AND farm_id = ${farm.id}::uuid
        AND quantity - reserved_quantity >= ${quantity}
      RETURNING quantity, reserved_quantity
    `;

    const after = rows[0];
    if (!after) throw new DomainError("INVENTORY_INSUFFICIENT");

    await tx.itemLedger.create({
      data: {
        farmId: farm.id,
        itemDefinitionId: inventoryItem.itemDefinitionId,
        qualityId: inventoryItem.qualityId,
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
      await tx.inventoryItem.delete({
        where: { id: inventoryItem.id }
      });
    }

    await tx.outboxMessage.create({
      data: {
        topic: "realtime.inventory.updated",
        schemaVersion: 1,
        aggregateType: "FARM",
        aggregateId: farm.id,
        payloadJson: {
          farmId: farm.id,
          inventoryItemId: inventoryItem.id,
          action: "DISCARD",
          linearizedAt: now.toISOString()
        }
      }
    });

    const response = {
      code: "DISCARD_OK",
      quantityDiscarded: input.quantity,
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
