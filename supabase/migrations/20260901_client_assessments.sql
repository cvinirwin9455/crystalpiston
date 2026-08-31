-- Client Health Assessment
-- Stores a new-client intake assessment (health screening, medication, injuries,
-- lifestyle, goals) as JSONB. One row per client, editable anytime by the client.
-- Coaches can view (read-only) and request a review.

CREATE TABLE IF NOT EXISTS public.client_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
  organization_id UUID,
  -- All answers stored as JSON (conditional sections, repeatable meds, etc.)
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Consent: client agreed to share health info + acknowledged coach is not medical
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_at TIMESTAMPTZ,
  -- Status: not_started (default), completed, review_requested
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'completed', 'review_requested')),
  completed_at TIMESTAMPTZ,
  review_requested_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_assessments_client_id ON public.client_assessments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_assessments_org_id ON public.client_assessments(organization_id);

ALTER TABLE public.client_assessments ENABLE ROW LEVEL SECURITY;

-- Admins/coaches manage all
CREATE POLICY "Admins can manage client_assessments"
  ON public.client_assessments FOR ALL
  USING (public.is_admin());

-- Clients can view + create + update their own
CREATE POLICY "Clients can view own assessment"
  ON public.client_assessments FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Clients can insert own assessment"
  ON public.client_assessments FOR INSERT
  WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Clients can update own assessment"
  ON public.client_assessments FOR UPDATE
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER update_client_assessments_updated_at
  BEFORE UPDATE ON public.client_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
