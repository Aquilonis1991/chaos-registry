-- 創建任務獎勵系統
-- 確保所有任務都存在於數據庫中

-- 創建 missions 表（如果不存在）
CREATE TABLE IF NOT EXISTS public.missions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  condition TEXT NOT NULL,
  reward INTEGER NOT NULL,
  limit_per_day INTEGER,
  completed_users JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 啟用 RLS
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- 創建 RLS 政策（如果不存在）
DROP POLICY IF EXISTS "Anyone can view missions" ON public.missions;
CREATE POLICY "Anyone can view missions"
  ON public.missions FOR SELECT
  USING (true);

-- 插入/更新任務到 missions 表
INSERT INTO public.missions (id, name, condition, reward, limit_per_day) VALUES
  ('first_vote', '新手上路', '完成第一次投票', 50, NULL),
  ('vote_lover', '投票愛好者', '對 10 個不同主題進行投票', 50, NULL),
  ('topic_creator', '話題創造者', '發起一個主題', 50, NULL),
  ('login_7days', '7天登入', '連續登入 7 天', 100, NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  condition = EXCLUDED.condition,
  reward = EXCLUDED.reward,
  limit_per_day = EXCLUDED.limit_per_day;

-- 刷新 Schema Cache
NOTIFY pgrst, 'reload schema';

