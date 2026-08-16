-- Migration: Create workout_moves table for tracking moved workouts (reset feature)
-- Run this in Supabase SQL Editor before deploying the drag-and-drop feature

CREATE TABLE IF NOT EXISTS workout_moves (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workout_id UUID NOT NULL,
  week_id UUID NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
  workout_type TEXT NOT NULL CHECK (workout_type IN ('programmed', 'client')),
  original_day TEXT NOT NULL,
  current_day TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by week
CREATE INDEX IF NOT EXISTS idx_workout_moves_week_id ON workout_moves(week_id);
CREATE INDEX IF NOT EXISTS idx_workout_moves_user_id ON workout_moves(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_moves_workout_id ON workout_moves(workout_id);

-- Unique constraint: one move record per workout
CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_moves_unique 
  ON workout_moves(workout_id, workout_type);

-- RLS policies
ALTER TABLE workout_moves ENABLE ROW LEVEL SECURITY;

-- Users can only see their own move records
CREATE POLICY "Users can view own workout moves" ON workout_moves
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own move records
CREATE POLICY "Users can insert own workout moves" ON workout_moves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own move records
CREATE POLICY "Users can update own workout moves" ON workout_moves
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own move records
CREATE POLICY "Users can delete own workout moves" ON workout_moves
  FOR DELETE USING (auth.uid() = user_id);

-- Service role bypass (for API routes using adminClient)
CREATE POLICY "Service role full access" ON workout_moves
  FOR ALL USING (true);
