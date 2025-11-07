-- 清除所有帳號的任務完成狀態
-- 此操作會刪除所有用戶的任務完成記錄，讓所有用戶可以重新領取任務獎勵

-- 首先確保 missions 表存在（user_missions 表需要引用它）
CREATE TABLE IF NOT EXISTS public.missions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  condition TEXT NOT NULL,
  reward INTEGER NOT NULL,
  limit_per_day INTEGER,
  completed_users JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 檢查並創建 user_missions 表（如果不存在）
-- 注意：如果表已存在，此語句不會有任何影響
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_missions'
  ) THEN
    CREATE TABLE public.user_missions (
      id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      mission_id text NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
      progress integer NOT NULL DEFAULT 0,
      completed boolean NOT NULL DEFAULT false,
      completed_at timestamp with time zone,
      last_completed_date date,
      created_at timestamp with time zone NOT NULL DEFAULT now(),
      updated_at timestamp with time zone NOT NULL DEFAULT now(),
      UNIQUE(user_id, mission_id)
    );
  END IF;
END $$;

-- 啟用 RLS（如果尚未啟用）
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

-- 創建 RLS 政策（如果不存在）
DROP POLICY IF EXISTS "Users can view own missions" ON public.user_missions;
CREATE POLICY "Users can view own missions" 
  ON public.user_missions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own missions" ON public.user_missions;
CREATE POLICY "Users can insert own missions" 
  ON public.user_missions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own missions" ON public.user_missions;
CREATE POLICY "Users can update own missions" 
  ON public.user_missions FOR UPDATE
  USING (auth.uid() = user_id);

-- 查看清除前的記錄數量
SELECT 
  '清除前' as status,
  COUNT(*) as total_records,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT mission_id) as unique_missions
FROM public.user_missions;

-- 創建一個臨時函數來清除所有任務完成記錄（繞過 RLS 限制）
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
  
  RETURN QUERY SELECT v_count, '已清除 ' || v_count || ' 筆任務完成記錄'::text;
END;
$$;

-- 方法1：使用函數清除所有任務完成記錄（推薦，繞過 RLS 限制）
SELECT * FROM public.clear_all_user_missions();

-- 方法2（不推薦）：直接刪除（可能遇到 RLS 限制）
-- DELETE FROM public.user_missions;

-- 方法2（可選）：如果只想重置完成狀態而保留記錄，可以取消註釋以下代碼
-- UPDATE public.user_missions
-- SET 
--   completed = false,
--   completed_at = NULL,
--   last_completed_date = NULL,
--   progress = 0,
--   updated_at = now();

-- 顯示清除後的結果
SELECT 
  '清除後' as status,
  COUNT(*) as remaining_records
FROM public.user_missions;

-- 確認清除完成
SELECT '所有任務完成狀態已清除' as result;

