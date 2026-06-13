CREATE TYPE "StoreStatus" AS ENUM ('PROPOSED', 'ACTIVE', 'REJECTED');

ALTER TABLE "stores"
  ADD COLUMN "status"          "StoreStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "submitted_by_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN "submitter_note"  TEXT;

CREATE TABLE "store_confirmations" (
  "id"           TEXT        NOT NULL PRIMARY KEY,
  "store_id"     TEXT        NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "user_id"      TEXT        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "proximity"    BOOLEAN     NOT NULL DEFAULT false,
  "confirmed_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("store_id", "user_id")
);
