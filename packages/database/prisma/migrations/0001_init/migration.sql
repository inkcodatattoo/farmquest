-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "farmquest";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'SUPPORT', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('TWITCH', 'DEV');

-- CreateEnum
CREATE TYPE "StreamerApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "FarmStatus" AS ENUM ('ACTIVE', 'SOLD');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'REMOVED', 'LEFT');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('SEED', 'CROP', 'ANIMAL_PRODUCT', 'FEED', 'REWARD_BOX', 'MISC');

-- CreateEnum
CREATE TYPE "QualityCode" AS ENUM ('NONE', 'COMMON', 'GOOD', 'EXCELLENT', 'EXTRAORDINARY', 'ROTTEN');

-- CreateEnum
CREATE TYPE "ProgressTrack" AS ENUM ('LEVEL_XP', 'COLLECTOR_XP', 'CONTRIBUTION_XP');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'IN_FLIGHT', 'DISPATCHED', 'EXPIRED');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "auth_provider" "AuthProvider" NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streamer" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "twitch_user_id" TEXT NOT NULL,
    "twitch_login" TEXT NOT NULL,
    "approval_status" "StreamerApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "bot_enabled" BOOLEAN NOT NULL DEFAULT false,
    "chat_game_active" BOOLEAN NOT NULL DEFAULT false,
    "approved_at" TIMESTAMPTZ(6),
    "approved_by_user_id" UUID,
    "chat_game_opened_at" TIMESTAMPTZ(6),
    "chat_game_closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "streamer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community" (
    "id" UUID NOT NULL,
    "streamer_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_seller_state" (
    "user_id" UUID NOT NULL,
    "next_listing_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "marketplace_seller_state_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "farm" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "streamer_id" UUID NOT NULL,
    "community_id" UUID NOT NULL,
    "status" "FarmStatus" NOT NULL DEFAULT 'ACTIVE',
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" BIGINT NOT NULL DEFAULT 0,
    "coins" BIGINT NOT NULL DEFAULT 0,
    "inventory_slots" INTEGER NOT NULL,
    "stack_limit" INTEGER NOT NULL,
    "next_harvest_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sold_at" TIMESTAMPTZ(6),

    CONSTRAINT "farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_membership" (
    "farm_id" UUID NOT NULL,
    "community_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMPTZ(6),
    "removed_by_user_id" UUID,
    "readmitted_at" TIMESTAMPTZ(6),

    CONSTRAINT "community_membership_pkey" PRIMARY KEY ("farm_id")
);

-- CreateTable
CREATE TABLE "community_membership_history" (
    "id" BIGSERIAL NOT NULL,
    "farm_id" UUID NOT NULL,
    "community_id" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by_user_id" UUID,
    "reason" TEXT,

    CONSTRAINT "community_membership_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plot" (
    "id" UUID NOT NULL,
    "farm_id" UUID NOT NULL,
    "slot_number" INTEGER NOT NULL,
    "unlocked" BOOLEAN NOT NULL DEFAULT true,
    "seeds_capacity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "plot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_definition" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "has_quality" BOOLEAN NOT NULL DEFAULT false,
    "base_price" BIGINT NOT NULL DEFAULT 0,
    "npc_sellable" BOOLEAN NOT NULL DEFAULT false,
    "p2p_tradeable" BOOLEAN NOT NULL DEFAULT false,
    "discardable" BOOLEAN NOT NULL DEFAULT true,
    "aliases" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "item_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_quality_definition" (
    "id" UUID NOT NULL,
    "code" "QualityCode" NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sell_multiplier_bps" INTEGER NOT NULL,
    "xp_multiplier_bps" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "tractor_weight" INTEGER NOT NULL DEFAULT 0,
    "drawable" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "item_quality_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crop_definition" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seed_item_id" UUID NOT NULL,
    "product_item_id" UUID NOT NULL,
    "yield_per_seed" INTEGER NOT NULL,
    "unlock_level" INTEGER NOT NULL DEFAULT 1,
    "growth_seconds" INTEGER NOT NULL,
    "xp_reward" BIGINT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "crop_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planted_crop" (
    "id" UUID NOT NULL,
    "farm_id" UUID NOT NULL,
    "plot_id" UUID NOT NULL,
    "crop_definition_id" UUID NOT NULL,
    "seed_count" INTEGER NOT NULL,
    "planted_at" TIMESTAMPTZ(6) NOT NULL,
    "grows_at" TIMESTAMPTZ(6) NOT NULL,
    "rots_at" TIMESTAMPTZ(6) NOT NULL,
    "tractor_bonus_applied" BOOLEAN NOT NULL DEFAULT false,
    "harvested_at" TIMESTAMPTZ(6),
    "result_quality_id" UUID,
    "result_quantity" BIGINT,
    "result_contributed" BIGINT,

    CONSTRAINT "planted_crop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_item" (
    "id" UUID NOT NULL,
    "farm_id" UUID NOT NULL,
    "item_definition_id" UUID NOT NULL,
    "quality_id" UUID NOT NULL,
    "quantity" BIGINT NOT NULL DEFAULT 0,
    "reserved_quantity" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "level_definition" (
    "level" INTEGER NOT NULL,
    "xp_required_total" BIGINT NOT NULL,
    "harvest_cooldown_seconds" INTEGER NOT NULL,
    "unlocks" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "level_definition_pkey" PRIMARY KEY ("level")
);

-- CreateTable
CREATE TABLE "action_xp_definition" (
    "id" UUID NOT NULL,
    "action_type" TEXT NOT NULL,
    "per" TEXT NOT NULL,
    "xp_amount" BIGINT NOT NULL,
    "active_from" TIMESTAMPTZ(6) NOT NULL,
    "active_to" TIMESTAMPTZ(6),

    CONSTRAINT "action_xp_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_offer" (
    "id" UUID NOT NULL,
    "item_definition_id" UUID NOT NULL,
    "buy_price" BIGINT NOT NULL,
    "min_level" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "shop_offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_ledger" (
    "id" BIGSERIAL NOT NULL,
    "farm_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "delta" BIGINT NOT NULL,
    "balance_after" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_ledger" (
    "id" BIGSERIAL NOT NULL,
    "farm_id" UUID NOT NULL,
    "item_definition_id" UUID NOT NULL,
    "quality_id" UUID NOT NULL,
    "quantity_delta" BIGINT NOT NULL,
    "reserved_delta" BIGINT NOT NULL,
    "quantity_after" BIGINT NOT NULL,
    "reserved_after" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_ledger" (
    "id" BIGSERIAL NOT NULL,
    "farm_id" UUID NOT NULL,
    "track" "ProgressTrack" NOT NULL,
    "delta" BIGINT NOT NULL,
    "value_after" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_record" (
    "id" BIGSERIAL NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_json" JSONB,
    "linearized_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "idempotency_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_message" (
    "id" BIGSERIAL NOT NULL,
    "topic" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_until" TIMESTAMPTZ(6),
    "dispatched_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "streamer_user_id_key" ON "streamer"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "streamer_twitch_user_id_key" ON "streamer"("twitch_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "community_streamer_id_key" ON "community"("streamer_id");

-- CreateIndex
CREATE UNIQUE INDEX "community_id_streamer_id_key" ON "community"("id", "streamer_id");

-- CreateIndex
CREATE INDEX "farm_user_id_idx" ON "farm"("user_id");

-- CreateIndex
CREATE INDEX "farm_streamer_id_idx" ON "farm"("streamer_id");

-- CreateIndex
CREATE UNIQUE INDEX "farm_id_community_id_key" ON "farm"("id", "community_id");

-- CreateIndex
CREATE UNIQUE INDEX "community_membership_farm_id_community_id_key" ON "community_membership"("farm_id", "community_id");

-- CreateIndex
CREATE INDEX "community_membership_history_farm_id_changed_at_idx" ON "community_membership_history"("farm_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "plot_farm_id_slot_number_key" ON "plot"("farm_id", "slot_number");

-- CreateIndex
CREATE UNIQUE INDEX "item_definition_key_key" ON "item_definition"("key");

-- CreateIndex
CREATE UNIQUE INDEX "item_quality_definition_code_key" ON "item_quality_definition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "crop_definition_key_key" ON "crop_definition"("key");

-- CreateIndex
CREATE INDEX "planted_crop_farm_id_idx" ON "planted_crop"("farm_id");

-- CreateIndex
CREATE INDEX "planted_crop_plot_id_idx" ON "planted_crop"("plot_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_item_farm_id_item_definition_id_quality_id_key" ON "inventory_item"("farm_id", "item_definition_id", "quality_id");

-- CreateIndex
CREATE INDEX "action_xp_definition_action_type_active_from_idx" ON "action_xp_definition"("action_type", "active_from");

-- CreateIndex
CREATE INDEX "coin_ledger_farm_id_id_idx" ON "coin_ledger"("farm_id", "id");

-- CreateIndex
CREATE INDEX "item_ledger_farm_id_item_definition_id_quality_id_id_idx" ON "item_ledger"("farm_id", "item_definition_id", "quality_id", "id");

-- CreateIndex
CREATE INDEX "progress_ledger_farm_id_track_id_idx" ON "progress_ledger"("farm_id", "track", "id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_record_actor_user_id_scope_key_key" ON "idempotency_record"("actor_user_id", "scope", "key");

-- CreateIndex
CREATE INDEX "outbox_message_status_available_at_idx" ON "outbox_message"("status", "available_at");

-- AddForeignKey
ALTER TABLE "streamer" ADD CONSTRAINT "streamer_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "community" ADD CONSTRAINT "community_streamer_id_fkey" FOREIGN KEY ("streamer_id") REFERENCES "streamer"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "marketplace_seller_state" ADD CONSTRAINT "marketplace_seller_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "farm" ADD CONSTRAINT "farm_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "farm" ADD CONSTRAINT "farm_streamer_id_fkey" FOREIGN KEY ("streamer_id") REFERENCES "streamer"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "farm" ADD CONSTRAINT "farm_community_id_streamer_id_fkey" FOREIGN KEY ("community_id", "streamer_id") REFERENCES "community"("id", "streamer_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "community_membership" ADD CONSTRAINT "community_membership_farm_id_community_id_fkey" FOREIGN KEY ("farm_id", "community_id") REFERENCES "farm"("id", "community_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "community_membership" ADD CONSTRAINT "community_membership_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "community"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "community_membership" ADD CONSTRAINT "community_membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "community_membership_history" ADD CONSTRAINT "community_membership_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "plot" ADD CONSTRAINT "plot_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farm"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "crop_definition" ADD CONSTRAINT "crop_definition_seed_item_id_fkey" FOREIGN KEY ("seed_item_id") REFERENCES "item_definition"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "crop_definition" ADD CONSTRAINT "crop_definition_product_item_id_fkey" FOREIGN KEY ("product_item_id") REFERENCES "item_definition"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "planted_crop" ADD CONSTRAINT "planted_crop_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farm"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "planted_crop" ADD CONSTRAINT "planted_crop_plot_id_fkey" FOREIGN KEY ("plot_id") REFERENCES "plot"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "planted_crop" ADD CONSTRAINT "planted_crop_crop_definition_id_fkey" FOREIGN KEY ("crop_definition_id") REFERENCES "crop_definition"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "planted_crop" ADD CONSTRAINT "planted_crop_result_quality_id_fkey" FOREIGN KEY ("result_quality_id") REFERENCES "item_quality_definition"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farm"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_item_definition_id_fkey" FOREIGN KEY ("item_definition_id") REFERENCES "item_definition"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_quality_id_fkey" FOREIGN KEY ("quality_id") REFERENCES "item_quality_definition"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "shop_offer" ADD CONSTRAINT "shop_offer_item_definition_id_fkey" FOREIGN KEY ("item_definition_id") REFERENCES "item_definition"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "coin_ledger" ADD CONSTRAINT "coin_ledger_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farm"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "coin_ledger" ADD CONSTRAINT "coin_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "item_ledger" ADD CONSTRAINT "item_ledger_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farm"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "item_ledger" ADD CONSTRAINT "item_ledger_item_definition_id_fkey" FOREIGN KEY ("item_definition_id") REFERENCES "item_definition"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "item_ledger" ADD CONSTRAINT "item_ledger_quality_id_fkey" FOREIGN KEY ("quality_id") REFERENCES "item_quality_definition"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "progress_ledger" ADD CONSTRAINT "progress_ledger_farm_id_fkey" FOREIGN KEY ("farm_id") REFERENCES "farm"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "idempotency_record" ADD CONSTRAINT "idempotency_record_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ---------------------------------------------------------------------------
-- FarmQuest v1.3.4 hardening not representable directly in Prisma schema.
-- These constraints are normative for Prototype 0.1.
-- ---------------------------------------------------------------------------

-- Exclusion constraints for time-ranged XP definitions.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Missing historical/operator foreign keys intentionally kept in SQL.
ALTER TABLE "streamer"
  ADD CONSTRAINT "streamer_approved_by_user_id_fkey"
  FOREIGN KEY ("approved_by_user_id") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "community_membership"
  ADD CONSTRAINT "community_membership_removed_by_user_id_fkey"
  FOREIGN KEY ("removed_by_user_id") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "community_membership_history"
  ADD CONSTRAINT "community_membership_history_farm_id_fkey"
  FOREIGN KEY ("farm_id") REFERENCES "farm"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "community_membership_history"
  ADD CONSTRAINT "community_membership_history_community_id_fkey"
  FOREIGN KEY ("community_id") REFERENCES "community"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- One active farm per user/streamer while SOLD rows remain historical.
CREATE UNIQUE INDEX "farm_user_streamer_active_uq"
  ON "farm" ("user_id", "streamer_id")
  WHERE "status" <> 'SOLD';

-- One active planting per plot.
CREATE UNIQUE INDEX "planted_crop_active_uq"
  ON "planted_crop" ("plot_id")
  WHERE "harvested_at" IS NULL;

-- Critical economic and temporal checks.
ALTER TABLE "farm"
  ADD CONSTRAINT "farm_xp_nonnegative_ck" CHECK ("xp" >= 0),
  ADD CONSTRAINT "farm_coins_nonnegative_ck" CHECK ("coins" >= 0),
  ADD CONSTRAINT "farm_inventory_slots_positive_ck" CHECK ("inventory_slots" > 0),
  ADD CONSTRAINT "farm_stack_limit_positive_ck" CHECK ("stack_limit" > 0);

ALTER TABLE "plot"
  ADD CONSTRAINT "plot_slot_number_positive_ck" CHECK ("slot_number" > 0),
  ADD CONSTRAINT "plot_seeds_capacity_positive_ck" CHECK ("seeds_capacity" > 0);

ALTER TABLE "item_definition"
  ADD CONSTRAINT "item_definition_base_price_nonnegative_ck" CHECK ("base_price" >= 0);

ALTER TABLE "item_quality_definition"
  ADD CONSTRAINT "quality_sell_multiplier_nonnegative_ck" CHECK ("sell_multiplier_bps" >= 0),
  ADD CONSTRAINT "quality_xp_multiplier_nonnegative_ck" CHECK ("xp_multiplier_bps" >= 0),
  ADD CONSTRAINT "quality_weight_nonnegative_ck" CHECK ("weight" >= 0),
  ADD CONSTRAINT "quality_tractor_weight_nonnegative_ck" CHECK ("tractor_weight" >= 0);

ALTER TABLE "crop_definition"
  ADD CONSTRAINT "crop_yield_positive_ck" CHECK ("yield_per_seed" > 0),
  ADD CONSTRAINT "crop_unlock_level_positive_ck" CHECK ("unlock_level" > 0),
  ADD CONSTRAINT "crop_growth_seconds_positive_ck" CHECK ("growth_seconds" > 0),
  ADD CONSTRAINT "crop_xp_reward_nonnegative_ck" CHECK ("xp_reward" >= 0);

ALTER TABLE "planted_crop"
  ADD CONSTRAINT "planted_crop_seed_count_positive_ck" CHECK ("seed_count" > 0),
  ADD CONSTRAINT "planted_crop_grows_after_plant_ck" CHECK ("grows_at" > "planted_at"),
  ADD CONSTRAINT "planted_crop_rots_after_grows_ck" CHECK ("rots_at" > "grows_at"),
  ADD CONSTRAINT "planted_crop_result_quantity_nonnegative_ck"
    CHECK ("result_quantity" IS NULL OR "result_quantity" >= 0),
  ADD CONSTRAINT "planted_crop_result_contributed_nonnegative_ck"
    CHECK ("result_contributed" IS NULL OR "result_contributed" >= 0);

ALTER TABLE "inventory_item"
  ADD CONSTRAINT "inventory_quantity_nonnegative_ck" CHECK ("quantity" >= 0),
  ADD CONSTRAINT "inventory_reserved_valid_ck"
    CHECK ("reserved_quantity" >= 0 AND "reserved_quantity" <= "quantity");

ALTER TABLE "level_definition"
  ADD CONSTRAINT "level_positive_ck" CHECK ("level" > 0),
  ADD CONSTRAINT "level_xp_nonnegative_ck" CHECK ("xp_required_total" >= 0),
  ADD CONSTRAINT "level_harvest_cooldown_positive_ck" CHECK ("harvest_cooldown_seconds" > 0);

ALTER TABLE "action_xp_definition"
  ADD CONSTRAINT "action_xp_amount_nonnegative_ck" CHECK ("xp_amount" >= 0),
  ADD CONSTRAINT "action_xp_range_valid_ck"
    CHECK ("active_to" IS NULL OR "active_to" > "active_from"),
  ADD CONSTRAINT "action_xp_definition_no_overlap_excl"
    EXCLUDE USING gist (
      "action_type" WITH =,
      tstzrange("active_from", "active_to", '[)') WITH &&
    );

ALTER TABLE "shop_offer"
  ADD CONSTRAINT "shop_offer_buy_price_positive_ck" CHECK ("buy_price" > 0),
  ADD CONSTRAINT "shop_offer_min_level_positive_ck" CHECK ("min_level" > 0);

ALTER TABLE "coin_ledger"
  ADD CONSTRAINT "coin_ledger_delta_nonzero_ck" CHECK ("delta" <> 0),
  ADD CONSTRAINT "coin_ledger_balance_nonnegative_ck" CHECK ("balance_after" >= 0);

ALTER TABLE "item_ledger"
  ADD CONSTRAINT "item_ledger_delta_nonzero_ck"
    CHECK ("quantity_delta" <> 0 OR "reserved_delta" <> 0),
  ADD CONSTRAINT "item_ledger_quantity_after_nonnegative_ck" CHECK ("quantity_after" >= 0),
  ADD CONSTRAINT "item_ledger_reserved_after_valid_ck"
    CHECK ("reserved_after" >= 0 AND "reserved_after" <= "quantity_after");

ALTER TABLE "progress_ledger"
  ADD CONSTRAINT "progress_ledger_delta_nonzero_ck" CHECK ("delta" <> 0),
  ADD CONSTRAINT "progress_ledger_value_after_nonnegative_ck" CHECK ("value_after" >= 0);

ALTER TABLE "outbox_message"
  ADD CONSTRAINT "outbox_attempts_nonnegative_ck" CHECK ("attempts" >= 0),
  ADD CONSTRAINT "outbox_inflight_requires_lease_ck"
    CHECK ("status" <> 'IN_FLIGHT' OR "lease_until" IS NOT NULL);
