-- Add completed status to client-added workouts
ALTER TABLE public.client_workouts 
  ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.client_workouts 
  ADD COLUMN IF NOT EXISTS completed_notes TEXT;


-- Add UPDATE policy for client_workouts (needed for marking complete)
CREATE POLICY "Users can update their own client workouts"
  ON public.client_workouts FOR UPDATE
  USING (auth.uid() = user_id);
