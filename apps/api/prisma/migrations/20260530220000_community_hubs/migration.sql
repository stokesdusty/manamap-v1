-- CreateEnum
CREATE TYPE "EventSource" AS ENUM ('STORE', 'DISCORD', 'WIZARDS');

-- AlterTable: make format_id nullable on events
ALTER TABLE "events" ALTER COLUMN "format_id" DROP NOT NULL;

-- AlterTable: add new columns to events
ALTER TABLE "events"
  ADD COLUMN "source"            "EventSource" NOT NULL DEFAULT 'STORE',
  ADD COLUMN "description"       TEXT,
  ADD COLUMN "url"               TEXT,
  ADD COLUMN "external_id"       TEXT,
  ADD COLUMN "event_channel_url" TEXT;

-- CreateTable: event_attendees
CREATE TABLE "event_attendees" (
  "id"       TEXT NOT NULL,
  "user_id"  TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "rsvp_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_attendees_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "event_attendees"
  ADD CONSTRAINT "event_attendees_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_attendees"
  ADD CONSTRAINT "event_attendees_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "event_attendees_user_id_event_id_key"
  ON "event_attendees"("user_id", "event_id");
