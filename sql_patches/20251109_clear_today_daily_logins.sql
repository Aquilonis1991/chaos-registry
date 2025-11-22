-- 清除全用戶當日簽到紀錄，並重算連續登入統計
BEGIN;

-- 刪除今日的 daily_logins 紀錄
DELETE FROM public.daily_logins
WHERE login_date = CURRENT_DATE;

-- 重新計算 profiles 中的登入統計
WITH last_logins AS (
  SELECT
    p.id AS user_id,
    (
      SELECT MAX(dl.login_date)
      FROM public.daily_logins dl
      WHERE dl.user_id = p.id
    ) AS last_login_date
  FROM public.profiles p
),
streaks AS (
  SELECT
    p.id AS user_id,
    ll.last_login_date,
    (
      SELECT COUNT(*)
      FROM public.daily_logins dl
      WHERE dl.user_id = p.id
        AND dl.login_date <= ll.last_login_date
    ) AS total_login_days,
    COALESCE((
      SELECT COUNT(*)
      FROM (
        SELECT
          dl.login_date,
          ROW_NUMBER() OVER (ORDER BY dl.login_date DESC) AS rn
        FROM public.daily_logins dl
        WHERE dl.user_id = p.id
          AND dl.login_date <= ll.last_login_date
      ) seq
      WHERE ll.last_login_date IS NOT NULL
        AND ll.last_login_date - seq.login_date = seq.rn - 1
    ), 0) AS login_streak
  FROM public.profiles p
  LEFT JOIN last_logins ll ON ll.user_id = p.id
)
UPDATE public.profiles p
SET
  last_login_date = streaks.last_login_date,
  total_login_days = streaks.total_login_days,
  login_streak = streaks.login_streak,
  updated_at = now()
FROM streaks
WHERE p.id = streaks.user_id;

-- 刷新 schema cache（確保 API 立即生效）
NOTIFY pgrst, 'reload schema';

COMMIT;


