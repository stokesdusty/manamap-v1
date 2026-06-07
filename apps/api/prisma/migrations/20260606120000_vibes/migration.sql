ALTER TABLE "users" ADD COLUMN "vibes" TEXT[] NOT NULL DEFAULT '{}';
UPDATE "users" SET "vibes" = ARRAY["vibe"] WHERE "vibe" IS NOT NULL;
ALTER TABLE "users" DROP COLUMN "vibe";
