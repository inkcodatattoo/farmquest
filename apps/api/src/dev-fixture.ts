import type { PrismaClient } from "@farmquest/database";

const IDS = {
  user: "00000000-0000-4000-8000-000000000001",
  streamer: "00000000-0000-4000-8000-000000000002",
  community: "00000000-0000-4000-8000-000000000003",
  farm: "00000000-0000-4000-8000-000000000004",
  plots: [
    "00000000-0000-4000-8000-000000000005",
    "00000000-0000-4000-8000-000000000006",
    "00000000-0000-4000-8000-000000000007"
  ],
  qualityNone: "00000000-0000-4000-8000-000000000010",
  qualityCommon: "00000000-0000-4000-8000-000000000011",
  qualityGood: "00000000-0000-4000-8000-000000000012",
  qualityExcellent: "00000000-0000-4000-8000-000000000013",
  qualityExtraordinary: "00000000-0000-4000-8000-000000000014",
  qualityRotten: "00000000-0000-4000-8000-000000000015",
  cornSeed: "00000000-0000-4000-8000-000000000020",
  corn: "00000000-0000-4000-8000-000000000021",
  cropCorn: "00000000-0000-4000-8000-000000000022",
  seedInventory: "00000000-0000-4000-8000-000000000023",
  shopCornSeed: "00000000-0000-4000-8000-000000000024",
  xpPlant: "00000000-0000-4000-8000-000000000030",
  xpNpcSell: "00000000-0000-4000-8000-000000000031"
} as const;

export const DEV_USER_ID = IDS.user;

export async function ensureDevFixture(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(2147483001)::text AS lock_result`;

    const farmAlreadyExists = await tx.farm.findUnique({
      where: { id: IDS.farm },
      select: { id: true }
    });

    await tx.user.upsert({
      where: { id: IDS.user },
      update: {
        displayName: "Coda",
        status: "ACTIVE",
        authProvider: "DEV"
      },
      create: {
        id: IDS.user,
        displayName: "Coda",
        status: "ACTIVE",
        authProvider: "DEV",
        role: "PLAYER"
      }
    });

    await tx.marketplaceSellerState.upsert({
      where: { userId: IDS.user },
      update: {},
      create: { userId: IDS.user }
    });

    await tx.streamer.upsert({
      where: { id: IDS.streamer },
      update: {
        approvalStatus: "APPROVED",
        twitchLogin: "farmquest_dev"
      },
      create: {
        id: IDS.streamer,
        userId: IDS.user,
        twitchUserId: "dev-streamer-001",
        twitchLogin: "farmquest_dev",
        approvalStatus: "APPROVED",
        approvedAt: new Date(),
        botEnabled: false,
        chatGameActive: false
      }
    });

    await tx.community.upsert({
      where: { id: IDS.community },
      update: {},
      create: {
        id: IDS.community,
        streamerId: IDS.streamer
      }
    });

    await tx.farm.upsert({
      where: { id: IDS.farm },
      update: {},
      create: {
        id: IDS.farm,
        userId: IDS.user,
        streamerId: IDS.streamer,
        communityId: IDS.community,
        status: "ACTIVE",
        level: 1,
        xp: 0n,
        coins: 100n,
        inventorySlots: 20,
        stackLimit: 200
      }
    });

    await tx.communityMembership.upsert({
      where: { farmId: IDS.farm },
      update: { status: "ACTIVE" },
      create: {
        farmId: IDS.farm,
        communityId: IDS.community,
        userId: IDS.user,
        status: "ACTIVE"
      }
    });

    for (const [index, id] of IDS.plots.entries()) {
      await tx.plot.upsert({
        where: { id },
        update: {},
        create: {
          id,
          farmId: IDS.farm,
          slotNumber: index + 1,
          unlocked: true,
          seedsCapacity: 1
        }
      });
    }

    const qualities = [
      [IDS.qualityNone, "NONE", "Nenhuma", "#FFFFFF", 10000, 10000, 0, false, true],
      [IDS.qualityCommon, "COMMON", "Comum", "#FFFFFF", 10000, 10000, 7000, true, false],
      [IDS.qualityGood, "GOOD", "Boa", "#4CAF50", 12500, 11000, 2500, true, false],
      [IDS.qualityExcellent, "EXCELLENT", "Excelente", "#2196F3", 15000, 12500, 490, true, false],
      [IDS.qualityExtraordinary, "EXTRAORDINARY", "Extraordinário", "#9C27B0", 30000, 20000, 10, true, false],
      [IDS.qualityRotten, "ROTTEN", "Apodrecido", "#795548", 0, 0, 0, false, true]
    ] as const;

    for (const [id, code, name, color, sellBps, xpBps, weight, drawable, isSystem] of qualities) {
      await tx.itemQualityDefinition.upsert({
        where: { code },
        update: {},
        create: {
          id,
          code,
          name,
          color,
          sellMultiplierBps: sellBps,
          xpMultiplierBps: xpBps,
          weight,
          tractorWeight: weight,
          drawable,
          isSystem
        }
      });
    }

    await tx.itemDefinition.upsert({
      where: { key: "corn_seed" },
      update: {},
      create: {
        id: IDS.cornSeed,
        key: "corn_seed",
        name: "Semente de Milho",
        category: "SEED",
        hasQuality: false,
        basePrice: 0n,
        npcSellable: false,
        p2pTradeable: false,
        discardable: true,
        aliases: ["milho", "semente de milho"]
      }
    });

    await tx.itemDefinition.upsert({
      where: { key: "corn" },
      update: {},
      create: {
        id: IDS.corn,
        key: "corn",
        name: "Milho",
        category: "CROP",
        hasQuality: true,
        basePrice: 10n,
        npcSellable: true,
        p2pTradeable: true,
        discardable: true,
        aliases: ["milho", "milhos"]
      }
    });

    await tx.cropDefinition.upsert({
      where: { key: "corn" },
      update: {},
      create: {
        id: IDS.cropCorn,
        key: "corn",
        name: "Milho",
        seedItemId: IDS.cornSeed,
        productItemId: IDS.corn,
        yieldPerSeed: 1,
        unlockLevel: 1,
        growthSeconds: 60,
        xpReward: 5n
      }
    });

    await tx.shopOffer.upsert({
      where: { id: IDS.shopCornSeed },
      update: {},
      create: {
        id: IDS.shopCornSeed,
        itemDefinitionId: IDS.cornSeed,
        buyPrice: 5n,
        minLevel: 1,
        enabled: true
      }
    });

    const inventory = await tx.inventoryItem.findUnique({
      where: {
        farmId_itemDefinitionId_qualityId: {
          farmId: IDS.farm,
          itemDefinitionId: IDS.cornSeed,
          qualityId: IDS.qualityNone
        }
      }
    });

    if (!farmAlreadyExists && !inventory) {
      await tx.inventoryItem.create({
        data: {
          id: IDS.seedInventory,
          farmId: IDS.farm,
          itemDefinitionId: IDS.cornSeed,
          qualityId: IDS.qualityNone,
          quantity: 3n,
          reservedQuantity: 0n
        }
      });

      await tx.itemLedger.create({
        data: {
          farmId: IDS.farm,
          itemDefinitionId: IDS.cornSeed,
          qualityId: IDS.qualityNone,
          quantityDelta: 3n,
          reservedDelta: 0n,
          quantityAfter: 3n,
          reservedAfter: 0n,
          reason: "INITIAL_GRANT",
          referenceType: "DEV_FIXTURE",
          referenceId: IDS.farm
        }
      });
    }

    const initialCoinLedger = await tx.coinLedger.findFirst({
      where: {
        farmId: IDS.farm,
        reason: "INITIAL_GRANT",
        referenceType: "DEV_FIXTURE"
      }
    });

    if (!initialCoinLedger) {
      await tx.coinLedger.create({
        data: {
          farmId: IDS.farm,
          userId: IDS.user,
          delta: 100n,
          balanceAfter: 100n,
          reason: "INITIAL_GRANT",
          referenceType: "DEV_FIXTURE",
          referenceId: IDS.farm
        }
      });
    }

    const levels = [
      [1, 0n, 60],
      [2, 100n, 55],
      [3, 300n, 50],
      [4, 650n, 45],
      [5, 1200n, 40]
    ] as const;

    for (const [level, xpRequiredTotal, cooldown] of levels) {
      await tx.levelDefinition.upsert({
        where: { level },
        update: {},
        create: {
          level,
          xpRequiredTotal,
          harvestCooldownSeconds: cooldown,
          unlocks: {}
        }
      });
    }

    const actionXp = [
      [IDS.xpPlant, "PLANT", "ACTION", 5n],
      [IDS.xpNpcSell, "NPC_SELL", "ACTION", 2n]
    ] as const;

    for (const [id, actionType, per, xpAmount] of actionXp) {
      await tx.actionXpDefinition.upsert({
        where: { id },
        update: {},
        create: {
          id,
          actionType,
          per,
          xpAmount,
          activeFrom: new Date("2020-01-01T00:00:00.000Z")
        }
      });
    }
  });
}
