-- Add default_expanded preference to control whether day blocks are expanded or collapsed by default
ALTER TABLE public.notification_preferences 
  ADD COLUMN IF NOT EXISTS default_expanded BOOLEAN NOT NULL DEFAULT true;
