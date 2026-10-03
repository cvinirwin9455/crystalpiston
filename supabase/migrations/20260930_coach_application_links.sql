-- ============================================================
-- Coach Application Links (Phase 1 of the coach signup funnel)
-- ============================================================
-- Purpose:
--   Let each coach share ONE public link (firstmilecoach.com/join/<slug>)
--   on social media. A potential client fills out an application. NO account
--   is created at this point — the application lands in the coach's
--   "Applications" inbox, where the coach reviews it and either ACCEPTS
--   (which triggers the existing /api/clients invite flow — real account +
--   coach assignment + set-password email) or DECLINES (archived, nothing
--   sent).
--
--   This mirrors the existing beta_signups lead-capture pattern, but targets
--   CLIENTS applying to a specific COACH (keyed on users.id, since a coach IS
--   an auth identity).
--
-- Phase 2 (later) will add Stripe payment between accept and account creation;
--   nothing here needs to change for that — the free-text pricing a coach
--   writes on their application page becomes the thing Stripe charges for.
-- ============================================================

-- 1. Per-coach public application page config.
--    One row per coach. Holds the shareable slug + the editable "offer" page
--    content (headline, about, free-text pricing) and an on/off switch.
CREATE TABLE IF NOT EXISTS coach_application_pages (
  coach_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  -- The public URL segment: firstmilecoach.com/join/<slug>. Lowercase,
  -- url-safe. Unique across all coaches.
  slug            TEXT NOT NULL UNIQUE,
  -- Is the public page live? Coaches can switch their link off.
  is_enabled      BOOLEAN NOT NULL DEFAULT true,
  -- Editable "offer" content shown to prospects (all optional / free-text).
  headline        TEXT,
  intro           TEXT,
  -- Free-text pricing block (Phase 1 is display-only, no checkout).
  pricing         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coach_application_pages_slug_format
    CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$' AND char_length(slug) BETWEEN 2 AND 40)
);

CREATE INDEX IF NOT EXISTS idx_coach_application_pages_org
  ON coach_application_pages (organization_id);

-- 2. The applications themselves (lead capture — NO account yet).
--    Each row is a prospective client who applied through a coach's link.
CREATE TABLE IF NOT EXISTS coach_applications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Which coach this application belongs to (resolved from the link slug).
  coach_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id  UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- Applicant-submitted fields (the funnel Adam specified). Only name + email
  -- are required; everything else is optional.
  full_name        TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT,
  age              INTEGER,
  sex              TEXT,                 -- free-text / 'male' | 'female' | other
  running_experience TEXT,              -- experience + current weekly mileage
  primary_goal     TEXT,
  target_race      TEXT,                -- race and/or date, free-text
  days_available   TEXT,                -- days available to train, free-text
  current_prs      TEXT,                -- current PRs, free-text
  injuries         TEXT,                -- injuries / limitations
  why_coaching     TEXT,                -- "why are you looking for coaching?"
  plan_interest    TEXT,                -- which of the coach's plans they want

  -- Review workflow.
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'declined')),
  reviewed_at      TIMESTAMPTZ,
  -- When accepted, the user id of the created/linked client account.
  accepted_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Consent / anti-abuse metadata (same shape as beta_signups).
  consent_ip         TEXT,
  consent_user_agent TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_applications_coach
  ON coach_applications (coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_applications_status
  ON coach_applications (coach_id, status);

-- 3. RLS. The public insert (new application) and the public read of a coach's
--    page both go through the service-role key in API routes, so RLS stays
--    strict and only lets a coach read/manage their OWN rows directly.
ALTER TABLE coach_application_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_applications ENABLE ROW LEVEL SECURITY;

-- A coach manages their own application page.
DROP POLICY IF EXISTS "Coach manages own application page" ON coach_application_pages;
CREATE POLICY "Coach manages own application page" ON coach_application_pages
  FOR ALL
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- A coach reads/updates their own applications.
DROP POLICY IF EXISTS "Coach reads own applications" ON coach_applications;
CREATE POLICY "Coach reads own applications" ON coach_applications
  FOR SELECT
  USING (coach_id = auth.uid());

DROP POLICY IF EXISTS "Coach updates own applications" ON coach_applications;
CREATE POLICY "Coach updates own applications" ON coach_applications
  FOR UPDATE
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- 4. Backfill a default application page + slug for every existing coach so
--    their link works immediately. Slug is derived from their name, with a
--    short suffix to guarantee uniqueness.
DO $$
DECLARE
  coach_record RECORD;
  base_slug TEXT;
  final_slug TEXT;
  suffix INT;
BEGIN
  FOR coach_record IN
    SELECT id, name, organization_id
    FROM public.users
    WHERE (role = 'admin' OR has_coach_access = true)
  LOOP
    -- Skip if this coach already has a page.
    IF EXISTS (SELECT 1 FROM coach_application_pages WHERE coach_id = coach_record.id) THEN
      CONTINUE;
    END IF;

    base_slug := regexp_replace(lower(coalesce(coach_record.name, 'coach')), '[^a-z0-9]+', '-', 'g');
    base_slug := regexp_replace(base_slug, '^-|-$', '', 'g');
    IF base_slug IS NULL OR char_length(base_slug) < 2 THEN
      base_slug := 'coach';
    END IF;

    final_slug := base_slug;
    suffix := 1;
    WHILE EXISTS (SELECT 1 FROM coach_application_pages WHERE slug = final_slug) LOOP
      suffix := suffix + 1;
      final_slug := base_slug || '-' || suffix;
    END LOOP;

    INSERT INTO coach_application_pages (coach_id, organization_id, slug, is_enabled, headline)
    VALUES (
      coach_record.id,
      coach_record.organization_id,
      final_slug,
      true,
      'Apply for coaching with ' || coalesce(coach_record.name, 'me')
    )
    ON CONFLICT (coach_id) DO NOTHING;
  END LOOP;
END $$;
