ALTER TABLE "stores" ADD COLUMN "wpn_id" TEXT;
CREATE UNIQUE INDEX "stores_wpn_id_key" ON "stores"("wpn_id");
