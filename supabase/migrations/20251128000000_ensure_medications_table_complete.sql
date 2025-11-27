/*
  # Ensure Medications Table is Complete
  
  This migration ensures the medications table exists with all required columns
  and proper RLS policies. It's idempotent and can be run multiple times safely.
*/

-- Create medications table if it doesn't exist
CREATE TABLE IF NOT EXISTS medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  generic_name text,
  dosage text,
  frequency text,
  description text,
  image_url text,
  reminder_time text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'medications_user_id_fkey'
    AND table_name = 'medications'
  ) THEN
    ALTER TABLE medications
    ADD CONSTRAINT medications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add category column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'category'
  ) THEN
    ALTER TABLE medications
    ADD COLUMN category text DEFAULT 'otc' CHECK (category IN ('otc', 'prescription', 'supplement'));
  END IF;
END $$;

-- Add is_prescription column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'is_prescription'
  ) THEN
    ALTER TABLE medications ADD COLUMN is_prescription boolean DEFAULT false;
  END IF;
END $$;

-- Add recommended_dosage column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'recommended_dosage'
  ) THEN
    ALTER TABLE medications ADD COLUMN recommended_dosage text;
  END IF;
END $$;

-- Add recommended_frequency column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'recommended_frequency'
  ) THEN
    ALTER TABLE medications ADD COLUMN recommended_frequency text;
  END IF;
END $$;

-- Add dosage_notes column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'dosage_notes'
  ) THEN
    ALTER TABLE medications ADD COLUMN dosage_notes text;
  END IF;
END $$;

-- Add reminder_frequency column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'reminder_frequency'
  ) THEN
    ALTER TABLE medications ADD COLUMN reminder_frequency text CHECK (reminder_frequency IN ('daily', 'weekly', 'monthly')) DEFAULT 'daily';
  END IF;
END $$;

-- Add reminder_days column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'reminder_days'
  ) THEN
    ALTER TABLE medications ADD COLUMN reminder_days integer[] DEFAULT ARRAY[]::integer[];
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_medications_user_id ON medications(user_id);
CREATE INDEX IF NOT EXISTS idx_medications_active ON medications(user_id, active);
CREATE INDEX IF NOT EXISTS idx_medications_category ON medications(user_id, category);

-- Enable Row Level Security
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own medications" ON medications;
  DROP POLICY IF EXISTS "Users can insert own medications" ON medications;
  DROP POLICY IF EXISTS "Users can update own medications" ON medications;
  DROP POLICY IF EXISTS "Users can delete own medications" ON medications;
END $$;

-- Create RLS policies
CREATE POLICY "Users can view own medications"
  ON medications FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own medications"
  ON medications FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own medications"
  ON medications FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own medications"
  ON medications FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Create function to automatically update updated_at timestamp if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at if it doesn't exist
DROP TRIGGER IF EXISTS update_medications_updated_at ON medications;
CREATE TRIGGER update_medications_updated_at
  BEFORE UPDATE ON medications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


