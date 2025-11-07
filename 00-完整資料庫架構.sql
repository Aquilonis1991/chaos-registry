-- ========================================
-- VoteChaos 完整資料庫架構初始化
-- 請在 Supabase Dashboard SQL Editor 執行
-- ========================================

-- ========================================
-- 1. 基礎工具函數
-- ========================================

-- 更新 updated_at 時間戳記的函數
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. Profiles 表格（用戶資料）
-- ========================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL DEFAULT 'User',
  avatar TEXT NOT NULL DEFAULT '🔥',
  tokens INTEGER NOT NULL DEFAULT 0,
  joined_topics TEXT[] DEFAULT '{}',
  created_topics TEXT[] DEFAULT '{}',
  ad_watch_count INTEGER NOT NULL DEFAULT 0,
  last_login TIMESTAMPTZ DEFAULT now(),
  notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 刪除舊政策
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- 建立政策
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trigger
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ========================================
-- 3. Topics 表格（主題/投票）
-- ========================================

CREATE TABLE IF NOT EXISTS public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  options JSONB NOT NULL DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exposure_level TEXT NOT NULL CHECK (exposure_level IN ('normal', 'medium', 'high')),
  duration_days INTEGER NOT NULL CHECK (duration_days >= 1 AND duration_days <= 30),
  votes JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'reported', 'deleted'))
);

-- 新增欄位（如果表格已存在但缺少欄位）
DO $$ 
BEGIN
  -- 新增 description
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'topics' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.topics ADD COLUMN description TEXT;
  END IF;
  
  -- 新增 category
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'topics' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.topics ADD COLUMN category TEXT;
  END IF;
  
  -- 新增 updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'topics' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.topics ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- 啟用 RLS
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- 刪除舊政策
DROP POLICY IF EXISTS "Anyone can view active topics" ON public.topics;
DROP POLICY IF EXISTS "Authenticated users can create topics" ON public.topics;
DROP POLICY IF EXISTS "Creators can update own topics" ON public.topics;
DROP POLICY IF EXISTS "Users can view all topics" ON public.topics;

-- 建立政策
CREATE POLICY "Users can view all topics"
  ON public.topics FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create topics"
  ON public.topics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own topics"
  ON public.topics FOR UPDATE
  USING (auth.uid() = creator_id);

-- ========================================
-- 4. Votes 表格（投票記錄）
-- ========================================

CREATE TABLE IF NOT EXISTS public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  option TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, topic_id)
);

-- 啟用 RLS
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- 刪除舊政策
DROP POLICY IF EXISTS "Users can view all votes" ON public.votes;
DROP POLICY IF EXISTS "Users can insert own votes" ON public.votes;
DROP POLICY IF EXISTS "Users can update own votes" ON public.votes;

-- 建立政策
CREATE POLICY "Users can view all votes"
  ON public.votes FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own votes"
  ON public.votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own votes"
  ON public.votes FOR UPDATE
  USING (auth.uid() = user_id);

-- ========================================
-- 5. 自動建立 Profile 的觸發器
-- ========================================

-- 處理新用戶註冊
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, avatar, tokens)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'avatar', '🔥'),
    50  -- 新用戶初始代幣
  );
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- 如果插入失敗（例如 profile 已存在），忽略錯誤
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 建立觸發器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- 6. System Config 表格
-- ========================================

CREATE TABLE IF NOT EXISTS public.system_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  category text NOT NULL,
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- 刪除舊政策
DROP POLICY IF EXISTS "Anyone can view system config" ON public.system_config;

-- 允許所有人查看
CREATE POLICY "Anyone can view system config"
  ON public.system_config FOR SELECT
  USING (true);

-- 插入預設配置
INSERT INTO public.system_config (key, value, category, description) VALUES
  ('title_max_length', '200', 'validation', '主題標題最大字數'),
  ('title_min_length', '5', 'validation', '主題標題最小字數'),
  ('description_max_length', '150', 'validation', '主題描述最大字數'),
  ('option_min_count', '2', 'validation', '最少選項數量'),
  ('option_max_count', '6', 'validation', '最多選項數量'),
  ('tags_max_count', '5', 'validation', '最多標籤數量'),
  ('vote_button_amounts', '[1, 5, 10, 20, 50, 100]', 'voting', '投票按鈕數量'),
  ('vote_max_amount', '100', 'voting', '單次投票最大數量'),
  ('vote_min_amount', '1', 'voting', '單次投票最小數量'),
  ('exposure_costs', '{"normal": 30, "medium": 90, "high": 180}', 'topic_cost', '曝光方案成本'),
  ('duration_costs', '{"1": 0, "2": 0, "3": 0, "4": 1, "5": 2, "6": 3, "7": 4, "8": 6, "9": 8, "10": 10, "11": 12, "12": 14, "13": 16, "14": 18, "15": 21, "16": 24, "17": 27, "18": 30}', 'topic_cost', '天數成本'),
  ('duration_min_days', '1', 'topic_cost', '最少天數'),
  ('duration_max_days', '30', 'topic_cost', '最多天數'),
  ('new_user_tokens', '50', 'user', '新用戶初始代幣')
ON CONFLICT (key) DO NOTHING;

-- ========================================
-- 7. 重新載入 Schema Cache
-- ========================================

NOTIFY pgrst, 'reload schema';

-- ========================================
-- 8. 驗證
-- ========================================

SELECT 
  '✅ Database schema initialized successfully!' as status,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count,
  (SELECT COUNT(*) FROM public.system_config) as config_count;



