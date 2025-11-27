-- Add category column to medications table
-- Categories: otc (over-the-counter), prescription, supplement

-- Add category column with default value
ALTER TABLE medications
ADD COLUMN IF NOT EXISTS category text DEFAULT 'otc' CHECK (category IN ('otc', 'prescription', 'supplement'));

-- Add index for category filtering
CREATE INDEX IF NOT EXISTS idx_medications_category ON medications(user_id, category);

-- Add comment for documentation
COMMENT ON COLUMN medications.category IS 'Medication category: otc (over-the-counter), prescription (requires prescription), or supplement (vitamins, minerals, dietary supplements)';
