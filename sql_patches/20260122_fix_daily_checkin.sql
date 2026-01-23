-- 修復每日簽到重複領取問題的 SQL Patch
-- 1. 確保 daily_login_logs 表存在且有唯一約束
CREATE TABLE IF NOT EXISTS public.daily_login_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    login_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加唯一索引以防止同一天重複簽到 (物理層面的防護)
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_login_logs_user_date 
ON public.daily_login_logs(user_id, login_date);

-- 2. 優化 record_daily_login 函數 (確保冪等性)
CREATE OR REPLACE FUNCTION public.record_daily_login(p_user_id UUID)
RETURNS TABLE (
    is_new_login BOOLEAN,
    current_streak INTEGER,
    total_days INTEGER,
    reward_tokens NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_last_login_date DATE;
    v_current_streak INTEGER := 0;
    v_total_days INTEGER := 0;
    v_reward_amount NUMERIC := 3;
    v_exists BOOLEAN;
BEGIN
    -- 檢查系統配置中的獎勵金額 (如果有)
    BEGIN
        SELECT (value->>'value')::NUMERIC INTO v_reward_amount
        FROM system_config WHERE key = 'mission_daily_login_reward';
    EXCEPTION WHEN OTHERS THEN
        v_reward_amount := 3;
    END;
    IF v_reward_amount IS NULL THEN v_reward_amount := 3; END IF;

    -- 檢查今天是否已簽到
    SELECT EXISTS(
        SELECT 1 FROM daily_login_logs
        WHERE user_id = p_user_id AND login_date = v_today
    ) INTO v_exists;

    -- 獲取最後一次簽到日期以計算連勝
    SELECT login_date INTO v_last_login_date
    FROM daily_login_logs
    WHERE user_id = p_user_id AND login_date < v_today
    ORDER BY login_date DESC
    LIMIT 1;

    -- 計算連勝邏輯
    SELECT continuous_login_days INTO v_current_streak
    FROM profiles WHERE id = p_user_id;
    
    -- 如果個人檔案中沒有連勝數據，嘗試初始化
    IF v_current_streak IS NULL THEN v_current_streak := 0; END IF;

    -- 如果昨天的簽到不存在，重置連勝 (除非今天是第一次)
    IF v_last_login_date IS NOT NULL AND v_last_login_date < v_today - 1 THEN
        v_current_streak := 0;
    END IF;

    -- 如果今天已經簽到，直接返回當前狀態 (冪等性)
    IF v_exists THEN
        SELECT COUNT(*) INTO v_total_days FROM daily_login_logs WHERE user_id = p_user_id;
        
        RETURN QUERY SELECT 
            FALSE as is_new_login,
            v_current_streak as current_streak,
            v_total_days as total_days,
            0::NUMERIC as reward_tokens;
        RETURN;
    END IF;

    -- 開始新簽到
    v_current_streak := v_current_streak + 1;
    
    -- 插入日誌 (如果唯一索引衝突，會拋出錯誤被外層捕獲，或者這裡使用 ON CONFLICT DO NOTHING)
    INSERT INTO daily_login_logs (user_id, login_date)
    VALUES (p_user_id, v_today)
    ON CONFLICT (user_id, login_date) DO NOTHING;
    
    -- 再次檢查是否插入成功 (處理併發情況)
    IF NOT FOUND THEN
        -- 如果插入失敗(因為衝突)，則視為已簽到
        SELECT COUNT(*) INTO v_total_days FROM daily_login_logs WHERE user_id = p_user_id;
        RETURN QUERY SELECT 
            FALSE as is_new_login,
            v_current_streak as current_streak,
            v_total_days as total_days,
            0::NUMERIC as reward_tokens;
        RETURN;
    END IF;

    -- 更新用戶資料 (連勝與代幣)
    UPDATE profiles 
    SET 
        continuous_login_days = v_current_streak,
        last_login = NOW(),
        tokens = tokens + v_reward_amount
    WHERE id = p_user_id;

    -- 記錄交易
    BEGIN
        PERFORM log_token_transaction(
            p_user_id, 
            v_reward_amount, 
            'daily_login', 
            '每日簽到獎勵'
        );
    EXCEPTION WHEN OTHERS THEN
        -- 忽略日誌錯誤，確保簽到成功
        RAISE NOTICE 'Failed to log token transaction';
    END;

    SELECT COUNT(*) INTO v_total_days FROM daily_login_logs WHERE user_id = p_user_id;

    RETURN QUERY SELECT 
        TRUE as is_new_login,
        v_current_streak as current_streak,
        v_total_days as total_days,
        v_reward_amount as reward_tokens;
END;
$$;

-- 3. 優化 get_login_streak_info 函數
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
AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_last_login DATE;
    v_streak INTEGER;
    v_total INTEGER;
BEGIN
    -- 獲取連勝
    SELECT continuous_login_days INTO v_streak
    FROM profiles WHERE id = p_user_id;
    
    -- 獲取總天數
    SELECT COUNT(*) INTO v_total
    FROM daily_login_logs WHERE user_id = p_user_id;
    
    -- 獲取最後登入日期
    SELECT MAX(login_date) INTO v_last_login
    FROM daily_login_logs WHERE user_id = p_user_id;
    
    -- 如果上次登入不是昨天或今天，連勝歸零顯示 (但不修改數據庫，數據庫由 record_daily_login 維護)
    IF v_last_login IS NOT NULL AND v_last_login < v_today - 1 THEN
        v_streak := 0;
    END IF;

    RETURN QUERY SELECT 
        COALESCE(v_streak, 0),
        COALESCE(v_total, 0),
        v_last_login,
        (v_last_login IS NULL OR v_last_login < v_today) as can_claim_today,
        FALSE as streak_reward_available;
END;
$$;
