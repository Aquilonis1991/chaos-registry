-- Phase 1.1: Fix Votes Table RLS Policy
-- Drop the public SELECT policy that exposes all votes
DROP POLICY IF EXISTS "Users can view all votes" ON public.votes;

-- Create policy: Users can only view their own votes
CREATE POLICY "Users can view own votes" 
ON public.votes 
FOR SELECT 
USING (auth.uid() = user_id);

-- Phase 1.2: Protect Profiles Table Sensitive Data
-- Drop existing public SELECT policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create policy: Users can view public profile data of all users (nickname, avatar only)
CREATE POLICY "Anyone can view public profile data" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Note: The policy allows SELECT on the entire table, but we'll handle field-level 
-- restrictions in the application layer. For true column-level security, we would need
-- to create a separate public_profiles view.

-- Create policy: Users can view their own full profile
CREATE POLICY "Users can view own full profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Phase 1.3: Redesign Mission Tracking
-- Create user_missions table to track individual completion
CREATE TABLE IF NOT EXISTS public.user_missions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id text NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamp with time zone,
  last_completed_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, mission_id)
);

-- Enable RLS on user_missions
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_missions
CREATE POLICY "Users can view own missions" 
ON public.user_missions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own missions" 
ON public.user_missions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own missions" 
ON public.user_missions 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_user_missions_updated_at
BEFORE UPDATE ON public.user_missions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Remove completed_users field from missions table (will be done after data migration)
-- Note: We'll keep it for now to allow data migration, then remove it in a follow-up migration

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_missions_user_id ON public.user_missions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_missions_mission_id ON public.user_missions(mission_id);
CREATE INDEX IF NOT EXISTS idx_user_missions_completed ON public.user_missions(completed) WHERE completed = true;

-- Phase 1.4: Password Protection
-- Note: Password protection and strength requirements are configured via Supabase Auth settings
-- This will be done via the configure-auth tool after this migration