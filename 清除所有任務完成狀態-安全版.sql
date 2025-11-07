-- 清除所有帳號的任務完成狀態（安全版）
-- 此腳本使用 SECURITY DEFINER 函數來繞過 RLS 限制，需要管理員權限執行

-- 創建一個臨時函數來清除所有任務完成記錄
CREATE OR REPLACE FUNCTION public.clear_all_user_missions()
RETURNS TABLE (
  cleared_count bigint,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count bigint;
BEGIN
  -- 刪除所有記錄
  DELETE FROM public.user_missions;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_count, '✅ 已清除 ' || v_count || ' 筆任務完成記錄'::text;
END;
$$;

-- 執行清除函數
SELECT * FROM public.clear_all_user_missions();

-- 可選：執行後刪除臨時函數
-- DROP FUNCTION IF EXISTS public.clear_all_user_missions();

