-- Migration: Add Irrationality Assessment Feature
-- Created at: 2026-01-06

-- 1. Create user_assessments table
CREATE OR REPLACE FUNCTION public.upsert_ui_text_v2(
    p_key TEXT,
    p_value TEXT,
    p_category TEXT,
    p_description TEXT,
    p_zh TEXT,
    p_en TEXT,
    p_ja TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.ui_texts (key, value, category, description, zh, en, ja, created_at, updated_at)
    VALUES (p_key, p_value, p_category, p_description, p_zh, p_en, p_ja, now(), now())
    ON CONFLICT (key)
    DO UPDATE SET
        value = EXCLUDED.value,
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        zh = EXCLUDED.zh,
        en = EXCLUDED.en,
        ja = EXCLUDED.ja,
        updated_at = now();
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_assessments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'zh', -- zh, en, ja
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Note: We use public.profiles(id) instead of users(id) to ensure consistency with other tables.

-- Enable RLS
ALTER TABLE public.user_assessments ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Users can view their own assessments
CREATE POLICY "Users can view their own assessments"
    ON public.user_assessments FOR SELECT
    USING (auth.uid() = user_id);

-- 2. Service role can insert assessments
CREATE POLICY "Service role can insert assessments"
    ON public.user_assessments FOR INSERT
    WITH CHECK (true);


-- 2. Create RPC for behavior metrics
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


-- 3. Add UI Texts
-- Ensure upsert_ui_text_v2 exists (it should be in previous migrations)
-- If not, re-declare it here or assume presence?
-- To be safe, we can conditionally create it or just run the inserts.
-- Assuming upsert_ui_text_v2 exists from previous patch.

SELECT public.upsert_ui_text_v2(
    'profile.assessment.button',
    '不理性鑑定',
    'profile',
    'Button label for taking the assessment',
    '不理性鑑定',
    'Irrationality Assessment',
    '非合理的診断'
);

SELECT public.upsert_ui_text_v2(
    'profile.assessment.title',
    '不理性鑑定',
    'profile',
    'Title of the assessment section',
    '不理性鑑定',
    'Irrationality Assessment',
    '非合理的診断'
);

SELECT public.upsert_ui_text_v2(
    'profile.assessment.disclaimer',
    '娛樂用途，非心理分析',
    'profile',
    'Disclaimer string',
    '娛樂用途，非心理分析',
    'For entertainment only, not psychological analysis',
    '娯楽目的であり、心理分析ではありません'
);

SELECT public.upsert_ui_text_v2(
    'profile.assessment.cooldown',
    '本週已完成一次鑑定',
    'profile',
    'Message shown when weekly limit reached',
    '本週已完成一次鑑定',
    'Assessment already completed this week',
    '今週はすでに診断済みです'
);

SELECT public.upsert_ui_text_v2(
    'profile.assessment.loading',
    '正在分析您的行為模式...',
    'profile',
    'Loading text',
    '正在分析您的行為模式...',
    'Analyzing your behavior patterns...',
    '行動パターンを分析中...'
);

SELECT public.upsert_ui_text_v2(
    'profile.assessment.start_prompt',
    '看看 AI 眼中的你是什麼樣子？',
    'profile',
    'Prompt to encourage user to take assessment',
    '看看 AI 眼中的你是什麼樣子？',
    'See what AI thinks of you?',
    'AIから見たあなたの姿は？'
);
