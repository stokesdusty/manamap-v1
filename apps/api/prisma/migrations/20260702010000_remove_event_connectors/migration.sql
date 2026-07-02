-- Discord/Wizards event connectors were stubs that never fetched real events;
-- no "events" row has ever had source DISCORD or WIZARDS. Drop them from the enum.
CREATE TYPE "EventSource_new" AS ENUM ('STORE');
ALTER TABLE "events" ALTER COLUMN "source" DROP DEFAULT;
ALTER TABLE "events" ALTER COLUMN "source" TYPE "EventSource_new" USING ("source"::text::"EventSource_new");
ALTER TABLE "events" ALTER COLUMN "source" SET DEFAULT 'STORE';
DROP TYPE "EventSource";
ALTER TYPE "EventSource_new" RENAME TO "EventSource";
