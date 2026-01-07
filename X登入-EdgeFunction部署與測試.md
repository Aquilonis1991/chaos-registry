# X (Twitter) 登入 - Edge Function 部署與測試

> **建立日期**：2025-01-29  
> **狀態**：前端已更新，需要部署 Edge Function 並設置環境變數

---

## 🔍 當前錯誤分析

### 錯誤訊息

```
Access to fetch at 'https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/auth?platform=app' 
from origin 'https://localhost' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status.
```

### 問題分析

**這表示 Edge Function 可能還沒有部署**，或者部署後沒有正確處理 CORS。

---

## 🔧 解決步驟

### 步驟 1：執行資料庫 Migration（如果還沒執行）

**在 Supabase Dashboard → SQL Editor 中執行**：

```sql
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS twitter_user_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS profiles_twitter_user_id_idx ON public.profiles (twitter_user_id);
```

---

### 步驟 2：設置環境變數（重要）

**在 Supabase Dashboard 中設置 Edge Function 環境變數**：

1. **進入 Settings → Edge Functions → Secrets**
2. **添加以下環境變數**：

   - **TWITTER_CLIENT_ID**：
     ```
     R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ
     ```

   - **TWITTER_CLIENT_SECRET**：
     ```
     rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG
     ```

   - **SERVICE_ROLE_KEY**（如果還沒有）：
     - 從 **Settings → API** 中複製 **service_role** key
     - ⚠️ **這是私密資訊，請妥善保管**

   - **FRONTEND_URL**（可選，已有預設值）：
     ```
     https://chaos-registry.vercel.app
     ```

   - **FRONTEND_DEEP_LINK**（可選，已有預設值）：
     ```
     votechaos://auth/callback
     ```

3. **點擊「Save」或「儲存」**

---

### 步驟 3：部署 Edge Function（最重要）

**使用 Supabase CLI 部署**：

```bash
cd votechaos-main
npx supabase functions deploy twitter-auth
```

**或使用 Supabase Dashboard**：

1. **進入 Edge Functions**
2. **點擊「Deploy」或「Upload」**
3. **選擇 `supabase/functions/twitter-auth` 目錄**

**部署完成後**：
- 您應該會看到部署成功的訊息
- Edge Function URL 應該是：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth`

---

### 步驟 4：更新 X Developer Portal Callback URI

**重要**：需要更新為 Edge Function 的 URL。

1. **登入 [X Developer Portal](https://developer.x.com/)**
2. **進入您的專案和應用程式**
3. **進入 User authentication settings**
4. **更新 Callback URI / Redirect URL**：
   - **舊值**：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - **新值**：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback`
5. **點擊「Save」**
6. **等待 30-60 秒讓設定生效**

---

### 步驟 5：測試 Edge Function（可選）

**在瀏覽器中測試 Edge Function**：

1. **打開瀏覽器**
2. **訪問**：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/auth?platform=web
   ```
3. **應該返回 JSON**：
   ```json
   {
     "authUrl": "https://twitter.com/i/oauth2/authorize?...",
     "state": "..."
   }
   ```

**如果返回錯誤**：
- 檢查環境變數是否正確設置
- 檢查 Edge Function 是否正確部署

---

### 步驟 6：在 Android Studio 中測試

**完成步驟 1-4 後**：

1. **運行應用程式**
2. **點擊 Twitter 登入按鈕**
3. **觀察行為**：
   - ✅ **成功**：顯示 X 授權頁面
   - ❌ **失敗**：顯示錯誤訊息

---

## 📋 檢查清單

請確認以下項目：

1. **✅ 資料庫 Migration**：
   - [ ] 已執行 SQL 添加 `twitter_user_id` 欄位

2. **✅ 環境變數**：
   - [ ] `TWITTER_CLIENT_ID` 已設置
   - [ ] `TWITTER_CLIENT_SECRET` 已設置
   - [ ] `SERVICE_ROLE_KEY` 已設置

3. **✅ Edge Function 部署**：
   - [ ] `twitter-auth` Edge Function 已部署
   - [ ] 部署成功，沒有錯誤

4. **✅ X Developer Portal Callback URI**：
   - [ ] 已更新為：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback`
   - [ ] 已等待 30-60 秒讓設定生效

5. **✅ 前端代碼**：
   - [ ] 已重新建置
   - [ ] 已同步到 Android

---

## 🎯 如果仍然失敗

### 檢查 Edge Function 日誌

1. **進入 Supabase Dashboard → Edge Functions → twitter-auth → Logs**
2. **查看最近的請求日誌**
3. **查看是否有錯誤訊息**

### 檢查環境變數

1. **進入 Settings → Edge Functions → Secrets**
2. **確認所有環境變數都已正確設置**
3. **確認沒有多餘空格**

### 重新部署 Edge Function

1. **刪除現有的 Edge Function**（如果需要的話）
2. **重新部署**：
   ```bash
   npx supabase functions deploy twitter-auth
   ```

---

## 🔗 相關文件

- [X 登入-EdgeFunction實作步驟](./X登入-EdgeFunction實作步驟.md)
- [X 登入設定指南 - 2025 最新版](./X登入設定指南-2025最新版.md)

---

**最後更新**：2025-01-29




