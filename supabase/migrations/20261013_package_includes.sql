-- Add includes_* columns to coach_packages
-- These control which questions applicants see when selecting this package:
--   includes_running = show running questions (experience, PRs, target race)
--   includes_strength = show strength/PT questions (goal, experience, equipment)
--   includes_in_person = show in-person questions (location, sessions per week)
--   includes_programming = indicates remote programming is included (informational)

ALTER TABLE coach_packages
ADD COLUMN IF NOT EXISTS includes_running BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE coach_packages
ADD COLUMN IF NOT EXISTS includes_strength BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE coach_packages
ADD COLUMN IF NOT EXISTS includes_in_person BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE coach_packages
ADD COLUMN IF NOT EXISTS includes_programming BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN coach_packages.includes_running IS 'Package includes running coaching - shows running questions on application';
COMMENT ON COLUMN coach_packages.includes_strength IS 'Package includes strength/PT coaching - shows strength questions on application';
COMMENT ON COLUMN coach_packages.includes_in_person IS 'Package includes in-person sessions - shows location/availability questions on application';
COMMENT ON COLUMN coach_packages.includes_programming IS 'Package includes remote programming/plans';
