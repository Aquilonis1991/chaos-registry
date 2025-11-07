-- ========================================
-- 導入禁字表 CSV 數據
-- 使用方式：將 CSV 轉換為 JSONB 格式後執行
-- ========================================

-- 方法 1：使用 import_banned_words_from_csv 函數
-- 需要先將 CSV 轉換為 JSONB 格式

-- 範例：導入單條記錄
SELECT * FROM public.import_banned_words_from_csv(
  '[
    {"level": "A", "category": "性別/色/不當", "keyword": "關鍵字", "action": "block"}
  ]'::JSONB
);

-- ========================================
-- 方法 2：直接使用 INSERT（批量）
-- ========================================

-- 注意：CSV 檔案編碼問題，建議使用以下方式：
-- 1. 在 Supabase Dashboard 的 Table Editor 手動導入
-- 2. 或使用 Python/Node.js 腳本轉換 CSV 為 SQL INSERT 語句

-- 範例 INSERT 語句格式：
INSERT INTO public.banned_words (level, category, keyword, action)
VALUES
  ('A', '性別/色/不當', '關鍵字1', 'block'),
  ('A', '性別/色/不當', '關鍵字2', 'block'),
  ('B', '政治/政治敏感', '關鍵字3', 'mask')
ON CONFLICT (keyword, level) DO UPDATE
SET 
  category = EXCLUDED.category,
  action = EXCLUDED.action,
  is_active = true,
  updated_at = now();

-- ========================================
-- 方法 3：使用 COPY 命令（PostgreSQL 原生）
-- ========================================
-- 注意：Supabase 可能不支援直接 COPY，建議使用方法 1 或 2

-- COPY public.banned_words (level, category, keyword, action)
-- FROM '/path/to/VoteChaos_BannedWords_V5.csv'
-- WITH (FORMAT csv, HEADER true, DELIMITER ',');

