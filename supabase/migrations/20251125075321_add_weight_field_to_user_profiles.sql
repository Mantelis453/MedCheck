/*
  # Add Weight Field to User Profiles

  1. Changes
    - Add `weight` (numeric) column to `user_profiles` table
      - Stores user's weight in kilograms
      - Optional field with no default value
      - Allows decimal values (e.g., 70.5 kg)

  2. Notes
    - Weight is stored in kilograms for consistency
    - Field is nullable to allow users to skip this during onboarding
    - Can be updated by users at any time through their profile
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'weight'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN weight numeric(5,2);
  END IF;
END $$;