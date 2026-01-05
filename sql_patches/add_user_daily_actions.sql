-- ==========================================
-- Add User Daily Actions Tracking
-- ==========================================

-- 1. Create table to track daily actions
CREATE TABLE IF NOT EXISTS public.user_daily_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- e.g., 'ai_chaos_rewrite'
    action_date DATE NOT NULL DEFAULT CURRENT_DATE,
    count INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, action_type, action_date)
);

-- Enable RLS
ALTER TABLE public.user_daily_actions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own actions
DROP POLICY IF EXISTS "Users can view own daily actions" ON public.user_daily_actions;
CREATE POLICY "Users can view own daily actions"
    ON public.user_daily_actions FOR SELECT
    USING (auth.uid() = user_id);

-- 2. Create RPC to atomically increment action count
CREATE OR REPLACE FUNCTION public.increment_daily_action(
    p_action_type TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_count INTEGER;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Insert or Update logic
    INSERT INTO public.user_daily_actions (user_id, action_type, action_date, count)
    VALUES (v_user_id, p_action_type, CURRENT_DATE, 1)
    ON CONFLICT (user_id, action_type, action_date)
    DO UPDATE SET 
        count = user_daily_actions.count + 1,
        updated_at = now()
    RETURNING count INTO v_count;

    RETURN v_count;
END;
$$;

-- 3. Insert default config for Rewrite Cost if not exists
INSERT INTO public.system_config (key, value, category, description)
VALUES (
    'ai_chaos_rewrite_cost', 
    '5'::jsonb, 
    'ai_cost',
    '不穩定改寫每次消耗代幣 (每日首次免費)'
)
ON CONFLICT (key) DO NOTHING;

-- Refresh Schema
NOTIFY pgrst, 'reload schema';
