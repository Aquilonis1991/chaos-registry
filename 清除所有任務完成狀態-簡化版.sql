-- 清除所有任務完成狀態（簡化版）
-- 只執行核心清除功能

-- 創建清除函數（如果不存在）
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
  DELETE FROM public.user_missions;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count, '已清除 ' || v_count || ' 筆任務完成記錄'::text;
END;
$$;

-- 執行清除
SELECT * FROM public.clear_all_user_missions();

