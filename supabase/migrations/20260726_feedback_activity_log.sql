-- Add activity_log JSON column to feedback table for persisting the activity history
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS activity_log JSONB DEFAULT '[]'::jsonb;
