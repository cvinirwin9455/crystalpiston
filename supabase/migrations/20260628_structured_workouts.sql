-- Add structure JSONB column to workouts table for structured run data
-- This stores warm-up, main set blocks (intervals/tempo/progression/etc), and cool-down
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS structure JSONB;
