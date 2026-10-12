-- Add delivery_format column to coach_packages
-- This single field controls which questions applicants see when selecting this package:
--   'programming' = remote only (no in-person questions)
--   'in_person' = in-person sessions (shows location/availability questions)
--   'hybrid' = both programming and in-person (shows all questions)

ALTER TABLE coach_packages
ADD COLUMN IF NOT EXISTS delivery_format TEXT NOT NULL DEFAULT 'programming'
CHECK (delivery_format IN ('programming', 'in_person', 'hybrid'));

COMMENT ON COLUMN coach_packages.delivery_format IS 'How the package is delivered: programming (remote), in_person, or hybrid (both)';
