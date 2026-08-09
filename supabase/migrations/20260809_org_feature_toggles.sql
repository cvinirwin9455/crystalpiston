-- Organization Feature Toggles
-- Stores which workout types and features are enabled per organization.
-- Account owners can toggle features on/off from Account Preferences.
-- When a feature is off, the option disappears from UI but existing data is preserved.

CREATE TABLE IF NOT EXISTS organization_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Workout type toggles (all default to true = enabled)
  feature_run BOOLEAN NOT NULL DEFAULT true,
  feature_walk BOOLEAN NOT NULL DEFAULT true,
  feature_cycling BOOLEAN NOT NULL DEFAULT true,
  feature_cross_training BOOLEAN NOT NULL DEFAULT true,
  feature_stretching BOOLEAN NOT NULL DEFAULT true,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One settings row per org
  UNIQUE(organization_id)
);

-- Index for fast lookups by org
CREATE INDEX IF NOT EXISTS idx_org_features_org_id ON organization_features(organization_id);

-- Enable RLS
ALTER TABLE organization_features ENABLE ROW LEVEL SECURITY;

-- Admins (account_coach level) can manage their org's features
CREATE POLICY "Admins can manage own org features" ON organization_features
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Coaches can read their org's features (needed to filter UI)
CREATE POLICY "Coaches can read own org features" ON organization_features
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Seed: create a default row for each existing organization with all features enabled
INSERT INTO organization_features (organization_id)
SELECT id FROM organizations
ON CONFLICT (organization_id) DO NOTHING;
