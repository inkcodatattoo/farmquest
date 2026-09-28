import { z } from "zod";

export const Uuid = z.string().uuid();
export const BigIntString = z.string().regex(/^(0|[1-9]\d*)$/);
export const PositiveBigIntString = z.string().regex(/^[1-9]\d*$/);
export const IsoDateTime = z.string().datetime({ offset: true });
export const IdempotencyKey = z.string().min(16).max(128);
export const RequestId = z.string().min(8).max(128);

export const DomainErrorCode = z.enum([
  "FARM_LIMIT_REACHED",
  "FARM_NOT_FOUND",
  "FARM_SOLD",
  "FARM_ACCESS_REMOVED",
  "FARM_STREAMER_SUSPENDED",
  "USER_BANNED",
  "UNKNOWN_CROP",
  "CROP_LOCKED_BY_LEVEL",
  "NOT_ENOUGH_SEEDS",
  "NO_EMPTY_PLOTS",
  "PLOT_NOT_READY",
  "PLOT_ALREADY_HARVESTED",
  "NOTHING_TO_HARVEST",
  "HARVEST_COOLDOWN_ACTIVE",
  "INSUFFICIENT_COINS",
  "INVENTORY_INSUFFICIENT",
  "INVENTORY_FULL",
  "ITEM_ROTTEN",
  "ITEM_NOT_SELLABLE",
  "CSRF_INVALID",
  "RATE_LIMITED",
  "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
  "PENDING_PRODUCT_DECISION"
]);

export type DomainErrorCode = z.infer<typeof DomainErrorCode>;
