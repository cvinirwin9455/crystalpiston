-- Templates table: stores reusable week and day training templates
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('week', 'day')),
  category TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by type
CREATE INDEX idx_templates_type ON public.templates(type);

-- RLS policies
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- Only admin can manage templates
CREATE POLICY "Admin full access on templates"
  ON public.templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
