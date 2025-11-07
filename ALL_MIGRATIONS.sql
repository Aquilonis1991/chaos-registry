-- ============================================
-- VoteChaos 完整資料庫遷移腳本
-- Project: epyykzxxglkjombvozhr
-- ============================================
-- 
-- 使用方法：
-- 1. 登入 Supabase Dashboard
-- 2. 選擇專案 epyykzxxglkjombvozhr
-- 3. 進入 SQL Editor
-- 4. 依序執行以下 SQL（建議分段執行）
--
-- ⚠️ 警告：此腳本會創建所有表格和函數
-- 如果表格已存在可能會報錯，可以忽略或先刪除
-- ============================================

-- ============================================
-- 第一部分：執行舊的遷移檔案
-- ============================================
-- 
-- 請先依序執行以下檔案的內容：
-- 1. supabase/migrations/20251007075605_ebe2adf3-cae5-4110-80b0-8f250b080829.sql
-- 2. supabase/migrations/20251007075806_e5a63b96-8c60-47ed-b458-1714b6d38bff.sql
-- 3. supabase/migrations/20251008031416_ce6208bf-8e78-4d16-994c-2789c6fe654a.sql
-- 4. supabase/migrations/20251008072802_cd730d2e-416d-4ad3-b577-0dab9d04b886.sql
-- 5. supabase/migrations/20251008074549_720cc9c8-59cd-405a-b4e9-74cd5d7af1f2.sql
-- 6. supabase/migrations/20251008081954_ebd269bb-bcc1-4577-bbb7-3f47752aac5d.sql
-- 7. supabase/migrations/20251008084123_3f07d7bf-57c9-4d16-9dd8-acd47ebc1b4c.sql
-- 8. supabase/migrations/20251008093241_16ba17b1-bdce-4352-8f37-1fa6b16930a0.sql
-- 9. supabase/migrations/20251008123917_6980aa2a-11de-4cc6-99c6-7f43bbd7aa63.sql
-- 10. supabase/migrations/20251008123957_5a38ee04-4be3-478f-810f-9f58e700e6b5.sql
-- 11. supabase/migrations/20251009055344_38a17186-fc30-45a8-8ca8-9d4d94089813.sql
-- 12. supabase/migrations/20251009083548_9a178953-cca8-453f-ad81-9ccbf6bf3e7b.sql
-- 13. supabase/migrations/20251013070122_e4ea9ca3-eb01-4e4e-9ea1-5e2b87a0aadf.sql
-- 14. supabase/migrations/20251013091805_9e159e7f-c38a-4962-8bb2-aa9552ccc7fc.sql
-- 15. supabase/migrations/20251013112515_4403f9c9-352b-4b4a-a50d-cdbce2617913.sql
-- 16. supabase/migrations/20251014025037_7d9e00fc-8872-4065-814c-6176478481f5.sql
--
-- ⚠️ 這些檔案太長，請分別複製貼上執行
--
-- ============================================


-- ============================================
-- 第二部分：新功能遷移（可以使用此腳本）
-- ============================================

-- 提示：執行完第一部分的16個遷移後，再執行以下內容

-- ============================================
-- 遷移 1: 免費投票系統
-- ============================================

-- Create free_votes table
CREATE TABLE IF NOT EXISTS public.free_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_free_vote_per_day UNIQUE (user_id, topic_id, (used_at::date))
);

-- Enable RLS on free_votes
ALTER TABLE public.free_votes ENABLE ROW LEVEL SECURITY;

-- Policies for free_votes
DROP POLICY IF EXISTS "Users can view own free votes" ON public.free_votes;
CREATE POLICY "Users can view own free votes"
  ON public.free_votes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own free votes" ON public.free_votes;
CREATE POLICY "Users can insert own free votes"
  ON public.free_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to check if a user has a free vote available
CREATE OR REPLACE FUNCTION public.has_free_vote_available(p_user_id uuid, p_topic_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1
    FROM public.free_votes
    WHERE user_id = p_user_id
      AND topic_id = p_topic_id
      AND used_at::date = now()::date
  );
END;
$$;

-- Function to record a free vote
CREATE OR REPLACE FUNCTION public.record_free_vote(p_user_id uuid, p_topic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.free_votes (user_id, topic_id)
  VALUES (p_user_id, p_topic_id);
END;
$$;

-- Update topics table to include free_votes_count
ALTER TABLE public.topics
ADD COLUMN IF NOT EXISTS free_votes_count INTEGER NOT NULL DEFAULT 0;

-- Create trigger function
CREATE OR REPLACE FUNCTION public.increment_free_votes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.topics
  SET free_votes_count = free_votes_count + 1
  WHERE id = NEW.topic_id;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS increment_free_votes_count_trigger ON public.free_votes;
CREATE TRIGGER increment_free_votes_count_trigger
AFTER INSERT ON public.free_votes
FOR EACH ROW
EXECUTE FUNCTION public.increment_free_votes_count();

-- ============================================
-- 遷移 2: 免費建立主題系統
-- ============================================

-- Create free_create_qualifications table
CREATE TABLE IF NOT EXISTS public.free_create_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  source TEXT,
  description TEXT,
  CONSTRAINT unique_active_free_qualification UNIQUE (user_id) WHERE used_at IS NULL AND expires_at IS NULL
);

-- Enable RLS
ALTER TABLE public.free_create_qualifications ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view own free create qualifications" ON public.free_create_qualifications;
CREATE POLICY "Users can view own free create qualifications"
  ON public.free_create_qualifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own free create qualifications" ON public.free_create_qualifications;
CREATE POLICY "Users can insert own free create qualifications"
  ON public.free_create_qualifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage free create qualifications" ON public.free_create_qualifications;
CREATE POLICY "Service role can manage free create qualifications"
  ON public.free_create_qualifications FOR ALL
  USING (false);

-- Function to check qualification
CREATE OR REPLACE FUNCTION public.has_free_create_qualification(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Function to use qualification
CREATE OR REPLACE FUNCTION public.use_free_create_qualification(check_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  qualification_id UUID;
BEGIN
  SELECT id INTO qualification_id
  FROM public.free_create_qualifications
  WHERE user_id = check_user_id
    AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1
  FOR UPDATE;

  IF qualification_id IS NULL THEN
    RAISE EXCEPTION 'No active free create qualification found for user %', check_user_id;
  END IF;

  UPDATE public.free_create_qualifications
  SET used_at = now()
  WHERE id = qualification_id;
END;
$$;

-- ============================================
-- 執行到這裡請先驗證
-- ============================================
-- 
-- SELECT * FROM pg_tables WHERE schemaname = 'public';
-- 
-- 應該看到 free_votes 和 free_create_qualifications 表
--
-- ============================================

-- 請在下一個 SQL 查詢中繼續執行公告系統和檢舉系統的遷移
-- 或參考 QUICK_SQL_MIGRATION.md 逐步執行

