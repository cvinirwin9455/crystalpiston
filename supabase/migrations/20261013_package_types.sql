-- ============================================================
-- Package Types & Delivery Formats
-- ============================================================
-- Each package now has a coaching type and delivery format that controls
-- which question blocks appear on the application form when that package
-- is selected.
--
-- This replaces the offer_types / offer_formats on coach_application_pages
-- when a coach has packages configured.
-- ============================================================

-- Add coaching type to packages
-- 'running' = running-focused (shows running questions)
-- 'personal_training' = PT/strength-focused (shows PT questions)
-- 'hybrid' = both running and PT (shows both question blocks)
ALTER TABLE coach_packages
  ADD COLUMN IF NOT EXISTS package_type TEXT NOT NULL DEFAULT 'running'
    CHECK (package_type IN ('running', 'personal_training', 'hybrid'));

-- Add delivery format to packages
-- 'programming' = remote/programming only (no extra questions)
-- 'in_person' = in-person sessions (shows location/sessions-per-week questions)
-- 'both' = client can do either (shows in-person questions)
ALTER TABLE coach_packages
  ADD COLUMN IF NOT EXISTS delivery_format TEXT NOT NULL DEFAULT 'programming'
    CHECK (delivery_format IN ('programming', 'in_person', 'both'));

-- Add a comment explaining the relationship
COMMENT ON COLUMN coach_packages.package_type IS 
  'Controls which question blocks show on the application form: running shows running questions, personal_training shows PT questions, hybrid shows both.';

COMMENT ON COLUMN coach_packages.delivery_format IS 
  'Controls whether in-person questions (location, sessions/week) appear on the application form.';
