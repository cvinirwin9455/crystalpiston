-- ============================================================
-- PWA Push Notifications & WebAuthn Biometric Login
-- Supabase Migration
-- ============================================================
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- or via supabase db push if using local CLI.
-- ============================================================

-- 1. Push Subscriptions Table
-- Stores Web Push API subscriptions for each user/device.
-- One user can have multiple subscriptions (e.g., phone + laptop).
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL DEFAULT '',
  auth TEXT NOT NULL DEFAULT '',
  subscription_json TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one subscription endpoint per row (upsert key)
ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON push_subscriptions(user_id);

-- 2. WebAuthn Credentials Table
-- Stores registered passkey/biometric credentials for each user.
-- One user can have multiple credentials (e.g., iPhone Face ID + MacBook Touch ID).
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_type TEXT NOT NULL DEFAULT 'singleDevice',
  backed_up BOOLEAN NOT NULL DEFAULT false,
  transports TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one credential_id per row
ALTER TABLE webauthn_credentials
  ADD CONSTRAINT webauthn_credentials_credential_id_unique UNIQUE (credential_id);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id
  ON webauthn_credentials(user_id);

-- Composite index for authentication lookups (user + credential)
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_credential
  ON webauthn_credentials(user_id, credential_id);

-- 3. WebAuthn Challenges Table
-- Temporary storage for registration/authentication challenges.
-- Challenges expire after 5 minutes. One active challenge per user.
CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('registration', 'authentication')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only one active challenge per user (upsert key)
ALTER TABLE webauthn_challenges
  ADD CONSTRAINT webauthn_challenges_user_id_unique UNIQUE (user_id);

-- 4. Row Level Security (RLS)
-- Enable RLS on all new tables. Access is managed via service_role key
-- in the API routes, so we just need basic policies.

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Allow users to read/manage their own push subscriptions
CREATE POLICY "Users can manage their own push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to read their own WebAuthn credentials
CREATE POLICY "Users can view their own WebAuthn credentials"
  ON webauthn_credentials
  FOR SELECT
  USING (auth.uid() = user_id);

-- WebAuthn credentials and challenges are managed via service_role (admin client)
-- so we add a permissive policy for the service role
CREATE POLICY "Service role full access to webauthn_credentials"
  ON webauthn_credentials
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to webauthn_challenges"
  ON webauthn_challenges
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. Cleanup function for expired challenges (optional, run periodically)
-- You can set up a Supabase Edge Function or cron to call this.
CREATE OR REPLACE FUNCTION cleanup_expired_webauthn_challenges()
RETURNS void AS $$
BEGIN
  DELETE FROM webauthn_challenges WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ENVIRONMENT VARIABLES NEEDED
-- ============================================================
-- Add these to your Vercel (or hosting) environment variables:
--
-- NEXT_PUBLIC_VAPID_PUBLIC_KEY  — Your VAPID public key (used client + server side)
-- VAPID_PRIVATE_KEY            — Your VAPID private key (server only)
-- VAPID_SUBJECT                — mailto:hello@firstmilecoach.com (or your domain URL)
-- WEBAUTHN_RP_ID               — Your domain: firstmilecoach.com (no https://, no port)
-- WEBAUTHN_ORIGIN              — Full origin: https://firstmilecoach.com
--
-- To generate VAPID keys, run this once locally:
--   npx web-push generate-vapid-keys
--
-- Example output:
--   Public Key:  BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkOs5k...
--   Private Key: UUxI4O8-FbRoute1mWg5ONmFCR7pCYkU...
-- ============================================================
