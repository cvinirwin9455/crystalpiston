-- ============================================================
-- Session package status: active vs closed
-- ------------------------------------------------------------
-- Lets a coach "close out" a client's unused in-person sessions
-- when completing a per-session / hybrid plan. Closed packages
-- no longer count toward the client's remaining balance, but the
-- row is kept for history and can be reopened later (e.g. on
-- renewal) by setting status back to 'active'.
--
-- Safe to run multiple times.
-- ============================================================

-- 1. Add the status column (defaults to 'active' so all existing
--    packages keep counting exactly as before).
ALTER TABLE public.session_packages
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Constrain to known values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'session_packages_status_check'
  ) THEN
    ALTER TABLE public.session_packages
      ADD CONSTRAINT session_packages_status_check
      CHECK (status IN ('active', 'closed'));
  END IF;
END$$;

-- 2. Rebuild the balance view so only ACTIVE packages count toward
--    purchased sessions and paid totals. Used-session counting is
--    unchanged.
CREATE OR REPLACE VIEW public.client_session_balances AS
SELECT
  c.id AS client_id,
  c.user_id,
  COALESCE(pkg.total_purchased, 0) AS total_purchased,
  COALESCE(used.total_used, 0) AS total_used,
  COALESCE(pkg.total_purchased, 0) - COALESCE(used.total_used, 0) AS sessions_remaining,
  COALESCE(pkg.total_paid, 0) AS total_paid
FROM public.clients c
LEFT JOIN (
  SELECT client_id,
    SUM(sessions_purchased) AS total_purchased,
    SUM(amount_paid) AS total_paid
  FROM public.session_packages
  WHERE status = 'active'
  GROUP BY client_id
) pkg ON pkg.client_id = c.id
LEFT JOIN (
  SELECT client_id, COUNT(*) AS total_used
  FROM public.sessions
  WHERE status IN ('completed', 'cancelled_charged', 'no_show')
  GROUP BY client_id
) used ON used.client_id = c.id;
