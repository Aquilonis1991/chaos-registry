-- 公告：分類、背景配色預設、顯示日期；權重改為 1～100

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS announcement_category TEXT NOT NULL DEFAULT '一般';

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS style_preset SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS display_date DATE;

UPDATE public.announcements
SET announcement_category = '一般'
WHERE announcement_category IS NULL OR trim(announcement_category) = '';

UPDATE public.announcements
SET style_preset = 1
WHERE style_preset IS NULL OR style_preset < 1 OR style_preset > 8;

-- 權重納入 1～100
UPDATE public.announcements
SET priority = 1
WHERE priority IS NULL OR priority < 1;

UPDATE public.announcements
SET priority = 100
WHERE priority > 100;

ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_priority_check;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_priority_check CHECK (priority >= 1 AND priority <= 100);

ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_category_check;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_category_check CHECK (
    announcement_category IN ('重要', '一般', '節慶', '活動', '其他')
  );

ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_style_preset_check;

ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_style_preset_check CHECK (style_preset >= 1 AND style_preset <= 8);

-- 前台取得有效公告（含分類／配色／顯示日）
DROP FUNCTION IF EXISTS public.get_active_announcements(integer);

CREATE OR REPLACE FUNCTION public.get_active_announcements(limit_count INTEGER DEFAULT 3)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  summary TEXT,
  image_url TEXT,
  priority INTEGER,
  click_count INTEGER,
  created_at TIMESTAMPTZ,
  announcement_category TEXT,
  style_preset SMALLINT,
  display_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.title,
    a.content,
    a.summary,
    a.image_url,
    a.priority,
    a.click_count,
    a.created_at,
    a.announcement_category,
    a.style_preset,
    a.display_date
  FROM public.announcements a
  WHERE a.is_active = true
    AND a.start_date <= now()
    AND a.end_date > now()
  ORDER BY a.priority DESC, a.created_at DESC
  LIMIT limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_announcements(integer) TO anon, authenticated;

ALTER FUNCTION public.get_active_announcements(integer) SET search_path TO public;
