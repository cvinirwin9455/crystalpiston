-- Payments table: stores individual payment log entries for each plan
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by plan
CREATE INDEX idx_payments_plan_id ON public.payments(plan_id);

-- RLS policies
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admin full access on payments"
  ON public.payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Clients can read their own payments (via plan -> client -> user)
CREATE POLICY "Clients can view own payments"
  ON public.payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.plans p
      JOIN public.clients c ON c.id = p.client_id
      WHERE p.id = payments.plan_id AND c.user_id = auth.uid()
    )
  );
