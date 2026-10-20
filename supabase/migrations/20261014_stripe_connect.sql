-- ============================================================
-- Stripe Connect (Stripe Payments — Step B)
-- ============================================================
-- Each coach connects their OWN full Stripe account via Stripe Connect
-- (Standard — the coach owns the account, dashboard, support, refunds and
-- disputes; First Mile takes no fee and bears no financial liability).
-- Payments go directly to the coach's connected account. We store the
-- connected account id + onboarding status on the coach's `users` row (a coach
-- IS an auth identity — see coach_packages notes).
--
--   stripe_account_id         : the connected Standard account id (acct_...)
--   stripe_charges_enabled    : Stripe says this account can accept charges
--   stripe_details_submitted  : coach finished the Stripe onboarding
--   stripe_payouts_enabled    : Stripe says payouts to the coach are enabled
--   stripe_connected_at        : when the account was first connected/linked
--   stripe_oauth_state         : short-lived CSRF/identity token for the OAuth
--                                connect flow (cleared once the callback runs)
--
-- Connection uses Stripe Connect OAuth: a coach who already has a Stripe
-- account signs in and authorizes First Mile; a coach without one can create
-- one in the same flow. Either way the coach owns a full Standard account.
--
-- A coach is "ready to accept payments" when charges_enabled is true.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_account_id        TEXT,
  ADD COLUMN IF NOT EXISTS stripe_charges_enabled   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_details_submitted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_payouts_enabled   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connected_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_oauth_state       TEXT;

-- Quick lookup of a coach by their Stripe account id (used by webhooks in a
-- later step to find the coach when Stripe sends account.updated events).
CREATE INDEX IF NOT EXISTS idx_users_stripe_account
  ON users (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

-- Lookup a coach by the pending OAuth state during the connect callback.
CREATE INDEX IF NOT EXISTS idx_users_stripe_oauth_state
  ON users (stripe_oauth_state)
  WHERE stripe_oauth_state IS NOT NULL;

COMMENT ON COLUMN users.stripe_account_id IS 'Stripe Connect (Standard) connected account id for this coach (acct_...). NULL = not connected.';
COMMENT ON COLUMN users.stripe_charges_enabled IS 'Stripe reports this connected account can accept charges — coach is ready to be paid.';
COMMENT ON COLUMN users.stripe_details_submitted IS 'Coach has submitted all required onboarding details to Stripe.';
COMMENT ON COLUMN users.stripe_payouts_enabled IS 'Stripe reports payouts to the coach are enabled.';
COMMENT ON COLUMN users.stripe_connected_at IS 'When the coach first connected their Stripe account.';
COMMENT ON COLUMN users.stripe_oauth_state IS 'Short-lived random token to validate the Stripe Connect OAuth callback (CSRF protection). Cleared after use.';
