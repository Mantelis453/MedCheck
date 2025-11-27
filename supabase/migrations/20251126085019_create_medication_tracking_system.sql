/*
  # Create Medication Tracking System

  ## Overview
  This migration creates a comprehensive medication tracking system that allows users to:
  - Log when they take medications
  - View their medication history in a calendar view
  - Track adherence over time
  - Confirm medication intake from notifications

  ## New Tables

  ### `medication_logs`
  Tracks each time a user takes or skips a medication
  - `id` (uuid, primary key) - Unique log entry identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `medication_id` (uuid, foreign key) - References medications
  - `scheduled_time` (timestamptz) - When medication was supposed to be taken
  - `taken_at` (timestamptz) - When medication was actually taken (null if skipped)
  - `status` (text) - taken, skipped, or missed
  - `confirmed_via` (text) - notification, manual, or auto
  - `notes` (text) - Optional user notes
  - `created_at` (timestamptz) - Log creation timestamp

  ## Indexes
  - Fast lookups by user_id and medication_id
  - Date-based queries for calendar views
  - Composite index for user + medication + date range queries

  ## Security
  - Enable RLS on medication_logs table
  - Users can only access their own medication logs
  - Policies optimized with (select auth.uid()) pattern

  ## Important Notes
  1. Status field values:
     - 'taken' - User confirmed they took the medication
     - 'skipped' - User intentionally skipped the dose
     - 'missed' - Scheduled time passed without confirmation
  2. confirmed_via tracks how the user confirmed:
     - 'notification' - Via notification action
     - 'manual' - Via app interface
     - 'auto' - Automatically logged by system
*/

-- Create medication_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS medication_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  medication_id uuid NOT NULL,
  scheduled_time timestamptz NOT NULL,
  taken_at timestamptz,
  status text CHECK (status IN ('taken', 'skipped', 'missed')) NOT NULL DEFAULT 'missed',
  confirmed_via text CHECK (confirmed_via IN ('notification', 'manual', 'auto')),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'medication_logs_user_id_fkey'
    AND table_name = 'medication_logs'
  ) THEN
    ALTER TABLE medication_logs
    ADD CONSTRAINT medication_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'medication_logs_medication_id_fkey'
    AND table_name = 'medication_logs'
  ) THEN
    ALTER TABLE medication_logs
    ADD CONSTRAINT medication_logs_medication_id_fkey
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_medication_logs_user_id ON medication_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_medication_id ON medication_logs(medication_id);
CREATE INDEX IF NOT EXISTS idx_medication_logs_scheduled_time ON medication_logs(scheduled_time DESC);
CREATE INDEX IF NOT EXISTS idx_medication_logs_user_medication_date ON medication_logs(user_id, medication_id, scheduled_time DESC);

-- Enable RLS
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own medication logs" ON medication_logs;
  DROP POLICY IF EXISTS "Users can insert own medication logs" ON medication_logs;
  DROP POLICY IF EXISTS "Users can update own medication logs" ON medication_logs;
  DROP POLICY IF EXISTS "Users can delete own medication logs" ON medication_logs;
END $$;

-- RLS Policies for medication_logs table
CREATE POLICY "Users can view own medication logs"
  ON medication_logs FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own medication logs"
  ON medication_logs FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own medication logs"
  ON medication_logs FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own medication logs"
  ON medication_logs FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Create function to automatically mark missed medications
CREATE OR REPLACE FUNCTION mark_missed_medications()
RETURNS void AS $$
BEGIN
  -- This function can be called by a cron job or scheduled task
  -- It marks medications as 'missed' if they weren't confirmed within a reasonable time window
  -- For now, this is a placeholder for future automation
  NULL;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;
