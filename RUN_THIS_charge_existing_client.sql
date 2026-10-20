-- ============================================================
-- RUN THIS in the Supabase SQL editor: charge an existing client via Stripe.
-- A payment request can now target an existing client (renewal / next package)
-- instead of a new application. Idempotent — safe to run more than once.
-- ============================================================

ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_requests_client ON payment_requests (client_id);

-- Sanity check: should return 1.
SELECT count(*) AS pr_client_id
FROM information_schema.columns
WHERE table_name = 'payment_requests' AND column_name = 'client_id';
