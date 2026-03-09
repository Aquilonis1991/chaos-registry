-- 財務交易紀錄匯出：加用戶固定ID欄位、email 改為實際值不隱藏
-- 用戶固定ID = auth.users.id (tt.user_id)，email 來自 auth.users

DROP FUNCTION IF EXISTS public.admin_export_transactions_v2(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_export_transactions_v2(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.admin_export_transactions_v2(
  p_start_date TEXT DEFAULT NULL,
  p_end_date TEXT DEFAULT NULL
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
SET search_path = public, auth
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  BEGIN
    IF p_start_date IS NOT NULL THEN v_start := p_start_date::TIMESTAMPTZ; END IF;
    IF p_end_date IS NOT NULL THEN v_end := p_end_date::TIMESTAMPTZ; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_start := NULL;
    v_end := NULL;
  END;

  RETURN QUERY
  SELECT
    tt.id AS transaction_id,
    tt.created_at,
    tt.user_id,
    p.nickname,
    COALESCE(u.email, '')::TEXT AS email,
    tt.amount,
    tt.transaction_type AS type,
    tt.description
  FROM public.token_transactions tt
  LEFT JOIN public.profiles p ON p.id = tt.user_id
  LEFT JOIN auth.users u ON u.id = tt.user_id
  WHERE
    (v_start IS NULL OR tt.created_at >= v_start)
    AND (v_end IS NULL OR tt.created_at <= v_end)
  ORDER BY tt.created_at DESC;
END;
$$;
