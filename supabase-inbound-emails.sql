-- Inbound Emails table for super-admin inbox
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS inbound_emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID DEFAULT gen_random_uuid(),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT NOT NULL DEFAULT 'hello@firstmilecoach.com',
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  resend_email_id TEXT,
  read BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_inbound_emails_thread_id ON inbound_emails(thread_id);
CREATE INDEX idx_inbound_emails_created_at ON inbound_emails(created_at DESC);
CREATE INDEX idx_inbound_emails_read ON inbound_emails(read) WHERE read = FALSE;
CREATE INDEX idx_inbound_emails_archived ON inbound_emails(archived) WHERE archived = FALSE;
CREATE INDEX idx_inbound_emails_from_email ON inbound_emails(from_email);

-- RLS: only service role can access (super-admin uses service role client)
ALTER TABLE inbound_emails ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed — super-admin uses service role which bypasses RLS
