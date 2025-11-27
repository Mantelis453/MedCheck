/*
  # Medication Checker Database Schema

  ## Overview
  Creates the core database structure for the AI-Powered Medication Checker MVP.
  
  ## New Tables
  
  ### 1. `profiles`
  User profile information for personalized medication checking
  - `id` (uuid, primary key) - Links to auth.users
  - `age` (integer) - User's age for dose calculations
  - `weight` (decimal) - User's weight in kg for dose calculations
  - `allergies` (text array) - List of known allergies
  - `conditions` (text array) - Medical conditions (optional)
  - `created_at` (timestamptz) - Profile creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 2. `medications`
  User's medication list with AI-extracted information
  - `id` (uuid, primary key) - Unique medication record ID
  - `user_id` (uuid, foreign key) - Owner of the medication
  - `name` (text) - Medication name
  - `generic_name` (text) - Generic drug name
  - `dosage` (text) - Dosage strength (e.g., "500mg")
  - `frequency` (text) - How often to take (e.g., "twice daily")
  - `description` (text) - Brief AI-generated description
  - `image_url` (text) - Stored medication image URL
  - `reminder_time` (text) - Time for reminder (e.g., "08:00")
  - `active` (boolean) - Whether currently taking this medication
  - `created_at` (timestamptz) - When medication was added
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### 3. `interactions`
  Cached AI interaction analysis results
  - `id` (uuid, primary key) - Unique interaction check ID
  - `user_id` (uuid, foreign key) - User this check belongs to
  - `medication_ids` (uuid array) - Medications included in check
  - `analysis` (jsonb) - Complete AI analysis results
  - `severity` (text) - Overall severity level (safe/warning/critical)
  - `has_warnings` (boolean) - Quick flag for warnings
  - `checked_at` (timestamptz) - When analysis was performed
  
  ### 4. `chat_messages`
  AI chat conversation history
  - `id` (uuid, primary key) - Unique message ID
  - `user_id` (uuid, foreign key) - User in conversation
  - `role` (text) - Message sender (user/assistant)
  - `content` (text) - Message text
  - `created_at` (timestamptz) - Message timestamp
  
  ## Security
  - Enable Row Level Security (RLS) on all tables
  - Users can only access their own data
  - All tables require authentication
  - Policies check auth.uid() for ownership
  
  ## Indexes
  - Fast lookups on user_id for all tables
  - Timestamp indexes for recent data queries
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  age integer,
  weight decimal(5,2),
  allergies text[] DEFAULT '{}',
  conditions text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create medications table
CREATE TABLE IF NOT EXISTS medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Create interactions table
CREATE TABLE IF NOT EXISTS interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_ids uuid[] NOT NULL DEFAULT '{}',
  analysis jsonb NOT NULL DEFAULT '{}',
  severity text DEFAULT 'safe',
  has_warnings boolean DEFAULT false,
  checked_at timestamptz DEFAULT now()
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_medications_user_id ON medications(user_id);
CREATE INDEX IF NOT EXISTS idx_medications_active ON medications(user_id, active);
CREATE INDEX IF NOT EXISTS idx_interactions_user_id ON interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_interactions_checked_at ON interactions(user_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles table
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for medications table
CREATE POLICY "Users can view own medications"
  ON medications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own medications"
  ON medications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own medications"
  ON medications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own medications"
  ON medications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for interactions table
CREATE POLICY "Users can view own interactions"
  ON interactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interactions"
  ON interactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for chat_messages table
CREATE POLICY "Users can view own chat messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medications_updated_at
  BEFORE UPDATE ON medications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
