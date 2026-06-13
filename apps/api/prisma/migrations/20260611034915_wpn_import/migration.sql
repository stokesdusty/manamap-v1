-- DropForeignKey
ALTER TABLE "store_confirmations" DROP CONSTRAINT "store_confirmations_store_id_fkey";

-- DropForeignKey
ALTER TABLE "store_confirmations" DROP CONSTRAINT "store_confirmations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "stores" DROP CONSTRAINT "stores_submitted_by_id_fkey";

-- AlterTable
ALTER TABLE "store_confirmations" ALTER COLUMN "confirmed_at" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_confirmations" ADD CONSTRAINT "store_confirmations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_confirmations" ADD CONSTRAINT "store_confirmations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
