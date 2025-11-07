-- 新增 topics 表格缺失的欄位
-- 在 Supabase Dashboard SQL Editor 執行

-- 1. 新增 category 欄位（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND column_name = 'category'
  ) THEN
    ALTER TABLE public.topics ADD COLUMN category TEXT;
  END IF;
END $$;

-- 2. 新增 description 欄位（如果不存在）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND column_name = 'description'
  ) THEN
    ALTER TABLE public.topics ADD COLUMN description TEXT;
  END IF;
END $$;

-- 3. 重新載入 Schema Cache
NOTIFY pgrst, 'reload schema';

-- 4. 驗證欄位已新增
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'topics'
AND column_name IN ('category', 'description', 'title', 'options', 'tags')
ORDER BY column_name;

-- 應該看到 category 和 description 欄位



