-- =====================================================================
-- PRODUCTION RELEASE SCRIPT
-- Session Management + Client Health Assessment
--
-- HOW TO RUN:
--   1. Open the PRODUCTION Supabase project (badge should say "main / PRODUCTION")
--   2. Left sidebar -> SQL Editor -> New query
--   3. Paste this ENTIRE file, click "Run"
--   4. Confirm it says Success. The verification queries at the bottom
--      should each return a row / non-null value.
--
-- SAFE TO RE-RUN: everything uses IF NOT EXISTS / guarded backfills.
-- ADDITIVE ONLY: no tables or columns are dropped or renamed.
-- =====================================================================


-- ############################################################
-- PART 1 of 2 — Session Management (20260823_session_management.sql)
-- ############################################################

-- 1. billing_mode on clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT 'programming_only'
  CHECK (billing_mode IN ('programming_only', 'per_session', 'hybrid'));

-- 1b. billing_mode on plans
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT 'programming_only'
  CHECK (billing_mode IN ('programming_only', 'per_session', 'hybrid'));

-- 2. Session Packages table
CREATE TABLE IF NOT EXISTS public.session_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  coach_id UUID NOT NULL REFERENCES auth.users(id),
  sessions_purchased INTEGER NOT NULL CHECK (sessions_purchased > 0),
  amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_session_packages_client_id ON public.session_packages(client_id);
CREATE INDEX IF NOT EXISTS idx_session_packages_org_id ON public.session_packages(organization_id);
ALTER TABLE public.session_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage session_packages" ON public.session_packages;
CREATE POLICY "Admins can manage session_packages"
  ON public.session_packages FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Clients can view own session_packages" ON public.session_packages;
CREATE POLICY "Clients can view own session_packages"
  ON public.session_packages FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- 3. Recurring Schedules table
CREATE TABLE IF NOT EXISTS public.recurring_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES auth.users(id),
  organization_id UUID NOT NULL,
  days_of_week INTEGER[] NOT NULL CHECK (array_length(days_of_week, 1) > 0),
  time_of_day TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  location TEXT,
  session_type TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_client_id ON public.recurring_schedules(client_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_org_id ON public.recurring_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_active ON public.recurring_schedules(active) WHERE active = true;
ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage recurring_schedules" ON public.recurring_schedules;
CREATE POLICY "Admins can manage recurring_schedules"
  ON public.recurring_schedules FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Clients can view own recurring_schedules" ON public.recurring_schedules;
CREATE POLICY "Clients can view own recurring_schedules"
  ON public.recurring_schedules FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- 4. Sessions table
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES auth.users(id),
  organization_id UUID NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  location TEXT,
  session_type TEXT,
  notes TEXT,
  workout_id UUID,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'completed', 'cancelled_charged', 'cancelled_no_charge', 'no_show', 'rescheduled')),
  marked_at TIMESTAMPTZ,
  recurring_schedule_id UUID REFERENCES public.recurring_schedules(id) ON DELETE SET NULL,
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON public.sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_coach_id ON public.sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_sessions_org_id ON public.sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled_at ON public.sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_recurring ON public.sessions(recurring_schedule_id);
CREATE INDEX IF NOT EXISTS idx_sessions_reminder_pending
  ON public.sessions(scheduled_at)
  WHERE status = 'scheduled' AND reminder_sent = false;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage sessions" ON public.sessions;
CREATE POLICY "Admins can manage sessions"
  ON public.sessions FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Clients can view own sessions" ON public.sessions;
CREATE POLICY "Clients can view own sessions"
  ON public.sessions FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- 5. session columns on notification_preferences
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS session_reminder BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS low_balance_threshold INTEGER NOT NULL DEFAULT 3;

-- 6. coach default session settings
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS default_session_duration INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS default_session_location TEXT,
  ADD COLUMN IF NOT EXISTS default_session_time TIME NOT NULL DEFAULT '09:00';

-- 7. session_type on workouts
ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'remote'
  CHECK (session_type IN ('remote', 'in_person'));

-- 8a. amount_owed on session_packages (BEFORE the balance view uses it)
ALTER TABLE public.session_packages
  ADD COLUMN IF NOT EXISTS amount_owed NUMERIC(10, 2) NOT NULL DEFAULT 0;
UPDATE public.session_packages
  SET amount_owed = amount_paid
  WHERE amount_owed = 0 AND amount_paid > 0;

-- 8. Helper view: session balance per client
CREATE OR REPLACE VIEW public.client_session_balances AS
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
  GROUP BY client_id
) pkg ON pkg.client_id = c.id
LEFT JOIN (
  SELECT client_id, COUNT(*) AS total_used
  FROM public.sessions
  WHERE status IN ('completed', 'cancelled_charged', 'no_show')
  GROUP BY client_id
) used ON used.client_id = c.id;

-- 8b. Auto-update triggers
CREATE OR REPLACE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE OR REPLACE TRIGGER update_recurring_schedules_updated_at
  BEFORE UPDATE ON public.recurring_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. day_times JSONB on recurring_schedules
ALTER TABLE public.recurring_schedules
  ADD COLUMN IF NOT EXISTS day_times JSONB;

-- 12. Extend payments for session payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'programming'
    CHECK (payment_type IN ('programming', 'session')),
  ADD COLUMN IF NOT EXISTS session_package_id UUID REFERENCES public.session_packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.payments
  ALTER COLUMN plan_id DROP NOT NULL;
UPDATE public.payments p
  SET client_id = pl.client_id
  FROM public.plans pl
  WHERE p.plan_id = pl.id AND p.client_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_session_package_id ON public.payments(session_package_id);

-- 13. Session requests table
CREATE TABLE IF NOT EXISTS public.session_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('cancel', 'reschedule')),
  note TEXT,
  preferred_datetime TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_session_requests_session_id ON public.session_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_session_requests_client_id ON public.session_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_session_requests_org_id ON public.session_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_session_requests_pending ON public.session_requests(status) WHERE status = 'pending';
ALTER TABLE public.session_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage session_requests" ON public.session_requests;
CREATE POLICY "Admins can manage session_requests"
  ON public.session_requests FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Clients can view own session_requests" ON public.session_requests;
CREATE POLICY "Clients can view own session_requests"
  ON public.session_requests FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Clients can create own session_requests" ON public.session_requests;
CREATE POLICY "Clients can create own session_requests"
  ON public.session_requests FOR INSERT
  WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));


-- ############################################################
-- PART 2 of 2 — Client Health Assessment (20260901_client_assessments.sql)
-- ############################################################

CREATE TABLE IF NOT EXISTS public.client_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
  organization_id UUID,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'completed', 'review_requested')),
  completed_at TIMESTAMPTZ,
  review_requested_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_assessments_client_id ON public.client_assessments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_assessments_org_id ON public.client_assessments(organization_id);
ALTER TABLE public.client_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage client_assessments" ON public.client_assessments;
CREATE POLICY "Admins can manage client_assessments"
  ON public.client_assessments FOR ALL USING (public.is_admin());
DROP POLICY IF EXISTS "Clients can view own assessment" ON public.client_assessments;
CREATE POLICY "Clients can view own assessment"
  ON public.client_assessments FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Clients can insert own assessment" ON public.client_assessments;
CREATE POLICY "Clients can insert own assessment"
  ON public.client_assessments FOR INSERT
  WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Clients can update own assessment" ON public.client_assessments;
CREATE POLICY "Clients can update own assessment"
  ON public.client_assessments FOR UPDATE
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));
CREATE OR REPLACE TRIGGER update_client_assessments_updated_at
  BEFORE UPDATE ON public.client_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ############################################################
-- Tell the Supabase API layer to pick up the new tables immediately
-- ############################################################
NOTIFY pgrst, 'reload schema';


-- ############################################################
-- VERIFICATION — run these after the above; each should return a row
-- ############################################################
-- New tables exist:
SELECT to_regclass('public.sessions')            AS sessions_table,
       to_regclass('public.session_packages')    AS packages_table,
       to_regclass('public.recurring_schedules') AS recurring_table,
       to_regclass('public.session_requests')    AS requests_table,
       to_regclass('public.client_assessments')  AS assessments_table;

-- New columns exist on existing tables:
SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_name='clients'  AND column_name='billing_mode')  AS clients_billing_mode,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='plans'    AND column_name='billing_mode')  AS plans_billing_mode,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='workouts' AND column_name='session_type')  AS workouts_session_type,
  (SELECT count(*) FROM information_schema.columns WHERE table_name='payments' AND column_name='payment_type')  AS payments_payment_type;
