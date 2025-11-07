-- Create announcement system

-- Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) <= 100),
  content TEXT NOT NULL CHECK (char_length(content) <= 1000),
  summary TEXT CHECK (char_length(summary) <= 200),
  image_url TEXT,
  priority INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Ensure end_date is after start_date
  CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Policies for announcements
CREATE POLICY "Anyone can view active announcements"
  ON public.announcements FOR SELECT
  USING (
    is_active = true 
    AND start_date <= now() 
    AND end_date > now()
  );

CREATE POLICY "Admins can view all announcements"
  ON public.announcements FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert announcements"
  ON public.announcements FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update announcements"
  ON public.announcements FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete announcements"
  ON public.announcements FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON public.announcements(priority DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_dates ON public.announcements(start_date, end_date);

-- Function to get active announcements (max 3, ordered by priority)
CREATE OR REPLACE FUNCTION public.get_active_announcements(limit_count INTEGER DEFAULT 3)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  summary TEXT,
  image_url TEXT,
  priority INTEGER,
  click_count INTEGER,
  created_at TIMESTAMPTZ
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
    a.created_at
  FROM public.announcements a
  WHERE a.is_active = true
    AND a.start_date <= now()
    AND a.end_date > now()
  ORDER BY a.priority DESC, a.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Function to increment announcement click count
CREATE OR REPLACE FUNCTION public.increment_announcement_clicks(announcement_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.announcements
  SET click_count = click_count + 1
  WHERE id = announcement_id;
END;
$$;

-- Function to automatically deactivate expired announcements
CREATE OR REPLACE FUNCTION public.deactivate_expired_announcements()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.announcements
  SET is_active = false
  WHERE is_active = true 
    AND end_date <= now();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Insert sample announcements for testing
INSERT INTO public.announcements (
  title, 
  content, 
  summary, 
  priority, 
  start_date, 
  end_date,
  is_active
) VALUES 
(
  '歡迎使用投票亂戰！',
  '歡迎來到投票亂戰平台！在這裡您可以發起各種有趣的投票話題，參與討論，與其他用戶互動。我們提供豐富的標籤系統和曝光方案，讓您的話題獲得更多關注。立即開始您的投票之旅吧！',
  '歡迎來到投票亂戰平台！開始您的投票之旅。',
  100,
  now() - interval '1 day',
  now() + interval '30 days',
  true
),
(
  '新功能上線：免費票機制',
  '我們推出了全新的免費票機制！每位用戶每日每主題可免費投票一次，讓您更容易參與討論。同時，連續登入5天還能獲得免費發起主題的資格。快來體驗這些新功能吧！',
  '新功能：每日免費投票 + 免費發起主題資格',
  90,
  now(),
  now() + interval '15 days',
  true
),
(
  '平台規則提醒',
  '為了維護良好的討論環境，請遵守以下規則：1. 不得發布仇恨言論或歧視性內容 2. 不得發布色情或暴力內容 3. 不得發布虛假信息或惡意釣魚 4. 尊重其他用戶的觀點 5. 合理使用檢舉功能。違反規則的用戶將面臨警告或封號處理。',
  '請遵守平台規則，維護良好的討論環境。',
  80,
  now(),
  now() + interval '7 days',
  true
);

-- Add system config for announcement settings
INSERT INTO public.system_config (key, value, category, description) VALUES
  ('announcement_max_display', '3', 'announcement', '前台最多同時顯示的公告數量'),
  ('announcement_title_max_length', '100', 'announcement', '公告標題最大字數'),
  ('announcement_content_max_length', '1000', 'announcement', '公告內容最大字數'),
  ('announcement_summary_max_length', '200', 'announcement', '公告摘要最大字數'),
  ('announcement_auto_deactivate', 'true', 'announcement', '是否自動停用過期公告')
ON CONFLICT (key) DO NOTHING;
