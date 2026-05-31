-- Reconcile out-of-order index drop: pnpm_db_seed (timestamp 200949) sorts before
-- encounter_source (230000) in shadow DB so its DROP is a no-op there; drop it here instead.
DROP INDEX IF EXISTS "encounters_user_id_store_id_source_idx";

-- Reshape Badge: add code + icon, drop icon_url, make criteria non-null
ALTER TABLE "badges" ADD COLUMN "code" TEXT;
ALTER TABLE "badges" ADD COLUMN "icon" TEXT NOT NULL DEFAULT '🏅';
ALTER TABLE "badges" DROP COLUMN IF EXISTS "icon_url";
-- Backfill code from name for any existing rows
UPDATE "badges" SET "code" = lower(replace("name", ' ', '_')) WHERE "code" IS NULL;
ALTER TABLE "badges" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "badges" ALTER COLUMN "criteria" SET NOT NULL;
ALTER TABLE "badges" ALTER COLUMN "criteria" SET DEFAULT '{}';
UPDATE "badges" SET "criteria" = '{}' WHERE "criteria" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "badges_code_key" ON "badges"("code");

-- UserBadge: add storeId
ALTER TABLE "user_badges" ADD COLUMN IF NOT EXISTS "store_id" TEXT;
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Streak: drop old columns, add new per-store structure
ALTER TABLE "streaks" DROP CONSTRAINT IF EXISTS "streaks_user_id_type_key";
ALTER TABLE "streaks" DROP COLUMN IF EXISTS "type";
ALTER TABLE "streaks" DROP COLUMN IF EXISTS "current_count";
ALTER TABLE "streaks" DROP COLUMN IF EXISTS "longest_count";
ALTER TABLE "streaks" DROP COLUMN IF EXISTS "last_activity_at";
ALTER TABLE "streaks" ADD COLUMN IF NOT EXISTS "store_id" TEXT;
ALTER TABLE "streaks" ADD COLUMN IF NOT EXISTS "current_streak" INT NOT NULL DEFAULT 1;
ALTER TABLE "streaks" ADD COLUMN IF NOT EXISTS "longest_streak" INT NOT NULL DEFAULT 1;
ALTER TABLE "streaks" ADD COLUMN IF NOT EXISTS "total_checkins" INT NOT NULL DEFAULT 1;
ALTER TABLE "streaks" ADD COLUMN IF NOT EXISTS "last_checkin_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
-- Drop any existing rows without a store (can't backfill meaningfully)
DELETE FROM "streaks" WHERE "store_id" IS NULL;
ALTER TABLE "streaks" ALTER COLUMN "store_id" SET NOT NULL;
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_store_id_fkey"
  FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "streaks_user_id_store_id_key" ON "streaks"("user_id", "store_id");

-- Drop StreakType enum (no longer used)
DROP TYPE IF EXISTS "StreakType";
