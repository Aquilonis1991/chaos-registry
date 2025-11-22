-- 重設任務列表，確保與前端需求一致
BEGIN;

-- 1. 確保 missions 資料表存在（與既有結構相同）
CREATE TABLE IF NOT EXISTS public.missions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  condition TEXT NOT NULL,
  reward INTEGER NOT NULL,
  limit_per_day INTEGER,
  completed_users JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 啟用 RLS 與查詢政策
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view missions" ON public.missions;
CREATE POLICY "Anyone can view missions"
  ON public.missions FOR SELECT
  USING (true);

-- 3. 插入 / 更新任務（每日簽到、觀看廣告、四個主要任務）
INSERT INTO public.missions (id, name, condition, reward, limit_per_day) VALUES
  ('daily_login',  '每日簽到',   '每天登入一次',             3,  1),
  ('watch_ad',     '觀看廣告',   '觀看一則 30 秒廣告',       5, 10),
  ('first_vote',   '新手上路',   '完成第一次投票',          50, NULL),
  ('vote_lover',   '投票愛好者', '對 10 個不同主題進行投票', 50, NULL),
  ('topic_creator','話題創造者', '發起一個主題',            50, NULL),
  ('login_7days',  '7天登入',   '連續登入 7 天',           100, NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  condition = EXCLUDED.condition,
  reward = EXCLUDED.reward,
  limit_per_day = EXCLUDED.limit_per_day;

-- 4. 清除不再使用的任務 ID（保留上述清單）
DELETE FROM public.missions
WHERE id NOT IN (
  'daily_login',
  'watch_ad',
  'first_vote',
  'vote_lover',
  'topic_creator',
  'login_7days'
);

-- 5. 更新任務相關系統設定值（若不存在則建立）
INSERT INTO public.system_config (key, value, category, description) VALUES
  ('daily_login_reward', '3', 'mission', '每日登入獎勵代幣數'),
  ('consecutive_login_target', '7', 'mission', '連續登入目標天數'),
  ('watch_ad_daily_limit', '10', 'mission', '每日可觀看廣告次數上限'),
  ('watch_ad_reward', '5', 'mission', '單次觀看廣告獎勵代幣數')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description;

-- 6. 通知 PostgREST 重新整理 schema 快取
NOTIFY pgrst, 'reload schema';

COMMIT;


