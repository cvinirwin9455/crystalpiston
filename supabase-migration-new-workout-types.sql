-- Migration: Add new workout type feature columns to organization_features
-- New types: Strength, HIIT, Swimming
-- Also: Make Run toggleable (add feature_run column), rename stretching to cover Mobility
-- Run this in Supabase SQL Editor

-- Add new feature columns (defaulting to true so existing orgs get all types enabled)
ALTER TABLE organization_features 
  ADD COLUMN IF NOT EXISTS feature_run BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS feature_strength BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS feature_hiit BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS feature_swimming BOOLEAN DEFAULT true;

-- Update any existing rows to have the new features enabled by default
UPDATE organization_features 
SET 
  feature_run = COALESCE(feature_run, true),
  feature_strength = COALESCE(feature_strength, true),
  feature_hiit = COALESCE(feature_hiit, true),
  feature_swimming = COALESCE(feature_swimming, true)
WHERE feature_strength IS NULL 
   OR feature_hiit IS NULL 
   OR feature_swimming IS NULL
   OR feature_run IS NULL;
