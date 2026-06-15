-- Client-added workouts: workouts logged by clients themselves (not programmed by Crystal)
CREATE TABLE IF NOT EXISTS public.client_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_id UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  day TEXT NOT NULL CHECK (day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  type TEXT NOT NULL CHECK (type IN ('run', 'walk', 'cross', 'cycling', 'stretching', 'strength', 'other')),
  training_type TEXT, -- subtype for run/walk (e.g., Easy, LongRun, etc.)
  miles NUMERIC, -- distance for run/walk/cycling
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: clients can only see/manage their own workouts
ALTER TABLE public.client_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own client workouts"
  ON public.client_workouts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own client workouts"
  ON public.client_workouts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own client workouts"
  ON public.client_workouts FOR DELETE
  USING (auth.uid() = user_id);

-- Index for efficient lookups
CREATE INDEX idx_client_workouts_week_id ON public.client_workouts(week_id);
CREATE INDEX idx_client_workouts_user_id ON public.client_workouts(user_id);
