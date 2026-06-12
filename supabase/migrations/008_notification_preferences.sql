-- Notification preferences table: stores per-user notification settings
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan_published BOOLEAN NOT NULL DEFAULT true,
  messages TEXT NOT NULL DEFAULT 'immediate' CHECK (messages IN ('immediate', 'daily', 'off')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by user
CREATE INDEX idx_notification_preferences_user_id ON public.notification_preferences(user_id);

-- RLS policies
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read and update their own preferences
CREATE POLICY "Users can view own notification preferences"
  ON public.notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admin can read all (for sending notifications)
CREATE POLICY "Admin can view all notification preferences"
  ON public.notification_preferences
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
