# 🔍 如何確認專案連結到正確的 Supabase

## 📝 檢查方法

### 方法 1：在瀏覽器 Console 檢查（最簡單）

1. **打開瀏覽器** http://localhost:8080/
2. **按 F12** 打開開發者工具
3. **Console 標籤** 中輸入：

```javascript
// 檢查 Supabase URL
import.meta.env.VITE_SUPABASE_URL

// 檢查 API Key（部分）
import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.substring(0, 20)
```

應該會顯示類似：
```
"https://idfqzcsxvuxperxfieam.supabase.co"
"eyJhbGciOiJIUzI1NiIsInR5..."
```

### 方法 2：查看環境變數檔案

專案應該有一個 `.env` 或 `.env.local` 檔案（可能被 gitignore 隱藏）。

查看內容：
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJxxx...
```

### 方法 3：從 Console 日誌確認

剛才建立主題時的錯誤顯示：
```
POST https://idfqzcsxvuxperxfieam.supabase.co/...
```

這表示專案連接到：
- **Project ID**: `idfqzcsxvuxperxfieam`
- **URL**: `https://idfqzcsxvuxperxfieam.supabase.co`

## ✅ 確認步驟

### 1. 確認這是您的專案

前往 https://supabase.com/dashboard

在專案列表中：
- 找到 **Project ID**: `idfqzcsxvuxperxfieam`
- 或 URL 包含 `idfqzcsxvuxperxfieam` 的專案

### 2. 檢查專案名稱

點進專案後，查看：
- 專案名稱是否是 VoteChaos 或相關名稱
- 專案設定 → General → Project URL 是否是 `https://idfqzcsxvuxperxfieam.supabase.co`

### 3. 確認資料庫狀態

在該專案中：
- **Table Editor** → 查看是否有表格
- 如果完全空白 → 需要執行初始化 SQL

## 🎯 從錯誤訊息判斷

從您提供的錯誤訊息：
```
POST https://idfqzcsxvuxperxfieam.supabase.co/rest/v1/topics
```

可以確認：
- ✅ 專案**已正確連接**到 Supabase
- ✅ 專案 ID: `idfqzcsxvuxperxfieam`
- ❌ 但該專案的資料庫**完全空白**（沒有表格）

## 💡 下一步

### 確認這是正確的專案

1. 登入 https://supabase.com/dashboard
2. 找到 Project ID 為 `idfqzcsxvuxperxfieam` 的專案
3. 確認這是您想要使用的專案

### 如果是正確的專案

執行 `00-完整資料庫架構.sql` 來初始化資料庫。

### 如果不是正確的專案

1. 找到正確的專案
2. 複製該專案的：
   - Project URL
   - API Key (anon, public)
3. 建立 `.env.local` 檔案並設定：
```
VITE_SUPABASE_URL=https://您的專案.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=您的API Key
```
4. 重新啟動開發伺服器

## 🔑 如何取得正確的連線資訊

在 Supabase Dashboard：
1. 選擇專案
2. **Settings** → **API**
3. 複製：
   - **Project URL**
   - **anon public** key

---

**目前連接到**：https://idfqzcsxvuxperxfieam.supabase.co  
**下一步**：確認這是正確的專案，然後執行初始化 SQL



