-- ============================================================
-- RUN THIS in the Supabase SQL editor for Stripe Payments (Steps B + C).
-- Idempotent — safe to run more than once.
-- ============================================================

-- === Step B: Stripe Connect columns on users (if not already run) ===
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_account_id        TEXT,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_details_submitted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connected_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_oauth_state       TEXT;

CREATE INDEX IF NOT EXISTS idx_users_stripe_account
  ON users (stripe_account_id) WHERE stripe_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_stripe_oauth_state
  ON users (stripe_oauth_state) WHERE stripe_oauth_state IS NOT NULL;

-- === Step C: payment_requests table ===
CREATE TABLE IF NOT EXISTS payment_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id   UUID REFERENCES organizations(id) ON DELETE SET NULL,
  application_id    UUID REFERENCES coach_applications(id) ON DELETE SET NULL,
  package_id        UUID REFERENCES coach_packages(id) ON DELETE SET NULL,
  amount_cents      INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency          TEXT NOT NULL DEFAULT 'usd',
  billing_interval  TEXT NOT NULL DEFAULT 'one_time'
                      CHECK (billing_interval IN ('monthly', 'one_time')),
  package_name      TEXT,
  client_email      TEXT NOT NULL,
  client_name       TEXT,
  token             TEXT NOT NULL UNIQUE,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'paid', 'cancelled', 'expired')),
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id   TEXT,
  paid_at           TIMESTAMPTZ,
  provisioned_user_id UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_coach   ON payment_requests (coach_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_token   ON payment_requests (token);
CREATE INDEX IF NOT EXISTS idx_payment_requests_app     ON payment_requests (application_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_session ON payment_requests (stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status  ON payment_requests (coach_id, status);

DROP TRIGGER IF EXISTS trg_payment_requests_updated_at ON payment_requests;
CREATE TRIGGER trg_payment_requests_updated_at
  BEFORE UPDATE ON payment_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_requests_select_own ON payment_requests;
CREATE POLICY payment_requests_select_own ON payment_requests
  FOR SELECT USING (coach_id = auth.uid());
DROP POLICY IF EXISTS payment_requests_insert_own ON payment_requests;
CREATE POLICY payment_requests_insert_own ON payment_requests
  FOR INSERT WITH CHECK (coach_id = auth.uid());
DROP POLICY IF EXISTS payment_requests_update_own ON payment_requests;
CREATE POLICY payment_requests_update_own ON payment_requests
  FOR UPDATE USING (coach_id = auth.uid());
DROP POLICY IF EXISTS payment_requests_delete_own ON payment_requests;
CREATE POLICY payment_requests_delete_own ON payment_requests
  FOR DELETE USING (coach_id = auth.uid());
