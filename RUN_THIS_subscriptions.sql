-- ============================================================
-- Monthly subscriptions (recurring Stripe billing)
-- ------------------------------------------------------------
-- Adds the state we need to run recurring monthly coaching:
--   * payment_requests.recur_months        -> how many months to bill, or
--                                             NULL = until the coach cancels
--   * payment_requests.stripe_subscription_id
--   * plans.stripe_subscription_id         -> the live Stripe subscription
--   * plans.stripe_customer_id             -> the Stripe customer (connected acct)
--   * plans.subscription_status            -> active | past_due | canceled | ...
--   * plans.subscription_cancel_at         -> when it's scheduled to stop (N months)
--
-- Subscriptions are DIRECT on the coach's connected account (same as the
-- one-time charges), so customer + subscription ids live on the connected
-- account, not the platform.
--
-- Safe to run multiple times.
-- ============================================================

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS recur_months integer,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS subscription_cancel_at timestamptz;

-- Look plans up quickly by their Stripe subscription id (webhook handlers).
CREATE INDEX IF NOT EXISTS idx_plans_stripe_subscription_id
  ON public.plans(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_payment_requests_stripe_subscription_id
  ON public.payment_requests(stripe_subscription_id);
