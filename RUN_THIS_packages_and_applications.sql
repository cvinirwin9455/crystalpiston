-- ============================================================
-- RUN THIS in the Supabase SQL editor to fix the application form.
-- Everything here is idempotent (IF NOT EXISTS) — safe to run even if
-- some columns/tables already exist. It brings the DB up to date for the
-- coach packages + application offerings flow.
-- ============================================================

-- 1) Coach offerings + applicant discipline/format answer columns
--    (migration 20261001_coach_application_offerings.sql)
ALTER TABLE coach_application_pages
  ADD COLUMN IF NOT EXISTS offer_types   TEXT[] NOT NULL DEFAULT ARRAY['running']::TEXT[],
  ADD COLUMN IF NOT EXISTS offer_formats TEXT[] NOT NULL DEFAULT ARRAY['programming']::TEXT[];

UPDATE coach_application_pages
  SET offer_types = ARRAY['running']::TEXT[]
  WHERE offer_types IS NULL OR cardinality(offer_types) = 0;
UPDATE coach_application_pages
  SET offer_formats = ARRAY['programming']::TEXT[]
  WHERE offer_formats IS NULL OR cardinality(offer_formats) = 0;

ALTER TABLE coach_applications
  ADD COLUMN IF NOT EXISTS interested_types   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS interested_formats TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS pt_goal             TEXT,
  ADD COLUMN IF NOT EXISTS training_experience TEXT,
  ADD COLUMN IF NOT EXISTS equipment_access    TEXT,
  ADD COLUMN IF NOT EXISTS preferred_location  TEXT,
  ADD COLUMN IF NOT EXISTS sessions_per_week   TEXT;

-- 2) coach_packages table + show_packages flag
--    (migration 20261013_coach_packages.sql)
CREATE TABLE IF NOT EXISTS coach_packages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  price_cents     INTEGER NOT NULL CHECK (price_cents >= 0),
  currency        TEXT NOT NULL DEFAULT 'usd',
  billing_interval TEXT NOT NULL DEFAULT 'monthly'
                     CHECK (billing_interval IN ('monthly', 'one_time')),
  client_cap      INTEGER CHECK (client_cap IS NULL OR client_cap > 0),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  stripe_product_id TEXT,
  stripe_price_id   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_packages_coach        ON coach_packages (coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_packages_coach_active ON coach_packages (coach_id, is_active);
CREATE INDEX IF NOT EXISTS idx_coach_packages_org          ON coach_packages (organization_id);

DROP TRIGGER IF EXISTS trg_coach_packages_updated_at ON coach_packages;
CREATE TRIGGER trg_coach_packages_updated_at
  BEFORE UPDATE ON coach_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE coach_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coach_packages_select_own ON coach_packages;
CREATE POLICY coach_packages_select_own ON coach_packages
  FOR SELECT USING (coach_id = auth.uid());
DROP POLICY IF EXISTS coach_packages_insert_own ON coach_packages;
CREATE POLICY coach_packages_insert_own ON coach_packages
  FOR INSERT WITH CHECK (coach_id = auth.uid());
DROP POLICY IF EXISTS coach_packages_update_own ON coach_packages;
CREATE POLICY coach_packages_update_own ON coach_packages
  FOR UPDATE USING (coach_id = auth.uid());
DROP POLICY IF EXISTS coach_packages_delete_own ON coach_packages;
CREATE POLICY coach_packages_delete_own ON coach_packages
  FOR DELETE USING (coach_id = auth.uid());

ALTER TABLE coach_application_pages
  ADD COLUMN IF NOT EXISTS show_packages BOOLEAN NOT NULL DEFAULT true;

-- 3) selected_package_id on applications
--    (migration 20261013_application_package_selection.sql)
ALTER TABLE coach_applications
  ADD COLUMN IF NOT EXISTS selected_package_id UUID REFERENCES coach_packages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_coach_applications_package
  ON coach_applications (selected_package_id)
  WHERE selected_package_id IS NOT NULL;

-- 4) includes_* flags on packages (controls which questions show)
--    (migration 20261013_package_includes.sql)
ALTER TABLE coach_packages ADD COLUMN IF NOT EXISTS includes_running     BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE coach_packages ADD COLUMN IF NOT EXISTS includes_strength    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE coach_packages ADD COLUMN IF NOT EXISTS includes_in_person   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE coach_packages ADD COLUMN IF NOT EXISTS includes_programming BOOLEAN NOT NULL DEFAULT true;
