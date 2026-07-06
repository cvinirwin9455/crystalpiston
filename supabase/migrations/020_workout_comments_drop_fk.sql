-- Drop the foreign key constraint on workout_comments so comments can reference
-- both workouts (programmed) and client_workouts (client-added/strava) IDs.
-- The application already passes IDs from both tables to the comments API.

-- Find and drop the FK constraint (name may vary)
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO constraint_name
  FROM information_schema.table_constraints tc
  WHERE tc.table_name = 'workout_comments'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.workout_comments DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- Add access_level column to users table for coach access control
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS access_level TEXT DEFAULT 'all_clients';
