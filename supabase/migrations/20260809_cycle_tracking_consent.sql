-- Cycle Tracking Consent Flow
-- Adds consent columns to the clients table for period/menstrual cycle tracking.
-- Coach requests tracking → client must consent before any data is visible.

-- cycle_tracking_requested: set by coach (true = coach wants to track this for the client)
-- cycle_tracking_consented: set by client (null = not yet responded, true = opted in, false = opted out)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cycle_tracking_requested BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cycle_tracking_consented BOOLEAN DEFAULT null;
