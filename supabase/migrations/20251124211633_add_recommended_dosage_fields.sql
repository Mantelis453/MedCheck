/*
  # Add Recommended Dosage Fields

  1. Changes to medications table
    - Add `recommended_dosage` (text) - AI-calculated personalized dosage
    - Add `recommended_frequency` (text) - How often to take (daily, weekly, etc.)
    - Add `is_prescription` (boolean) - Whether this is a prescription medication
    - Add `prescribed_by` (text) - Doctor name if prescription
    - Add `dosage_notes` (text) - Additional dosage information from AI
    
  2. Purpose
    - Store personalized dosage recommendations based on user profile
    - Distinguish between prescription and OTC medications
    - Provide clear guidance on medication usage
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'recommended_dosage'
  ) THEN
    ALTER TABLE medications ADD COLUMN recommended_dosage text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'recommended_frequency'
  ) THEN
    ALTER TABLE medications ADD COLUMN recommended_frequency text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'is_prescription'
  ) THEN
    ALTER TABLE medications ADD COLUMN is_prescription boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'prescribed_by'
  ) THEN
    ALTER TABLE medications ADD COLUMN prescribed_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'medications' AND column_name = 'dosage_notes'
  ) THEN
    ALTER TABLE medications ADD COLUMN dosage_notes text;
  END IF;
END $$;
