-- 一般請求定時上限：依 identifier（user_id 或 anon）與 action_type 統計每分鐘請求次數，超過則拒絕。
-- （RPC 覆寫拆至 20260215000001～00004，避免單檔多段 CREATE+GRANT 觸發 prepared statement 錯誤）

-- 1. 表：每 (identifier, action_type) 每分鐘一個 bucket
CREATE TABLE IF NOT EXISTS public.general_rate_limits (
  identifier TEXT NOT NULL,
  action_type TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (identifier, action_type)
);

CREATE INDEX IF NOT EXISTS idx_general_rate_limits_updated
  ON public.general_rate_limits (updated_at);

COMMENT ON TABLE public.general_rate_limits IS '一般 API 請求 rate limit：每 identifier+action_type 每分鐘 request_count 不超過設定上限';

-- 2. 檢查函數：未超過上限則將計數 +1，超過則拋錯
CREATE OR REPLACE FUNCTION public.check_general_rate_limit(
  p_action_type TEXT,
  p_max_per_minute INT DEFAULT 120
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_identifier TEXT;
  v_window    TIMESTAMPTZ;
  v_count     INT;
BEGIN
  v_identifier := COALESCE(auth.uid()::TEXT, 'anon');
  v_window     := date_trunc('minute', NOW());

  INSERT INTO public.general_rate_limits (identifier, action_type, window_start, request_count, updated_at)
  VALUES (v_identifier, p_action_type, v_window, 1, NOW())
  ON CONFLICT (identifier, action_type)
  DO UPDATE SET
    request_count = CASE
      WHEN general_rate_limits.window_start = v_window
        THEN general_rate_limits.request_count + 1
      ELSE 1
    END,
    window_start = CASE
      WHEN general_rate_limits.window_start = v_window
        THEN general_rate_limits.window_start
      ELSE v_window
    END,
    updated_at = NOW();

  SELECT request_count INTO v_count
  FROM public.general_rate_limits
  WHERE identifier = v_identifier AND action_type = p_action_type AND window_start = v_window;

  IF v_count > p_max_per_minute THEN
    RAISE EXCEPTION 'Rate limit exceeded. Try again later.'
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_general_rate_limit(TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_general_rate_limit(TEXT, INT) TO anon;

ALTER TABLE public.general_rate_limits ENABLE ROW LEVEL SECURITY;
