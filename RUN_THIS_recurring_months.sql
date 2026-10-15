-- ============================================================
-- RUN THIS in the Supabase SQL editor: recurring package duration.
-- Adds "number of months to bill" to a recurring (monthly) package.
--   NULL  = bill until cancelled (open-ended)
--   N (>0) = bill for N months, then auto-cancel the subscription
-- Idempotent — safe to run more than once.
-- ============================================================

ALTER TABLE coach_packages
  ADD COLUMN IF NOT EXISTS recur_months INTEGER
    CHECK (recur_months IS NULL OR recur_months > 0);

-- Sanity check: should return 1.
SELECT count(*) AS pkg_recur_months
FROM information_schema.columns
WHERE table_name = 'coach_packages' AND column_name = 'recur_months';
