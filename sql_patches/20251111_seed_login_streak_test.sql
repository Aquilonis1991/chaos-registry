-- 建立測試用連續登入紀錄，以驗證 7 天登入任務進度
-- 使用方式：
--   1. 將 target_user_id 改為實際要測試的使用者 UUID。
--   2. 每次執行腳本會自動增加「前置連續天數」，首次執行為 0，第二次為 1（昨天），第三次為 2（前天＋昨天），以此類推。
--   3. 執行腳本後，再由前端或呼叫 record_daily_login() 進行今日簽到，檢驗連續登入天數是否遞增。
--   4. 當前置天數已達 6（簽到後即為第 7 天）時，腳本會維持在 6，便於重複驗證第 7 天。

BEGIN;

-- 紀錄測試進度的輔助資料表
CREATE TABLE IF NOT EXISTS public.login_seed_tracker (
  user_id uuid PRIMARY KEY,
  seeded_days integer NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  target_user_id uuid := '4f2694ea-6c42-4ceb-9b9e-cb86933bfd7f'; -- TODO: 改成實際使用者 ID
  max_seed_days integer := 6; -- 最高預先建立 6 天，簽到後即達 7 天
  auto_claim_today boolean := true; -- 設為 true 時，腳本會自動呼叫 record_daily_login() 模擬今日簽到
  current_seed integer;
  start_date date;
  insert_date date;
BEGIN
  IF target_user_id = '00000000-0000-0000-0000-000000000000' THEN
    RAISE EXCEPTION '請先在腳本中設定 target_user_id 後再執行';
  END IF;

  -- 鎖定或新增測試紀錄
  SELECT seeded_days INTO current_seed
  FROM public.login_seed_tracker
  WHERE user_id = target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    current_seed := 0;
    INSERT INTO public.login_seed_tracker (user_id, seeded_days, last_updated)
    VALUES (target_user_id, current_seed, now());
  ELSE
    current_seed := current_seed + 1;
    IF current_seed > max_seed_days THEN
      current_seed := max_seed_days;
    END IF;
    UPDATE public.login_seed_tracker
    SET seeded_days = current_seed,
        last_updated = now()
    WHERE user_id = target_user_id;
  END IF;

  -- 計算起始日期（current_seed = 0 表示不插入任何歷史紀錄）
  start_date := CURRENT_DATE - current_seed;

  -- 清除目標範圍（包含今日），確保重新簽到時不會出現重複
  DELETE FROM public.daily_logins
  WHERE user_id = target_user_id
    AND login_date >= start_date;

  DELETE FROM public.daily_logins
  WHERE user_id = target_user_id
    AND login_date = CURRENT_DATE;

  -- 逐日插入測試用登入紀錄（僅到昨天為止，不含今日）
  IF current_seed > 0 THEN
    FOR insert_date IN
      SELECT gs::date
      FROM generate_series(start_date, CURRENT_DATE - 1, INTERVAL '1 day') gs
    LOOP
      INSERT INTO public.daily_logins (user_id, login_date)
      VALUES (target_user_id, insert_date)
      ON CONFLICT (user_id, login_date) DO NOTHING;
    END LOOP;
  END IF;

  -- 需要時自動進行今日簽到，模擬使用者操作
  IF auto_claim_today THEN
    PERFORM *
    FROM public.record_daily_login(target_user_id);
  END IF;

  -- 重新整理 profiles 的統計資料，確保前端讀取快取值時一致
  UPDATE public.profiles p
  SET
    last_login_date = sub.max_login_date,
    total_login_days = sub.total_login_days,
    login_streak = COALESCE(sub.streak, 0),
    updated_at = now()
  FROM (
    SELECT
      MAX(login_date) AS max_login_date,
      COUNT(*) AS total_login_days,
      COALESCE((
        SELECT COUNT(*)
        FROM (
          SELECT
            dl.login_date,
            ROW_NUMBER() OVER (ORDER BY dl.login_date DESC) AS rn
          FROM public.daily_logins dl
          WHERE dl.user_id = target_user_id
        ) seq
        CROSS JOIN LATERAL (
          SELECT MAX(login_date) AS max_login_date
          FROM public.daily_logins
          WHERE user_id = target_user_id
        ) latest
        WHERE latest.max_login_date IS NOT NULL
          AND latest.max_login_date - seq.login_date = seq.rn - 1
      ), 0) AS streak
    FROM public.daily_logins
    WHERE user_id = target_user_id
  ) sub
  WHERE p.id = target_user_id;

  -- 重新載入 PostgREST schema，確保 API 隨即反映變更
  NOTIFY pgrst, 'reload schema';
END $$;

COMMIT;


