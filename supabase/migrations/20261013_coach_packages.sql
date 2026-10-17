-- ============================================================
-- Coach Packages (Stripe Payments — Step A)
-- ============================================================
-- Purpose:
--   A structured list of the offerings a coach charges for, replacing the
--   free-text `pricing` block on coach_application_pages. Each package is one
--   thing a coach can request payment for — e.g. "Run" at $125/month, or
--   "Marathon Prep" at $499 one-time. Coaches can also charge a custom one-off
--   amount without a package, so this table is for their COMMON offerings.
--
--   Shown (optionally) on the public /join/<slug> page so prospects see pricing
--   before applying, and used later (Step C) as the thing Stripe charges for.
--
--   Keyed on coach_id (a coach IS an auth identity) and carries organization_id
--   to match the scoping used across the billing/session tables.
-- ============================================================

CREATE TABLE IF NOT EXISTS coach_packages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- Display name, e.g. "Run + Strength" or "Marathon Prep".
  name            TEXT NOT NULL,
  -- Optional short description shown on the public page.
  description     TEXT,

  -- Price in MINOR units (cents) to avoid float rounding. $125.00 => 12500.
  price_cents     INTEGER NOT NULL CHECK (price_cents >= 0),
  -- ISO currency; defaults to the org currency convention ('usd').
  currency        TEXT NOT NULL DEFAULT 'usd',

  -- 'monthly' = recurring subscription; 'one_time' = single charge.
  billing_interval TEXT NOT NULL DEFAULT 'monthly'
                     CHECK (billing_interval IN ('monthly', 'one_time')),

  -- Optional soft cap on how many ACTIVE clients may hold this package
  -- (e.g. Adam caps "Performance" at ~5). NULL = unlimited. Enforcement is in
  -- application logic, not the DB.
  client_cap      INTEGER CHECK (client_cap IS NULL OR client_cap > 0),

  -- Coach can retire a package without deleting history. Inactive packages are
  -- hidden from the public page and from new payment requests.
  is_active       BOOLEAN NOT NULL DEFAULT true,

  -- Display ordering on the public page / picker (lower first).
  sort_order      INTEGER NOT NULL DEFAULT 0,

  -- Stripe linkage (populated in Step B once the coach connects Stripe). The
  -- Stripe Product/Price live on the COACH's connected account.
  stripe_product_id TEXT,
  stripe_price_id   TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coach_packages_coach
  ON coach_packages (coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_packages_coach_active
  ON coach_packages (coach_id, is_active);
CREATE INDEX IF NOT EXISTS idx_coach_packages_org
  ON coach_packages (organization_id);

-- Keep updated_at fresh (reuses the shared trigger function if present).
DROP TRIGGER IF EXISTS trg_coach_packages_updated_at ON coach_packages;
CREATE TRIGGER trg_coach_packages_updated_at
  BEFORE UPDATE ON coach_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS: coaches manage their own packages; the public page reads active
-- packages through the service-role client (same pattern as the application
-- link tables), so no public SELECT policy is granted here.
-- ============================================================
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

-- Optional flag on the public page: whether to show packages/pricing to
-- prospects. Defaults to true so Adam's request ("show my packages") is the
-- default behaviour.
ALTER TABLE coach_application_pages
  ADD COLUMN IF NOT EXISTS show_packages BOOLEAN NOT NULL DEFAULT true;
