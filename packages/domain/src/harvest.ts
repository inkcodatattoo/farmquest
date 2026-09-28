import { createHash } from "node:crypto";
import type { PrismaClient } from "@farmquest/database";
import {
  addSeconds,
  drawWeighted,
  type RandomSource
} from "@farmquest/game-rules";
import { DomainError } from "./errors.js";

export type HarvestInput = Readonly<{
  actorUserId: string;
  farmId: string;
  plotId?: string;
  idempotencyKey: string;
}>;

function hashInput(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function harvest(
  prisma: PrismaClient,
  random: RandomSource,
  input: HarvestInput
): Promise<Record<string, unknown>> {
  return prisma.$transaction(async (tx) => {
    const scope = input.plotId ? "farm.plot.harvest" : "farm.harvest";
    const requestHash = hashInput({
      farmId: input.farmId,
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

    if (farm.nextHarvestAt && now < farm.nextHarvestAt) {
      throw new DomainError("HARVEST_COOLDOWN_ACTIVE", {
        remainingSeconds: Math.ceil(
          (farm.nextHarvestAt.getTime() - now.getTime()) / 1000
        )
      });
    }

    const plantings = await tx.plantedCrop.findMany({
      where: {
        farmId: farm.id,
        harvestedAt: null,
        growsAt: { lte: now },
        ...(input.plotId ? { plotId: input.plotId } : {})
      },
      include: {
        crop: true,
        plot: true
      },
      orderBy: {
        plot: {
          slotNumber: "asc"
        }
      }
    });

    if (plantings.length === 0) {
      throw new DomainError("NOTHING_TO_HARVEST");
    }

    const inventory = await tx.inventoryItem.findMany({
      where: { farmId: farm.id }
    });

    let slotsUsed = inventory.reduce((sum, item) => {
      const quantity = item.quantity;
      const stack = BigInt(farm.stackLimit);
      const slots = Number((quantity + stack - 1n) / stack);
      return sum + slots;
    }, 0);

    const accepted = [];
    for (const planting of plantings) {
      const quantity = BigInt(
        planting.seedCount * planting.crop.yieldPerSeed
      );
      const stack = BigInt(farm.stackLimit);
      const worstCaseNewSlots = Number((quantity + stack - 1n) / stack);

      if (slotsUsed + worstCaseNewSlots > farm.inventorySlots) break;

      accepted.push(planting);
      slotsUsed += worstCaseNewSlots;
      if (input.plotId) break;
    }

    if (accepted.length === 0) {
      throw new DomainError("INVENTORY_FULL");
    }

    const drawable = await tx.itemQualityDefinition.findMany({
      where: {
        drawable: true,
        enabled: true
      }
    });
    const rotten = await tx.itemQualityDefinition.findUnique({
      where: { code: "ROTTEN" }
    });

    if (!rotten) throw new Error("ROTTEN_QUALITY_MISSING");
    if (drawable.length === 0) throw new Error("DRAWABLE_QUALITIES_MISSING");

    let totalXp = 0n;
    const harvested: Array<{
      plotId: string;
      itemDefinitionId: string;
      quality: string;
      quantity: number;
      xpGranted: string;
    }> = [];

    for (const planting of accepted) {
      const quality =
        now >= planting.rotsAt
          ? rotten
          : drawWeighted(
              drawable.map((item) => ({
                value: item,
                weight: item.weight
              })),
              random
            );

      const quantity = BigInt(
        planting.seedCount * planting.crop.yieldPerSeed
      );

      const marked = await tx.plantedCrop.updateMany({
        where: {
          id: planting.id,
          harvestedAt: null
        },
        data: {
          harvestedAt: now,
          resultQualityId: quality.id,
          resultQuantity: quantity,
          resultContributed: 0n
        }
      });

      if (marked.count !== 1) {
        throw new DomainError("PLOT_ALREADY_HARVESTED");
      }

      const inventoryKey = {
        farmId_itemDefinitionId_qualityId: {
          farmId: farm.id,
          itemDefinitionId: planting.crop.productItemId,
          qualityId: quality.id
        }
      };

      const existing = await tx.inventoryItem.findUnique({
        where: inventoryKey
      });

      const updated = existing
        ? await tx.inventoryItem.update({
            where: inventoryKey,
            data: {
              quantity: {
                increment: quantity
              }
            }
          })
        : await tx.inventoryItem.create({
            data: {
              farmId: farm.id,
              itemDefinitionId: planting.crop.productItemId,
              qualityId: quality.id,
              quantity,
              reservedQuantity: 0n
            }
          });

      await tx.itemLedger.create({
        data: {
          farmId: farm.id,
          itemDefinitionId: planting.crop.productItemId,
          qualityId: quality.id,
          quantityDelta: quantity,
          reservedDelta: 0n,
          quantityAfter: updated.quantity,
          reservedAfter: updated.reservedQuantity,
          reason: "HARVEST",
          referenceType: "PLANTED_CROP",
          referenceId: planting.id,
          idempotencyKey: input.idempotencyKey
        }
      });

      const xp =
        (planting.crop.xpReward *
          BigInt(planting.seedCount) *
          BigInt(quality.xpMultiplierBps)) /
        10_000n;

      totalXp += xp;

      harvested.push({
        plotId: planting.plotId,
        itemDefinitionId: planting.crop.productItemId,
        quality: quality.code,
        quantity: Number(quantity),
        xpGranted: xp.toString()
      });
    }

    const newXp = farm.xp + totalXp;
    const levelDefinitions = await tx.levelDefinition.findMany({
      orderBy: { level: "asc" }
    });

    let newLevel = 1;
    for (const level of levelDefinitions) {
      if (newXp >= level.xpRequiredTotal) newLevel = level.level;
    }

    const newLevelDefinition = levelDefinitions.find(
      (definition) => definition.level === newLevel
    );
    if (!newLevelDefinition) {
      throw new Error("LEVEL_DEFINITION_MISSING");
    }

    const nextHarvestAt = addSeconds(
      now,
      newLevelDefinition.harvestCooldownSeconds
    );

    await tx.farm.update({
      where: { id: farm.id },
      data: {
        xp: newXp,
        level: newLevel,
        nextHarvestAt
      }
    });

    if (totalXp > 0n) {
      await tx.progressLedger.create({
        data: {
          farmId: farm.id,
          track: "LEVEL_XP",
          delta: totalXp,
          valueAfter: newXp,
          reason: "HARVEST",
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
          action: "HARVEST",
          linearizedAt: now.toISOString()
        }
      }
    });

    const response = {
      code: "HARVEST_OK",
      harvested,
      totalXpGranted: totalXp.toString(),
      newLevel,
      nextHarvestAt: nextHarvestAt.toISOString(),
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
