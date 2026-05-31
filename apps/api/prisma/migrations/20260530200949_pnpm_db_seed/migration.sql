-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_format_id_fkey";

-- DropIndex
DROP INDEX "encounters_user_id_store_id_source_idx";

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_format_id_fkey" FOREIGN KEY ("format_id") REFERENCES "formats"("id") ON DELETE SET NULL ON UPDATE CASCADE;
