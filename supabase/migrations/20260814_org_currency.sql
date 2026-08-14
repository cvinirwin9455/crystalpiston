-- Add currency column to organizations table
-- Default 'USD' for all existing organizations
-- Coaches set this in Account Preferences; clients inherit it automatically

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
