-- ============================================================
-- Payment Requests (Stripe Payments — Step C)
-- ============================================================
-- A payment request is created when a coach asks an applicant to pay for a
-- package. The applicant pays via a First Mile checkout page using Stripe
-- Checkout ON THE COACH'S CONNECTED ACCOUNT (direct charge, no platform fee).
-- On successful payment, the client's First Mile account is auto-provisioned
-- (Option A: account created/activated only after payment).
--
-- Flow:
--   coach reviews application -> creates payment_request (status 'pending')
--   client opens /pay/<token> -> Stripe Checkout session created
--   client pays -> webhook/success marks 'paid' + provisions the account
--   client cancels/fails -> stays 'pending' (account not created)
--
-- Keyed on coach_id (a coach IS an auth identity) + the application + package.
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id   UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- What's being paid for.
  application_id    UUID REFERENCES coach_applications(id) ON DELETE SET NULL,
  package_id        UUID REFERENCES coach_packages(id) ON DELETE SET NULL,

  -- Snapshot of the charge details at request time (so later package edits
  -- don't change what the client was asked to pay).
  amount_cents      INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency          TEXT NOT NULL DEFAULT 'usd',
  billing_interval  TEXT NOT NULL DEFAULT 'one_time'
                      CHECK (billing_interval IN ('monthly', 'one_time')),
  package_name      TEXT,

  -- Who's paying (copied from the application for the checkout page / receipt).
  client_email      TEXT NOT NULL,
  client_name       TEXT,

  -- Opaque public token used in the /pay/<token> URL (unguessable).
  token             TEXT NOT NULL UNIQUE,

  -- Lifecycle: pending -> paid (or cancelled/expired). Account is provisioned
  -- only when status becomes 'paid'.
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'paid', 'cancelled', 'expired')),

  -- Stripe references (on the coach's connected account).
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id   TEXT,

  -- Set when payment succeeds.
  paid_at           TIMESTAMPTZ,
  -- The provisioned client's auth user id (set on payment success).
  provisioned_user_id UUID,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_coach   ON payment_requests (coach_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_token   ON payment_requests (token);
CREATE INDEX IF NOT EXISTS idx_payment_requests_app     ON payment_requests (application_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_session ON payment_requests (stripe_checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status  ON payment_requests (coach_id, status);

-- Keep updated_at fresh (reuses the shared trigger function).
DROP TRIGGER IF EXISTS trg_payment_requests_updated_at ON payment_requests;
CREATE TRIGGER trg_payment_requests_updated_at
  BEFORE UPDATE ON payment_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: coaches manage their own payment requests. The public checkout page and
-- the Stripe webhook both use the service-role client (which bypasses RLS), so
-- there is NO public SELECT policy — the token lookup is done server-side only.
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
