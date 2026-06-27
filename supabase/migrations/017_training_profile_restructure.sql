-- Training Profile Restructure:
-- 1. Add birthday column to clients table (replaces age)
-- 2. Add target_distance and race_date to plans table (moved from clients)
-- 3. Remove experience_level and days_per_week from clients table

-- Add birthday to clients (date field so age can be computed dynamically)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS birthday DATE;

-- Add target_distance and race_date to plans table (per-plan tracking)
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS target_distance TEXT,
  ADD COLUMN IF NOT EXISTS race_date DATE,
  ADD COLUMN IF NOT EXISTS goal_pace TEXT,
  ADD COLUMN IF NOT EXISTS injury_notes TEXT;

-- Migrate existing target_distance and race_date data from clients to their active plan
UPDATE public.plans p
SET target_distance = c.target_distance,
    race_date = c.race_date::date,
    goal_pace = c.goal_pace,
    injury_notes = c.injury_notes
FROM public.clients c
WHERE p.client_id = c.id
  AND p.status = 'active'
  AND (c.target_distance IS NOT NULL OR c.race_date IS NOT NULL OR c.goal_pace IS NOT NULL OR c.injury_notes IS NOT NULL);

-- Drop removed columns from clients
ALTER TABLE public.clients
  DROP COLUMN IF EXISTS experience_level,
  DROP COLUMN IF EXISTS days_per_week,
  DROP COLUMN IF EXISTS current_mileage,
  DROP COLUMN IF EXISTS easy_pace,
  DROP COLUMN IF EXISTS goal_pace,
  DROP COLUMN IF EXISTS injury_notes;
