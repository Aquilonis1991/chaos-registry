-- Add free vote system support

-- Create free_votes table to track daily free votes per user per topic
CREATE TABLE IF NOT EXISTS public.free_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  option TEXT NOT NULL,
  used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.free_votes ENABLE ROW LEVEL SECURITY;

-- Policies for free_votes
CREATE POLICY "Users can view own free votes"
  ON public.free_votes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own free votes"
  ON public.free_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create unique constraint to prevent duplicate free votes per user per topic per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_free_votes_user_topic_date 
ON public.free_votes (user_id, topic_id, DATE(used_at));

-- Add function to check if user has used free vote today
CREATE OR REPLACE FUNCTION public.has_used_free_vote_today(
  check_user_id UUID,
  check_topic_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.free_votes
    WHERE user_id = check_user_id
    AND topic_id = check_topic_id
    AND DATE(used_at) = CURRENT_DATE
  );
END;
$$;

-- Add function to cast free vote
CREATE OR REPLACE FUNCTION public.cast_free_vote(
  p_topic_id UUID,
  p_option TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Check if user already used free vote today for this topic
  IF public.has_used_free_vote_today(v_user_id, p_topic_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Free vote already used today for this topic');
  END IF;

  -- Insert free vote record
  INSERT INTO public.free_votes (user_id, topic_id, option)
  VALUES (v_user_id, p_topic_id, p_option);

  -- Update topic votes (add 1 vote to the option)
  UPDATE public.topics
  SET votes = jsonb_set(
    votes,
    ARRAY[p_option],
    COALESCE((votes->p_option)::integer, 0) + 1
  )
  WHERE id = p_topic_id;

  -- Add to topic participants if not already present
  INSERT INTO public.topic_participants (user_id, topic_id)
  VALUES (v_user_id, p_topic_id)
  ON CONFLICT (user_id, topic_id) DO NOTHING;

  -- Log transaction
  INSERT INTO public.token_transactions (
    user_id,
    amount,
    transaction_type,
    description
  ) VALUES (
    v_user_id,
    0,
    'free_vote',
    'Used daily free vote'
  );

  -- Log audit
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    metadata
  ) VALUES (
    v_user_id,
    'free_vote',
    'topic',
    jsonb_build_object(
      'topic_id', p_topic_id,
      'option', p_option,
      'amount', 0
    )
  );

  RETURN jsonb_build_object('success', true, 'message', 'Free vote cast successfully');
END;
$$;

-- Add system config for free vote settings
INSERT INTO public.system_config (key, value, category, description) VALUES
  ('free_vote_enabled', 'true', 'voting', '是否啟用免費票功能'),
  ('free_vote_per_topic_per_day', '1', 'voting', '每個主題每日免費票數量')
ON CONFLICT (key) DO NOTHING;

