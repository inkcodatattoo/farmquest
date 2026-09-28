import { z } from "./zod.js";
import { BigIntString, IsoDateTime, Uuid } from "./common.js";

export const QualityCode = z.enum([
  "NONE",
  "COMMON",
  "GOOD",
  "EXCELLENT",
  "EXTRAORDINARY",
  "ROTTEN"
]);

export const FarmView = z.object({
  id: Uuid,
  level: z.int().positive(),
  xp: BigIntString,
  coins: BigIntString,
  inventorySlots: z.int().positive(),
  stackLimit: z.int().positive(),
  nextHarvestAt: IsoDateTime.nullable(),
  status: z.literal("ACTIVE")
});

export const PlotState = z.enum(["EMPTY", "PLANTED", "READY", "ROTTEN"]);

export const PlotView = z.object({
  id: Uuid,
  slotNumber: z.int().positive(),
  unlocked: z.boolean(),
  seedsCapacity: z.int().positive(),
  state: PlotState,
  planted: z.object({
    cropDefinitionId: Uuid,
    cropName: z.string(),
    seedCount: z.int().positive(),
    plantedAt: IsoDateTime,
    growsAt: IsoDateTime,
    rotsAt: IsoDateTime
  }).nullable()
});

export const PlantBody = z.object({
  cropDefinitionId: Uuid
}).strict();

export const PlantResponse = z.object({
  code: z.literal("PLANT_OK"),
  plantedPlots: z.array(z.object({
    plotId: Uuid,
    seedCount: z.int().positive(),
    growsAt: IsoDateTime,
    rotsAt: IsoDateTime
  })),
  seedsConsumed: z.int().positive()
});

export const HarvestResponse = z.object({
  code: z.literal("HARVEST_OK"),
  harvested: z.array(z.object({
    plotId: Uuid,
    itemDefinitionId: Uuid,
    quality: QualityCode.exclude(["NONE"]),
    quantity: z.int().positive(),
    xpGranted: BigIntString
  })),
  totalXpGranted: BigIntString,
  newLevel: z.int().positive(),
  nextHarvestAt: IsoDateTime
});

export const InventoryItemView = z.object({
  id: Uuid,
  itemDefinitionId: Uuid,
  name: z.string(),
  quality: QualityCode,
  quantity: z.int().nonnegative(),
  reservedQuantity: z.int().nonnegative()
});

export const DiscardBody = z.object({
  quantity: z.int().positive()
}).strict();

export const ShopBuyBody = z.object({
  offerId: Uuid,
  quantity: z.int().min(1).max(1000)
}).strict();

export const QuickSellBody = z.object({
  inventoryItemId: Uuid,
  quantity: z.int().positive()
}).strict();

export const QuickSellResponse = z.object({
  code: z.literal("QUICK_SELL_OK"),
  quantitySold: z.int().positive(),
  grossValue: BigIntString,
  feeValue: BigIntString,
  payout: BigIntString,
  coinsAfter: BigIntString,
  xpGranted: BigIntString
});
