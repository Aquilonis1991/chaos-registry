# LINE 登入 - 執行 Migration 說明

> **更新日期**：2025-01-29

---

## ⚠️ 情況說明

使用 `npx supabase db push` 時遇到錯誤（之前的 migration 有問題），但我們的 LINE migration 可以單獨執行。

---

## ✅ 解決方案：在 Supabase Dashboard 中執行

### 步驟 1：登入 Supabase Dashboard

1. 前往：https://app.supabase.com/
2. 選擇專案：`votechaos` (epyykzxxglkjombvozhr)

### 步驟 2：進入 SQL Editor

1. 在左側導航欄，點擊 **「SQL Editor」**
2. 或直接訪問：`https://app.supabase.com/project/epyykzxxglkjombvozhr/sql/new`

### 步驟 3：執行 Migration

**複製以下 SQL 並執行**：

```sql
-- Add line_user_id column to profiles table for LINE login integration
-- This allows linking LINE users to Supabase users

-- Add line_user_id column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS line_user_id TEXT;

-- Create unique index on line_user_id to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_line_user_id 
ON public.profiles(line_user_id) 
WHERE line_user_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.profiles.line_user_id IS 'LINE user ID for LINE login integration';
```

### 步驟 4：驗證執行結果

執行以下 SQL 確認欄位已添加：

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'line_user_id';
```

**預期結果**：
- 應該返回一行，顯示 `line_user_id` 欄位

---

## ✅ 檢查清單

- [ ] 已登入 Supabase Dashboard
- [ ] 已進入 SQL Editor
- [ ] 已執行 Migration SQL
- [ ] 已驗證 `line_user_id` 欄位存在

---

## 🔗 相關文件

- [LINE 登入 - Edge Function 實作詳細步驟](./LINE登入-EdgeFunction實作步驟.md)
- [LINE 登入 - 實作檢查清單](./LINE登入-實作檢查清單.md)

---

**執行完成後，可以繼續進行下一步：設定環境變數和部署 Edge Function。**




