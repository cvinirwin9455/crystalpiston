-- Migration: Add 'notified' flag to workout_moves table for daily summary emails
-- Run this in Supabase SQL Editor

ALTER TABLE workout_moves 
  ADD COLUMN IF NOT EXISTS notified BOOLEAN DEFAULT false;

-- Index for fast lookup of un-notified moves (used by cron job)
CREATE INDEX IF NOT EXISTS idx_workout_moves_notified 
  ON workout_moves(notified) WHERE notified = false;
