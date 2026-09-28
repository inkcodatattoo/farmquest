import { z } from "zod";
import { BigIntString, IsoDateTime, Uuid } from "./primitives.js";

export const FarmView = z.object({
  id: Uuid,
  level: z.number().int().positive(),
  xp: BigIntString,
  coins: BigIntString,
  inventorySlots: z.number().int().positive(),
  stackLimit: z.number().int().positive(),
  nextHarvestAt: IsoDateTime.nullable(),
  status: z.literal("ACTIVE")
});

export const PlotState = z.enum(["EMPTY", "PLANTED", "READY", "ROTTEN"]);

export const PlotView = z.object({
  id: Uuid,
  slotNumber: z.number().int().positive(),
  unlocked: z.boolean(),
  seedsCapacity: z.number().int().positive(),
  state: PlotState,
  planted: z.object({
    cropDefinitionId: Uuid,
    cropName: z.string(),
    seedCount: z.number().int().positive(),
    plantedAt: IsoDateTime,
    growsAt: IsoDateTime,
    rotsAt: IsoDateTime
  }).nullable()
});

export const PlantRequest = z.object({
  cropDefinitionId: Uuid
}).strict();

export const PlantResponse = z.object({
  code: z.literal("PLANT_OK"),
  plantedPlots: z.array(z.object({
    plotId: Uuid,
    seedCount: z.number().int().positive(),
    growsAt: IsoDateTime,
    rotsAt: IsoDateTime
  })),
  seedsConsumed: z.number().int().positive()
});

export const HarvestResponse = z.object({
  code: z.literal("HARVEST_OK"),
  harvested: z.array(z.object({
    plotId: Uuid,
    itemDefinitionId: Uuid,
    quality: z.enum(["COMMON", "GOOD", "EXCELLENT", "EXTRAORDINARY", "ROTTEN"]),
    quantity: z.number().int().positive(),
    xpGranted: BigIntString
  })),
  totalXpGranted: BigIntString,
  newLevel: z.number().int().positive(),
  nextHarvestAt: IsoDateTime
});

export const InventoryItemView = z.object({
  id: Uuid,
  itemDefinitionId: Uuid,
  name: z.string(),
  quality: z.enum(["NONE", "COMMON", "GOOD", "EXCELLENT", "EXTRAORDINARY", "ROTTEN"]),
  quantity: z.number().int().nonnegative(),
  reservedQuantity: z.number().int().nonnegative()
});

export const DiscardRequest = z.object({
  quantity: z.number().int().positive()
}).strict();

export const ShopBuyRequest = z.object({
  offerId: Uuid,
  quantity: z.number().int().min(1).max(1000)
}).strict();

export const QuickSellRequest = z.object({
  inventoryItemId: Uuid,
  quantity: z.number().int().positive()
}).strict();

export const QuickSellResponse = z.object({
  code: z.literal("QUICK_SELL_OK"),
  quantitySold: z.number().int().positive(),
  grossValue: BigIntString,
  feeValue: BigIntString,
  payout: BigIntString,
  coinsAfter: BigIntString,
  xpGranted: BigIntString
});

export const ResponseMeta = z.object({
  requestId: z.string(),
  serverTime: IsoDateTime,
  linearizedAt: IsoDateTime.optional()
});
