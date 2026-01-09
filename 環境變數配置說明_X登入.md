# 環境變數配置說明 - X (Twitter) 登入

## 📋 必需的環境變數

為了讓 X (Twitter) 登入功能正常運作，您需要在 `.env.local` 檔案中配置以下環境變數：

---

## 🔑 環境變數清單

### 1. Supabase URL

```env
VITE_SUPABASE_URL=https://epyykzxxglkjombvozhr.supabase.co
```

**說明**：
- Supabase 專案的 URL
- 用於連接 Supabase 服務

---

### 2. Supabase Anon Key（公開金鑰）

```env
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVweXlrenh4Z2xram9tYnZvemhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MDg1MTEsImV4cCI6MjA3NTk4NDUxMX0.A2QBfDwW1TlG5GiKaHN3_JzT3Tk3U0hJfTZm0hRq1tg
```

**說明**：
- Supabase 的公開 API 金鑰（anon key）
- 用於前端調用 Supabase API 和 Edge Functions
- **重要**：這個 key 是公開的，可以安全地在前端使用
- 用於通過 Supabase 路由層級的檢查（添加 `apikey` header）

**如何取得**：
1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇您的專案：`epyykzxxglkjombvozhr`
3. 進入 **Settings** → **API**
4. 在 **Project API keys** 區塊中
5. 複製 `anon` `public` key

---

## 📝 完整的 .env.local 檔案範例

在專案根目錄（`votechaos-main/`）創建或更新 `.env.local` 檔案：

```env
# Supabase 配置
VITE_SUPABASE_URL=https://epyykzxxglkjombvozhr.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVweXlrenh4Z2xram9tYnZvemhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MDg1MTEsImV4cCI6MjA3NTk4NDUxMX0.A2QBfDwW1TlG5GiKaHN3_JzT3Tk3U0hJfTZm0hRq1tg
```

---

## ✅ 配置步驟

### 步驟 1：創建或編輯 .env.local 檔案

1. **進入專案根目錄**：
   ```powershell
   cd C:\Users\USER\Documents\Mywork\votechaos-main
   ```

2. **創建或編輯 .env.local 檔案**：
   - 如果檔案不存在，創建新檔案
   - 如果檔案已存在，編輯現有檔案

3. **添加環境變數**：
   ```env
   VITE_SUPABASE_URL=https://epyykzxxglkjombvozhr.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVweXlrenh4Z2xram9tYnZvemhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MDg1MTEsImV4cCI6MjA3NTk4NDUxMX0.A2QBfDwW1TlG5GiKaHN3_JzT3Tk3U0hJfTZm0hRq1tg
   ```

---

### 步驟 2：重新啟動開發伺服器

**重要**：修改環境變數後，必須重新啟動開發伺服器才能生效。

1. **停止當前的開發伺服器**（如果正在運行）：
   - 按 `Ctrl + C` 停止

2. **重新啟動開發伺服器**：
   ```powershell
   npm run dev
   ```

---

## 🔍 驗證配置

### 方法 1：檢查瀏覽器控制台

1. 打開瀏覽器開發者工具（F12）
2. 進入 **Console** 標籤
3. 檢查是否有環境變數相關的錯誤訊息
4. 如果看到 "Supabase environment variables are not set"，表示環境變數未正確配置

### 方法 2：檢查應用程式行為

1. 打開應用程式
2. 嘗試點擊 X (Twitter) 登入按鈕
3. 檢查是否不再出現 401 錯誤
4. 檢查 Network 標籤中的請求是否包含 `apikey` header

---

## ⚠️ 重要提醒

### 1. 安全性

- ✅ **anon key 是公開的**：可以安全地在前端使用
- ❌ **不要使用 service_role key**：service_role key 應該只在後端使用
- ✅ **.env.local 已加入 .gitignore**：不會被提交到 Git

### 2. 環境變數命名

- 使用 `VITE_SUPABASE_PUBLISHABLE_KEY`（不是 `VITE_SUPABASE_ANON_KEY`）
- 這是 Vite 的命名慣例，`VITE_` 前綴表示這些變數會暴露給前端

### 3. 重新啟動開發伺服器

- 修改環境變數後，**必須重新啟動開發伺服器**
- 環境變數在構建時讀取，運行時不會自動更新

---

## 🐛 常見問題

### 問題 1：仍然出現 401 錯誤

**可能原因**：
- 環境變數未正確設置
- 開發伺服器未重新啟動
- 環境變數名稱錯誤

**解決方案**：
1. 確認 `.env.local` 檔案存在且內容正確
2. 確認環境變數名稱是 `VITE_SUPABASE_PUBLISHABLE_KEY`
3. 重新啟動開發伺服器
4. 清除瀏覽器快取

---

### 問題 2：環境變數未生效

**可能原因**：
- 檔案位置錯誤（應該在專案根目錄）
- 檔案名稱錯誤（應該是 `.env.local`，不是 `.env`）
- 開發伺服器未重新啟動

**解決方案**：
1. 確認檔案路徑：`votechaos-main/.env.local`
2. 確認檔案名稱正確
3. 重新啟動開發伺服器

---

### 問題 3：找不到環境變數

**錯誤訊息**：
```
❌ Supabase 環境變數未設置！
```

**解決方案**：
1. 檢查 `.env.local` 檔案是否存在
2. 檢查環境變數名稱是否正確
3. 確認沒有多餘的空格或特殊字元
4. 重新啟動開發伺服器

---

## 📚 相關文件

- `設定環境變數指南.md` - 完整的環境變數設定指南
- `X_Twitter_Missing_Authorization_Header_解決方案.md` - 401 錯誤解決方案
- `src/integrations/supabase/client.ts` - Supabase 客戶端配置

---

## ✅ 配置完成檢查清單

- [ ] `.env.local` 檔案已創建
- [ ] `VITE_SUPABASE_URL` 已設置
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` 已設置
- [ ] 開發伺服器已重新啟動
- [ ] 瀏覽器控制台沒有環境變數錯誤
- [ ] X 登入功能可以正常運作

---

**配置完成後，請重新啟動開發伺服器並測試 X 登入功能！**
