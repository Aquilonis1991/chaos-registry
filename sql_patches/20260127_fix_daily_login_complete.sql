-- COMPLETE FIX FOR DAILY LOGIN AND TRANSACTION CONSTRAINTS
-- Date: 2026-01-27
-- Description:
-- 1. Explicitly updates token_transactions check constraint to include ALL known types.
-- 2. Ensures profiles table has continuous_login_days.
-- 3. Replaces record_daily_login with UTC-enforced, transaction-safe version.
-- 4. Replaces get_login_streak_info with UTC-enforced version.

BEGIN;

-------------------------------------------------------------------------------
-- 1. FIX TABLE CONSTRAINTS (CRITICAL)
-------------------------------------------------------------------------------

-- Drop the old constraint to ensure we can update it
ALTER TABLE public.token_transactions
DROP CONSTRAINT IF EXISTS token_transactions_transaction_type_check;

-- Add the COMPLETE constraint with all known types
-- This fixes the "new row for relation violates check constraint" error
ALTER TABLE public.token_transactions
ADD CONSTRAINT token_transactions_transaction_type_check
CHECK (transaction_type IN (
    'create_topic',
    'free_create_topic',
    'cast_vote',
    'cast_free_vote',
    'free_vote',
    'watch_ad',
    'click_native_ad',
    'deposit',           -- Needed for daily login and purchase
    'complete_mission',
    'admin_adjustment',
    'purchase',
    'refund',
    'ai_usage',          -- Needed for AI features
    'withdrawal',        -- Future proofing
    'daily_login'        -- Legacy support if needed, but we prefer 'deposit'
));

-- Ensure profiles table has continuous_login_days
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS continuous_login_days INTEGER DEFAULT 0;

-- Ensure daily_login_logs table exists
CREATE TABLE IF NOT EXISTS public.daily_login_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    login_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure Unique Index exists (Critical for idempotency)
DROP INDEX IF EXISTS idx_daily_login_logs_user_date;
CREATE UNIQUE INDEX idx_daily_login_logs_user_date 
ON public.daily_login_logs(user_id, login_date);

-------------------------------------------------------------------------------
-- 2. ROBUST DAILY LOGIN FUNCTION (FORCE UTC)
-------------------------------------------------------------------------------

-- DROP FIRST to allow return type changes
DROP FUNCTION IF EXISTS public.record_daily_login(UUID);

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
    -- FORCE UTC DATE for consistency across all regions
    v_today DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
    v_last_login_date DATE;
    v_current_streak INTEGER := 0;
    v_total_days INTEGER := 0;
    v_reward_amount NUMERIC := 3;
    v_exists BOOLEAN;
    v_new_transaction_id UUID;
BEGIN
    -- 1. Check if specific reward config exists
    BEGIN
        -- Try to get config, handling both { "value": 5 } and raw 5 format
        SELECT 
            CASE 
                WHEN jsonb_typeof(value) = 'object' AND value ? 'value' THEN (value->>'value')::NUMERIC
                ELSE (value #>> '{}')::NUMERIC
            END INTO v_reward_amount
        FROM system_config 
        WHERE key = 'mission_daily_login_reward'; -- Or 'daily_login_reward' if needed, but let's stick to specific first
        
        -- Fallback if main key not found, try legacy key
        IF v_reward_amount IS NULL THEN
             SELECT 
                CASE 
                    WHEN jsonb_typeof(value) = 'object' AND value ? 'value' THEN (value->>'value')::NUMERIC
                    ELSE (value #>> '{}')::NUMERIC
                END INTO v_reward_amount
            FROM system_config 
            WHERE key = 'daily_login_reward';
        END IF;

    EXCEPTION WHEN OTHERS THEN
        v_reward_amount := 3;
    END;
    
    -- Final default fallback
    IF v_reward_amount IS NULL THEN v_reward_amount := 3; END IF;

    -- 2. Check Exists (Idempotency) - Using UTC Date
    -- We assume the unique index idx_daily_login_logs_user_date handles physical uniqueness
    SELECT EXISTS(
        SELECT 1 FROM daily_login_logs
        WHERE user_id = p_user_id AND login_date = v_today
    ) INTO v_exists;

    -- If already exists, return immediately (Idempotent)
    IF v_exists THEN
        SELECT continuous_login_days INTO v_current_streak FROM profiles WHERE id = p_user_id;
        SELECT COUNT(*) INTO v_total_days FROM daily_login_logs WHERE user_id = p_user_id;
        
        RETURN QUERY SELECT 
            FALSE,
            COALESCE(v_current_streak, 0),
            COALESCE(v_total_days, 0),
            0::NUMERIC;
        RETURN;
    END IF;

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

    -- 6. Perform Claim
    v_current_streak := v_current_streak + 1;
    
    -- Insert Log (ON CONFLICT DO NOTHING handles race conditions)
    INSERT INTO daily_login_logs (user_id, login_date)
    VALUES (p_user_id, v_today)
    ON CONFLICT (user_id, login_date) DO NOTHING;
    
    -- Check if insert succeeded (concurrency check)
    IF NOT FOUND THEN
        -- Another request beat us to it, re-fetch status
        SELECT continuous_login_days INTO v_current_streak FROM profiles WHERE id = p_user_id;
        SELECT COUNT(*) INTO v_total_days FROM daily_login_logs WHERE user_id = p_user_id;
        RETURN QUERY SELECT 
            FALSE,
            COALESCE(v_current_streak, 0),
            COALESCE(v_total_days, 0),
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
    -- Uses 'deposit' ensuring it matches the constraint we just fixed
    INSERT INTO public.token_transactions (
        user_id,
        amount,
        transaction_type,
        description,
        created_at
    ) VALUES (
        p_user_id,
        v_reward_amount,
        'deposit',
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
-- 3. ROBUST STREAK INFO FUNCTION (FORCE UTC)
-------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_login_streak_info(UUID);

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
    -- FORCE UTC for consistency
    v_today DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
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
