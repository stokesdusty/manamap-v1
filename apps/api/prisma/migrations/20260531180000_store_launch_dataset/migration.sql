-- AlterTable: add timezone, website, and is_partner columns to stores
ALTER TABLE "stores" ADD COLUMN "timezone" TEXT;
ALTER TABLE "stores" ADD COLUMN "website" TEXT;
ALTER TABLE "stores" ADD COLUMN "is_partner" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: natural key for idempotent upsert — (name, city)
-- NULLs are distinct in Postgres, so city must be non-null for the constraint to fire.
-- All seeded stores and partner-claimed stores are expected to have a city.
CREATE UNIQUE INDEX "stores_name_city_key" ON "stores"("name", "city");
