-- 更新函數：標記所有通知為已讀時排除客服回覆
-- 確保客服回覆完全獨立，不會被標記為已讀

BEGIN;

-- 更新 mark_all_notifications_read 函數，排除 'contact' 類型
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true,
      read_at = now()
  WHERE user_id = auth.uid()
    AND is_read = false
    AND type != 'contact';  -- 排除客服回覆
END;
$$;

-- 更新 get_unread_notification_count 函數，排除 'contact' 類型
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.notifications
  WHERE user_id = auth.uid()
    AND is_read = false
    AND type != 'contact'  -- 排除客服回覆
    AND (expires_at IS NULL OR expires_at > now());
  
  RETURN v_count;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;

