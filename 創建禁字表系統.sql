-- ========================================
-- 禁字表系統
-- 用於檢查主題標題、內容、選項、分類、標籤、會員名稱
-- ========================================

-- 0. 確保 admin_users 表存在（如果不存在則創建）
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- 基本 RLS 政策（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'admin_users' 
    AND policyname = 'Users can view own admin status'
  ) THEN
    CREATE POLICY "Users can view own admin status"
      ON public.admin_users FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 1. 創建禁字表
CREATE TABLE IF NOT EXISTS public.banned_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('A', 'B', 'C', 'D', 'E', 'F')),
  category TEXT NOT NULL,
  keyword TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('block', 'mask', 'review')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(keyword, level) -- 同一級別同一關鍵字不重複
);

-- 創建索引以提高查詢效能
CREATE INDEX IF NOT EXISTS idx_banned_words_keyword ON public.banned_words(keyword);
CREATE INDEX IF NOT EXISTS idx_banned_words_level ON public.banned_words(level);
CREATE INDEX IF NOT EXISTS idx_banned_words_active ON public.banned_words(is_active) WHERE is_active = true;

-- 啟用 RLS
ALTER TABLE public.banned_words ENABLE ROW LEVEL SECURITY;

-- RLS 政策：所有人可以查看，僅管理員可以修改
CREATE POLICY "Anyone can view banned words"
  ON public.banned_words FOR SELECT
  USING (true);

-- 檢查 is_admin 函數是否存在，如果不存在則創建
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = check_user_id
  );
$$;

CREATE POLICY "Only admins can insert banned words"
  ON public.banned_words FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can update banned words"
  ON public.banned_words FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete banned words"
  ON public.banned_words FOR DELETE
  USING (public.is_admin(auth.uid()));

-- 更新 updated_at 觸發器
CREATE TRIGGER update_banned_words_updated_at
  BEFORE UPDATE ON public.banned_words
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ========================================
-- 2. 創建驗證函數
-- ========================================

-- 檢查文本是否包含禁字
CREATE OR REPLACE FUNCTION public.check_banned_words(
  p_text TEXT,
  p_check_levels TEXT[] DEFAULT ARRAY['A', 'B', 'C', 'D', 'E', 'F']::TEXT[]
)
RETURNS TABLE (
  found BOOLEAN,
  level TEXT,
  keyword TEXT,
  action TEXT,
  category TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text_lower TEXT;
  v_word RECORD;
BEGIN
  -- 轉為小寫以進行不區分大小寫的匹配
  v_text_lower := LOWER(p_text);

  -- 檢查所有活躍的禁字
  FOR v_word IN
    SELECT level, keyword, action, category
    FROM public.banned_words
    WHERE is_active = true
      AND level = ANY(p_check_levels)
      AND v_text_lower LIKE '%' || LOWER(v_word.keyword) || '%'
    ORDER BY 
      CASE level
        WHEN 'A' THEN 1
        WHEN 'B' THEN 2
        WHEN 'C' THEN 3
        WHEN 'D' THEN 4
        WHEN 'E' THEN 5
        WHEN 'F' THEN 6
      END
    LIMIT 1 -- 只返回第一個匹配的（最高優先級）
  LOOP
    RETURN QUERY SELECT true, v_word.level, v_word.keyword, v_word.action, v_word.category;
    RETURN; -- 找到第一個就返回
  END LOOP;

  -- 沒有找到禁字
  RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
END;
$$;

-- 驗證主題內容（標題、描述、選項、標籤）
CREATE OR REPLACE FUNCTION public.validate_topic_content(
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_options JSONB DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_check_levels TEXT[] DEFAULT ARRAY['A', 'B', 'C', 'D', 'E', 'F']::TEXT[]
)
RETURNS TABLE (
  is_valid BOOLEAN,
  error_message TEXT,
  matched_keyword TEXT,
  matched_level TEXT,
  matched_action TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_check_result RECORD;
  v_option TEXT;
  v_tag TEXT;
BEGIN
  -- 檢查標題
  SELECT * INTO v_check_result
  FROM public.check_banned_words(p_title, p_check_levels)
  WHERE found = true;

  IF v_check_result.found THEN
    RETURN QUERY SELECT 
      false,
      '標題包含不當內容：' || v_check_result.keyword,
      v_check_result.keyword,
      v_check_result.level,
      v_check_result.action;
    RETURN;
  END IF;

  -- 檢查描述
  IF p_description IS NOT NULL AND p_description != '' THEN
    SELECT * INTO v_check_result
    FROM public.check_banned_words(p_description, p_check_levels)
    WHERE found = true;

    IF v_check_result.found THEN
      RETURN QUERY SELECT 
        false,
        '描述包含不當內容：' || v_check_result.keyword,
        v_check_result.keyword,
        v_check_result.level,
        v_check_result.action;
      RETURN;
    END IF;
  END IF;

  -- 檢查分類
  IF p_category IS NOT NULL AND p_category != '' THEN
    SELECT * INTO v_check_result
    FROM public.check_banned_words(p_category, p_check_levels)
    WHERE found = true;

    IF v_check_result.found THEN
      RETURN QUERY SELECT 
        false,
        '分類包含不當內容：' || v_check_result.keyword,
        v_check_result.keyword,
        v_check_result.level,
        v_check_result.action;
      RETURN;
    END IF;
  END IF;

  -- 檢查選項
  IF p_options IS NOT NULL THEN
    FOR v_option IN
      SELECT value->>'text' AS text
      FROM jsonb_array_elements(p_options)
      WHERE value->>'text' IS NOT NULL
    LOOP
      SELECT * INTO v_check_result
      FROM public.check_banned_words(v_option, p_check_levels)
      WHERE found = true;

      IF v_check_result.found THEN
        RETURN QUERY SELECT 
          false,
          '選項包含不當內容：' || v_check_result.keyword,
          v_check_result.keyword,
          v_check_result.level,
          v_check_result.action;
        RETURN;
      END IF;
    END LOOP;
  END IF;

  -- 檢查標籤
  IF p_tags IS NOT NULL THEN
    FOREACH v_tag IN ARRAY p_tags
    LOOP
      SELECT * INTO v_check_result
      FROM public.check_banned_words(v_tag, p_check_levels)
      WHERE found = true;

      IF v_check_result.found THEN
        RETURN QUERY SELECT 
          false,
          '標籤包含不當內容：' || v_check_result.keyword,
          v_check_result.keyword,
          v_check_result.level,
          v_check_result.action;
        RETURN;
      END IF;
    END LOOP;
  END IF;

  -- 全部通過
  RETURN QUERY SELECT true, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
END;
$$;

-- 驗證用戶名稱
CREATE OR REPLACE FUNCTION public.validate_nickname(
  p_nickname TEXT,
  p_check_levels TEXT[] DEFAULT ARRAY['A', 'B', 'C', 'D', 'E', 'F']::TEXT[]
)
RETURNS TABLE (
  is_valid BOOLEAN,
  error_message TEXT,
  matched_keyword TEXT,
  matched_level TEXT,
  matched_action TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_check_result RECORD;
BEGIN
  SELECT * INTO v_check_result
  FROM public.check_banned_words(p_nickname, p_check_levels)
  WHERE found = true;

  IF v_check_result.found THEN
    RETURN QUERY SELECT 
      false,
      '名稱包含不當內容：' || v_check_result.keyword,
      v_check_result.keyword,
      v_check_result.level,
      v_check_result.action;
  ELSE
    RETURN QUERY SELECT true, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
  END IF;
END;
$$;

-- ========================================
-- 3. 批量導入函數（從 CSV 格式）
-- ========================================

CREATE OR REPLACE FUNCTION public.import_banned_words_from_csv(
  p_csv_data JSONB -- 格式：[{"level": "A", "category": "...", "keyword": "...", "action": "block"}, ...]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_imported INTEGER := 0;
  v_skipped INTEGER := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 遍歷 CSV 數據
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_csv_data)
  LOOP
    BEGIN
      INSERT INTO public.banned_words (level, category, keyword, action)
      VALUES (
        (v_item->>'level'),
        (v_item->>'category'),
        (v_item->>'keyword'),
        (v_item->>'action')
      )
      ON CONFLICT (keyword, level) DO UPDATE
      SET 
        category = EXCLUDED.category,
        action = EXCLUDED.action,
        is_active = true,
        updated_at = now();
      
      v_imported := v_imported + 1;
    EXCEPTION
      WHEN OTHERS THEN
        v_skipped := v_skipped + 1;
        v_errors := array_append(v_errors, 
          '錯誤：' || COALESCE(v_item->>'keyword', '未知') || ' - ' || SQLERRM);
    END;
  END LOOP;

  -- 返回結果
  RETURN jsonb_build_object(
    'imported_count', v_imported,
    'skipped_count', v_skipped,
    'errors', v_errors
  );
END;
$$;

-- ========================================
-- 4. 重載 Schema Cache
-- ========================================

SELECT pg_notify('pgrst','reload schema');

