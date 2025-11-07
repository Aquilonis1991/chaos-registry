# 🚀 Supabase 專案設置指南

## 📋 您的 Supabase 連接資訊

```
Project URL: https://epyykzxxglkjombvozhr.supabase.co
Project Ref: epyykzxxglkjombvozhr
API Key (anon): eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVweXlrenh4Z2xram9tYnZvemhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MDg1MTEsImV4cCI6MjA3NTk4NDUxMX0.A2QBfDwW1TlG5GiKaHN3_JzT3Tk3U0hJfTZm0hRq1tg
```

---

## 🔧 Step 1: 設置環境變數

### 創建 `.env.local` 檔案

在專案根目錄創建 `.env.local` 檔案（與 `package.json` 同級），內容如下：

```env
VITE_SUPABASE_URL=https://epyykzxxglkjombvozhr.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVweXlrenh4Z2xram9tYnZvemhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MDg1MTEsImV4cCI6MjA3NTk4NDUxMX0.A2QBfDwW1TlG5GiKaHN3_JzT3Tk3U0hJfTZm0hRq1tg
```

**使用 PowerShell 創建檔案：**

```powershell
@"
VITE_SUPABASE_URL=https://epyykzxxglkjombvozhr.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVweXlrenh4Z2xram9tYnZvemhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MDg1MTEsImV4cCI6MjA3NTk4NDUxMX0.A2QBfDwW1TlG5GiKaHN3_JzT3Tk3U0hJfTZm0hRq1tg
"@ | Out-File -FilePath .env.local -Encoding utf8
```

---

## 🗄️ Step 2: 執行資料庫遷移

您有 **兩種方式** 執行遷移：

### 🎯 方式 A：使用 Supabase Dashboard（推薦！最簡單）

1. **登入 Supabase Dashboard**
   - 訪問：https://supabase.com/dashboard
   - 登入您的帳號
   - 選擇專案：`epyykzxxglkjombvozhr`

2. **打開 SQL Editor**
   - 點擊左側導航欄的 **SQL Editor**
   - 點擊 **New query** 創建新查詢

3. **按順序執行遷移 SQL**
   
   請按照 `QUICK_SQL_MIGRATION.md` 文檔中的順序執行所有 SQL：
   
   #### 第一批：舊的遷移（基礎結構）
   依序執行 `supabase/migrations/` 目錄下的以下檔案：
   
   1. `20251007075605_ebe2adf3-cae5-4110-80b0-8f250b080829.sql`
   2. `20251007075806_e5a63b96-8c60-47ed-b458-1714b6d38bff.sql`
   3. `20251008031416_ce6208bf-8e78-4d16-994c-2789c6fe654a.sql`
   4. `20251008072802_cd730d2e-416d-4ad3-b577-0dab9d04b886.sql`
   5. `20251008074549_720cc9c8-59cd-405a-b4e9-74cd5d7af1f2.sql`
   6. `20251008081954_ebd269bb-bcc1-4577-bbb7-3f47752aac5d.sql`
   7. `20251008084123_3f07d7bf-57c9-4d16-9dd8-acd47ebc1b4c.sql`
   8. `20251008093241_16ba17b1-bdce-4352-8f37-1fa6b16930a0.sql`
   9. `20251008123917_6980aa2a-11de-4cc6-99c6-7f43bbd7aa63.sql`
   10. `20251008123957_5a38ee04-4be3-478f-810f-9f58e700e6b5.sql`
   11. `20251009055344_38a17186-fc30-45a8-8ca8-9d4d94089813.sql`
   12. `20251009083548_9a178953-cca8-453f-ad81-9ccbf6bf3e7b.sql`
   13. `20251013070122_e4ea9ca3-eb01-4e4e-9ea1-5e2b87a0aadf.sql`
   14. `20251013091805_9e159e7f-c38a-4962-8bb2-aa9552ccc7fc.sql`
   15. `20251013112515_4403f9c9-352b-4b4a-a50d-cdbce2617913.sql`
   16. `20251014025037_7d9e00fc-8872-4065-814c-6176478481f5.sql`
   
   #### 第二批：新功能遷移
   然後執行新的功能遷移（按照 `QUICK_SQL_MIGRATION.md` 的分段方式）：
   
   1. **免費投票系統** - `20250115000000_add_free_vote_system.sql`
   2. **免費建立系統** - `20250115000001_add_free_create_system.sql`
   3. **公告系統** - `20250115000002_add_announcement_system.sql` (分2段)
   4. **檢舉系統** - `20250115000003_add_report_system.sql` (分3段)

4. **驗證遷移成功**
   
   執行以下 SQL 確認：
   
   ```sql
   -- 檢查所有表格
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   
   -- 應該看到以下表格：
   -- announcements, audit_logs, free_create_qualifications, free_votes,
   -- missions, profiles, reports, system_config, token_transactions,
   -- topic_creators, topics, ui_texts
   ```

### 🎯 方式 B：使用 Supabase CLI

如果您已經安裝了 Supabase CLI，可以使用命令行：

```powershell
# 1. 登入 Supabase
supabase login

# 2. 連接到您的專案
supabase link --project-ref epyykzxxglkjombvozhr

# 3. 推送所有遷移
supabase db push
```

---

## 🔐 Step 3: 設置管理員帳號

### 在 SQL Editor 執行以下 SQL：

```sql
-- 1. 首先註冊一個帳號（使用前台註冊頁面）
-- 然後將該用戶設為管理員

-- 2. 查找您的用戶 ID
SELECT id, email FROM auth.users;

-- 3. 將用戶設為管理員（替換 YOUR_USER_ID）
UPDATE public.profiles 
SET is_admin = true 
WHERE id = 'YOUR_USER_ID';

-- 4. 驗證
SELECT id, username, email, is_admin 
FROM public.profiles 
WHERE is_admin = true;
```

**或者直接在 Supabase Dashboard：**

1. 點擊 **Authentication** > **Users**
2. 找到您的用戶
3. 複製 User ID
4. 在 **Table Editor** > **profiles** 表
5. 找到該用戶的記錄
6. 將 `is_admin` 欄位改為 `true`

---

## 🚀 Step 4: 啟動應用

### 安裝依賴（如果還沒做）

```powershell
npm install
```

### 啟動開發服務器

```powershell
npm run dev
```

應用將啟動在：`http://localhost:5173`

---

## ✅ Step 5: 驗證功能

### 前台功能測試：

1. ✅ **首頁**
   - 訪問 `http://localhost:5173`
   - 應該看到公告輪播（3個示範公告）
   - 可以匿名瀏覽

2. ✅ **註冊/登入**
   - 點擊「註冊」創建帳號
   - 或使用「匿名瀏覽」

3. ✅ **主題詳情**
   - 點擊任一主題
   - 應該看到「檢舉」按鈕
   - 登入用戶應該看到「免費投票」按鈕（如果當日未使用）

4. ✅ **建立主題**
   - 登入後點擊右下角「+」按鈕
   - 測試建立主題功能

### 後台功能測試（需要管理員權限）：

1. ✅ **訪問後台**
   - 訪問 `http://localhost:5173/admin`
   - 如果不是管理員會被重定向

2. ✅ **公告管理**
   - 查看現有的3個示範公告
   - 嘗試新增/編輯公告

3. ✅ **檢舉管理**
   - 查看檢舉列表（初始應為空）
   - 查看統計儀表板

4. ✅ **主題審核**
   - 查看待審核的主題
   - 測試審核功能

5. ✅ **系統配置**
   - 查看/修改系統參數

---

## 🗃️ 資料庫結構概覽

遷移完成後，您的資料庫將包含以下主要表格：

### 核心表格：
- `profiles` - 用戶資料
- `topics` - 投票主題
- `topic_creators` - 主題創建者關聯

### 交易與歷史：
- `token_transactions` - 代幣交易記錄
- `audit_logs` - 審計日誌

### 新功能表格：
- `free_votes` - 免費投票記錄
- `free_create_qualifications` - 免費建立資格
- `announcements` - 公告
- `reports` - 檢舉記錄

### 系統配置：
- `system_config` - 系統配置參數
- `ui_texts` - UI 文字管理
- `missions` - 任務系統

### Edge Functions：
- `cast-vote` - 投票
- `cast-free-vote` - 免費投票
- `create-topic` - 建立主題
- `complete-mission` - 完成任務
- `watch-ad` - 觀看廣告
- `get-system-config` - 獲取系統配置

---

## 🐛 常見問題

### Q1: 啟動後看不到公告？
**A:** 檢查以下：
1. 資料庫遷移是否成功執行
2. 環境變數是否正確設置
3. 瀏覽器控制台是否有錯誤
4. 在 SQL Editor 執行：`SELECT * FROM get_active_announcements(3);`

### Q2: 無法登入管理後台？
**A:** 確認：
1. 您的用戶 `is_admin` 欄位是否為 `true`
2. 在 profiles 表中檢查您的用戶記錄
3. 清除瀏覽器快取後重新登入

### Q3: 遷移時出現錯誤？
**A:** 
1. 檢查是否按順序執行
2. 查看具體的錯誤訊息
3. 某些表格可能已存在，可以跳過
4. 參考 `DATABASE_MIGRATION_GUIDE.md` 的問題排除章節

### Q4: 免費投票按鈕不顯示？
**A:**
1. 確認 `free_votes` 表已創建
2. 檢查相關函數是否存在
3. 查看瀏覽器控制台的錯誤訊息

---

## 📊 快速驗證 SQL

執行以下 SQL 快速檢查所有功能是否正常：

```sql
-- 1. 檢查表格數量
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public';
-- 應該 >= 12

-- 2. 檢查函數數量
SELECT COUNT(*) as function_count 
FROM information_schema.routines 
WHERE routine_schema = 'public';
-- 應該 >= 15

-- 3. 檢查公告
SELECT COUNT(*) as announcement_count 
FROM announcements;
-- 應該 = 3

-- 4. 檢查系統配置
SELECT COUNT(*) as config_count 
FROM system_config;
-- 應該 > 20

-- 5. 檢查 RLS 政策
SELECT schemaname, tablename, COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;
-- 每個表格應該有多個政策
```

---

## 🎉 完成！

如果所有步驟都成功完成，您的 VoteChaos 應用應該已經完全運行了！

### 下一步建議：

1. 📝 自訂公告內容
2. 🎨 調整系統配置參數
3. 👥 邀請用戶測試
4. 📊 監控使用數據
5. 🔧 根據需求調整功能

---

## 📞 需要協助？

如果遇到任何問題：
1. 查看瀏覽器控制台的錯誤訊息
2. 檢查 Supabase Dashboard 的 Logs
3. 參考其他指南文檔
4. 確認所有環境變數正確設置

祝您使用愉快！🚀

