-- Add distance_unit preference column to notification_preferences table
-- Used by both admin (Crystal) and clients to control how distances are displayed
ALTER TABLE public.notification_preferences 
  ADD COLUMN IF NOT EXISTS distance_unit TEXT NOT NULL DEFAULT 'mi' CHECK (distance_unit IN ('mi', 'km'));
