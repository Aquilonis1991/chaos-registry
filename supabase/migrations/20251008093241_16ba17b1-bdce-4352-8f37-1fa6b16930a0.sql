-- 1. Create ui_texts table for managing all UI text content
CREATE TABLE IF NOT EXISTS public.ui_texts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'general',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ui_texts ENABLE ROW LEVEL SECURITY;

-- Anyone can read UI texts
CREATE POLICY "Anyone can view ui_texts"
  ON public.ui_texts
  FOR SELECT
  USING (true);

-- Only service role can modify UI texts (admin only)
CREATE POLICY "Service role can manage ui_texts"
  ON public.ui_texts
  FOR ALL
  USING (false);

-- 2. Add approval system to topics table
ALTER TABLE public.topics 
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Create index for faster approval queries
CREATE INDEX IF NOT EXISTS idx_topics_approval_status ON public.topics(approval_status);

-- Update existing topics to be approved
UPDATE public.topics SET approval_status = 'approved' WHERE approval_status = 'pending';

-- Modify the public view policy to only show approved topics
DROP POLICY IF EXISTS "Anyone can view active topics" ON public.topics;
CREATE POLICY "Anyone can view approved active topics"
  ON public.topics
  FOR SELECT
  USING (status = 'active' AND approval_status = 'approved');

-- Allow creators to view their own pending topics
CREATE POLICY "Creators can view own pending topics"
  ON public.topics
  FOR SELECT
  USING (creator_id = auth.uid());

-- 3. Create admin_users table to track admin permissions
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES profiles(id),
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  granted_by uuid
);

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Only service role can manage admins
CREATE POLICY "Service role can manage admin_users"
  ON public.admin_users
  FOR ALL
  USING (false);

-- Users can check if they are admin
CREATE POLICY "Users can view own admin status"
  ON public.admin_users
  FOR SELECT
  USING (user_id = auth.uid());

-- 4. Insert default UI texts
INSERT INTO public.ui_texts (key, value, description, category) VALUES
  ('nav.home', '首頁', 'Bottom navigation - Home', 'navigation'),
  ('nav.recharge', '儲值', 'Bottom navigation - Recharge', 'navigation'),
  ('nav.create', '發起', 'Bottom navigation - Create', 'navigation'),
  ('nav.mission', '任務', 'Bottom navigation - Mission', 'navigation'),
  ('nav.profile', '個人', 'Bottom navigation - Profile', 'navigation'),
  ('home.title', '投票亂戰', 'Home page title', 'home'),
  ('home.trending', '熱門主題', 'Trending topics section', 'home'),
  ('create.title', '發起新主題', 'Create topic page title', 'create'),
  ('create.submit', '發起主題', 'Submit button text', 'create'),
  ('profile.title', '個人資料', 'Profile page title', 'profile'),
  ('profile.tokens', '代幣餘額', 'Token balance label', 'profile'),
  ('mission.title', '每日任務', 'Mission page title', 'mission'),
  ('mission.complete', '完成', 'Complete mission button', 'mission'),
  ('common.loading', '載入中...', 'Loading text', 'common'),
  ('common.error', '發生錯誤', 'Error message', 'common'),
  ('common.success', '成功', 'Success message', 'common')
ON CONFLICT (key) DO NOTHING;

-- 5. Create function to refund tokens when topic is deleted
CREATE OR REPLACE FUNCTION public.refund_topic_tokens()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  topic_cost integer;
  exposure_cost integer;
  duration_cost integer;
BEGIN
  -- Calculate the cost that was paid for this topic
  exposure_cost := CASE OLD.exposure_level
    WHEN 'low' THEN 5
    WHEN 'medium' THEN 10
    WHEN 'high' THEN 15
    ELSE 5
  END;
  
  duration_cost := CASE OLD.duration_days
    WHEN 1 THEN 3
    WHEN 3 THEN 5
    WHEN 7 THEN 8
    WHEN 14 THEN 12
    ELSE 3
  END;
  
  topic_cost := exposure_cost + duration_cost;
  
  -- Refund tokens to the creator
  UPDATE public.profiles
  SET tokens = tokens + topic_cost
  WHERE id = OLD.creator_id;
  
  -- Log the refund transaction
  INSERT INTO public.token_transactions (user_id, amount, transaction_type, description, reference_id)
  VALUES (
    OLD.creator_id,
    topic_cost,
    'refund',
    '主題被刪除，退還代幣',
    OLD.id
  );
  
  RETURN OLD;
END;
$$;

-- Create trigger for topic deletion refunds
DROP TRIGGER IF EXISTS trigger_refund_topic_tokens ON public.topics;
CREATE TRIGGER trigger_refund_topic_tokens
  BEFORE DELETE ON public.topics
  FOR EACH ROW
  EXECUTE FUNCTION public.refund_topic_tokens();

-- Add trigger for ui_texts updated_at
DROP TRIGGER IF EXISTS update_ui_texts_updated_at ON public.ui_texts;
CREATE TRIGGER update_ui_texts_updated_at
  BEFORE UPDATE ON public.ui_texts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();