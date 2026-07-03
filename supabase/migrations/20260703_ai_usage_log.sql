-- AI Usage Log: tracks every AI Coach query locally for monthly budget tracking
-- This gives Crystal visibility into exactly what's being spent and when,
-- independent of the Vercel AI Gateway reporting.

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  client_id UUID REFERENCES users(id) ON DELETE SET NULL,
  data_depth TEXT CHECK (data_depth IN ('light', 'standard', 'deep')),
  prompt_preview TEXT, -- first 100 chars of the prompt
  tokens_used INTEGER DEFAULT 0,
  estimated_cost NUMERIC(10, 6) DEFAULT 0, -- cost in USD (e.g. 0.000150)
  provider TEXT, -- 'Vercel AI Gateway' or 'OpenAI Direct'
  model TEXT DEFAULT 'gpt-4o-mini'
);

-- Index for fast monthly queries
CREATE INDEX idx_ai_usage_log_created_at ON ai_usage_log(created_at);
CREATE INDEX idx_ai_usage_log_user_id ON ai_usage_log(user_id);

-- RLS: Only admins can read/write
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by the API route)
CREATE POLICY "Service role full access" ON ai_usage_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Admin users can read their own usage
CREATE POLICY "Admins can read usage" ON ai_usage_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
