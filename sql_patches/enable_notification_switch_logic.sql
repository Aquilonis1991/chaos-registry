-- 更新 get_unread_notification_count 函數
-- 變更：加入對 profiles.notifications 設定的檢測
-- 效果：如果使用者關閉通知設定，此函數將返回 0 (即不顯示紅點)

BEGIN;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_notifications_enabled boolean;
BEGIN
  -- 1. 先確認使用者的通知設定權限
  SELECT notifications INTO v_notifications_enabled
  FROM public.profiles
  WHERE id = auth.uid();

  -- 如果找不到使用者或設定為 false，直接回傳 0
  IF v_notifications_enabled IS FALSE THEN
    RETURN 0;
  END IF;

  -- 2. 計算未讀數量 (僅在開啟通知時計算)
  SELECT COUNT(*) INTO v_count
  FROM public.notifications
  WHERE user_id = auth.uid()
    AND is_read = false
    AND type != 'contact'  -- 排除客服回覆 (通常客服回覆不應被全域開關屏蔽，或者需獨立處理，此處維持既有邏輯)
    AND (expires_at IS NULL OR expires_at > now());
  
  RETURN v_count;
END;
$$;

COMMIT;
