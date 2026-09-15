-- ============================================================
-- Dual-role accounts: one auth identity can be BOTH a coach and a client
-- ============================================================
-- Background:
--   Historically `users.role` was a single scalar: 'admin' (= coach) OR
--   'client'. The whole app branches on role === 'admin'. To let a single
--   person hold BOTH hats (e.g. a client of Crystal who also runs their own
--   coaching), we take an ADDITIVE approach rather than turning role into an
--   array:
--     * `role` stays the PRIMARY role and keeps every existing
--       `.eq('role', 'client' | 'admin')` query working unchanged.
--     * A new boolean `has_coach_access` grants coach capability regardless
--       of the primary role.
--   Coach capability  = (role = 'admin' OR has_coach_access = true)
--   Client capability = a row exists in public.clients for this user_id
--   Dual-role         = has BOTH of the above.
-- ============================================================

-- 1. Add the coach-capability flag. Existing admins are coaches by virtue of
--    role='admin'; this flag is for NON-admin-primary users who also coach.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS has_coach_access BOOLEAN NOT NULL DEFAULT false;

-- 2. Relax the role CHECK constraint so the app's existing writes are legal.
--    The app already writes role='inactive_coach' when a coach is removed
--    (see api/coaches/invite/route.ts DELETE), which violated the old
--    ('admin','client') constraint on stricter environments.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_role_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT users_role_check;
  END IF;
END $$;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'client', 'inactive_coach'));

-- 3. Update is_admin() so coach capability (not just primary role) grants the
--    admin RLS permissions coaches rely on. A dual-role user whose primary
--    role is 'client' but has_coach_access = true must still be able to do
--    coach work under RLS.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND (role = 'admin' OR has_coach_access = true)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Helpful index for looking up coach-capable users.
CREATE INDEX IF NOT EXISTS idx_users_has_coach_access
  ON public.users (has_coach_access)
  WHERE has_coach_access = true;

COMMENT ON COLUMN public.users.has_coach_access IS
  'Grants coach/admin capability to a user whose primary role is not admin (dual-role accounts). Coach capability = (role = ''admin'' OR has_coach_access = true).';
