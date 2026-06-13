-- Reconcile out-of-order index rebuild: storeannouncements (193355) sorts before
-- broadcast (300000) in shadow DB, so broadcasts table doesn't exist here yet.
-- Guard with a table-existence check; on real DB the table exists and the swap runs normally.
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'broadcasts'
  ) THEN
    DROP INDEX IF EXISTS "broadcasts_store_id_created_at_idx";
    CREATE INDEX IF NOT EXISTS "broadcasts_store_id_created_at_idx"
      ON "broadcasts"("store_id", "created_at");
  END IF;
END $$;
