-- Add plans table to support multiple plans per client
-- Each plan has its own date range and payment tracking

CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  owed DECIMAL(10, 2) NOT NULL DEFAULT 0,
  paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Policies using is_admin() function (no recursion)
CREATE POLICY "Admins can manage all plans"
  ON public.plans FOR ALL
  USING (public.is_admin());

CREATE POLICY "Clients can view their own plans"
  ON public.plans FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- Index
CREATE INDEX idx_plans_client_id ON public.plans(client_id);

-- Auto-update trigger
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing data: create a plan for each client that has start_date/plan_end set
INSERT INTO public.plans (client_id, start_date, end_date, owed, paid, status)
SELECT 
  id,
  COALESCE(start_date, CURRENT_DATE),
  COALESCE(plan_end, CURRENT_DATE + INTERVAL '3 months'),
  COALESCE(owed, 0),
  COALESCE(paid, 0),
  CASE 
    WHEN plan_end < CURRENT_DATE THEN 'completed'
    ELSE 'active'
  END
FROM public.clients
WHERE start_date IS NOT NULL OR plan_end IS NOT NULL OR owed > 0;
