-- ========================================
-- 添加主題審核欄位到 topics 表
-- ========================================

-- 1. 檢查並添加審核相關欄位
DO $$ 
BEGIN
  -- 添加 approval_status 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE public.topics 
    ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending';
    
    RAISE NOTICE '已添加 approval_status 欄位';
  END IF;

  -- 添加 reviewed_by 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND column_name = 'reviewed_by'
  ) THEN
    ALTER TABLE public.topics 
    ADD COLUMN reviewed_by UUID REFERENCES auth.users(id);
    
    RAISE NOTICE '已添加 reviewed_by 欄位';
  END IF;

  -- 添加 reviewed_at 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE public.topics 
    ADD COLUMN reviewed_at TIMESTAMPTZ;
    
    RAISE NOTICE '已添加 reviewed_at 欄位';
  END IF;

  -- 添加 rejection_reason 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE public.topics 
    ADD COLUMN rejection_reason TEXT;
    
    RAISE NOTICE '已添加 rejection_reason 欄位';
  END IF;
END $$;

-- 2. 添加 CHECK 約束（如果不存在）
DO $$
BEGIN
  -- 檢查 approval_status 的值是否有效
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_schema = 'public' 
    AND table_name = 'topics' 
    AND constraint_name LIKE '%approval_status%'
  ) THEN
    ALTER TABLE public.topics 
    ADD CONSTRAINT topics_approval_status_check 
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));
    
    RAISE NOTICE '已添加 approval_status CHECK 約束';
  END IF;
END $$;

-- 3. 創建索引以提高查詢效能
CREATE INDEX IF NOT EXISTS idx_topics_approval_status 
ON public.topics(approval_status);

-- 4. 將現有主題設為已批准（如果還沒有審核狀態）
UPDATE public.topics 
SET approval_status = 'approved' 
WHERE approval_status IS NULL OR approval_status = '';

-- 5. 驗證欄位
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'topics'
  AND column_name IN ('approval_status', 'reviewed_by', 'reviewed_at', 'rejection_reason')
ORDER BY column_name;

-- 6. 重載 Schema Cache
SELECT pg_notify('pgrst','reload schema');

