-- ============================================================
-- RUN THIS in the Supabase SQL editor:
--   * Birth month/year on applications (age is still derived + stored).
--   * Program start date carried on a payment request (coach sets it when
--     requesting payment; it becomes the plan's start_date on payment).
-- Idempotent — safe to run more than once.
-- ============================================================

-- Applications: store the birth month (1-12) + year the applicant entered.
ALTER TABLE coach_applications
  ADD COLUMN IF NOT EXISTS birth_month INTEGER CHECK (birth_month IS NULL OR (birth_month BETWEEN 1 AND 12)),
  ADD COLUMN IF NOT EXISTS birth_year  INTEGER CHECK (birth_year IS NULL OR (birth_year BETWEEN 1900 AND 2100));

-- Payment requests: the coach-chosen program start date (Option A — set when
-- requesting payment, flows onto the client's plan as start_date on payment),
-- plus the setup choices to apply when the client pays.
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS request_assessment BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS request_cycle_tracking BOOLEAN NOT NULL DEFAULT false;

-- Sanity check: all should return 1.
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_name='coach_applications' AND column_name='birth_month') AS app_birth_month,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='coach_applications' AND column_name='birth_year')  AS app_birth_year,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='payment_requests'   AND column_name='start_date')  AS pr_start_date;
