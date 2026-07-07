-- Add dismissed_banners column to notification_preferences
-- Stores an array of banner IDs that the user has dismissed (persists across devices)
ALTER TABLE public.notification_preferences 
  ADD COLUMN IF NOT EXISTS dismissed_banners JSONB DEFAULT '[]'::jsonb;
