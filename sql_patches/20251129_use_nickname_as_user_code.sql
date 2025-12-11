-- 修改用戶註冊邏輯：
-- 1. 生成唯一的 user_code（USER + 6位數字）
-- 2. 如果註冊時沒有提供 nickname，使用生成的 user_code 作為臨時 nickname

-- 更新 handle_new_user 函數
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  initial_tokens integer;
  v_nickname TEXT;
  v_user_code TEXT;
BEGIN
  SELECT (value::text)::integer INTO initial_tokens
  FROM public.system_config
  WHERE key = 'new_user_tokens';
  
  IF initial_tokens IS NULL THEN
    initial_tokens := 50;
  END IF;
  
  -- 生成唯一的 user_code（USER + 6位數字）
  LOOP
    v_user_code := 'USER' || to_char(floor(random() * 1000000)::INT, 'FM000000');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE user_code = v_user_code
    );
  END LOOP;
  
  -- 取得註冊時的 nickname（如果有的話）
  v_nickname := COALESCE(NEW.raw_user_meta_data->>'nickname', '');
  
  -- 如果沒有提供 nickname 或為空，使用生成的 user_code 作為臨時 nickname
  IF TRIM(v_nickname) = '' THEN
    v_nickname := v_user_code;
  END IF;
  
  INSERT INTO public.profiles (id, nickname, avatar, tokens, user_code)
  VALUES (
    NEW.id,
    v_nickname,
    COALESCE(NEW.raw_user_meta_data->>'avatar', '🔥'),
    initial_tokens,
    v_user_code
  );
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';

