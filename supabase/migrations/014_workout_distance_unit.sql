-- Add distance_unit column to workouts table so we know what unit each workout's distance was entered in
ALTER TABLE public.workouts 
  ADD COLUMN IF NOT EXISTS distance_unit TEXT NOT NULL DEFAULT 'mi' CHECK (distance_unit IN ('mi', 'km'));
