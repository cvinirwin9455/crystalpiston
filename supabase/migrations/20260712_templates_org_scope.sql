-- Add organization_id to templates table for per-coach isolation
-- Each coach's templates are scoped to their own organization

ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Index for fast org-scoped lookups
CREATE INDEX IF NOT EXISTS idx_templates_organization_id ON public.templates(organization_id);

-- Existing templates (Crystal's) get assigned to Crystal's org
UPDATE public.templates
SET organization_id = 'fffa6f6b-8226-40d9-9e49-ff17164334f4'
WHERE organization_id IS NULL;
