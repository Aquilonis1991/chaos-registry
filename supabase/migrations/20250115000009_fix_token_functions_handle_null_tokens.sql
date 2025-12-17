-- ========================================
-- 修正代幣欄位可能為 NULL 時，add_tokens / deduct_tokens 的行為
--
-- 根因：
-- - 既有 add_tokens 寫法為：tokens = tokens + token_amount
-- - 若 profiles.tokens 為 NULL，則 NULL + 3 = NULL，導致「簽到顯示成功但代幣不增加」
--
-- 修正：
-- 1) 將 profiles.tokens 的 NULL 值補成 0
-- 2) 設定 tokens 預設值為 0，並設為 NOT NULL（避免未來再出現 NULL）
-- 3) 更新 add_tokens / deduct_tokens 使用 COALESCE(tokens, 0)
-- ========================================

-- 1) 修正既有資料：把 NULL 補為 0
UPDATE public.profiles
SET tokens = 0
WHERE tokens IS NULL;

-- 2) 防止未來再出現 NULL
ALTER TABLE public.profiles
  ALTER COLUMN tokens SET DEFAULT 0;

ALTER TABLE public.profiles
  ALTER COLUMN tokens SET NOT NULL;

-- 3) 修正 add_tokens：使用 COALESCE 避免 NULL + N = NULL
CREATE OR REPLACE FUNCTION public.add_tokens(user_id uuid, token_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET tokens = COALESCE(tokens, 0) + token_amount
  WHERE id = user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

-- 4) 修正 deduct_tokens：使用 COALESCE，並以 COALESCE(tokens,0) 做餘額檢查
CREATE OR REPLACE FUNCTION public.deduct_tokens(user_id uuid, token_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET tokens = COALESCE(tokens, 0) - token_amount
  WHERE id = user_id
    AND COALESCE(tokens, 0) >= token_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient tokens or user not found';
  END IF;
END;
$$;


