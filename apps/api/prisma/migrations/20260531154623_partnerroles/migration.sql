-- AlterTable
ALTER TABLE "reward_offers" ALTER COLUMN "redemption_code" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "store_ownerships" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);
