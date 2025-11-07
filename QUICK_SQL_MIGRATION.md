# 快速 SQL 遷移指南

> 💡 **最簡單的方法**：直接在 Supabase Dashboard 的 SQL Editor 中執行以下 SQL

## 🎯 執行步驟

### 1️⃣ 登入 Supabase Dashboard
- 訪問：https://supabase.com/dashboard
- 選擇您的專案
- 點擊左側的 **SQL Editor**
- 點擊 **New query**

### 2️⃣ 按順序執行以下 SQL（重要：按順序執行！）

---

## 📋 遷移 1：免費投票系統

**檔案：** `20250115000000_add_free_vote_system.sql`

**複製以下 SQL 並執行：**

```sql
-- Create free_votes table
CREATE TABLE public.free_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_free_vote_per_day UNIQUE (user_id, topic_id, (used_at::date))
);

-- Enable RLS on free_votes
ALTER TABLE public.free_votes ENABLE ROW LEVEL SECURITY;

-- Policies for free_votes
CREATE POLICY "Users can view own free votes"
  ON public.free_votes FOR SELECT
  USING (auth.uid() = user_id);

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
CREATE TRIGGER increment_free_votes_count_trigger
AFTER INSERT ON public.free_votes
FOR EACH ROW
EXECUTE FUNCTION public.increment_free_votes_count();
```

✅ **執行完成後，應該看到 "Success. No rows returned"**

---

## 📋 遷移 2：免費建立主題系統

**檔案：** `20250115000001_add_free_create_system.sql`

**複製以下 SQL 並執行：**

```sql
-- Create free_create_qualifications table
CREATE TABLE public.free_create_qualifications (
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
CREATE POLICY "Users can view own free create qualifications"
  ON public.free_create_qualifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own free create qualifications"
  ON public.free_create_qualifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

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
```

✅ **執行完成後，應該看到 "Success. No rows returned"**

---

## 📋 遷移 3：公告系統

**檔案：** `20250115000002_add_announcement_system.sql`

**⚠️ 注意：這個遷移比較長，建議分兩段執行**

### 第一段：創建表格和函數

```sql
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
  CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view active announcements"
  ON public.announcements FOR SELECT
  USING (is_active = true AND start_date <= now() AND end_date > now());

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON public.announcements(priority DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_dates ON public.announcements(start_date, end_date);

-- Function to get active announcements
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
    a.id, a.title, a.content, a.summary, a.image_url,
    a.priority, a.click_count, a.created_at
  FROM public.announcements a
  WHERE a.is_active = true
    AND a.start_date <= now()
    AND a.end_date > now()
  ORDER BY a.priority DESC, a.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Function to increment clicks
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

-- Function to deactivate expired
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
  WHERE is_active = true AND end_date <= now();
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Create trigger
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
```

### 第二段：插入示範資料和系統配置

```sql
-- Insert sample announcements
INSERT INTO public.announcements (
  title, content, summary, priority, start_date, end_date, is_active
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

-- Add system config
INSERT INTO public.system_config (key, value, category, description) VALUES
  ('announcement_max_display', '3', 'announcement', '前台最多同時顯示的公告數量'),
  ('announcement_title_max_length', '100', 'announcement', '公告標題最大字數'),
  ('announcement_content_max_length', '1000', 'announcement', '公告內容最大字數'),
  ('announcement_summary_max_length', '200', 'announcement', '公告摘要最大字數'),
  ('announcement_auto_deactivate', 'true', 'announcement', '是否自動停用過期公告')
ON CONFLICT (key) DO NOTHING;
```

✅ **執行完成後，應該看到 "Success. Rows affected: 3" (插入了3個公告)**

---

## 📋 遷移 4：檢舉系統

**檔案：** `20250115000003_add_report_system.sql`

**⚠️ 注意：這個遷移最長，建議分三段執行**

### 第一段：創建枚舉類型和表格

```sql
-- Create enums
CREATE TYPE public.report_type AS ENUM (
  'hate_speech', 'sexual_content', 'violence', 'illegal',
  'spam', 'phishing', 'misinformation', 'harassment', 'other'
);

CREATE TYPE public.report_status AS ENUM (
  'pending', 'reviewing', 'resolved', 'rejected', 'closed'
);

-- Create reports table
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_email TEXT,
  target_type TEXT NOT NULL CHECK (target_type IN ('topic', 'user', 'comment')),
  target_id UUID NOT NULL,
  report_type public.report_type NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(reason) <= 500),
  details TEXT CHECK (char_length(details) <= 2000),
  status public.report_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  resolution TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_user_target_report UNIQUE (reporter_id, target_type, target_id, report_type)
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY "Users can insert reports"
  ON public.reports FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all reports"
  ON public.reports FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update reports"
  ON public.reports FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete reports"
  ON public.reports FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_type ON public.reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON public.reports(created_at DESC);
```

### 第二段：創建統計函數

```sql
-- Function to get stats
CREATE OR REPLACE FUNCTION public.get_report_stats()
RETURNS TABLE (
  total_reports BIGINT,
  pending_reports BIGINT,
  reviewing_reports BIGINT,
  resolved_reports BIGINT,
  rejected_reports BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_reports,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT as pending_reports,
    COUNT(*) FILTER (WHERE status = 'reviewing')::BIGINT as reviewing_reports,
    COUNT(*) FILTER (WHERE status = 'resolved')::BIGINT as resolved_reports,
    COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT as rejected_reports
  FROM public.reports;
END;
$$;
```

### 第三段：創建查詢和更新函數

```sql
-- Function to get reports with details
CREATE OR REPLACE FUNCTION public.get_reports_with_details(
  p_status public.report_status DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID, reporter_id UUID, reporter_email TEXT,
  target_type TEXT, target_id UUID, target_title TEXT,
  report_type public.report_type, reason TEXT, details TEXT,
  status public.report_status, reviewed_by UUID, reviewed_at TIMESTAMPTZ,
  admin_notes TEXT, resolution TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id, r.reporter_id, r.reporter_email, r.target_type, r.target_id,
    CASE 
      WHEN r.target_type = 'topic' THEN (SELECT t.title FROM public.topics t WHERE t.id = r.target_id)
      WHEN r.target_type = 'user' THEN (SELECT p.username FROM public.profiles p WHERE p.id = r.target_id)
      ELSE NULL
    END as target_title,
    r.report_type, r.reason, r.details, r.status, r.reviewed_by, r.reviewed_at,
    r.admin_notes, r.resolution, r.created_at, r.updated_at
  FROM public.reports r
  WHERE (p_status IS NULL OR r.status = p_status)
  ORDER BY 
    CASE 
      WHEN r.status = 'pending' THEN 1
      WHEN r.status = 'reviewing' THEN 2
      WHEN r.status = 'resolved' THEN 3
      WHEN r.status = 'rejected' THEN 4
      ELSE 5
    END,
    r.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Function to update status
CREATE OR REPLACE FUNCTION public.update_report_status(
  p_report_id UUID,
  p_status public.report_status,
  p_admin_notes TEXT DEFAULT NULL,
  p_resolution TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.reports
  SET 
    status = p_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    admin_notes = COALESCE(p_admin_notes, admin_notes),
    resolution = COALESCE(p_resolution, resolution),
    updated_at = now()
  WHERE id = p_report_id;
END;
$$;

-- Create trigger
CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Add system config
INSERT INTO public.system_config (key, value, category, description) VALUES
  ('report_email_notifications', 'true', 'report', '是否發送檢舉郵件通知給管理員'),
  ('report_admin_email', 'admin@votechaos.com', 'report', '接收檢舉通知的管理員郵箱'),
  ('report_auto_hide_threshold', '5', 'report', '自動隱藏內容的檢舉數量閾值'),
  ('report_require_auth', 'false', 'report', '檢舉是否需要登入')
ON CONFLICT (key) DO NOTHING;
```

✅ **執行完成後，應該看到 "Success. No rows returned"**

---

## ✅ 驗證遷移成功

執行以下 SQL 驗證所有遷移都成功：

```sql
-- 檢查所有新表格
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('free_votes', 'free_create_qualifications', 'announcements', 'reports');
-- 應該返回 4 行

-- 檢查公告資料
SELECT title, priority FROM announcements ORDER BY priority DESC;
-- 應該返回 3 個公告

-- 檢查檢舉統計
SELECT * FROM get_report_stats();
-- 應該返回全 0 的統計

-- 檢查所有函數
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%free%' 
   OR routine_name LIKE '%announcement%'
   OR routine_name LIKE '%report%';
-- 應該返回多個函數
```

---

## 🎉 完成！

如果所有驗證都通過，恭喜您成功完成資料庫遷移！

### 下一步：

1. **啟動開發服務器**：
   ```powershell
   npm run dev
   ```

2. **測試功能**：
   - 首頁應該顯示公告輪播
   - 主題詳情頁應該有檢舉按鈕和免費投票按鈕
   - 管理員可以訪問後台查看公告和檢舉管理

3. **如果遇到問題**：
   - 檢查瀏覽器控制台的錯誤
   - 查看 Supabase Dashboard 的 Logs
   - 確認 RLS 政策是否正確啟用

---

## 💡 小提示

- 建議保存這些 SQL 語句，以便未來需要時重新執行
- 在生產環境執行前，建議先在測試環境驗證
- 定期備份資料庫以防萬一

祝您使用愉快！🚀

