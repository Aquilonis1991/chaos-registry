-- Create user_assessments table for storing Irrationality Assessment results
CREATE TABLE IF NOT EXISTS public.user_assessments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'zh', -- zh, en, ja
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Note: We use public.profiles(id) instead of users(id) to ensure consistency with other tables if needed,
-- but usually they are 1:1. Ensuring we refer to the public interface.

-- Enable RLS
ALTER TABLE public.user_assessments ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Users can view their own assessments
CREATE POLICY "Users can view their own assessments"
    ON public.user_assessments FOR SELECT
    USING (auth.uid() = user_id);

-- 2. Service role can insert assessments (triggered by Edge Function)
-- We need to grant insert to service role, or just allow all for authenticated if we handle logic in API.
-- Ideally, only the system (service role) creates these.
CREATE POLICY "Service role can insert assessments"
    ON public.user_assessments FOR INSERT
    WITH CHECK (true);
    -- Note: In Supabase, service role bypasses RLS, so this policy technically handles authenticated users implies
    -- we might strictly rely on RPC/Edge Function using service key.
    -- If we use supabase-admin in Edge Function, RLS is bypassed.


-- RPC to get user behavior metrics for AI analysis
-- This function calculates stats for the last 7 days.
CREATE OR REPLACE FUNCTION public.get_user_behavior_metrics(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_votes INT;
    v_distinct_topics_count INT;
    v_created_topics_count INT;
    v_activity_days INT;
    v_start_date TIMESTAMPTZ := now() - INTERVAL '7 days'; 
BEGIN
    -- 1. Total Votes in last 7 days
    SELECT count(*) INTO v_total_votes
    FROM public.votes
    WHERE user_id = p_user_id AND created_at >= v_start_date;

    -- 2. Distinct Topics Voted in last 7 days
    SELECT count(DISTINCT topic_id) INTO v_distinct_topics_count
    FROM public.votes
    WHERE user_id = p_user_id AND created_at >= v_start_date;

    -- 3. Created Topics in last 7 days
    SELECT count(*) INTO v_created_topics_count
    FROM public.topics
    WHERE created_by = p_user_id AND created_at >= v_start_date;
    
    -- 4. Activity Days (distinct days with any action)
    WITH active_dates AS (
        SELECT created_at::date as d FROM public.votes WHERE user_id = p_user_id AND created_at >= v_start_date
        UNION
        SELECT created_at::date as d FROM public.topics WHERE created_by = p_user_id AND created_at >= v_start_date
    )
    SELECT count(*) INTO v_activity_days FROM active_dates;

    RETURN jsonb_build_object(
        'period', '7 days',
        'total_votes', v_total_votes,
        'distinct_topics_voted', v_distinct_topics_count,
        'created_topics', v_created_topics_count,
        'activity_days', v_activity_days
    );
END;
$$;

-- Grant permissions
GRANT SELECT ON public.user_assessments TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_behavior_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_behavior_metrics TO service_role;
