-- Workout comments: threaded comments between coach and client on individual workouts
CREATE TABLE IF NOT EXISTS public.workout_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies
ALTER TABLE public.workout_comments ENABLE ROW LEVEL SECURITY;

-- Everyone involved (admin + the client whose workout it is) can view comments
CREATE POLICY "Users can view workout comments"
  ON public.workout_comments FOR SELECT
  USING (true);

-- Any authenticated user can insert comments
CREATE POLICY "Users can insert workout comments"
  ON public.workout_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for efficient lookups
CREATE INDEX idx_workout_comments_workout_id ON public.workout_comments(workout_id);
