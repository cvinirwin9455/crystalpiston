-- ============================================================
-- Stripe Connect (Stripe Payments — Step B)
-- ============================================================
-- Each coach connects their OWN Stripe account via Stripe Connect (Express).
-- Payments go directly to the coach's connected account (no First Mile
-- platform fee). We store the connected account id + onboarding status on the
-- coach's `users` row (a coach IS an auth identity — see coach_packages notes).
--
--   stripe_account_id         : the connected Express account id (acct_...)
--   stripe_charges_enabled    : Stripe says this account can accept charges
--   stripe_details_submitted  : coach finished the Stripe onboarding form
--   stripe_payouts_enabled    : Stripe says payouts to the coach are enabled
--   stripe_connected_at        : when the account was first created/linked
--
-- A coach is "ready to accept payments" when charges_enabled is true.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_account_id        TEXT,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_details_submitted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connected_at      TIMESTAMPTZ;

-- Quick lookup of a coach by their Stripe account id (used by webhooks in a
-- later step to find the coach when Stripe sends account.updated events).
CREATE INDEX IF NOT EXISTS idx_users_stripe_account
  ON users (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

COMMENT ON COLUMN users.stripe_account_id IS 'Stripe Connect (Express) connected account id for this coach (acct_...). NULL = not connected.';
COMMENT ON COLUMN users.stripe_charges_enabled IS 'Stripe reports this connected account can accept charges — coach is ready to be paid.';
COMMENT ON COLUMN users.stripe_details_submitted IS 'Coach has submitted all required onboarding details to Stripe.';
COMMENT ON COLUMN users.stripe_payouts_enabled IS 'Stripe reports payouts to the coach are enabled.';
COMMENT ON COLUMN users.stripe_connected_at IS 'When the coach first created/linked their Stripe Connect account.';
