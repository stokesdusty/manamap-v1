-- CreateEnum
CREATE TYPE "BroadcastAudience" AS ENUM ('CHECKED_IN_NOW', 'TODAY', 'EVENT_RSVPS', 'RECENT_30D');

-- AlterTable: store broadcast opt-out
ALTER TABLE "privacy_settings" ADD COLUMN "store_messages" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "broadcasts" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "sent_by_id" TEXT NOT NULL,
    "audience" "BroadcastAudience" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "event_id" TEXT,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broadcasts_store_id_created_at_idx" ON "broadcasts"("store_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_sent_by_id_fkey"
    FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
