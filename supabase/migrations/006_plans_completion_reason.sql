-- Add completion_reason column to plans table
-- Stores the reason when a plan is completed with outstanding balance
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS completion_reason TEXT;
