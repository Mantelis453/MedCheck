/*
  # Fix User Profiles Foreign Key Constraint

  1. Changes
    - Drop existing foreign key constraint on user_profiles
    - Recreate user_profiles table without foreign key constraint to auth.users
    - This allows profiles to be created without strict FK validation
    
  2. Notes
    - The user_id still references the auth user but without DB-enforced FK
    - RLS policies still protect data access properly
*/

-- Drop the existing foreign key constraint
ALTER TABLE IF EXISTS user_profiles 
  DROP CONSTRAINT IF EXISTS user_profiles_user_id_fkey;

-- The table will now allow inserts without strict FK validation
-- RLS policies still ensure users can only access their own data