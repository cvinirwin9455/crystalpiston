-- ============================================================
-- RUN THIS in the Supabase SQL editor: "seen by super admin" tracking.
-- Powers the red unread dots and counts on the Super Admin page for
-- Beta Signups and Feedback & Bugs (Inbox already has its own `read` flag).
--   admin_seen_at IS NULL     = the super admin has never opened it (unread)
--   admin_seen_at = timestamp = opened (read)
-- Existing rows are marked as seen once, when the column is first added,
-- so only items that arrive from now on show as unread.
-- Idempotent: safe to run more than once. A re-run never marks new unread
-- items as seen, because the backfill only runs when the column is created.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'beta_signups' AND column_name = 'admin_seen_at'
  ) THEN
    ALTER TABLE beta_signups ADD COLUMN admin_seen_at timestamptz;
    UPDATE beta_signups SET admin_seen_at = now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'feedback' AND column_name = 'admin_seen_at'
  ) THEN
    ALTER TABLE feedback ADD COLUMN admin_seen_at timestamptz;
    UPDATE feedback SET admin_seen_at = now();
  END IF;
END $$;

-- Sanity check: should return 2 rows.
SELECT table_name FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'admin_seen_at'
  AND table_name IN ('beta_signups', 'feedback');
