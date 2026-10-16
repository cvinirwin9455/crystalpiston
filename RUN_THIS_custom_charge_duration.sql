-- ============================================================
-- RUN THIS in the Supabase SQL editor: custom-charge program length.
-- A custom one-time charge (no saved package) carries its own program length
-- so the created plan spans a real period (and the create-week flow works).
-- Idempotent — safe to run more than once.
-- ============================================================

ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS custom_duration_weeks INTEGER
    CHECK (custom_duration_weeks IS NULL OR custom_duration_weeks > 0);

-- Sanity check: should return 1.
SELECT count(*) AS pr_custom_duration_weeks
FROM information_schema.columns
WHERE table_name = 'payment_requests' AND column_name = 'custom_duration_weeks';
