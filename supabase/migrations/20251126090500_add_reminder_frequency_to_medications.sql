/*
  # Add Reminder Frequency to Medications

  ## Overview
  This migration adds support for different reminder frequencies (daily, weekly, monthly)
  to the medications table, allowing users to set reminders that repeat at different intervals.

  ## Changes

  ### Modifications to `medications` table
  - Add `reminder_frequency` column with values: 'daily', 'weekly', 'monthly'
  - Add `reminder_days` column for storing which days (for weekly reminders)
  - Default to 'daily' for existing medications with reminders

  ## Reminder Frequencies
  - **daily**: Reminder fires every day at the specified time
  - **weekly**: Reminder fires on specific days of the week at the specified time
  - **monthly**: Reminder fires on the same day each month at the specified time

  ## Important Notes
  1. `reminder_days` stores an array of day numbers:
     - For weekly: [0-6] where 0=Sunday, 1=Monday, etc.
     - For monthly: [1-31] for day of month
  2. If `reminder_time` is set but `reminder_frequency` is null, defaults to 'daily'
  3. Existing medications with reminders will be set to 'daily' frequency
*/

-- Add reminder frequency columns to medications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'reminder_frequency'
  ) THEN
    ALTER TABLE medications ADD COLUMN reminder_frequency text CHECK (reminder_frequency IN ('daily', 'weekly', 'monthly')) DEFAULT 'daily';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'reminder_days'
  ) THEN
    ALTER TABLE medications ADD COLUMN reminder_days integer[] DEFAULT ARRAY[]::integer[];
  END IF;
END $$;

-- Update existing medications with reminder_time set to use 'daily' frequency
UPDATE medications
SET reminder_frequency = 'daily'
WHERE reminder_time IS NOT NULL
  AND reminder_frequency IS NULL;

-- Add helpful comment
COMMENT ON COLUMN medications.reminder_frequency IS 'Frequency of medication reminders: daily, weekly, or monthly';
COMMENT ON COLUMN medications.reminder_days IS 'Array of days for reminders. Weekly: 0-6 (Sun-Sat), Monthly: 1-31 (day of month)';
