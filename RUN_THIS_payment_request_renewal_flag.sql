-- ============================================================
-- RUN THIS in the Supabase SQL editor: renewal flag on a payment request.
-- Lets the pay page + emails use "continue your coaching" wording for a client
-- who already has prior plans, vs. "set up your account" for a first-time
-- (manually created) client's first package. Idempotent.
-- ============================================================

ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS is_renewal BOOLEAN NOT NULL DEFAULT false;

-- Sanity check: should return 1.
SELECT count(*) AS pr_is_renewal
FROM information_schema.columns
WHERE table_name = 'payment_requests' AND column_name = 'is_renewal';
