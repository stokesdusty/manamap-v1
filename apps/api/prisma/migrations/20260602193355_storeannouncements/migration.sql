-- DropIndex
DROP INDEX "broadcasts_store_id_created_at_idx";

-- CreateIndex
CREATE INDEX "broadcasts_store_id_created_at_idx" ON "broadcasts"("store_id", "created_at");
