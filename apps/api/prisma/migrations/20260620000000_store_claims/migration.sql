-- CreateEnum
CREATE TYPE "StoreClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "stores" ADD COLUMN     "claim_code" TEXT;

-- CreateTable
CREATE TABLE "store_claims" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "StoreClaimStatus" NOT NULL DEFAULT 'PENDING',
    "via_code" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "rejection_reason" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "store_claims_store_id_idx" ON "store_claims"("store_id");

-- CreateIndex
CREATE INDEX "store_claims_user_id_idx" ON "store_claims"("user_id");

-- CreateIndex
CREATE INDEX "store_claims_status_idx" ON "store_claims"("status");

-- CreateIndex
CREATE UNIQUE INDEX "stores_claim_code_key" ON "stores"("claim_code");

-- AddForeignKey
ALTER TABLE "store_claims" ADD CONSTRAINT "store_claims_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_claims" ADD CONSTRAINT "store_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_claims" ADD CONSTRAINT "store_claims_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
