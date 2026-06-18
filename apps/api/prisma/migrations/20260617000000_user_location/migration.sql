-- User last-known location, updated on every presence heartbeat.
-- Used to populate the Stores map without waiting for a GPS fix and to
-- power location-based nearby discovery when the user is not checked in.
ALTER TABLE "users" ADD COLUMN "last_lat"        DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "last_lng"        DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "last_located_at" TIMESTAMP(3);
