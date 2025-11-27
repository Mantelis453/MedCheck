# Database Migration Guide

## Required Migrations

This app requires several database migrations to function properly. Run them in the following order:

1. **Medications Table** - Creates the core medications table
2. **Onboarding Enhancements** - Adds new columns to user_profiles table
3. **Medication Logs** - Creates medication tracking table (optional but recommended)
4. **Conversations System** - Creates chat functionality tables

## Running Migrations

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Navigate to **SQL Editor** in the left sidebar
3. Open the migration file you need to run
4. Copy the entire contents of the file
5. Paste it into the SQL Editor
6. Click **Run** to execute the migration
7. Wait 10-30 seconds for the schema cache to refresh

### Option 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Make sure you're in the project root
cd /Users/juozas/Downloads/MedAI-main

# Link your project (if not already linked)
supabase link --project-ref xlfiqrnpkuvakzbxoelt

# Push all migrations
supabase db push
```

---

## 1. Medications Table Migration

**File:** `supabase/migrations/20251128000000_ensure_medications_table_complete.sql`

**If you see "Database table not found" error for medications:**

This migration creates the complete medications table with all required columns and RLS policies.

### What This Migration Does

1. **Creates the `medications` table** if it doesn't exist
2. **Adds all required columns:**
   - Base: `id`, `user_id`, `name`, `generic_name`, `dosage`, `frequency`, `description`, `image_url`, `reminder_time`, `active`, `created_at`, `updated_at`
   - Extended: `category`, `is_prescription`, `recommended_dosage`, `recommended_frequency`, `dosage_notes`, `reminder_frequency`, `reminder_days`
3. **Sets up Row Level Security (RLS)** and policies
4. **Creates indexes** for better query performance
5. **Sets up automatic timestamp updates** for the `updated_at` column

**Note:** This migration is safe to run even if the table already exists. It will only add missing columns.

---

## 2. Running the Onboarding Enhancements Migration

The app requires a database migration to add new columns to the `user_profiles` table. Follow these steps:

**File:** `supabase/migrations/20251127000000_add_onboarding_enhancements.sql`

### What This Migration Does

This migration is **self-contained** and will:

1. **Create the `user_profiles` table** if it doesn't exist (with all base columns)
2. **Set up Row Level Security (RLS)** and policies
3. **Add the following new columns** to the `user_profiles` table:
   - `weight` (numeric) - User's weight in kilograms
   - `height` (numeric) - User's height in centimeters
   - `lifestyle` (jsonb) - Lifestyle factors (smoking, alcohol use)
   - `emergency_contact` (jsonb) - Emergency contact information
   - `biometric_data` (jsonb) - Biometric information (blood type, RH factor)
   - `family_medical_history` (text[]) - Family medical history
   - `medication_history` (text[]) - Previous medications

4. **Create indexes** for better query performance
5. **Set up automatic timestamp updates** for the `updated_at` column

**Note:** This migration is safe to run even if the base table doesn't exist. It will create everything needed.

### Verifying the Migration

After running the migration, you can verify it worked by:

1. Going to **Table Editor** in Supabase dashboard
2. Selecting the `user_profiles` table
3. Checking that all columns appear in the table structure:
   - Base columns: `id`, `user_id`, `full_name`, `date_of_birth`, `gender`, `allergies`, `medical_conditions`, `onboarding_completed`, `created_at`, `updated_at`
   - New columns: `weight`, `height`, `lifestyle`, `emergency_contact`, `biometric_data`, `family_medical_history`, `medication_history`

### Troubleshooting

**If you see the error "relation 'user_profiles' does not exist":**
- This migration has been updated to create the table automatically
- Simply run the migration again - it will create the table and all columns

**If you see policy conflicts:**
- The migration will drop and recreate policies to avoid conflicts
- This is safe and won't affect existing data

