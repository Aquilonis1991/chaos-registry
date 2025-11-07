-- 修復剩餘的資料庫問題
-- 在 Supabase SQL Editor 執行

-- 1. 修復 free_votes 表格結構
ALTER TABLE public.free_votes 
ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ DEFAULT now();

-- 2. 建立 audit_logs 表格
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 建立政策
CREATE POLICY "Users can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view own audit logs" ON public.audit_logs FOR SELECT USING (auth.uid() = user_id);

-- 3. 確保 topics 表格的 options 欄位有正確的預設值
UPDATE public.topics 
SET options = '[]'::jsonb 
WHERE options IS NULL;

-- 4. 修復任何現有主題的 options 結構
UPDATE public.topics 
SET options = jsonb_build_array(
  jsonb_build_object('text', '選項A', 'votes', 0),
  jsonb_build_object('text', '選項B', 'votes', 0)
)
WHERE jsonb_array_length(options) = 0;

-- 5. 確保所有現有主題的 options 都有 votes 欄位
UPDATE public.topics 
SET options = (
  SELECT jsonb_agg(
    CASE 
      WHEN option ? 'votes' THEN option
      ELSE option || '{"votes": 0}'::jsonb
    END
  )
  FROM jsonb_array_elements(options) AS option
)
WHERE EXISTS (
  SELECT 1 
  FROM jsonb_array_elements(options) AS option 
  WHERE NOT (option ? 'votes')
);

-- 6. 建立一些測試資料（可選）
INSERT INTO public.ui_texts (key, value, language) VALUES
  ('welcome_message', '歡迎使用 VoteChaos！', 'zh'),
  ('create_topic_title', '建立新主題', 'zh'),
  ('vote_success', '投票成功！', 'zh')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.announcements (title, content, type, is_active, priority) VALUES
  ('歡迎使用 VoteChaos！', '感謝您使用我們的投票平台，開始建立您的第一個主題吧！', 'info', true, 1);

-- 7. 檢查結果
SELECT 
  '✅ 修復完成！' as status,
  (SELECT COUNT(*) FROM public.profiles) as profile_count,
  (SELECT COUNT(*) FROM public.topics) as topic_count,
  (SELECT COUNT(*) FROM public.free_votes) as free_vote_count,
  (SELECT COUNT(*) FROM public.audit_logs) as audit_log_count;
