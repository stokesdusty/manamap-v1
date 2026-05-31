-- Add UserRole enum
CREATE TYPE "UserRole" AS ENUM ('USER', 'PARTNER', 'ADMIN');

-- Add OfferType enum
CREATE TYPE "OfferType" AS ENUM ('FIRST_VISIT', 'STREAK');

-- Add role column to users
ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

-- Create store_ownerships table
CREATE TABLE "store_ownerships" (
  "id"         TEXT        NOT NULL,
  "user_id"    TEXT        NOT NULL,
  "store_id"   TEXT        NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "store_ownerships_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "store_ownerships_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "store_ownerships_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "store_ownerships_user_id_store_id_key"
  ON "store_ownerships"("user_id", "store_id");

-- Extend reward_offers: new columns
ALTER TABLE "reward_offers"
  ADD COLUMN "type"           "OfferType" NOT NULL DEFAULT 'FIRST_VISIT',
  ADD COLUMN "terms"          TEXT,
  ADD COLUMN "redemption_code" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "active"         BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "streak_required" INT,
  ADD COLUMN "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Make starts_at nullable
ALTER TABLE "reward_offers" ALTER COLUMN "starts_at" DROP NOT NULL;

-- Back-fill redemption codes for any pre-existing rows
UPDATE "reward_offers"
  SET "redemption_code" = upper(left(replace(gen_random_uuid()::text, '-', ''), 8))
  WHERE "redemption_code" = '';

-- Unique index on redemption_code
CREATE UNIQUE INDEX "reward_offers_redemption_code_key"
  ON "reward_offers"("redemption_code");

-- Re-create the reward_offers→stores FK with ON DELETE CASCADE
ALTER TABLE "reward_offers"
  DROP CONSTRAINT IF EXISTS "reward_offers_store_id_fkey";
ALTER TABLE "reward_offers"
  ADD CONSTRAINT "reward_offers_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
