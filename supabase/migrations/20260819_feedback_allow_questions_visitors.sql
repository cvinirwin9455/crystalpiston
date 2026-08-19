-- Allow unauthenticated inquiries (visitor questions from FAQ contact form)
-- and add 'question' as a valid feedback type

-- 1. Allow NULL user_id (for anonymous/visitor submissions)
ALTER TABLE public.feedback ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add 'question' to the type check constraint
ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_type_check;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_type_check CHECK (type IN ('bug', 'feedback', 'question'));

-- 3. Add 'visitor' to the user_role check constraint
ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_user_role_check;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_user_role_check CHECK (user_role IN ('coach', 'client', 'visitor'));

-- 4. Add a service-role bypass policy for inserting anonymous feedback
-- (the service role key already bypasses RLS, but this documents intent)
CREATE POLICY "Service role can insert anonymous feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- Drop the old restrictive insert policy and replace
DROP POLICY IF EXISTS "Users can insert own feedback" ON public.feedback;
CREATE POLICY "Users can insert own feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);
