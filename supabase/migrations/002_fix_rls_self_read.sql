-- Fix: Ensure users can always read their own profile
-- The original policy might conflict with the admin policy due to OR logic

-- Drop existing SELECT policies on users
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

-- Create a single combined SELECT policy
CREATE POLICY "Users can view own profile or admins can view all"
  ON public.users FOR SELECT
  USING (
    auth.uid() = id
    OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
