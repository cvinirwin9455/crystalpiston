-- ============================================================
-- Coach Application Offerings (Phase 1.1)
-- ============================================================
-- Adds a coach's OFFERINGS to their application page and lets prospects pick
-- what they want, revealing discipline/format-specific questions.
--
-- Two independent dimensions:
--   * coaching TYPE   : 'running', 'personal_training'   (what discipline)
--   * delivery FORMAT : 'programming', 'in_person'       (how they work)
--
-- A coach selects which types + formats they offer. A prospect selects a
-- subset (one or many), which reveals the matching question blocks on the
-- public form. The answers are stored on coach_applications.
-- ============================================================

-- --- Coach side: what the coach offers (shown as choices on their page) ---
ALTER TABLE coach_application_pages
  ADD COLUMN IF NOT EXISTS offer_types   TEXT[] NOT NULL DEFAULT ARRAY['running']::TEXT[],
  ADD COLUMN IF NOT EXISTS offer_formats TEXT[] NOT NULL DEFAULT ARRAY['programming']::TEXT[];

-- Backfill existing coaches to the running + programming defaults (the form's
-- previous hardcoded behavior) so nothing changes for them until they edit.
UPDATE coach_application_pages
  SET offer_types = ARRAY['running']::TEXT[]
  WHERE offer_types IS NULL OR cardinality(offer_types) = 0;
UPDATE coach_application_pages
  SET offer_formats = ARRAY['programming']::TEXT[]
  WHERE offer_formats IS NULL OR cardinality(offer_formats) = 0;

-- --- Applicant side: what the prospect selected + discipline/format answers ---
ALTER TABLE coach_applications
  -- What the prospect picked (subset of the coach's offerings).
  ADD COLUMN IF NOT EXISTS interested_types   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS interested_formats TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- Personal-training-specific answers (revealed when PT is selected).
  ADD COLUMN IF NOT EXISTS pt_goal             TEXT,  -- strength / weight loss / general fitness / muscle gain
  ADD COLUMN IF NOT EXISTS training_experience TEXT,  -- new / some / experienced
  ADD COLUMN IF NOT EXISTS equipment_access    TEXT,  -- home / gym / both + what equipment
  -- In-person-specific answers (revealed when in_person is selected).
  ADD COLUMN IF NOT EXISTS preferred_location  TEXT,
  ADD COLUMN IF NOT EXISTS sessions_per_week   TEXT;

-- NOTE: existing running columns (running_experience, target_race, current_prs)
-- are reused for the running question block — no change needed there.
