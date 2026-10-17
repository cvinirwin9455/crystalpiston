-- ============================================================
-- Application Package Selection
-- ============================================================
-- When a coach has packages configured, applicants can select one from a
-- dropdown instead of typing free text. The selected package ID is stored
-- for reference when the coach reviews the application.
-- ============================================================

-- Add selected_package_id to coach_applications
ALTER TABLE coach_applications
  ADD COLUMN IF NOT EXISTS selected_package_id UUID REFERENCES coach_packages(id) ON DELETE SET NULL;

-- Index for looking up applications by package (useful if coach wants to
-- filter applications by which package they selected)
CREATE INDEX IF NOT EXISTS idx_coach_applications_package
  ON coach_applications (selected_package_id)
  WHERE selected_package_id IS NOT NULL;

-- Add a comment explaining the relationship between plan_interest and selected_package_id
COMMENT ON COLUMN coach_applications.selected_package_id IS 
  'If the coach has packages, this is the package the applicant selected. The plan_interest text field is still available for coaches without packages or for additional notes.';
