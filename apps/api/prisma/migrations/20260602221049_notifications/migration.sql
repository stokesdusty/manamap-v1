-- Reconcile out-of-order index rebuild: this migration (221049) sorts between
-- storeannouncements (193355) and broadcast (300000), so the broadcasts table
-- may not exist yet in the shadow DB. Notifications table may also not exist yet
-- (it's created in 20260603200000). Guard both with table-existence checks.
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'broadcasts'
  ) THEN
    DROP INDEX IF EXISTS "broadcasts_store_id_created_at_idx";
    CREATE INDEX IF NOT EXISTS "broadcasts_store_id_created_at_idx"
      ON "broadcasts"("store_id", "created_at");
  END IF;

  IF EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    DROP INDEX IF EXISTS "notifications_user_id_created_at_idx";
    CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx"
      ON "notifications"("user_id", "created_at");
  END IF;
END $$;
