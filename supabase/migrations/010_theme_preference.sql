-- Add theme preference column to notification_preferences table (reusing for user prefs)
ALTER TABLE public.notification_preferences 
  ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light'));
