-- Extend notification_preferences table for admin (Crystal) settings
ALTER TABLE public.notification_preferences 
  ADD COLUMN IF NOT EXISTS workout_completed TEXT NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS workout_skipped TEXT NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS workout_partial TEXT NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS client_message TEXT NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS daily_summary TEXT NOT NULL DEFAULT 'off',
  ADD COLUMN IF NOT EXISTS notification_emails TEXT;
