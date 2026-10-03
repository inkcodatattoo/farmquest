import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Req
} from "@nestjs/common";
import type { Request } from "express";
import {
  CryptoRandomSource,
  drawWeighted,
  getPlotTemporalState
} from "@farmquest/game-rules";
import { AuthService } from "../auth/auth.service.js";
import { DatabaseService } from "../database.service.js";

@Controller("api/v1/farms")
export class FarmsController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuthService) private readonly auth: AuthService
  ) {}

  @Get()
  async list(@Req() req: Request) {
    const session = await this.auth.requireSession(req);

    const farms = await this.db.client.farm.findMany({
      where: {
        userId: session.user.id,
        status: "ACTIVE"
      },
      orderBy: { createdAt: "asc" }
    });
    const levelDefinitions =
  await this.db.client.levelDefinition.findMany({
    orderBy: { level: "asc" }
  });

    return farms.map((farm) => {
  const currentLevel = levelDefinitions.find(
    (definition) => definition.level === farm.level
  );

  const nextLevel = levelDefinitions.find(
    (definition) => definition.level === farm.level + 1
  );

  return {
    id: farm.id,
    level: farm.level,
    xp: farm.xp.toString(),

    xpLevelStart:
      currentLevel?.xpRequiredTotal.toString() ?? "0",

    xpNextLevel:
      nextLevel?.xpRequiredTotal.toString() ?? null,

    coins: farm.coins.toString(),
    inventorySlots: farm.inventorySlots,
    stackLimit: farm.stackLimit,
    nextHarvestAt: farm.nextHarvestAt?.toISOString() ?? null,
    status: farm.status
  };
});
  }

  @Get(":farmId")
  async get(
    @Req() req: Request,
    @Param("farmId") farmId: string
  ) {
    const session = await this.auth.requireSession(req);

    const farm = await this.db.client.farm.findFirst({
      where: {
        id: farmId,
        userId: session.user.id,
        status: "ACTIVE"
      }
    });

    if (!farm) throw new NotFoundException("FARM_NOT_FOUND");

    return {
      id: farm.id,
      level: farm.level,
      xp: farm.xp.toString(),
      coins: farm.coins.toString(),
      inventorySlots: farm.inventorySlots,
      stackLimit: farm.stackLimit,
      nextHarvestAt: farm.nextHarvestAt?.toISOString() ?? null,
      status: farm.status
    };
  }

  @Get(":farmId/plots")
  async plots(
    @Req() req: Request,
    @Param("farmId") farmId: string
  ) {
    const session = await this.auth.requireSession(req);

    const farm = await this.db.client.farm.findFirst({
      where: { id: farmId, userId: session.user.id, status: "ACTIVE" },
      select: { id: true }
    });

    if (!farm) throw new NotFoundException("FARM_NOT_FOUND");

    const loadPlots = () =>
  this.db.client.plot.findMany({
    where: { farmId },
    include: {
      plantings: {
        where: { harvestedAt: null },
        include: {
          crop: true,
          quality: true
        },
        take: 1
      }
    },
    orderBy: { slotNumber: "asc" }
  });

let plots = await loadPlots();

const now = new Date();
const random = new CryptoRandomSource();

const drawableQualities =
  await this.db.client.itemQualityDefinition.findMany({
    where: {
      drawable: true,
      enabled: true
    }
  });

let qualityAssigned = false;

if (drawableQualities.length > 0) {
  for (const plot of plots) {
    const active = plot.plantings[0] ?? null;

    if (!active) continue;

    const state = getPlotTemporalState(
      now,
      active.growsAt,
      active.rotsAt
    );

    if (state !== "READY" || active.resultQualityId) {
      continue;
    }

    const quality = drawWeighted(
      drawableQualities.map((item) => ({
        value: item,
        weight: item.weight
      })),
      random
    );

    const updated =
      await this.db.client.plantedCrop.updateMany({
        where: {
          id: active.id,
          harvestedAt: null,
          resultQualityId: null
        },
        data: {
          resultQualityId: quality.id
        }
      });

    if (updated.count === 1) {
      qualityAssigned = true;
    }
  }
}

if (qualityAssigned) {
  plots = await loadPlots();
}

    return {
      serverTime: now.toISOString(),
      plots: plots.map((plot) => {
        const active = plot.plantings[0] ?? null;

        if (!active) {
          return {
            id: plot.id,
            slotNumber: plot.slotNumber,
            unlocked: plot.unlocked,
            seedsCapacity: plot.seedsCapacity,
            state: "EMPTY",
            planted: null
          };
        }

        return {
          id: plot.id,
          slotNumber: plot.slotNumber,
          unlocked: plot.unlocked,
          seedsCapacity: plot.seedsCapacity,
          state: getPlotTemporalState(now, active.growsAt, active.rotsAt),
          planted: {
  cropDefinitionId: active.cropDefinitionId,
  cropName: active.crop.name,
  seedCount: active.seedCount,
  plantedAt: active.plantedAt.toISOString(),
  growsAt: active.growsAt.toISOString(),
  rotsAt: active.rotsAt.toISOString(),
  quality: active.quality?.code ?? null
}
        };
      })
    };
  }
}
