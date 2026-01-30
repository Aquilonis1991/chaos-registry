-- FIX DAILY LOGIN LOGIC (ROBUST VERSION)
-- Replaces previous logic to remove dependency on potentially missing functions
-- and ensure transaction safety.

BEGIN;

-------------------------------------------------------------------------------
-- 1. Ensure Table Structure
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_login_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    login_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_login_logs_user_date 
ON public.daily_login_logs(user_id, login_date);

-------------------------------------------------------------------------------
-- 2. Robust record_daily_login (Inline Transaction Log)
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_daily_login(p_user_id UUID)
RETURNS TABLE (
    is_new_login BOOLEAN,
    current_streak INTEGER,
    total_days INTEGER,
    reward_tokens NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_last_login_date DATE;
    v_current_streak INTEGER := 0;
    v_total_days INTEGER := 0;
    v_reward_amount NUMERIC := 3;
    v_exists BOOLEAN;
    v_new_transaction_id UUID;
BEGIN
    -- 1. Get Reward Amount from Config
    BEGIN
        SELECT (value->>'value')::NUMERIC INTO v_reward_amount
        FROM system_config WHERE key = 'mission_daily_login_reward';
    EXCEPTION WHEN OTHERS THEN
        v_reward_amount := 3;
    END;
    IF v_reward_amount IS NULL THEN v_reward_amount := 3; END IF;

    -- 2. Check Exists (Idempotency)
    SELECT EXISTS(
        SELECT 1 FROM daily_login_logs
        WHERE user_id = p_user_id AND login_date = v_today
    ) INTO v_exists;

    -- 3. Get Last Login Date (for Streak)
    SELECT login_date INTO v_last_login_date
    FROM daily_login_logs
    WHERE user_id = p_user_id AND login_date < v_today
    ORDER BY login_date DESC
    LIMIT 1;

    -- 4. Get Current Streak from Profile
    SELECT continuous_login_days INTO v_current_streak
    FROM profiles WHERE id = p_user_id;
    
    IF v_current_streak IS NULL THEN v_current_streak := 0; END IF;

    -- 5. Streak Reset Logic
    -- If last login was strictly before yesterday (streak broken)
    IF v_last_login_date IS NOT NULL AND v_last_login_date < v_today - 1 THEN
        v_current_streak := 0;
    END IF;

    -- 6. If Already Claimed, Return Status
    IF v_exists THEN
        SELECT COUNT(*) INTO v_total_days FROM daily_login_logs WHERE user_id = p_user_id;
        
        RETURN QUERY SELECT 
            FALSE,
            v_current_streak,
            v_total_days,
            0::NUMERIC;
        RETURN;
    END IF;

    -- 7. Perform Claim
    v_current_streak := v_current_streak + 1;
    
    -- Insert Log (Try/Catch not needed if using ON CONFLICT)
    INSERT INTO daily_login_logs (user_id, login_date)
    VALUES (p_user_id, v_today)
    ON CONFLICT (user_id, login_date) DO NOTHING;
    
    -- Check if insert succeeded (concurrency check)
    IF NOT FOUND THEN
        -- Another request beat us to it
        SELECT COUNT(*) INTO v_total_days FROM daily_login_logs WHERE user_id = p_user_id;
        RETURN QUERY SELECT 
            FALSE,
            v_current_streak,
            v_total_days,
            0::NUMERIC;
        RETURN;
    END IF;

    -- Update Profile
    UPDATE public.profiles 
    SET 
        continuous_login_days = v_current_streak,
        last_login = NOW(),
        tokens = COALESCE(tokens, 0) + v_reward_amount
    WHERE id = p_user_id;

    -- Log Transaction (Inline, replacing log_token_transaction call)
    INSERT INTO public.token_transactions (
        user_id,
        amount,
        transaction_type,
        description,
        created_at
    ) VALUES (
        p_user_id,
        v_reward_amount,
        'daily_login',
        '每日簽到獎勵',
        NOW()
    ) RETURNING id INTO v_new_transaction_id;

    -- Get final total
    SELECT COUNT(*) INTO v_total_days FROM daily_login_logs WHERE user_id = p_user_id;

    RETURN QUERY SELECT 
        TRUE,
        v_current_streak,
        v_total_days,
        v_reward_amount;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_daily_login(UUID) TO authenticated;

-------------------------------------------------------------------------------
-- 3. Robust get_login_streak_info (Refresh Logic)
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_login_streak_info(p_user_id UUID)
RETURNS TABLE (
    current_streak INTEGER,
    total_days INTEGER,
    last_login_date DATE,
    can_claim_today BOOLEAN,
    streak_reward_available BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_last_login DATE;
    v_streak INTEGER;
    v_total INTEGER;
BEGIN
    SELECT continuous_login_days INTO v_streak
    FROM profiles WHERE id = p_user_id;
    
    SELECT COUNT(*) INTO v_total
    FROM daily_login_logs WHERE user_id = p_user_id;
    
    SELECT MAX(login_date) INTO v_last_login
    FROM daily_login_logs WHERE user_id = p_user_id;
    
    -- Streak Logic for Display
    IF v_last_login IS NOT NULL AND v_last_login < v_today - 1 THEN
        v_streak := 0;
    END IF;

    RETURN QUERY SELECT 
        COALESCE(v_streak, 0),
        COALESCE(v_total, 0),
        v_last_login,
        (v_last_login IS NULL OR v_last_login < v_today), -- can_claim_today
        FALSE; -- Future Extension
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_login_streak_info(UUID) TO authenticated;

COMMIT;
