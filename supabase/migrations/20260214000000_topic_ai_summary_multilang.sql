-- 混亂結語支援三語（zh / en / ja），依用戶 UI 語言顯示
ALTER TABLE public.topic_ai_summary
  ADD COLUMN IF NOT EXISTS content_zh TEXT,
  ADD COLUMN IF NOT EXISTS content_en TEXT,
  ADD COLUMN IF NOT EXISTS content_ja TEXT;

COMMENT ON COLUMN public.topic_ai_summary.content_zh IS '混亂結語（繁體中文）';
COMMENT ON COLUMN public.topic_ai_summary.content_en IS '混亂結語（English）';
COMMENT ON COLUMN public.topic_ai_summary.content_ja IS '混亂結語（日本語）';

-- 舊資料：若 content 有值且三語皆空，可視為 content_zh（選填，不強制更新）
-- 新產生者一律寫入 content + content_zh/content_en/content_ja
