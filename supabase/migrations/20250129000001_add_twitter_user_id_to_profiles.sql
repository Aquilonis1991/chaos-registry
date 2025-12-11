-- 添加 twitter_user_id 欄位到 profiles 表
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS twitter_user_id TEXT UNIQUE;

-- 添加索引以加快查詢
CREATE INDEX IF NOT EXISTS profiles_twitter_user_id_idx ON public.profiles (twitter_user_id);

-- 可選：如果需要，可以添加 RLS 政策
-- 例如，如果只有用戶可以更新自己的 twitter_user_id
-- CREATE POLICY "Allow update twitter_user_id for own profile"
--   ON public.profiles FOR UPDATE
--   USING (auth.uid() = id)
--   WITH CHECK (auth.uid() = id);


