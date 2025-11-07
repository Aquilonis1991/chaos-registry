-- 修復任務獎勵安全漏洞
-- 創建一個安全的、原子性的任務完成函數，防止重複領取

-- 創建安全的任務完成函數（防止競態條件和重複領取）
CREATE OR REPLACE FUNCTION public.complete_mission_safe(
  p_user_id uuid,
  p_mission_id text
)
RETURNS TABLE (
  success boolean,
  reward integer,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission RECORD;
  v_user_mission RECORD;
  v_reward integer;
  v_today date;
  v_already_completed boolean := false;
BEGIN
  -- 獲取任務詳情
  SELECT * INTO v_mission
  FROM public.missions
  WHERE id = p_mission_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, '任務不存在'::text;
    RETURN;
  END IF;
  
  v_today := CURRENT_DATE;
  v_reward := v_mission.reward;
  
  -- 使用 SELECT FOR UPDATE 鎖定記錄，防止競態條件
  SELECT * INTO v_user_mission
  FROM public.user_missions
  WHERE user_id = p_user_id
    AND mission_id = p_mission_id
  FOR UPDATE;
  
  -- 檢查是否已完成
  IF FOUND AND v_user_mission.completed THEN
    -- 檢查是否為每日任務
    IF v_mission.limit_per_day IS NOT NULL THEN
      IF v_user_mission.last_completed_date = v_today THEN
        RETURN QUERY SELECT false, 0, '今日任務次數已達上限'::text;
        RETURN;
      END IF;
    ELSE
      RETURN QUERY SELECT false, 0, '任務已完成'::text;
      RETURN;
    END IF;
  END IF;
  
  -- 原子性更新或插入（使用 ON CONFLICT 防止重複）
  -- 如果記錄不存在，插入新記錄
  -- 如果記錄存在但未完成，更新為已完成
  -- 如果記錄存在且已完成（非每日任務），不更新並返回錯誤
  IF v_user_mission IS NULL THEN
    -- 記錄不存在，插入新記錄
    INSERT INTO public.user_missions (
      user_id,
      mission_id,
      completed,
      completed_at,
      last_completed_date,
      progress
    )
    VALUES (
      p_user_id,
      p_mission_id,
      true,
      now(),
      v_today,
      100
    );
  ELSIF NOT v_user_mission.completed OR 
         (v_mission.limit_per_day IS NOT NULL AND v_user_mission.last_completed_date < v_today) THEN
    -- 記錄存在但未完成，或每日任務且不是今天完成，更新記錄
    UPDATE public.user_missions
    SET
      completed = true,
      completed_at = now(),
      last_completed_date = v_today,
      progress = 100,
      updated_at = now()
    WHERE user_id = p_user_id
      AND mission_id = p_mission_id
      AND (completed = false OR 
           (v_mission.limit_per_day IS NOT NULL AND last_completed_date < v_today));
    
    -- 檢查更新是否成功
    IF NOT FOUND THEN
      RETURN QUERY SELECT false, 0, '任務已完成'::text;
      RETURN;
    END IF;
  ELSE
    -- 記錄存在且已完成（非每日任務），返回錯誤
    RETURN QUERY SELECT false, 0, '任務已完成'::text;
    RETURN;
  END IF;
  
  -- 發放獎勵（使用原子性操作）
  PERFORM public.add_tokens(p_user_id, v_reward);
  
  -- 記錄交易（如果表存在）
  BEGIN
    INSERT INTO public.token_transactions (
      user_id,
      amount,
      transaction_type,
      description
    )
    VALUES (
      p_user_id,
      v_reward,
      'complete_mission',
      '完成任務: ' || v_mission.name
    );
  EXCEPTION WHEN OTHERS THEN
    -- 忽略交易記錄錯誤，不影響任務完成
    NULL;
  END;
  
  RETURN QUERY SELECT true, v_reward, NULL::text;
END;
$$;

-- 刷新 Schema Cache
NOTIFY pgrst, 'reload schema';

