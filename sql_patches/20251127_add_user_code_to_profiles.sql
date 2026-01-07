-- 為用戶建立可讀 ID（USER+隨機亂數），並確保唯一

-- 1. 產生 user_code 的函數
DROP FUNCTION IF EXISTS public.generate_user_code();

CREATE OR REPLACE FUNCTION public.generate_user_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  LOOP
    v_code := 'USER' || to_char(floor(random() * 1000000)::INT, 'FM000000');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE user_code = v_code
    );
  END LOOP;
  RETURN v_code;
END;
$$;

-- 2. 新增 user_code 欄位並設定預設值
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_code TEXT;

ALTER TABLE public.profiles
  ALTER COLUMN user_code SET DEFAULT public.generate_user_code();

-- 3. 補齊既有用戶的 user_code
WITH to_update AS (
  SELECT id
  FROM public.profiles
  WHERE user_code IS NULL OR user_code = ''
)
UPDATE public.profiles AS p
SET user_code = public.generate_user_code()
FROM to_update tu
WHERE p.id = tu.id;

-- 4. 確保 user_code 唯一
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND indexname = 'profiles_user_code_key'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_code_key UNIQUE (user_code);
  END IF;
END;
$$;

-- 5. 更新 handle_new_user 以寫入 user_code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  initial_tokens integer;
BEGIN
  SELECT (value::text)::integer INTO initial_tokens
  FROM public.system_config
  WHERE key = 'new_user_tokens';
  
  IF initial_tokens IS NULL THEN
    initial_tokens := 50;
  END IF;
  
  INSERT INTO public.profiles (id, nickname, avatar, tokens, user_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'avatar', '🔥'),
    initial_tokens,
    public.generate_user_code()
  );
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';






