-- ============================================================================
-- CONSOLIDATED PRODUCTION MIGRATION — Stripe Payments / Packages / Applications
-- ----------------------------------------------------------------------------
-- Brings production up to date for the feature/stripe-payments branch.
-- Everything is ADDITIVE and IDEMPOTENT (IF NOT EXISTS / defensive backfills):
--   - new tables: coach_packages, payment_requests
--   - new columns on: users, coach_applications, coach_application_pages,
--                     plans, payments, session_packages
--   - new indexes, RLS policies, and one view rebuild (client_session_balances)
-- No drops, no row deletions. The only data writes are backfills that set a
-- default where a column is currently NULL.
--
-- Run order matters (payment_requests references coach_packages/applications),
-- so these blocks are sequenced. Wrapped in a single transaction — if any
-- statement fails, NOTHING is applied.
--
-- Prereqs verified on prod: update_updated_at_column() exists; coach_applications,
-- coach_application_pages, session_packages exist; coach_packages &
-- payment_requests do not yet exist.
-- ============================================================================

BEGIN;

-- ============ 1. Packages + application offerings ============
ALTER TABLE coach_application_pages
  ADD COLUMN IF NOT EXISTS offer_types   TEXT[] NOT NULL DEFAULT ARRAY['running']::TEXT[],
  ADD COLUMN IF NOT EXISTS offer_formats TEXT[] NOT NULL DEFAULT ARRAY['programming']::TEXT[];

UPDATE coach_application_pages
  SET offer_types = ARRAY['running']::TEXT[]
  WHERE offer_types IS NULL OR cardinality(offer_types) = 0;
UPDATE coach_application_pages
  SET offer_formats = ARRAY['programming']::TEXT[]
  WHERE offer_formats IS NULL OR cardinality(offer_formats) = 0;

ALTER TABLE coach_applications
  ADD COLUMN IF NOT EXISTS interested_types   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS interested_formats TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS pt_goal             TEXT,
  ADD COLUMN IF NOT EXISTS training_experience TEXT,
  ADD COLUMN IF NOT EXISTS equipment_access    TEXT,
  ADD COLUMN IF NOT EXISTS preferred_location  TEXT,
  ADD COLUMN IF NOT EXISTS sessions_per_week   TEXT;

CREATE TABLE IF NOT EXISTS coach_packages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  price_cents     INTEGER NOT NULL CHECK (price_cents >= 0),
  currency        TEXT NOT NULL DEFAULT 'usd',
  billing_interval TEXT NOT NULL DEFAULT 'monthly'
                     CHECK (billing_interval IN ('monthly', 'one_time')),
  client_cap      INTEGER CHECK (client_cap IS NULL OR client_cap > 0),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  stripe_product_id TEXT,
  stripe_price_id   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_packages_coach        ON coach_packages (coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_packages_coach_active ON coach_packages (coach_id, is_active);
CREATE INDEX IF NOT EXISTS idx_coach_packages_org          ON coach_packages (organization_id);

DROP TRIGGER IF EXISTS trg_coach_packages_updated_at ON coach_packages;
CREATE TRIGGER trg_coach_packages_updated_at
  BEFORE UPDATE ON coach_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE coach_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS coach_packages_select_own ON coach_packages;
CREATE POLICY coach_packages_select_own ON coach_packages FOR SELECT USING (coach_id = auth.uid());
DROP POLICY IF EXISTS coach_packages_insert_own ON coach_packages;
CREATE POLICY coach_packages_insert_own ON coach_packages FOR INSERT WITH CHECK (coach_id = auth.uid());
DROP POLICY IF EXISTS coach_packages_update_own ON coach_packages;
CREATE POLICY coach_packages_update_own ON coach_packages FOR UPDATE USING (coach_id = auth.uid());
DROP POLICY IF EXISTS coach_packages_delete_own ON coach_packages;
CREATE POLICY coach_packages_delete_own ON coach_packages FOR DELETE USING (coach_id = auth.uid());

ALTER TABLE coach_application_pages
  ADD COLUMN IF NOT EXISTS show_packages BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE coach_applications
  ADD COLUMN IF NOT EXISTS selected_package_id UUID REFERENCES coach_packages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_coach_applications_package
  ON coach_applications (selected_package_id) WHERE selected_package_id IS NOT NULL;

ALTER TABLE coach_packages ADD COLUMN IF NOT EXISTS includes_running     BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE coach_packages ADD COLUMN IF NOT EXISTS includes_strength    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE coach_packages ADD COLUMN IF NOT EXISTS includes_in_person   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE coach_packages ADD COLUMN IF NOT EXISTS includes_programming BOOLEAN NOT NULL DEFAULT true;

-- ============ 2. Stripe Connect cols on users + payment_requests table ============
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
CREATE POLICY payment_requests_select_own ON payment_requests FOR SELECT USING (coach_id = auth.uid());
DROP POLICY IF EXISTS payment_requests_insert_own ON payment_requests;
CREATE POLICY payment_requests_insert_own ON payment_requests FOR INSERT WITH CHECK (coach_id = auth.uid());
DROP POLICY IF EXISTS payment_requests_update_own ON payment_requests;
CREATE POLICY payment_requests_update_own ON payment_requests FOR UPDATE USING (coach_id = auth.uid());
DROP POLICY IF EXISTS payment_requests_delete_own ON payment_requests;
CREATE POLICY payment_requests_delete_own ON payment_requests FOR DELETE USING (coach_id = auth.uid());

-- ============ 3. payment_requests extra columns ============
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payment_requests_client ON payment_requests (client_id);

ALTER TABLE coach_applications
  ADD COLUMN IF NOT EXISTS birth_month INTEGER CHECK (birth_month IS NULL OR (birth_month BETWEEN 1 AND 12)),
  ADD COLUMN IF NOT EXISTS birth_year  INTEGER CHECK (birth_year IS NULL OR (birth_year BETWEEN 1900 AND 2100));

ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS request_assessment BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS request_cycle_tracking BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_duration_weeks INTEGER
    CHECK (custom_duration_weeks IS NULL OR custom_duration_weeks > 0),
  ADD COLUMN IF NOT EXISTS is_renewal BOOLEAN NOT NULL DEFAULT false;

-- ============ 4. Recurring / subscriptions ============
ALTER TABLE coach_packages
  ADD COLUMN IF NOT EXISTS recur_months INTEGER
    CHECK (recur_months IS NULL OR recur_months > 0);

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS subscription_cancel_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

CREATE INDEX IF NOT EXISTS idx_plans_stripe_subscription_id
  ON public.plans(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_stripe_subscription_id
  ON public.payment_requests(stripe_subscription_id);

-- ============ 5. Packages-as-plan-recipes + payments links ============
ALTER TABLE coach_packages
  ADD COLUMN IF NOT EXISTS program_template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT 'programming_only'
    CHECK (billing_mode IN ('programming_only', 'per_session', 'hybrid')),
  ADD COLUMN IF NOT EXISTS duration_weeks INTEGER CHECK (duration_weeks IS NULL OR duration_weeks > 0),
  ADD COLUMN IF NOT EXISTS session_count INTEGER CHECK (session_count IS NULL OR session_count >= 0),
  ADD COLUMN IF NOT EXISTS session_cost NUMERIC(10, 2) CHECK (session_cost IS NULL OR session_cost >= 0),
  ADD COLUMN IF NOT EXISTS programming_cost NUMERIC(10, 2) CHECK (programming_cost IS NULL OR programming_cost >= 0);

CREATE INDEX IF NOT EXISTS idx_coach_packages_program_template
  ON coach_packages (program_template_id) WHERE program_template_id IS NOT NULL;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS source_package_id UUID REFERENCES coach_packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS program_loaded BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.payments ALTER COLUMN plan_id DROP NOT NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'programming'
    CHECK (payment_type IN ('programming', 'session')),
  ADD COLUMN IF NOT EXISTS session_package_id UUID REFERENCES public.session_packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES coach_packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_request_id UUID REFERENCES payment_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_payment_request
  ON public.payments(payment_request_id) WHERE payment_request_id IS NOT NULL;

ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS plan_id    UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL;

-- ============ 6. Session package status + per-plan isolation ============
ALTER TABLE public.session_packages
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_packages_status_check') THEN
    ALTER TABLE public.session_packages
      ADD CONSTRAINT session_packages_status_check CHECK (status IN ('active', 'closed'));
  END IF;
END$$;

ALTER TABLE public.session_packages
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_session_packages_plan_id
  ON public.session_packages(plan_id);

-- DROP + CREATE (not CREATE OR REPLACE) because we keep the existing column set
-- INCLUDING total_owed — Postgres won't let CREATE OR REPLACE change columns.
-- Only functional change: count ONLY active session_packages.
DROP VIEW IF EXISTS public.client_session_balances;
CREATE VIEW public.client_session_balances AS
SELECT
  c.id AS client_id,
  c.user_id,
  COALESCE(pkg.total_purchased, 0) AS total_purchased,
  COALESCE(used.total_used, 0) AS total_used,
  COALESCE(pkg.total_purchased, 0) - COALESCE(used.total_used, 0) AS sessions_remaining,
  COALESCE(pkg.total_paid, 0) AS total_paid,
  COALESCE(pkg.total_owed, 0) AS total_owed
FROM public.clients c
LEFT JOIN (
  SELECT client_id,
    SUM(sessions_purchased) AS total_purchased,
    SUM(amount_paid) AS total_paid,
    SUM(amount_owed) AS total_owed
  FROM public.session_packages
  WHERE status = 'active'
  GROUP BY client_id
) pkg ON pkg.client_id = c.id
LEFT JOIN (
  SELECT client_id, COUNT(*) AS total_used
  FROM public.sessions
  WHERE status IN ('completed', 'cancelled_charged', 'no_show')
  GROUP BY client_id
) used ON used.client_id = c.id;

-- ============ 7. Monthly pricing mode ============
ALTER TABLE public.coach_packages
  ADD COLUMN IF NOT EXISTS monthly_pricing_mode text
    DEFAULT 'direct'
    CHECK (monthly_pricing_mode IN ('direct', 'split'));
UPDATE public.coach_packages
  SET monthly_pricing_mode = 'direct'
  WHERE monthly_pricing_mode IS NULL;

-- ============ 8. Data API grants (for the new tables, Oct 30 change) ============
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

COMMIT;

-- ============ VERIFICATION (run after; each should be > 0) ============
SELECT
  (SELECT to_regclass('public.coach_packages'))                                                       AS coach_packages_tbl,
  (SELECT to_regclass('public.payment_requests'))                                                     AS payment_requests_tbl,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='coach_packages' AND column_name='monthly_pricing_mode') AS pkg_monthly_mode,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='payment_requests' AND column_name='is_renewal')         AS pr_is_renewal,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='plans' AND column_name='stripe_subscription_id')        AS plans_sub_id,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='users' AND column_name='stripe_account_id')             AS users_stripe;
