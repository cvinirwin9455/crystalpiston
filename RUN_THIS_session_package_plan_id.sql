-- ============================================================
-- Per-plan isolation for session packages
-- ------------------------------------------------------------
-- Ties each session package to the plan it belongs to, so a
-- client's "In-Person Sessions" card (purchased / paid / owed /
-- balance / remaining) reflects ONLY that plan — not a running
-- client-wide total across every plan they've ever had.
--
-- Sessions themselves stay client-wide (not plan-linked); the
-- per-plan "remaining" is computed as that plan's purchased minus
-- used, capped at the plan's purchased.
--
-- Safe to run multiple times.
-- ============================================================

-- Add plan_id (nullable; existing rows stay client-wide until you
-- backfill / clean the data yourself).
ALTER TABLE public.session_packages
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_session_packages_plan_id
  ON public.session_packages(plan_id);
