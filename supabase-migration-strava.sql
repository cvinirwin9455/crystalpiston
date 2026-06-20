-- Strava Integration Migration
-- Run this in the Supabase SQL editor

-- 1. Create strava_connections table
CREATE TABLE IF NOT EXISTS strava_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strava_athlete_id BIGINT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  athlete_firstname TEXT,
  athlete_lastname TEXT,
  athlete_profile TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(strava_athlete_id)
);

-- 2. Create strava_activities table to track synced activities
CREATE TABLE IF NOT EXISTS strava_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strava_activity_id BIGINT NOT NULL UNIQUE,
  week_id UUID REFERENCES weeks(id) ON DELETE SET NULL,
  day TEXT NOT NULL,
  type TEXT NOT NULL,
  training_type TEXT,
  miles NUMERIC(6,2),
  duration TEXT,
  average_pace TEXT,
  activity_name TEXT,
  strava_type TEXT,
  moving_time_seconds INTEGER,
  distance_meters NUMERIC(10,2),
  start_date TIMESTAMPTZ,
  -- Matching state: 'pending' = shown to client to match, 'matched' = linked to a programmed workout, 'standalone' = kept as client-added
  match_status TEXT NOT NULL DEFAULT 'pending',
  matched_workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add strava_activity_id column to client_workouts to link Strava imports
ALTER TABLE client_workouts ADD COLUMN IF NOT EXISTS strava_activity_id UUID REFERENCES strava_activities(id) ON DELETE SET NULL;

-- 4. Add source column to client_workouts to indicate origin
ALTER TABLE client_workouts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- 5. Add duration column to client_workouts if not exists
ALTER TABLE client_workouts ADD COLUMN IF NOT EXISTS duration TEXT;

-- 6. Add average_pace column to client_workouts if not exists  
ALTER TABLE client_workouts ADD COLUMN IF NOT EXISTS average_pace TEXT;

-- 7. Add activity_name column to client_workouts for Strava activity names
ALTER TABLE client_workouts ADD COLUMN IF NOT EXISTS activity_name TEXT;

-- 8. Create index for fast webhook lookups
CREATE INDEX IF NOT EXISTS idx_strava_connections_athlete_id ON strava_connections(strava_athlete_id);
CREATE INDEX IF NOT EXISTS idx_strava_activities_user_week ON strava_activities(user_id, week_id);
CREATE INDEX IF NOT EXISTS idx_strava_activities_strava_id ON strava_activities(strava_activity_id);

-- 9. RLS policies for strava_connections
ALTER TABLE strava_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own strava connection"
  ON strava_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own strava connection"
  ON strava_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own strava connection"
  ON strava_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own strava connection"
  ON strava_connections FOR DELETE
  USING (auth.uid() = user_id);

-- 10. RLS policies for strava_activities
ALTER TABLE strava_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own strava activities"
  ON strava_activities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage strava activities"
  ON strava_activities FOR ALL
  USING (true);
