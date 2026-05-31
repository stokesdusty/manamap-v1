-- DropForeignKey
ALTER TABLE "streaks" DROP CONSTRAINT "streaks_store_id_fkey";

-- AlterTable
ALTER TABLE "badges" ALTER COLUMN "criteria" DROP DEFAULT;

-- AlterTable
ALTER TABLE "streaks" ALTER COLUMN "last_checkin_at" DROP DEFAULT,
ALTER COLUMN "last_checkin_at" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
