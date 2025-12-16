-- Add line_user_id column to profiles table for LINE login integration
-- This allows linking LINE users to Supabase users

-- Add line_user_id column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS line_user_id TEXT;

-- Create unique index on line_user_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_line_user_id 
ON public.profiles(line_user_id) 
WHERE line_user_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.profiles.line_user_id IS 'LINE user ID for LINE login integration';



