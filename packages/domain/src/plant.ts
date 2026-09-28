import { createHash } from "node:crypto";
import type { PrismaClient } from "@farmquest/database";
import { addSeconds } from "@farmquest/game-rules";
import { DomainError } from "./errors.js";

export type PlantInput = Readonly<{
  actorUserId: string;
  farmId: string;
  cropDefinitionId: string;
  plotId?: string;
  idempotencyKey: string;
}>;

function hashInput(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function plant(
  prisma: PrismaClient,
  input: PlantInput
): Promise<Record<string, unknown>> {
  return prisma.$transaction(async (tx) => {
    const scope = input.plotId ? "farm.plot.plant" : "farm.plant";
    const requestHash = hashInput({
      farmId: input.farmId,
      cropDefinitionId: input.cropDefinitionId,
      plotId: input.plotId ?? null
    });

    const idem = await tx.idempotencyRecord.upsert({
      where: {
        actorUserId_scope_key: {
          actorUserId: input.actorUserId,
          scope,
          key: input.idempotencyKey
        }
      },
      update: {},
      create: {
        actorUserId: input.actorUserId,
        scope,
        key: input.idempotencyKey,
        requestHash
      }
    });

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

    const crop = await tx.cropDefinition.findUnique({
      where: { id: input.cropDefinitionId }
    });

    if (!crop || !crop.enabled) throw new DomainError("UNKNOWN_CROP");
    if (farm.level < crop.unlockLevel) {
      throw new DomainError("CROP_LOCKED_BY_LEVEL");
    }

    const noneQuality = await tx.itemQualityDefinition.findUnique({
      where: { code: "NONE" }
    });
    if (!noneQuality) throw new Error("NONE_QUALITY_MISSING");

    const seedInventory = await tx.inventoryItem.findUnique({
      where: {
        farmId_itemDefinitionId_qualityId: {
          farmId: farm.id,
          itemDefinitionId: crop.seedItemId,
          qualityId: noneQuality.id
        }
      }
    });

    const available =
      (seedInventory?.quantity ?? 0n) -
      (seedInventory?.reservedQuantity ?? 0n);

    if (available <= 0n || !seedInventory) {
      throw new DomainError("NOT_ENOUGH_SEEDS");
    }

    const plots = await tx.plot.findMany({
      where: {
        farmId: farm.id,
        unlocked: true,
        ...(input.plotId ? { id: input.plotId } : {})
      },
      include: {
        plantings: {
          where: { harvestedAt: null },
          select: { id: true }
        }
      },
      orderBy: { slotNumber: "asc" }
    });

    const empty = plots.filter((plot) => plot.plantings.length === 0);
    if (empty.length === 0) throw new DomainError("NO_EMPTY_PLOTS");

    let remaining = available;
    const allocations: Array<{ plotId: string; seedCount: number }> = [];

    for (const plot of empty) {
      if (remaining <= 0n) break;

      const capacity = BigInt(plot.seedsCapacity);
      const used = remaining < capacity ? remaining : capacity;
      const seedCount = Number(used);

      if (seedCount > 0) {
        allocations.push({ plotId: plot.id, seedCount });
        remaining -= used;
      }

      if (input.plotId) break;
    }

    if (allocations.length === 0) {
      throw new DomainError("NOT_ENOUGH_SEEDS");
    }

    const consumed = allocations.reduce(
      (sum, allocation) => sum + allocation.seedCount,
      0
    );

    const updatedInventory = await tx.$queryRaw<
      Array<{ quantity: bigint; reserved_quantity: bigint }>
    >`
      UPDATE farmquest.inventory_item
      SET quantity = quantity - ${BigInt(consumed)}
      WHERE id = ${seedInventory.id}::uuid
        AND quantity - reserved_quantity >= ${BigInt(consumed)}
      RETURNING quantity, reserved_quantity
    `;

    const inventoryAfter = updatedInventory[0];
    if (!inventoryAfter) throw new DomainError("NOT_ENOUGH_SEEDS");

    await tx.itemLedger.create({
      data: {
        farmId: farm.id,
        itemDefinitionId: crop.seedItemId,
        qualityId: noneQuality.id,
        quantityDelta: -BigInt(consumed),
        reservedDelta: 0n,
        quantityAfter: inventoryAfter.quantity,
        reservedAfter: inventoryAfter.reserved_quantity,
        reason: "PLANT",
        referenceType: "IDEMPOTENCY",
        referenceId: idem.id.toString(),
        idempotencyKey: input.idempotencyKey
      }
    });

    if (
      inventoryAfter.quantity === 0n &&
      inventoryAfter.reserved_quantity === 0n
    ) {
      await tx.inventoryItem.delete({ where: { id: seedInventory.id } });
    }

    const growsAt = addSeconds(now, crop.growthSeconds);
    const rotsAt = addSeconds(growsAt, 86_400);

    const plantedPlots: Array<{
      plotId: string;
      seedCount: number;
      growsAt: string;
      rotsAt: string;
    }> = [];

    for (const allocation of allocations) {
      await tx.plantedCrop.create({
        data: {
          farmId: farm.id,
          plotId: allocation.plotId,
          cropDefinitionId: crop.id,
          seedCount: allocation.seedCount,
          plantedAt: now,
          growsAt,
          rotsAt,
          tractorBonusApplied: false
        }
      });

      plantedPlots.push({
        plotId: allocation.plotId,
        seedCount: allocation.seedCount,
        growsAt: growsAt.toISOString(),
        rotsAt: rotsAt.toISOString()
      });
    }

    const xpDefinition = await tx.actionXpDefinition.findFirst({
      where: {
        actionType: "PLANT",
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
      data: { xp: newXp, level: newLevel }
    });

    if (xpGranted > 0n) {
      await tx.progressLedger.create({
        data: {
          farmId: farm.id,
          track: "LEVEL_XP",
          delta: xpGranted,
          valueAfter: newXp,
          reason: "PLANT",
          referenceType: "IDEMPOTENCY",
          referenceId: idem.id.toString()
        }
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
          action: "PLANT",
          linearizedAt: now.toISOString()
        }
      }
    });

    const response = {
      code: "PLANT_OK",
      plantedPlots,
      seedsConsumed: consumed,
      xpGranted: xpGranted.toString(),
      newLevel,
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
