-- Phase 2.1: Create Token Transaction System
CREATE TABLE IF NOT EXISTS public.token_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('create_topic', 'cast_vote', 'complete_mission', 'watch_ad', 'admin_adjustment')),
  reference_id uuid,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on token_transactions
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for token_transactions
CREATE POLICY "Users can view own transactions" 
ON public.token_transactions 
FOR SELECT 
USING (auth.uid() = user_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON public.token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON public.token_transactions(created_at DESC);

-- Phase 4.2: Create Audit Logging
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs (will need admin role system)
CREATE POLICY "Service role can insert audit logs" 
ON public.audit_logs 
FOR INSERT 
WITH CHECK (true);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- Phase 4.3: Database Optimization - Replace array fields with junction tables
-- Create topic_creators junction table
CREATE TABLE IF NOT EXISTS public.topic_creators (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);

ALTER TABLE public.topic_creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own created topics" 
ON public.topic_creators 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own created topics" 
ON public.topic_creators 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create topic_participants junction table
CREATE TABLE IF NOT EXISTS public.topic_participants (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);

ALTER TABLE public.topic_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own joined topics" 
ON public.topic_participants 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own joined topics" 
ON public.topic_participants 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_topic_creators_user_id ON public.topic_creators(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_creators_topic_id ON public.topic_creators(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_participants_user_id ON public.topic_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_participants_topic_id ON public.topic_participants(topic_id);

-- Migrate existing data from profiles arrays to junction tables
INSERT INTO public.topic_creators (user_id, topic_id)
SELECT p.id, unnest(p.created_topics)::uuid
FROM public.profiles p
WHERE p.created_topics IS NOT NULL AND array_length(p.created_topics, 1) > 0
ON CONFLICT (user_id, topic_id) DO NOTHING;

INSERT INTO public.topic_participants (user_id, topic_id)
SELECT p.id, unnest(p.joined_topics)::uuid
FROM public.profiles p
WHERE p.joined_topics IS NOT NULL AND array_length(p.joined_topics, 1) > 0
ON CONFLICT (user_id, topic_id) DO NOTHING;

-- Remove array columns from profiles (keeping for backward compatibility for now)
-- These can be dropped in a future migration after frontend is updated:
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS created_topics;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS joined_topics;

-- Phase 3.4: Add Server-Side Validation - Database constraints
-- Add constraints to topics table
ALTER TABLE public.topics 
  ADD CONSTRAINT check_title_length CHECK (char_length(title) >= 5 AND char_length(title) <= 200);

-- Add constraints to profiles table
ALTER TABLE public.profiles
  ADD CONSTRAINT check_nickname_length CHECK (char_length(nickname) >= 1 AND char_length(nickname) <= 50);

-- Add constraint to votes table
ALTER TABLE public.votes
  ADD CONSTRAINT check_vote_amount_positive CHECK (amount > 0 AND amount <= 100);