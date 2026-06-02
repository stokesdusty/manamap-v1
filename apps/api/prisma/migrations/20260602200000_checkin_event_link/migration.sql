-- AlterTable: add event_id to checkins (nullable FK to events)
ALTER TABLE "checkins" ADD COLUMN "event_id" TEXT;

-- CreateIndex
CREATE INDEX "checkins_event_id_idx" ON "checkins"("event_id");

-- AddForeignKey
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
