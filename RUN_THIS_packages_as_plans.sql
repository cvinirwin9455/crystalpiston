-- ============================================================
-- RUN THIS in the Supabase SQL editor: "Packages as Plan recipes".
-- Aligns the application/package flow with the per-client Plans & Payments
-- structure, so every accepted application (manual accept OR Stripe payment)
-- produces a real `plans` row + a `payments` row on the client's account.
-- Idempotent — safe to run more than once.
-- ============================================================

-- ------------------------------------------------------------
-- 1. coach_packages becomes a "plan recipe": it carries the same inputs a
--    plan needs, plus an optional program template to assign.
-- ------------------------------------------------------------
ALTER TABLE coach_packages
  -- Optional program template this package assigns to the client's plan.
  ADD COLUMN IF NOT EXISTS program_template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
  -- Matches the per-client plan billing vocabulary.
  ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT 'programming_only'
    CHECK (billing_mode IN ('programming_only', 'per_session', 'hybrid')),
  -- How many weeks the plan should run (drives the plan's end_date).
  ADD COLUMN IF NOT EXISTS duration_weeks INTEGER CHECK (duration_weeks IS NULL OR duration_weeks > 0),
  -- Session bundle inputs (for per_session / hybrid packages).
  ADD COLUMN IF NOT EXISTS session_count INTEGER CHECK (session_count IS NULL OR session_count >= 0),
  ADD COLUMN IF NOT EXISTS session_cost NUMERIC(10, 2) CHECK (session_cost IS NULL OR session_cost >= 0),
  -- Programming cost (for programming_only / hybrid packages). When null, the
  -- package price (price_cents) is used as the programming cost.
  ADD COLUMN IF NOT EXISTS programming_cost NUMERIC(10, 2) CHECK (programming_cost IS NULL OR programming_cost >= 0);

CREATE INDEX IF NOT EXISTS idx_coach_packages_program_template
  ON coach_packages (program_template_id) WHERE program_template_id IS NOT NULL;

-- ------------------------------------------------------------
-- 2. plans: remember which package the plan came from, and whether the
--    program template's weeks have been loaded onto the client yet (drives the
--    "Program not loaded" indicator on the Account page).
-- ------------------------------------------------------------
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS source_package_id UUID REFERENCES coach_packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS program_loaded BOOLEAN NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- 3. payments: ensure the columns the app already expects exist, plus a link
--    back to the package the payment was for. (The app reads these with a
--    graceful fallback, but we want them present so Stripe/offline fulfillment
--    can write a clean, unified payment row.)
-- ------------------------------------------------------------
ALTER TABLE public.payments
  -- plan_id was NOT NULL in the original schema; relax it so a payment can be
  -- recorded against a client directly (session payments) if ever needed. Plan
  -- payments still set plan_id.
  ALTER COLUMN plan_id DROP NOT NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'programming'
    CHECK (payment_type IN ('programming', 'session')),
  ADD COLUMN IF NOT EXISTS session_package_id UUID REFERENCES public.session_packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES coach_packages(id) ON DELETE SET NULL,
  -- Link the online payment back to its Stripe payment_requests row (so a
  -- payment is never double-recorded and we can trace Stripe <-> payments).
  ADD COLUMN IF NOT EXISTS payment_request_id UUID REFERENCES payment_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments(client_id);
-- Guard against the same payment_requests row producing two payment rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_payment_request
  ON public.payments(payment_request_id) WHERE payment_request_id IS NOT NULL;

-- ------------------------------------------------------------
-- 4. payment_requests: remember the plan (and payment) that fulfillment
--    produced, so the Stripe record ties back to the client's account.
-- ------------------------------------------------------------
ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS plan_id    UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- Sanity check: confirm the new columns landed.
-- ------------------------------------------------------------
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_name='coach_packages' AND column_name='program_template_id') AS pkg_program_template,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='coach_packages' AND column_name='billing_mode')        AS pkg_billing_mode,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='coach_packages' AND column_name='duration_weeks')      AS pkg_duration_weeks,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='plans'          AND column_name='source_package_id')   AS plans_source_package,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='plans'          AND column_name='program_loaded')      AS plans_program_loaded,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='payments'       AND column_name='payment_request_id')  AS payments_pr_link,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='payment_requests' AND column_name='plan_id')           AS pr_plan_id;
