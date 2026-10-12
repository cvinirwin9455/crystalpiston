-- ============================================================
-- Strava match integrity: one activity per workout, and ensure the
-- matched_client_workout_id column actually exists in the schema.
-- ============================================================
-- Background:
--   A single Strava activity was being displayed as "complete" on TWO
--   programmed workouts on the same day (e.g. a 13.11mi run showing on both a
--   13mi Long Run and a 4mi Easy Run). Part of the cause is that nothing at
--   the DB level stopped two different strava_activities rows from pointing at
--   the same matched_workout_id, and the display routes then back-filled both
--   workouts' logs with the same activity's stats.
--
--   This migration adds a guard rail: a given programmed workout can be the
--   match target of AT MOST ONE Strava activity. The application-side display
--   hardening (my-weeks / weeks routes) handles the rest.
--
--   It also makes `matched_client_workout_id` an explicit, committed column.
--   The application code (strava import / activities / my-weeks) already reads
--   and writes this column, but it only existed via live-DB drift and was
--   never in a migration. Adding it IF NOT EXISTS is safe on all environments.
-- ============================================================

-- 1. Ensure matched_client_workout_id exists (schema drift fix).
--    References client_workouts; clearing on delete keeps rows valid.
ALTER TABLE public.strava_activities
  ADD COLUMN IF NOT EXISTS matched_client_workout_id UUID
  REFERENCES public.client_workouts(id) ON DELETE SET NULL;

-- 2. Before enforcing uniqueness, clear any EXISTING duplicate matches so the
--    index can be created. For any workout claimed by more than one activity,
--    keep the earliest-created match and unlink the rest (back to 'pending').
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY matched_workout_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.strava_activities
  WHERE matched_workout_id IS NOT NULL
)
UPDATE public.strava_activities sa
SET match_status = 'pending',
    matched_workout_id = NULL
FROM ranked
WHERE sa.id = ranked.id
  AND ranked.rn > 1;

-- 3. Enforce: at most one Strava activity may claim a given programmed workout.
--    Partial unique index ignores the many NULL (unmatched) rows.
CREATE UNIQUE INDEX IF NOT EXISTS strava_activities_matched_workout_unique
  ON public.strava_activities (matched_workout_id)
  WHERE matched_workout_id IS NOT NULL;
