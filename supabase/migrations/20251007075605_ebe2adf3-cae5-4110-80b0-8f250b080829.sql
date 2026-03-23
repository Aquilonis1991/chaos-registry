-- Create profiles table for user data（遠端可能已存在）
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

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create topics table
CREATE TABLE IF NOT EXISTS public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exposure_level TEXT NOT NULL CHECK (exposure_level IN ('normal', 'medium', 'high')),
  duration_days INTEGER NOT NULL CHECK (duration_days >= 1 AND duration_days <= 30),
  votes JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'reported'))
);

-- Enable RLS on topics
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;

-- Topics policies
DROP POLICY IF EXISTS "Anyone can view active topics" ON public.topics;
DROP POLICY IF EXISTS "Authenticated users can create topics" ON public.topics;
DROP POLICY IF EXISTS "Creators can update own topics" ON public.topics;
CREATE POLICY "Anyone can view active topics"
  ON public.topics FOR SELECT
  USING (status = 'active');

CREATE POLICY "Authenticated users can create topics"
  ON public.topics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update own topics"
  ON public.topics FOR UPDATE
  USING (auth.uid() = creator_id);

-- Create votes table
CREATE TABLE IF NOT EXISTS public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  option TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, topic_id)
);

-- Enable RLS on votes
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Votes policies
DROP POLICY IF EXISTS "Users can view all votes" ON public.votes;
DROP POLICY IF EXISTS "Users can insert own votes" ON public.votes;
DROP POLICY IF EXISTS "Users can update own votes" ON public.votes;
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

-- reports 已由 20250115000003 建立（reporter_id 等新欄位）；略過舊版 user_id schema 與 policies

-- Create missions table
CREATE TABLE IF NOT EXISTS public.missions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  condition TEXT NOT NULL,
  reward INTEGER NOT NULL,
  limit_per_day INTEGER,
  completed_users JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on missions
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- Missions policies
DROP POLICY IF EXISTS "Anyone can view missions" ON public.missions;
CREATE POLICY "Anyone can view missions"
  ON public.missions FOR SELECT
  USING (true);

-- Insert default missions
INSERT INTO public.missions (id, name, condition, reward, limit_per_day) VALUES
  ('vote_lover', '投票愛好者', 'vote_5_times', 50, NULL),
  ('topic_creator', '話題創造者', 'create_1_topic', 50, NULL),
  ('login_7days', '7天登入', 'login_7_days', 100, NULL),
  ('watch_ad', '觀看廣告', 'watch_ad', 10, 5)
ON CONFLICT (id) DO NOTHING;

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, avatar, tokens)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'avatar', '🔥'),
    1250
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();