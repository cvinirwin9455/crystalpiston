-- Add distance unit preference for clients (mi or km)
ALTER TABLE public.notification_preferences 
  ADD COLUMN IF NOT EXISTS distance_unit TEXT NOT NULL DEFAULT 'mi' CHECK (distance_unit IN ('mi', 'km'));

-- Add distance_unit to workouts table so we know what unit the coach entered
ALTER TABLE public.workouts 
  ADD COLUMN IF NOT EXISTS distance_unit TEXT NOT NULL DEFAULT 'mi' CHECK (distance_unit IN ('mi', 'km'));
