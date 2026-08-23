-- Session Management Migration
-- Adds tables for in-person session tracking, packages, and recurring schedules

-- ============================================================
-- 1. Add billing_mode to clients table
-- ============================================================
ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT 'programming_only'
  CHECK (billing_mode IN ('programming_only', 'per_session', 'hybrid'));

-- ============================================================
-- 2. Session Packages table
-- Tracks pre-paid session bundles per client
-- ============================================================
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_session_packages_client_id ON public.session_packages(client_id);
CREATE INDEX IF NOT EXISTS idx_session_packages_org_id ON public.session_packages(organization_id);

-- RLS
ALTER TABLE public.session_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage session_packages"
  ON public.session_packages FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can view own session_packages"
  ON public.session_packages FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- ============================================================
-- 3. Recurring Schedules table
-- Defines repeating patterns for auto-generated sessions
-- ============================================================
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_client_id ON public.recurring_schedules(client_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_org_id ON public.recurring_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_active ON public.recurring_schedules(active) WHERE active = true;

-- RLS
ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage recurring_schedules"
  ON public.recurring_schedules FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can view own recurring_schedules"
  ON public.recurring_schedules FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- ============================================================
-- 4. Sessions table
-- Individual session instances (one-off or generated from recurring)
-- ============================================================
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON public.sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_coach_id ON public.sessions(coach_id);
CREATE INDEX IF NOT EXISTS idx_sessions_org_id ON public.sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled_at ON public.sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_recurring ON public.sessions(recurring_schedule_id);
-- For reminder cron: find upcoming scheduled sessions that haven't been reminded
CREATE INDEX IF NOT EXISTS idx_sessions_reminder_pending 
  ON public.sessions(scheduled_at) 
  WHERE status = 'scheduled' AND reminder_sent = false;

-- RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sessions"
  ON public.sessions FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can view own sessions"
  ON public.sessions FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- ============================================================
-- 5. Add session-related columns to notification_preferences
-- ============================================================
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS session_reminder BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS low_balance_threshold INTEGER NOT NULL DEFAULT 3;

-- ============================================================
-- 6. Coach settings: default session duration and location
-- Add to notification_preferences (used as general coach settings)
-- ============================================================
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS default_session_duration INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS default_session_location TEXT;

-- ============================================================
-- 7. Auto-update trigger for sessions
-- ============================================================
CREATE OR REPLACE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_recurring_schedules_updated_at
  BEFORE UPDATE ON public.recurring_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. Helper view: session balance per client
-- Calculates remaining sessions from packages minus used sessions
-- ============================================================
CREATE OR REPLACE VIEW public.client_session_balances AS
SELECT 
  c.id AS client_id,
  c.user_id,
  COALESCE(pkg.total_purchased, 0) AS total_purchased,
  COALESCE(used.total_used, 0) AS total_used,
  COALESCE(pkg.total_purchased, 0) - COALESCE(used.total_used, 0) AS sessions_remaining,
  COALESCE(pkg.total_paid, 0) AS total_paid
FROM public.clients c
LEFT JOIN (
  SELECT client_id, 
    SUM(sessions_purchased) AS total_purchased,
    SUM(amount_paid) AS total_paid
  FROM public.session_packages
  GROUP BY client_id
) pkg ON pkg.client_id = c.id
LEFT JOIN (
  SELECT client_id, COUNT(*) AS total_used
  FROM public.sessions
  WHERE status IN ('completed', 'cancelled_charged', 'no_show')
  GROUP BY client_id
) used ON used.client_id = c.id;
