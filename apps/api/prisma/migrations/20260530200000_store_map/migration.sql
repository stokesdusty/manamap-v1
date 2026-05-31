-- AlterTable stores: add Discord community URL
ALTER TABLE "stores" ADD COLUMN "discord_url" TEXT;

-- AlterTable users: add home store FK
ALTER TABLE "users" ADD COLUMN "home_store_id" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_home_store_id_fkey"
  FOREIGN KEY ("home_store_id") REFERENCES "stores"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
