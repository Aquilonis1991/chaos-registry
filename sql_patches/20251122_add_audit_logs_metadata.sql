-- ========================================
-- 20251122 - 補齊 audit_logs.metadata 欄位
-- ========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'audit_logs'
      AND column_name  = 'metadata'
  ) THEN
    ALTER TABLE public.audit_logs
      ADD COLUMN metadata JSONB;
  END IF;
END $$;

