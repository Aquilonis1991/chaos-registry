-- ========================================
-- 修復主題隱藏欄位
-- 確保 topics 表包含所有必要的隱藏相關欄位
-- ========================================

-- 1. 添加隱藏相關欄位（如果不存在）
DO $$
BEGIN
  -- 添加 is_hidden 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND column_name = 'is_hidden'
  ) THEN
    ALTER TABLE public.topics 
    ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- 添加 hidden_by 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND column_name = 'hidden_by'
  ) THEN
    ALTER TABLE public.topics 
    ADD COLUMN hidden_by UUID REFERENCES auth.users(id);
  END IF;

  -- 添加 hidden_at 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND column_name = 'hidden_at'
  ) THEN
    ALTER TABLE public.topics 
    ADD COLUMN hidden_at TIMESTAMPTZ;
  END IF;

  -- 添加 hidden_reason 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND column_name = 'hidden_reason'
  ) THEN
    ALTER TABLE public.topics 
    ADD COLUMN hidden_reason TEXT;
  END IF;

  -- 添加 report_count 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND column_name = 'report_count'
  ) THEN
    ALTER TABLE public.topics 
    ADD COLUMN report_count INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- 添加 auto_hidden 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND column_name = 'auto_hidden'
  ) THEN
    ALTER TABLE public.topics 
    ADD COLUMN auto_hidden BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- 2. 創建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_topics_is_hidden ON public.topics(is_hidden);
CREATE INDEX IF NOT EXISTS idx_topics_report_count ON public.topics(report_count);

-- 3. 更新現有主題的預設值（確保所有欄位都有正確的值）
UPDATE public.topics
SET 
  is_hidden = COALESCE(is_hidden, false),
  report_count = COALESCE(report_count, 0),
  auto_hidden = COALESCE(auto_hidden, false)
WHERE is_hidden IS NULL OR report_count IS NULL OR auto_hidden IS NULL;

-- 4. 驗證欄位是否存在
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'topics'
  AND column_name IN ('is_hidden', 'hidden_by', 'hidden_at', 'hidden_reason', 'report_count', 'auto_hidden')
ORDER BY column_name;

-- 5. 重新載入 Schema Cache
SELECT pg_notify('pgrst', 'reload schema');

