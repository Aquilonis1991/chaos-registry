-- 重新整理 Supabase Schema Cache
-- 在 Supabase Dashboard SQL Editor 執行

-- 1. 先刪除舊函數（如果存在）
DROP FUNCTION IF EXISTS public.has_free_create_qualification(UUID);
DROP FUNCTION IF EXISTS public.has_free_create_qualification(check_user_id UUID);
DROP FUNCTION IF EXISTS public.use_free_create_qualification(UUID);
DROP FUNCTION IF EXISTS public.use_free_create_qualification(check_user_id UUID);
DROP FUNCTION IF EXISTS public.grant_free_create_qualification(UUID, TEXT, TEXT, TIMESTAMPTZ);

-- 2. 重新建立函數（使用正確的簽名）
CREATE OR REPLACE FUNCTION public.has_free_create_qualification(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.free_create_qualifications
    WHERE user_id = check_user_id
    AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.use_free_create_qualification(check_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qualification_id UUID;
BEGIN
  SELECT id INTO qualification_id
  FROM public.free_create_qualifications
  WHERE user_id = check_user_id
  AND used_at IS NULL
  AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at ASC
  LIMIT 1;

  IF qualification_id IS NULL THEN
    RAISE EXCEPTION 'No available free create qualification';
  END IF;

  UPDATE public.free_create_qualifications
  SET used_at = now()
  WHERE id = qualification_id;

  RETURN qualification_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_free_create_qualification(
  target_user_id UUID,
  qualification_type TEXT,
  source TEXT DEFAULT NULL,
  expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qualification_id UUID;
BEGIN
  INSERT INTO public.free_create_qualifications (
    user_id,
    qualification_type,
    source,
    expires_at
  ) VALUES (
    target_user_id,
    qualification_type,
    source,
    expires_at
  ) RETURNING id INTO qualification_id;

  RETURN qualification_id;
END;
$$;

-- 3. 重新載入 Schema（重要！）
NOTIFY pgrst, 'reload schema';

-- 4. 驗證函數已建立
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%free_create%'
ORDER BY routine_name;

-- 應該看到 3 個函數



