-- Multi-Coach System Migration
-- Creates the client_coaches junction table and adds coach tracking to weeks/comments

-- 1. Create client_coaches junction table
-- Links clients to their assigned coaches with a default coach flag
CREATE TABLE IF NOT EXISTS client_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, coach_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_client_coaches_client_id ON client_coaches(client_id);
CREATE INDEX IF NOT EXISTS idx_client_coaches_coach_id ON client_coaches(coach_id);

-- 2. Add created_by_coach_id to weeks table to track which coach created the week
ALTER TABLE weeks ADD COLUMN IF NOT EXISTS created_by_coach_id UUID REFERENCES auth.users(id);

-- 3. Add created_by_coach_id to workout_comments table  
ALTER TABLE workout_comments ADD COLUMN IF NOT EXISTS created_by_coach_id UUID REFERENCES auth.users(id);

-- 4. Add created_by_coach_id to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS created_by_coach_id UUID REFERENCES auth.users(id);

-- 5. Seed existing data: assign Crystal (first admin) as default coach for all existing clients
-- This ensures backward compatibility - Crystal stays as the coach for all current clients
DO $$
DECLARE
  first_admin_id UUID;
  client_record RECORD;
BEGIN
  -- Get the first admin user (Crystal)
  SELECT id INTO first_admin_id FROM auth.users 
  WHERE id IN (SELECT id FROM public.users WHERE role = 'admin')
  ORDER BY created_at ASC
  LIMIT 1;

  IF first_admin_id IS NOT NULL THEN
    -- For each existing client, create a coach assignment
    FOR client_record IN SELECT id FROM clients LOOP
      INSERT INTO client_coaches (client_id, coach_id, is_default)
      VALUES (client_record.id, first_admin_id, true)
      ON CONFLICT (client_id, coach_id) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- 6. Enable RLS on client_coaches
ALTER TABLE client_coaches ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage coach assignments
CREATE POLICY "Admins can manage client_coaches" ON client_coaches
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow coaches to read their own assignments
CREATE POLICY "Coaches can read own assignments" ON client_coaches
  FOR SELECT
  USING (coach_id = auth.uid());
