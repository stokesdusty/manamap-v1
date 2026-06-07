-- DropIndex
DROP INDEX "broadcasts_store_id_created_at_idx";

-- DropIndex
DROP INDEX "notifications_user_id_created_at_idx";

-- CreateIndex
CREATE INDEX "broadcasts_store_id_created_at_idx" ON "broadcasts"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
