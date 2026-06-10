-- Crystal Pistol Performance - Initial Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- ============================================
-- USERS TABLE
-- ============================================
-- Extends Supabase auth.users with app-specific fields
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  gender TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- CLIENTS TABLE
-- ============================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  goal TEXT,
  start_date DATE,
  plan_end DATE,
  owed DECIMAL(10, 2) DEFAULT 0,
  paid DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================
-- WEEKS TABLE
-- ============================================
CREATE TABLE public.weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date_range TEXT NOT NULL,
  focus TEXT,
  coach_message TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- WORKOUTS TABLE
-- ============================================
CREATE TABLE public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  type TEXT,
  training_type TEXT,
  title TEXT,
  miles DECIMAL(5, 2),
  description TEXT,
  pace_target TEXT,
  location TEXT,
  coach_notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- WORKOUT LOGS TABLE
-- ============================================
CREATE TABLE public.workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('complete', 'partial', 'skipped')),
  skip_reason TEXT,
  rpe INTEGER CHECK (rpe >= 1 AND rpe <= 10),
  actual_miles DECIMAL(5, 2),
  actual_pace TEXT,
  stress INTEGER CHECK (stress >= 1 AND stress <= 10),
  notes TEXT,
  on_period BOOLEAN DEFAULT FALSE,
  duration TEXT,
  energy INTEGER CHECK (energy >= 1 AND energy <= 10),
  motivation INTEGER CHECK (motivation >= 1 AND motivation <= 10),
  sleep INTEGER CHECK (sleep >= 1 AND sleep <= 10),
  strength INTEGER CHECK (strength >= 1 AND strength <= 10),
  recovery INTEGER CHECK (recovery >= 1 AND recovery <= 10),
  mood INTEGER CHECK (mood >= 1 AND mood <= 10),
  hunger INTEGER CHECK (hunger >= 1 AND hunger <= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workout_id)
);

-- ============================================
-- MESSAGES TABLE
-- ============================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- NOTIFICATION SETTINGS TABLE
-- ============================================
CREATE TABLE public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  workout_completed BOOLEAN NOT NULL DEFAULT TRUE,
  workout_skipped BOOLEAN NOT NULL DEFAULT TRUE,
  client_message BOOLEAN NOT NULL DEFAULT TRUE,
  daily_summary BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- USERS policies
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any user"
  ON public.users FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert users"
  ON public.users FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- CLIENTS policies
CREATE POLICY "Clients can view their own record"
  ON public.clients FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all clients"
  ON public.clients FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- WEEKS policies
CREATE POLICY "Clients can view their published weeks"
  ON public.weeks FOR SELECT
  USING (
    status = 'published' AND
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all weeks"
  ON public.weeks FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- WORKOUTS policies
CREATE POLICY "Clients can view their workouts"
  ON public.workouts FOR SELECT
  USING (
    week_id IN (
      SELECT w.id FROM public.weeks w
      JOIN public.clients c ON w.client_id = c.id
      WHERE c.user_id = auth.uid() AND w.status = 'published'
    )
  );

CREATE POLICY "Admins can manage all workouts"
  ON public.workouts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- WORKOUT LOGS policies
CREATE POLICY "Clients can manage their own logs"
  ON public.workout_logs FOR ALL
  USING (
    workout_id IN (
      SELECT wo.id FROM public.workouts wo
      JOIN public.weeks w ON wo.week_id = w.id
      JOIN public.clients c ON w.client_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all logs"
  ON public.workout_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- MESSAGES policies
CREATE POLICY "Users can view their own messages"
  ON public.messages FOR SELECT
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "Recipients can mark messages as read"
  ON public.messages FOR UPDATE
  USING (to_user_id = auth.uid());

-- NOTIFICATION SETTINGS policies
CREATE POLICY "Users can manage their own notification settings"
  ON public.notification_settings FOR ALL
  USING (user_id = auth.uid());

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX idx_clients_user_id ON public.clients(user_id);
CREATE INDEX idx_weeks_client_id ON public.weeks(client_id);
CREATE INDEX idx_weeks_status ON public.weeks(status);
CREATE INDEX idx_workouts_week_id ON public.workouts(week_id);
CREATE INDEX idx_workouts_day ON public.workouts(day);
CREATE INDEX idx_workout_logs_workout_id ON public.workout_logs(workout_id);
CREATE INDEX idx_messages_from_user ON public.messages(from_user_id);
CREATE INDEX idx_messages_to_user ON public.messages(to_user_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);
CREATE INDEX idx_notification_settings_user_id ON public.notification_settings(user_id);

-- ============================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weeks_updated_at
  BEFORE UPDATE ON public.weeks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workouts_updated_at
  BEFORE UPDATE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workout_logs_updated_at
  BEFORE UPDATE ON public.workout_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCTION: Auto-create user profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: when a new user signs up via Supabase Auth, auto-create their profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
