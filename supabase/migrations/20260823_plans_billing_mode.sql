-- Add billing_mode column to plans table
-- Tracks how the client is billed for this specific plan

ALTER TABLE public.plans 
  ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT 'time_period'
  CHECK (billing_mode IN ('time_period', 'per_session', 'hybrid'));
