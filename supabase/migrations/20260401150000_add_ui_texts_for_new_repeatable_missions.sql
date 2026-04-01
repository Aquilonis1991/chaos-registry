-- UI texts for newly added repeatable missions (daily vote + streak rewards)
-- Prevent fallback texts when admin has not configured localized values yet.

INSERT INTO public.ui_texts (key, value, category, description, zh, en, ja)
VALUES
  (
    'mission.list.6.name',
    '每日投票（1票）',
    'mission',
    '任務列表：每日投票 1 票任務名稱',
    '每日投票（1票）',
    'Daily Voting (1 Vote)',
    'デイリー投票（1票）'
  ),
  (
    'mission.list.6.description',
    '今日累積投票 {{target}} 票',
    'mission',
    '任務列表：每日投票 1 票任務說明',
    '今日累積投票 {{target}} 票',
    'Accumulate {{target}} vote today',
    '本日の累計投票 {{target}} 票'
  ),
  (
    'mission.list.6.condition',
    '今日投票 {{target}} 票',
    'mission',
    '任務列表：每日投票 1 票任務條件',
    '今日投票 {{target}} 票',
    'Cast {{target}} vote today',
    '本日 {{target}} 票投票する'
  ),
  (
    'mission.list.7.name',
    '每日投票（5票）',
    'mission',
    '任務列表：每日投票 5 票任務名稱',
    '每日投票（5票）',
    'Daily Voting (5 Votes)',
    'デイリー投票（5票）'
  ),
  (
    'mission.list.7.description',
    '今日累積投票 {{target}} 票',
    'mission',
    '任務列表：每日投票 5 票任務說明',
    '今日累積投票 {{target}} 票',
    'Accumulate {{target}} votes today',
    '本日の累計投票 {{target}} 票'
  ),
  (
    'mission.list.7.condition',
    '今日投票 {{target}} 票',
    'mission',
    '任務列表：每日投票 5 票任務條件',
    '今日投票 {{target}} 票',
    'Cast {{target}} votes today',
    '本日 {{target}} 票投票する'
  ),
  (
    'mission.list.8.name',
    '每日投票（10票）',
    'mission',
    '任務列表：每日投票 10 票任務名稱',
    '每日投票（10票）',
    'Daily Voting (10 Votes)',
    'デイリー投票（10票）'
  ),
  (
    'mission.list.8.description',
    '今日累積投票 {{target}} 票',
    'mission',
    '任務列表：每日投票 10 票任務說明',
    '今日累積投票 {{target}} 票',
    'Accumulate {{target}} votes today',
    '本日の累計投票 {{target}} 票'
  ),
  (
    'mission.list.8.condition',
    '今日投票 {{target}} 票',
    'mission',
    '任務列表：每日投票 10 票任務條件',
    '今日投票 {{target}} 票',
    'Cast {{target}} votes today',
    '本日 {{target}} 票投票する'
  ),
  (
    'mission.list.9.name',
    '連續簽到 7 天',
    'mission',
    '任務列表：連續簽到 7 天（可重複）任務名稱',
    '連續簽到 7 天',
    '7-Day Login Streak',
    '連続ログイン 7 日'
  ),
  (
    'mission.list.9.description',
    '當前連續簽到達 {{target}} 天（可重複）',
    'mission',
    '任務列表：連續簽到 7 天（可重複）任務說明',
    '當前連續簽到達 {{target}} 天（可重複）',
    'Reach a current {{target}}-day login streak (repeatable)',
    '現在の連続ログインが {{target}} 日に到達（繰り返し可能）'
  ),
  (
    'mission.list.9.condition',
    '連續簽到 {{target}} 天',
    'mission',
    '任務列表：連續簽到 7 天（可重複）任務條件',
    '連續簽到 {{target}} 天',
    'Maintain a {{target}}-day login streak',
    '{{target}} 日連続ログインする'
  ),
  (
    'mission.list.10.name',
    '連續簽到 14 天',
    'mission',
    '任務列表：連續簽到 14 天（可重複）任務名稱',
    '連續簽到 14 天',
    '14-Day Login Streak',
    '連続ログイン 14 日'
  ),
  (
    'mission.list.10.description',
    '當前連續簽到達 {{target}} 天（可重複）',
    'mission',
    '任務列表：連續簽到 14 天（可重複）任務說明',
    '當前連續簽到達 {{target}} 天（可重複）',
    'Reach a current {{target}}-day login streak (repeatable)',
    '現在の連続ログインが {{target}} 日に到達（繰り返し可能）'
  ),
  (
    'mission.list.10.condition',
    '連續簽到 {{target}} 天',
    'mission',
    '任務列表：連續簽到 14 天（可重複）任務條件',
    '連續簽到 {{target}} 天',
    'Maintain a {{target}}-day login streak',
    '{{target}} 日連続ログインする'
  ),
  (
    'mission.list.11.name',
    '連續簽到 30 天',
    'mission',
    '任務列表：連續簽到 30 天（可重複）任務名稱',
    '連續簽到 30 天',
    '30-Day Login Streak',
    '連続ログイン 30 日'
  ),
  (
    'mission.list.11.description',
    '當前連續簽到達 {{target}} 天（可重複）',
    'mission',
    '任務列表：連續簽到 30 天（可重複）任務說明',
    '當前連續簽到達 {{target}} 天（可重複）',
    'Reach a current {{target}}-day login streak (repeatable)',
    '現在の連続ログインが {{target}} 日に到達（繰り返し可能）'
  ),
  (
    'mission.list.11.condition',
    '連續簽到 {{target}} 天',
    'mission',
    '任務列表：連續簽到 30 天（可重複）任務條件',
    '連續簽到 {{target}} 天',
    'Maintain a {{target}}-day login streak',
    '{{target}} 日連続ログインする'
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  zh = EXCLUDED.zh,
  en = EXCLUDED.en,
  ja = EXCLUDED.ja,
  updated_at = now();

NOTIFY pgrst, 'reload schema';

