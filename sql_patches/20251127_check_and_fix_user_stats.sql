-- 檢查並修復 get_user_stats 函數
-- 解決用戶詳細信息一直讀取中的問題

-- 1. 檢查函數是否存在
SELECT 
  'get_user_stats function check' as check_type,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'get_user_stats'
  ) as function_exists;

-- 2. 檢查 topics 表的實際欄位名稱
SELECT 
  'topics table columns' as check_type,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'topics'
  AND column_name IN ('creator_id', 'created_by')
ORDER BY column_name;

-- 3. 重新創建優化版本的 get_user_stats 函數
-- 使用更高效的查詢方式，避免子查詢性能問題
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_topics INTEGER,
  total_votes INTEGER,
  total_free_votes INTEGER,
  total_tokens INTEGER,
  created_at TIMESTAMPTZ,
  last_login TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_topics INTEGER := 0;
  v_total_votes INTEGER := 0;
  v_total_free_votes INTEGER := 0;
  v_total_tokens INTEGER := 0;
  v_created_at TIMESTAMPTZ;
  v_last_login TIMESTAMPTZ;
BEGIN
  -- 獲取用戶基本信息
  SELECT 
    COALESCE(tokens, 0),
    created_at,
    COALESCE(last_login, last_login_date::TIMESTAMPTZ)
  INTO v_total_tokens, v_created_at, v_last_login
  FROM public.profiles
  WHERE id = p_user_id;
  
  IF NOT FOUND THEN
    -- 用戶不存在，返回空值
    RETURN QUERY SELECT 0, 0, 0, 0, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;
  
  -- 統計創建的主題數（使用 COUNT，更高效）
  SELECT COUNT(*)::INTEGER INTO v_total_topics
  FROM public.topics
  WHERE creator_id = p_user_id;
  
  -- 統計代幣投票數（從 votes 表）
  SELECT COUNT(*)::INTEGER INTO v_total_votes
  FROM public.votes
  WHERE user_id = p_user_id;
  
  -- 統計免費投票數（從 free_votes 表）
  SELECT COUNT(*)::INTEGER INTO v_total_free_votes
  FROM public.free_votes
  WHERE user_id = p_user_id;
  
  -- 返回結果
  RETURN QUERY SELECT 
    v_total_topics,
    v_total_votes,
    v_total_free_votes,
    v_total_tokens,
    v_created_at,
    v_last_login;
END;
$$;

-- 4. 授予執行權限
GRANT EXECUTE ON FUNCTION public.get_user_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_stats(UUID) TO anon;

-- 5. 刷新 Schema Cache
NOTIFY pgrst, 'reload schema';

-- 6. 測試函數（可選，使用實際用戶 ID 測試）
-- SELECT * FROM public.get_user_stats('08fc94c1-bfb3-47ed-9191-b46fa24837f2'::UUID);

