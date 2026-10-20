-- ============================================================
-- RUN THIS in the Supabase SQL editor: monthly package pricing method.
-- ------------------------------------------------------------
-- Lets a MONTHLY package record HOW the coach set the per-month price:
--   'direct' = coach typed the monthly amount directly (existing behavior)
--   'split'  = coach entered a program TOTAL; the system split it evenly
--              across the program's months (exact split; the final month
--              absorbs any rounding remainder so the total matches).
--
-- For a monthly package, billing stops at the end of the program:
-- recur_months is auto-derived from duration_weeks (~round(weeks/4), min 1)
-- rather than typed by hand.
--
-- No effect on one-time packages. Defaults to 'direct' so existing monthly
-- packages are unchanged.
-- Idempotent — safe to run more than once.
-- ============================================================

ALTER TABLE public.coach_packages
  ADD COLUMN IF NOT EXISTS monthly_pricing_mode text
    DEFAULT 'direct'
    CHECK (monthly_pricing_mode IN ('direct', 'split'));

-- Backfill any existing rows that predate the column (defensive; the DEFAULT
-- already covers new rows and the ADD COLUMN above).
UPDATE public.coach_packages
  SET monthly_pricing_mode = 'direct'
  WHERE monthly_pricing_mode IS NULL;

-- Sanity check: should return 1.
SELECT count(*) AS pkg_monthly_pricing_mode
FROM information_schema.columns
WHERE table_name = 'coach_packages' AND column_name = 'monthly_pricing_mode';
