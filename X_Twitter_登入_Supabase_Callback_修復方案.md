# X (Twitter) 登入 - Supabase Callback 修復方案

## 修復方案說明

### 核心思路

**直接修改 Supabase 的 callback 處理流程：**

1. Edge Function 的 callback 處理中，使用 `generateLink` 生成 magic link
2. Magic link 的 `redirectTo` 設為中間重定向頁面（`/auth/deep-link-redirect`）
3. Supabase 驗證 magic link 後，重定向到中間重定向頁面（包含 tokens）
4. 中間重定向頁面立即重定向到 Deep Link（包含 tokens）
5. Android 系統檢測到 Deep Link，打開 APP
6. APP 處理 Deep Link，設置 session，登入成功

### 關鍵優勢

✅ **完全利用 Supabase 的 callback 機制**
- 使用 Supabase 標準的 magic link 驗證流程
- 確保 session tokens 的正確生成和驗證
- 不需要手動管理 tokens

✅ **簡化流程**
- 減少中間環節
- 減少出錯可能性
- 更符合 Supabase 的最佳實踐

### 完整流程

1. **用戶點擊 X (Twitter) 登入按鈕**
   - `AuthPage.tsx` 調用 Edge Function `twitter-auth`

2. **Edge Function 處理授權**
   - 生成 PKCE code verifier 和 challenge
   - 構建 Twitter 授權 URL
   - 返回授權 URL 給前端

3. **用戶在外部瀏覽器中授權**
   - 用戶在 Twitter 授權頁面授權
   - Twitter 重定向到 Supabase 的 callback URL（`/auth/v1/callback`）
   - Supabase 的 callback 處理邏輯會將請求轉發到 Edge Function 的 callback 端點

4. **Edge Function 處理回調**
   - 驗證 state 參數
   - 交換 access token
   - 獲取用戶資訊
   - 建立或更新用戶
   - **生成 magic link，`redirectTo` 設為中間重定向頁面（`/auth/deep-link-redirect`）**

5. **Supabase 驗證 magic link**
   - Supabase 驗證 magic link 的 token
   - **重定向到中間重定向頁面（`/auth/deep-link-redirect#access_token=...&refresh_token=...`）**

6. **中間重定向頁面處理**
   - `DeepLinkRedirectPage` 檢測到 tokens
   - **立即重定向到 Deep Link（`votechaos://auth/callback#access_token=...&refresh_token=...`）**
   - Android 系統檢測到 Deep Link，打開 APP

7. **APP 處理 Deep Link**
   - `app-lifecycle.ts` 的 `appUrlOpen` 監聽器捕獲 Deep Link
   - 解析 hash fragment 中的 `access_token` 和 `refresh_token`
   - 分發 `oauth-callback` 事件

8. **OAuthCallbackHandler.tsx 處理回調**
   - 從 Deep Link URL 中提取 `access_token` 和 `refresh_token`
   - 設置 Supabase session
   - 登入成功，導航到 `/home`

## 修改內容

### 1. Edge Function (`supabase/functions/twitter-auth/index.ts`)

**修改內容：**
- 使用中間重定向頁面（`/auth/deep-link-redirect`）作為 `redirectTo`
- 確保 Supabase 支持（因為是 HTTP/HTTPS URL）
- 中間頁面會立即重定向到 Deep Link，觸發 APP 打開

### 2. 中間重定向頁面 (`src/pages/DeepLinkRedirectPage.tsx`)

**功能：**
- 當 Supabase 驗證 magic link 後重定向到這個頁面時，立即重定向到 Deep Link
- 從 URL hash 中提取 `access_token` 和 `refresh_token`
- 構建 Deep Link URL 並立即重定向

### 3. 路由配置 (`src/App.tsx`)

**修改內容：**
- 添加 `/auth/deep-link-redirect` 路由，指向 `DeepLinkRedirectPage`

## 測試步驟

1. **部署 Edge Function**
   ```bash
   cd votechaos-main
   npx supabase functions deploy twitter-auth
   ```

2. **Clean Project**
   - 在 Android Studio 中執行 `Build → Clean Project`

3. **重新構建並安裝 APP**
   - 點擊 Run 按鈕（▶️）
   - 等待構建和安裝完成

4. **測試 X (Twitter) 登入**
   - 打開 APP
   - 點擊 X (Twitter) 登入按鈕
   - 在外部瀏覽器中授權
   - **確認 APP 立即返回並登入成功**

## 預期結果

- ✅ 用戶點擊 X (Twitter) 登入按鈕
- ✅ APP 重定向到 Twitter 授權頁面
- ✅ 用戶在外部瀏覽器中授權
- ✅ **APP 立即返回並登入成功**（不再停留在網頁登入頁面）

## 技術細節

### Supabase Callback 流程

1. **Twitter 重定向到 Supabase Callback URL**
   - URL: `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback?code=...&state=...`
   - Supabase 的 callback 處理邏輯會檢查是否有對應的 Provider 配置

2. **Edge Function Callback 處理**
   - 由於我們使用 Edge Function 處理 X (Twitter) 登入，Supabase 的 callback 會將請求轉發到 Edge Function
   - Edge Function 驗證 state、交換 token、獲取用戶資訊、生成 magic link

3. **Magic Link 驗證**
   - Supabase 驗證 magic link 的 token
   - 生成 session tokens（access_token 和 refresh_token）
   - 重定向到 `redirectTo`（中間重定向頁面）

4. **中間重定向頁面**
   - 從 URL hash 中提取 tokens
   - 立即重定向到 Deep Link

5. **Deep Link 處理**
   - Android 系統檢測到 Deep Link，打開 APP
   - APP 處理 Deep Link，設置 session，登入成功
