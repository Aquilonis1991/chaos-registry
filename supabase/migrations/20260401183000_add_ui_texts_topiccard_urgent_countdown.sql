-- UI texts for TopicCard urgent countdown badge/message.
-- Ensures text can be managed from backend UI_texts.

INSERT INTO public.ui_texts (key, value, category, description, zh, en, ja)
VALUES
  (
    'home.topicCard.urgentTag',
    '🔥 倒數中',
    'home',
    '首頁主題卡片：最後 1 小時顯示的倒數標籤',
    '🔥 倒數中',
    '🔥 Countdown',
    '🔥 カウントダウン中'
  ),
  (
    'common.time.urgentMinutes',
    '⌛ 剩餘 {{count}} 分鐘',
    'common_time',
    '首頁主題卡片：最後 1 小時顯示的強提示剩餘分鐘',
    '⌛ 剩餘 {{count}} 分鐘',
    '⌛ {{count}} minutes left',
    '⌛ 残り{{count}}分'
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
