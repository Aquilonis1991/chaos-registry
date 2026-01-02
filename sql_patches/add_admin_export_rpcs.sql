-- 建立後台數據匯出功能的 RPCs
-- 包含：主題詳細統計、用戶清單、財務流水

BEGIN;

-- 1. 匯出主題統計 (包含選項與不重複人數)
-- 為了讓 CSV 好讀，我們將產出 "每個選項一行" 的格式 (Flat format)
CREATE OR REPLACE FUNCTION public.admin_export_topic_stats(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  topic_id UUID,
  created_at TIMESTAMPTZ,
  title TEXT,
  status TEXT,
  total_votes INTEGER,
  topic_unique_voters BIGINT, -- 該主題的不重複參與人數
  option_label TEXT,
  option_votes INTEGER,
  option_free_unique_voters BIGINT -- 該選項的免費票不重複人數 (付費票因紀錄格式限制，僅能精確統計免費票)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 檢查管理員權限
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    t.id AS topic_id,
    t.created_at,
    t.title,
    t.status,
    COALESCE(t.total_votes, 0) AS total_votes,
    -- 計算該主題的不重複參與者
    COALESCE(tp.unique_count, 0) AS topic_unique_voters,
    -- 選項資訊 (從 JSON 展開)
    opt.value->>'label' AS option_label,
    (opt.value->>'votes')::INTEGER AS option_votes,
    -- 計算該選項的免費票不重複人數
    COALESCE(fv.unique_count, 0) AS option_free_unique_voters
  FROM public.topics t
  -- 展開選項
  CROSS JOIN LATERAL jsonb_array_elements(t.options) AS opt
  -- 關聯主題參與者統計
  LEFT JOIN (
    SELECT topic_id, COUNT(*) AS unique_count
    FROM public.topic_participants
    GROUP BY topic_id
  ) tp ON tp.topic_id = t.id
  -- 關聯免費票統計 (精確到選項)
  LEFT JOIN (
    SELECT topic_id, option AS option_id, COUNT(DISTINCT user_id) AS unique_count
    FROM public.free_votes
    GROUP BY topic_id, option
  ) fv ON fv.topic_id = t.id AND fv.option_id = (opt.value->>'id')
  WHERE
    (p_start_date IS NULL OR t.created_at >= p_start_date)
    AND (p_end_date IS NULL OR t.created_at <= p_end_date)
  ORDER BY t.created_at DESC, t.title, opt.value->>'label';
END;
$$;

-- 2. 匯出用戶清單
CREATE OR REPLACE FUNCTION public.admin_export_users(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  nickname TEXT,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  token_balance INTEGER,
  is_banned BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    au.email::TEXT,
    p.nickname,
    p.created_at,
    p.last_sign_in_at,
    p.token_balance,
    p.is_banned
  FROM public.profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  WHERE
    (p_start_date IS NULL OR p.created_at >= p_start_date)
    AND (p_end_date IS NULL OR p.created_at <= p_end_date)
  ORDER BY p.created_at DESC;
END;
$$;

-- 3. 匯出財務流水 (代幣交易)
CREATE OR REPLACE FUNCTION public.admin_export_transactions(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  transaction_id UUID,
  created_at TIMESTAMPTZ,
  user_id UUID,
  nickname TEXT,
  email TEXT,
  amount INTEGER,
  type TEXT,
  description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    tt.id AS transaction_id,
    tt.created_at,
    tt.user_id,
    p.nickname,
    au.email::TEXT,
    tt.amount,
    tt.transaction_type AS type,
    tt.description
  FROM public.token_transactions tt
  LEFT JOIN public.profiles p ON p.id = tt.user_id
  LEFT JOIN auth.users au ON au.id = tt.user_id
  WHERE
    (p_start_date IS NULL OR tt.created_at >= p_start_date)
    AND (p_end_date IS NULL OR tt.created_at <= p_end_date)
  ORDER BY tt.created_at DESC;
END;
$$;

COMMIT;
