-- Add coach_id to clients table: assigns each client to a specific admin/coach
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES auth.users(id);

-- Index for fast filtering by coach
CREATE INDEX IF NOT EXISTS idx_clients_coach_id ON public.clients(coach_id);
