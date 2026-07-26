-- Feedback & Bug Reporting System
-- Allows coaches and clients on both Crystal Pistol and First Mile
-- to report bugs and submit feature feedback.

CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL CHECK (platform IN ('crystal-pistol', 'first-mile')),
  user_role TEXT NOT NULL CHECK (user_role IN ('coach', 'client')),
  type TEXT NOT NULL CHECK (type IN ('bug', 'feedback')),
  description TEXT NOT NULL,
  page_url TEXT,
  screenshot_url TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'implemented', 'wont_fix')),
  admin_notes TEXT,
  resolution_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_platform ON public.feedback(platform);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON public.feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON public.feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own feedback (to see status updates)
CREATE POLICY "Users can read own feedback"
  ON public.feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Super admins (account_coach level) can read all feedback
CREATE POLICY "Admins can read all feedback"
  ON public.feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.coaches
      WHERE coaches.user_id = auth.uid()
      AND coaches.coach_level = 'account_coach'
    )
  );

-- Super admins can update feedback (status, notes, resolution)
CREATE POLICY "Admins can update feedback"
  ON public.feedback FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.coaches
      WHERE coaches.user_id = auth.uid()
      AND coaches.coach_level = 'account_coach'
    )
  );

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION public.handle_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_feedback_updated_at();

-- Storage bucket for feedback screenshots (optional uploads)
-- Note: Run this in Supabase dashboard if not using supabase CLI:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('feedback-screenshots', 'feedback-screenshots', true);
