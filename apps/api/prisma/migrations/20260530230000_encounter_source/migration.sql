-- CreateEnum
CREATE TYPE "EncounterSource" AS ENUM ('PRESENCE', 'CONNECTION', 'GAME');

-- AlterTable: add source column to encounters (existing rows default to GAME)
ALTER TABLE "encounters"
  ADD COLUMN "source" "EncounterSource" NOT NULL DEFAULT 'GAME';

-- CreateIndex: speeds up deduplication query (userId, storeId, source, date)
CREATE INDEX "encounters_user_id_store_id_source_idx"
  ON "encounters"("user_id", "store_id", "source");
