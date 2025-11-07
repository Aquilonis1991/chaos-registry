# 資料庫遷移詳細步驟指南

## 📋 目前待遷移的檔案

本次需要遷移以下3個新的 migration 檔案：

1. ✅ `20250115000000_add_free_vote_system.sql` - 免費投票系統
2. ✅ `20250115000001_add_free_create_system.sql` - 免費建立主題系統
3. ✅ `20250115000002_add_announcement_system.sql` - 公告系統
4. ✅ `20250115000003_add_report_system.sql` - 檢舉系統

## 🎯 方法一：使用 Supabase CLI（推薦）

### 前置需求
- Node.js 18+ 或 Bun
- Supabase CLI
- Supabase 專案連接資訊

### Step 1: 確認環境
```powershell
# 檢查 Node.js 版本
node --version

# 如果沒有 Node.js，請先安裝
# 下載：https://nodejs.org/
```

### Step 2: 安裝 Supabase CLI
```powershell
# 使用 npm 全域安裝
npm install -g supabase

# 驗證安裝
supabase --version
```

### Step 3: 連接到 Supabase 專案
```powershell
# 進入專案目錄
cd "C:\Users\USER\Documents\工作用\votechaos-main"

# 登入 Supabase（如果還沒登入）
supabase login

# 連接到您的專案
supabase link --project-ref YOUR_PROJECT_REF
# YOUR_PROJECT_REF 可以在 Supabase Dashboard 的 Project Settings > General 找到
```

### Step 4: 推送遷移到遠端資料庫
```powershell
# 切換到 supabase 目錄
cd supabase

# 推送所有未執行的遷移
npx supabase db push

# 或者使用全域安裝的 CLI
supabase db push
```

### Step 5: 驗證遷移
```powershell
# 查看遷移歷史
supabase migration list

# 檢查資料庫狀態
supabase db diff
```

---

## 🎯 方法二：使用 Supabase Dashboard（最簡單）

如果 CLI 有問題，可以直接在網頁介面執行 SQL。

### Step 1: 登入 Supabase Dashboard
1. 訪問 https://supabase.com/dashboard
2. 登入您的帳號
3. 選擇您的專案

### Step 2: 打開 SQL Editor
1. 在左側導航欄點擊 **SQL Editor**
2. 點擊 **New query** 創建新查詢

### Step 3: 執行遷移檔案（按順序）

#### 3.1 執行免費投票系統遷移
1. 複製 `supabase/migrations/20250115000000_add_free_vote_system.sql` 的所有內容
2. 貼到 SQL Editor
3. 點擊 **Run** 執行
4. 確認沒有錯誤訊息

#### 3.2 執行免費建立主題系統遷移
1. 複製 `supabase/migrations/20250115000001_add_free_create_system.sql` 的所有內容
2. 貼到 SQL Editor
3. 點擊 **Run** 執行
4. 確認沒有錯誤訊息

#### 3.3 執行公告系統遷移
1. 複製 `supabase/migrations/20250115000002_add_announcement_system.sql` 的所有內容
2. 貼到 SQL Editor
3. 點擊 **Run** 執行
4. 確認沒有錯誤訊息

#### 3.4 執行檢舉系統遷移
1. 複製 `supabase/migrations/20250115000003_add_report_system.sql` 的所有內容
2. 貼到 SQL Editor
3. 點擊 **Run** 執行
4. 確認沒有錯誤訊息

### Step 4: 驗證資料表
在 Supabase Dashboard 左側點擊 **Table Editor**，確認以下表格已創建：

- ✅ `free_votes` - 免費投票記錄
- ✅ `free_create_qualifications` - 免費建立資格
- ✅ `announcements` - 公告
- ✅ `reports` - 檢舉記錄

### Step 5: 檢查函數
在 Supabase Dashboard 左側點擊 **Database** > **Functions**，確認以下函數已創建：

**免費投票相關：**
- ✅ `has_free_vote_available(uuid, uuid)`
- ✅ `record_free_vote(uuid, uuid)`

**免費建立相關：**
- ✅ `has_free_create_qualification(uuid)`
- ✅ `use_free_create_qualification(uuid)`

**公告相關：**
- ✅ `get_active_announcements(integer)`
- ✅ `increment_announcement_clicks(uuid)`
- ✅ `deactivate_expired_announcements()`

**檢舉相關：**
- ✅ `get_report_stats()`
- ✅ `get_reports_with_details(report_status, integer, integer)`
- ✅ `update_report_status(uuid, report_status, text, text)`

---

## 🎯 方法三：使用本地 Supabase（開發環境）

### Step 1: 安裝 Docker Desktop
1. 下載：https://www.docker.com/products/docker-desktop/
2. 安裝並啟動 Docker Desktop

### Step 2: 啟動本地 Supabase
```powershell
cd "C:\Users\USER\Documents\工作用\votechaos-main"

# 初始化 Supabase（如果還沒做過）
supabase init

# 啟動本地 Supabase
supabase start
```

### Step 3: 執行遷移
```powershell
# 自動執行所有遷移
supabase db reset

# 或者推送新的遷移
supabase db push
```

### Step 4: 查看本地 Dashboard
```powershell
# 獲取本地 Dashboard URL
supabase status

# 通常是：http://localhost:54323
```

---

## 📊 遷移內容說明

### 1️⃣ 免費投票系統
創建的內容：
- `free_votes` 表 - 記錄用戶每日每主題的免費投票
- `has_free_vote_available()` - 檢查是否還有免費投票
- `record_free_vote()` - 記錄免費投票
- `increment_free_votes_count` 觸發器 - 自動更新計數
- 在 `topics` 表添加 `free_votes_count` 欄位

### 2️⃣ 免費建立主題系統
創建的內容：
- `free_create_qualifications` 表 - 記錄用戶的免費建立資格
- `has_free_create_qualification()` - 檢查是否有免費建立資格
- `use_free_create_qualification()` - 使用免費建立資格

### 3️⃣ 公告系統
創建的內容：
- `announcements` 表 - 存儲所有公告
- `get_active_announcements()` - 獲取活躍公告（最多3個）
- `increment_announcement_clicks()` - 增加點擊統計
- `deactivate_expired_announcements()` - 停用過期公告
- 系統配置參數（最多顯示數、字數限制等）
- 3個示範公告資料

### 4️⃣ 檢舉系統
創建的內容：
- `report_type` 枚舉類型 - 9種檢舉類型
- `report_status` 枚舉類型 - 5種處理狀態
- `reports` 表 - 存儲所有檢舉記錄
- `get_report_stats()` - 獲取檢舉統計
- `get_reports_with_details()` - 獲取檢舉詳情列表
- `update_report_status()` - 更新檢舉狀態
- 系統配置參數（郵件通知、自動隱藏閾值等）

---

## ✅ 驗證遷移成功

### 在 SQL Editor 執行以下查詢進行驗證：

```sql
-- 1. 檢查所有新表格是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('free_votes', 'free_create_qualifications', 'announcements', 'reports');

-- 2. 檢查 topics 表是否有新欄位
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'topics' 
AND column_name = 'free_votes_count';

-- 3. 檢查函數是否存在
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'has_free_vote_available',
  'record_free_vote',
  'has_free_create_qualification',
  'use_free_create_qualification',
  'get_active_announcements',
  'increment_announcement_clicks',
  'get_report_stats',
  'get_reports_with_details',
  'update_report_status'
);

-- 4. 檢查枚舉類型是否存在
SELECT typname 
FROM pg_type 
WHERE typname IN ('report_type', 'report_status');

-- 5. 測試公告查詢（應該返回3個示範公告）
SELECT * FROM get_active_announcements(3);

-- 6. 測試檢舉統計（應該返回全0的統計）
SELECT * FROM get_report_stats();
```

預期結果：
- 查詢 1: 應返回 4 行（4個新表格）
- 查詢 2: 應返回 1 行（free_votes_count）
- 查詢 3: 應返回 9 行（9個函數）
- 查詢 4: 應返回 2 行（2個枚舉類型）
- 查詢 5: 應返回 3 行公告資料
- 查詢 6: 應返回統計資料（全部為0）

---

## 🐛 常見問題排除

### 問題 1: "npx: command not found" 或 "npx 不是內部或外部命令"
**解決方案：**
```powershell
# 安裝 Node.js
# 下載：https://nodejs.org/zh-tw/download/

# 驗證安裝
node --version
npm --version
```

### 問題 2: "supabase: command not found"
**解決方案：**
```powershell
# 全域安裝 Supabase CLI
npm install -g supabase

# 或使用 npx（不需要全域安裝）
npx supabase --version
```

### 問題 3: "Cannot find module '@supabase/supabase-js'"
**解決方案：**
```powershell
# 安裝專案依賴
npm install

# 或使用 bun
bun install
```

### 問題 4: 遷移執行時出現權限錯誤
**解決方案：**
- 確認您是專案的 Owner 或有足夠的權限
- 在 Supabase Dashboard > Settings > Database 檢查連接資訊
- 使用 Dashboard 的 SQL Editor 直接執行（方法二）

### 問題 5: "relation already exists" 錯誤
**解決方案：**
這表示表格已經存在，遷移已經執行過。可以：
1. 跳過該遷移
2. 或使用 `DROP TABLE IF EXISTS` 先刪除（⚠️ 會遺失資料）
3. 檢查 `supabase_migrations.schema_migrations` 表確認已執行的遷移

### 問題 6: 中文路徑問題（工作用）
**解決方案：**
```powershell
# 使用完整路徑並加引號
cd "C:\Users\USER\Documents\工作用\votechaos-main"

# 或使用 pushd（自動處理路徑）
pushd "C:\Users\USER\Documents\工作用\votechaos-main"
```

---

## 📝 推薦執行順序（方法二最簡單）

對於您的環境，我**強烈推薦使用方法二（Supabase Dashboard）**：

1. ✅ 不需要安裝額外工具
2. ✅ 不會有路徑或編碼問題
3. ✅ 視覺化介面，錯誤訊息清楚
4. ✅ 可以立即驗證結果
5. ✅ 每個遷移獨立執行，容易追蹤

### 快速步驟：
1. 打開 Supabase Dashboard
2. 點擊 SQL Editor
3. 依序貼上4個 SQL 檔案並執行
4. 在 Table Editor 確認表格已創建
5. 完成！

---

## 🚀 遷移後下一步

遷移成功後，您需要：

1. **啟動開發服務器**：
   ```powershell
   npm run dev
   ```

2. **測試新功能**：
   - 訪問首頁查看公告輪播
   - 進入主題詳情頁測試免費投票
   - 嘗試檢舉功能
   - 管理員訪問後台查看公告和檢舉管理

3. **更新環境變數**（如果需要）：
   確認 `.env` 或 `.env.local` 中的 Supabase 連接資訊正確

---

## 📞 需要協助？

如果遇到任何問題：
1. 檢查 Supabase Dashboard 的 Logs
2. 查看瀏覽器控制台的錯誤訊息
3. 確認所有依賴已安裝（`npm install`）
4. 嘗試清除快取後重啟（`npm run dev`）

祝您遷移順利！🎉

