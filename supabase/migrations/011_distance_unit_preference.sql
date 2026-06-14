-- Add distance_unit preference column to notification_preferences table (reusing for user prefs)
ALTER TABLE public.notification_preferences 
  ADD COLUMN IF NOT EXISTS distance_unit TEXT NOT NULL DEFAULT 'mi' CHECK (distance_unit IN ('mi', 'km'));
