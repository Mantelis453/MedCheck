/*
  # Add Multiple Reminders Support
  
  This migration adds support for multiple reminders per day per medication.
  It adds a reminder_times JSONB column to store an array of reminder times.
*/

-- Add reminder_times column to store multiple reminder times per day
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'reminder_times'
  ) THEN
    ALTER TABLE medications ADD COLUMN reminder_times jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Migrate existing reminder_time to reminder_times array
UPDATE medications
SET reminder_times = CASE
  WHEN reminder_time IS NOT NULL THEN jsonb_build_array(reminder_time)
  ELSE '[]'::jsonb
END
WHERE reminder_times IS NULL OR reminder_times = '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN medications.reminder_times IS 'Array of reminder times in HH:MM format. Allows multiple reminders per day. Example: ["08:00", "20:00"]';


