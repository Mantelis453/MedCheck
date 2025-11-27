/*
  # Add Onboarding Enhancements to User Profiles

  1. New Columns
    - `height` (numeric) - User's height in centimeters
    - `lifestyle` (jsonb) - Lifestyle factors (smoking, alcohol use)
    - `emergency_contact` (jsonb) - Emergency contact information
    - `biometric_data` (jsonb) - Biometric information (blood type, etc.)
    - `family_medical_history` (text[]) - Family medical history
    - `medication_history` (text[]) - Previous medications

  2. Indexes
    - Add index on height for filtering
    - Add index on lifestyle for queries

  Note: This migration will create the user_profiles table if it doesn't exist,
  making it safe to run even if base migrations haven't been executed.
*/

-- Create user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  full_name text NOT NULL,
  date_of_birth date,
  gender text,
  allergies text[] DEFAULT '{}',
  medical_conditions text[] DEFAULT '{}',
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS if not already enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies if they don't exist
DO $$
BEGIN
  -- Drop existing policies if they exist (to avoid conflicts)
  DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
  
  -- Create policies
  CREATE POLICY "Users can read own profile"
    ON user_profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can insert own profile"
    ON user_profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can update own profile"
    ON user_profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
END $$;

-- Create index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add weight column if it doesn't exist (from previous migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'weight'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN weight numeric(5,2);
  END IF;
END $$;

-- Add height column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'height'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN height numeric(5,2);
  END IF;
END $$;

-- Add lifestyle JSONB column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'lifestyle'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN lifestyle jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add emergency_contact JSONB column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'emergency_contact'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN emergency_contact jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add biometric_data JSONB column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'biometric_data'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN biometric_data jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add family_medical_history array column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'family_medical_history'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN family_medical_history text[] DEFAULT '{}';
  END IF;
END $$;

-- Add medication_history array column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'medication_history'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN medication_history text[] DEFAULT '{}';
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_height ON user_profiles(height) WHERE height IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_lifestyle ON user_profiles USING gin(lifestyle);
CREATE INDEX IF NOT EXISTS idx_user_profiles_emergency_contact ON user_profiles USING gin(emergency_contact);


