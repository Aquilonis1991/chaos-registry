-- 時間篩選功能 UI 文字
-- 分類：timeFilter
-- 用於歷史記錄頁面的時間篩選器

INSERT INTO public.ui_texts (key, value, description, category, zh, en, ja) VALUES
  -- 時間篩選選項
  ('timeFilter.option.all', '全部', '時間篩選 - 顯示全部記錄', 'timeFilter', '全部', 'All', 'すべて'),
  ('timeFilter.option.1day', '1天', '時間篩選 - 最近1天', 'timeFilter', '1天', '1 Day', '1日'),
  ('timeFilter.option.1week', '1週', '時間篩選 - 最近1週', 'timeFilter', '1週', '1 Week', '1週間'),
  ('timeFilter.option.1month', '1個月', '時間篩選 - 最近1個月', 'timeFilter', '1個月', '1 Month', '1ヶ月'),
  ('timeFilter.option.3months', '3個月', '時間篩選 - 最近3個月', 'timeFilter', '3個月', '3 Months', '3ヶ月'),
  ('timeFilter.option.6months', '6個月', '時間篩選 - 最近6個月', 'timeFilter', '6個月', '6 Months', '6ヶ月'),
  ('timeFilter.option.1year', '1年', '時間篩選 - 最近1年', 'timeFilter', '1年', '1 Year', '1年')
ON CONFLICT (key) DO UPDATE 
SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  zh = EXCLUDED.zh,
  en = EXCLUDED.en,
  ja = EXCLUDED.ja,
  updated_at = now();
