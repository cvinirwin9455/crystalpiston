-- ============================================================
-- FULL SCHEMA FOR STAGING DATABASE
-- Run this in your STAGING Supabase project's SQL Editor
-- This creates all tables from scratch (empty, no data)
-- ============================================================

-- ============================================================
-- UTILITY FUNCTIONS
-- ============================================================

-- Auto-update updated_at column trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. ORGANIZATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  slug TEXT,
  domain TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. USERS (profile table linked to auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  gender TEXT,
  status TEXT DEFAULT 'active',
  avatar_url TEXT,
  organization_id UUID REFERENCES public.organizations(id),
  access_level TEXT DEFAULT 'all_clients',
  coach_level TEXT,
  is_super_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- is_admin() function (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for users
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON public.users FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any user"
  ON public.users FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can insert users"
  ON public.users FOR INSERT
  WITH CHECK (public.is_admin());

-- ============================================================
-- 3. CLIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  goal TEXT,
  start_date DATE,
  plan_end DATE,
  owed DECIMAL(10, 2) DEFAULT 0,
  paid DECIMAL(10, 2) DEFAULT 0,
  birthday DATE,
  cycle_tracking_requested BOOLEAN NOT NULL DEFAULT false,
  cycle_tracking_consented BOOLEAN DEFAULT null,
  billing_mode TEXT NOT NULL DEFAULT 'programming_only'
    CHECK (billing_mode IN ('programming_only', 'per_session', 'hybrid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all clients"
  ON public.clients FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can view own record"
  ON public.clients FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- 4. CLIENT_COACHES (junction table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, coach_id)
);

CREATE INDEX IF NOT EXISTS idx_client_coaches_client_id ON public.client_coaches(client_id);
CREATE INDEX IF NOT EXISTS idx_client_coaches_coach_id ON public.client_coaches(coach_id);

ALTER TABLE public.client_coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage client_coaches"
  ON public.client_coaches FOR ALL
  USING (public.is_admin());

CREATE POLICY "Coaches can read own assignments"
  ON public.client_coaches FOR SELECT
  USING (coach_id = auth.uid());

-- ============================================================
-- 5. PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  owed DECIMAL(10, 2) NOT NULL DEFAULT 0,
  paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  completion_reason TEXT,
  target_distance TEXT,
  race_date DATE,
  goal_pace TEXT,
  injury_notes TEXT,
  program_template_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_client_id ON public.plans(client_id);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all plans"
  ON public.plans FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can view their own plans"
  ON public.plans FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_plan_id ON public.payments(plan_id);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on payments"
  ON public.payments FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can view own payments"
  ON public.payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.plans p
      JOIN public.clients c ON c.id = p.client_id
      WHERE p.id = payments.plan_id AND c.user_id = auth.uid()
    )
  );

-- ============================================================
-- 7. WEEKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date_range TEXT NOT NULL,
  focus TEXT,
  coach_message TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_by_coach_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weeks_client_id ON public.weeks(client_id);
ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all weeks"
  ON public.weeks FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can view own published weeks"
  ON public.weeks FOR SELECT
  USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    AND status = 'published'
  );

-- ============================================================
-- 8. WORKOUTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  type TEXT NOT NULL,
  training_type TEXT,
  title TEXT,
  miles NUMERIC(6, 2),
  description TEXT,
  pace_target TEXT,
  location TEXT,
  coach_notes TEXT,
  sort_order INTEGER DEFAULT 0,
  distance_unit TEXT NOT NULL DEFAULT 'mi' CHECK (distance_unit IN ('mi', 'km')),
  structure JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workouts_week_id ON public.workouts(week_id);
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all workouts"
  ON public.workouts FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can view own workouts"
  ON public.workouts FOR SELECT
  USING (
    week_id IN (
      SELECT id FROM public.weeks WHERE client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 9. WORKOUT_LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  status TEXT,
  skip_reason TEXT,
  rpe INTEGER,
  actual_miles NUMERIC(6, 2),
  actual_pace TEXT,
  stress NUMERIC,
  notes TEXT,
  on_period BOOLEAN,
  duration TEXT,
  energy NUMERIC,
  motivation NUMERIC,
  sleep NUMERIC,
  strength NUMERIC,
  recovery NUMERIC,
  mood NUMERIC,
  hunger NUMERIC,
  avg_heartrate NUMERIC,
  max_heartrate NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workout_logs_workout_id ON public.workout_logs(workout_id);
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all workout_logs"
  ON public.workout_logs FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can manage own workout_logs"
  ON public.workout_logs FOR ALL
  USING (
    workout_id IN (
      SELECT id FROM public.workouts WHERE week_id IN (
        SELECT id FROM public.weeks WHERE client_id IN (
          SELECT id FROM public.clients WHERE user_id = auth.uid()
        )
      )
    )
  );

-- ============================================================
-- 10. MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_by_coach_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON public.messages FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Admins can manage all messages"
  ON public.messages FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 11. TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('week', 'day', 'program')),
  category TEXT,
  data JSONB NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage templates"
  ON public.templates FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 12. NOTIFICATION_PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan_published BOOLEAN NOT NULL DEFAULT true,
  messages TEXT NOT NULL DEFAULT 'immediate' CHECK (messages IN ('immediate', 'daily', 'off')),
  workout_completed TEXT NOT NULL DEFAULT 'immediate',
  workout_skipped TEXT NOT NULL DEFAULT 'immediate',
  workout_partial TEXT NOT NULL DEFAULT 'immediate',
  client_message TEXT NOT NULL DEFAULT 'immediate',
  daily_summary TEXT NOT NULL DEFAULT 'off',
  notification_emails TEXT,
  theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
  distance_unit TEXT NOT NULL DEFAULT 'mi' CHECK (distance_unit IN ('mi', 'km')),
  weight_unit TEXT DEFAULT 'kg',
  default_expanded BOOLEAN NOT NULL DEFAULT true,
  dismissed_banners JSONB DEFAULT '[]',
  date_format TEXT DEFAULT 'MM/DD/YYYY',
  session_reminder BOOLEAN NOT NULL DEFAULT true,
  low_balance_threshold INTEGER NOT NULL DEFAULT 3,
  default_session_duration INTEGER NOT NULL DEFAULT 60,
  default_session_location TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences(user_id);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can view all notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (public.is_admin());

-- ============================================================
-- 13. CLIENT_WORKOUTS (client-added workouts)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_id UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  type TEXT NOT NULL,
  training_type TEXT,
  miles NUMERIC(6, 2),
  notes TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_notes TEXT,
  strava_activity_id UUID,
  source TEXT DEFAULT 'manual',
  duration TEXT,
  average_pace TEXT,
  activity_name TEXT,
  avg_heartrate NUMERIC,
  max_heartrate NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.client_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own client_workouts"
  ON public.client_workouts FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all client_workouts"
  ON public.client_workouts FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 14. WORKOUT_COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workout_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_by_coach_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.workout_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments"
  ON public.workout_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert comments"
  ON public.workout_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all comments"
  ON public.workout_comments FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 15. ORGANIZATION_FEATURES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organization_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_run BOOLEAN NOT NULL DEFAULT true,
  feature_walk BOOLEAN NOT NULL DEFAULT true,
  feature_cycling BOOLEAN NOT NULL DEFAULT true,
  feature_cross_training BOOLEAN NOT NULL DEFAULT true,
  feature_stretching BOOLEAN NOT NULL DEFAULT true,
  feature_strength BOOLEAN NOT NULL DEFAULT true,
  feature_hiit BOOLEAN NOT NULL DEFAULT true,
  feature_swimming BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organization_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage own org features"
  ON public.organization_features FOR ALL
  USING (public.is_admin());

-- ============================================================
-- 16. STRAVA_CONNECTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.strava_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  strava_athlete_id BIGINT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  athlete_firstname TEXT,
  athlete_lastname TEXT,
  athlete_profile TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strava_connections_athlete_id ON public.strava_connections(strava_athlete_id);
ALTER TABLE public.strava_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own strava connection"
  ON public.strava_connections FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================
-- 17. STRAVA_ACTIVITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.strava_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strava_activity_id BIGINT NOT NULL UNIQUE,
  week_id UUID REFERENCES public.weeks(id) ON DELETE SET NULL,
  day TEXT NOT NULL,
  type TEXT NOT NULL,
  training_type TEXT,
  miles NUMERIC(6, 2),
  duration TEXT,
  average_pace TEXT,
  activity_name TEXT,
  strava_type TEXT,
  moving_time_seconds INTEGER,
  distance_meters NUMERIC(10, 2),
  start_date TIMESTAMPTZ,
  match_status TEXT NOT NULL DEFAULT 'pending',
  matched_workout_id UUID REFERENCES public.workouts(id) ON DELETE SET NULL,
  avg_heartrate NUMERIC,
  max_heartrate NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strava_activities_user_week ON public.strava_activities(user_id, week_id);
CREATE INDEX IF NOT EXISTS idx_strava_activities_strava_id ON public.strava_activities(strava_activity_id);
ALTER TABLE public.strava_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own strava activities"
  ON public.strava_activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage strava activities"
  ON public.strava_activities FOR ALL
  USING (true);

-- ============================================================
-- 18. WORKOUT_MOVES (drag-and-drop tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workout_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL,
  week_id UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  workout_type TEXT NOT NULL CHECK (workout_type IN ('programmed', 'client')),
  original_day TEXT NOT NULL,
  current_day TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workout_id, workout_type)
);

ALTER TABLE public.workout_moves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workout_moves"
  ON public.workout_moves FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to workout_moves"
  ON public.workout_moves FOR ALL
  USING (true);

-- ============================================================
-- 19. PUSH_SUBSCRIPTIONS (PWA)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL DEFAULT '',
  auth TEXT NOT NULL DEFAULT '',
  subscription_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 20. WEBAUTHN_CREDENTIALS (biometric login)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_type TEXT NOT NULL DEFAULT 'singleDevice',
  backed_up BOOLEAN NOT NULL DEFAULT false,
  transports TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id ON public.webauthn_credentials(user_id);
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own WebAuthn credentials"
  ON public.webauthn_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to webauthn_credentials"
  ON public.webauthn_credentials FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 21. WEBAUTHN_CHALLENGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to webauthn_challenges"
  ON public.webauthn_challenges FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION cleanup_expired_webauthn_challenges()
RETURNS void AS $$
BEGIN
  DELETE FROM webauthn_challenges WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 22. INBOUND_EMAILS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inbound_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID DEFAULT gen_random_uuid(),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL DEFAULT 'hello@firstmilecoach.com',
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  resend_email_id TEXT,
  read BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.inbound_emails ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 23. FEEDBACK
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL CHECK (platform IN ('crystal-pistol', 'first-mile')),
  user_role TEXT NOT NULL CHECK (user_role IN ('coach', 'client', 'visitor')),
  type TEXT NOT NULL CHECK (type IN ('bug', 'feedback', 'question')),
  description TEXT NOT NULL,
  page_url TEXT,
  screenshot_url TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'implemented', 'wont_fix')),
  admin_notes TEXT,
  resolution_message TEXT,
  activity_log JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view own feedback"
  ON public.feedback FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can manage all feedback"
  ON public.feedback FOR ALL
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.handle_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.handle_feedback_updated_at();

-- ============================================================
-- 24. BETA_SIGNUPS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.beta_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  full_name TEXT,
  email TEXT UNIQUE,
  coaching_type TEXT,
  expected_clients INTEGER,
  agreed_to_terms BOOLEAN,
  signed_up_at TIMESTAMPTZ DEFAULT NOW(),
  consent_ip TEXT,
  consent_user_agent TEXT,
  consent_terms_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 25. SESSION_PACKAGES
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

CREATE INDEX IF NOT EXISTS idx_session_packages_client_id ON public.session_packages(client_id);
CREATE INDEX IF NOT EXISTS idx_session_packages_org_id ON public.session_packages(organization_id);
ALTER TABLE public.session_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage session_packages"
  ON public.session_packages FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can view own session_packages"
  ON public.session_packages FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- ============================================================
-- 26. RECURRING_SCHEDULES
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

CREATE INDEX IF NOT EXISTS idx_recurring_schedules_client_id ON public.recurring_schedules(client_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_org_id ON public.recurring_schedules(organization_id);
ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage recurring_schedules"
  ON public.recurring_schedules FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can view own recurring_schedules"
  ON public.recurring_schedules FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE TRIGGER update_recurring_schedules_updated_at
  BEFORE UPDATE ON public.recurring_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 27. SESSIONS
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

CREATE POLICY "Admins can manage sessions"
  ON public.sessions FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can view own sessions"
  ON public.sessions FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 28. CLIENT_SESSION_BALANCES (view)
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

-- ============================================================
-- DONE! Your staging database now has the full schema.
-- Next: Create a test coach account and test client in this DB.
-- ============================================================
