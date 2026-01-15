# X (Twitter) 登入根本修復方案

## 問題根本原因

**核心問題：**
- Edge Function 返回的 `redirectTo` 是 Web URL（`${FRONTEND_URL}/auth/callback?platform=app`）
- 當 Supabase 驗證 magic link 後，會重定向到這個 Web URL（在外部瀏覽器中）
- 即使前端檢測到 `platform=app` 並嘗試重定向到 Deep Link，但用戶可能已經在外部瀏覽器中，Deep Link 可能無法正確觸發 APP

## 修復方案

### 1. Edge Function 修改（`supabase/functions/twitter-auth/index.ts`）

**修改內容：**
- 在 `platform=app` 時，將 Deep Link 作為 `deep_link` 參數添加到 `redirectTo` URL 中
- 這樣前端可以檢測到 `deep_link` 參數並立即重定向到 Deep Link

**修改前：**
```typescript
redirectTo = `${FRONTEND_URL}/auth/callback?platform=app`
```

**修改後：**
```typescript
const deepLinkEncoded = encodeURIComponent(FRONTEND_DEEP_LINK)
redirectTo = `${FRONTEND_URL}/auth/callback?platform=app&deep_link=${deepLinkEncoded}`
```

### 2. OAuthCallbackPage.tsx 修改

**修改內容：**
- 添加對 `deep_link` 參數的檢測
- 如果檢測到 `deep_link` 參數且是 magic link 回調，**立即重定向到 Deep Link**（在設置 session 之前）

**新增邏輯：**
```typescript
const deepLink = urlParams.get('deep_link'); // 從 URL 參數中提取 deep_link

// 優先處理：如果有 deep_link 參數且是 magic link 回調，立即重定向到 Deep Link
if (deepLink && type === 'magiclink' && accessToken && refreshToken) {
  const deepLinkUrl = `${deepLink}#access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&type=magiclink`;
  window.location.href = deepLinkUrl;
  return;
}
```

### 3. index.html 預處理邏輯修改

**修改內容：**
- 添加對 `deep_link` 參數的檢測
- 如果檢測到 `deep_link` 參數且是 magic link 回調，**立即重定向到 Deep Link**（在 React 載入之前）

**新增邏輯：**
```javascript
const deepLink = urlParams.get('deep_link');

// 優先處理：如果有 deep_link 參數且是 magic link 回調，立即重定向到 Deep Link
if (deepLink && type === 'magiclink' && accessToken && refreshToken) {
  const deepLinkUrl = deepLink + '#access_token=' + encodeURIComponent(accessToken) + '&refresh_token=' + encodeURIComponent(refreshToken) + '&type=magiclink';
  window.location.href = deepLinkUrl;
  return;
}
```

## 修復後的流程

1. **用戶點擊 X (Twitter) 登入按鈕**
   - `AuthPage.tsx` 調用 Edge Function `twitter-auth`

2. **Edge Function 處理授權**
   - 生成 PKCE code verifier 和 challenge
   - 構建 Twitter 授權 URL
   - 返回授權 URL 給前端

3. **用戶在外部瀏覽器中授權**
   - 用戶在 Twitter 授權頁面授權
   - Twitter 重定向到 Edge Function 的 callback 端點

4. **Edge Function 處理回調**
   - 驗證 state 參數
   - 交換 access token
   - 獲取用戶資訊
   - 建立或更新用戶
   - **生成 magic link，`redirectTo` 包含 `deep_link` 參數**

5. **Supabase 驗證 magic link**
   - Supabase 驗證 magic link 的 token
   - 重定向到 `redirectTo`（包含 `deep_link` 參數）
   - URL hash 中包含 `access_token` 和 `refresh_token`

6. **前端立即重定向到 Deep Link**
   - `index.html` 預處理邏輯檢測到 `deep_link` 參數
   - **立即重定向到 Deep Link**（在 React 載入之前）
   - 或 `OAuthCallbackPage.tsx` 檢測到 `deep_link` 參數並重定向

7. **MainActivity.java 處理 Deep Link**
   - `shouldOverrideUrlLoading` 檢測到 `votechaos://` URL
   - 觸發 Android Intent 打開 APP

8. **APP 處理 Deep Link**
   - `app-lifecycle.ts` 的 `appUrlOpen` 監聽器捕獲 Deep Link
   - 分發 `oauth-callback` 事件

9. **OAuthCallbackHandler.tsx 處理回調**
   - 從 Deep Link URL 中提取 `access_token` 和 `refresh_token`
   - 設置 Supabase session
   - 登入成功

## 關鍵改進

1. **明確的 Deep Link 傳遞**
   - Edge Function 明確地將 Deep Link 作為參數傳遞
   - 前端可以可靠地檢測到 Deep Link 並重定向

2. **優先處理 Deep Link**
   - `index.html` 和 `OAuthCallbackPage.tsx` 都優先檢測 `deep_link` 參數
   - 如果檢測到，立即重定向，不等待其他邏輯

3. **雙重保障**
   - `index.html` 在 React 載入之前處理（最快）
   - `OAuthCallbackPage.tsx` 作為備用處理（如果 `index.html` 未觸發）

## 測試步驟

1. **Clean Project**
   - 在 Android Studio 中執行 `Build → Clean Project`

2. **重新構建並安裝 APP**
   - 點擊 Run 按鈕（▶️）
   - 等待構建和安裝完成

3. **測試 X (Twitter) 登入**
   - 打開 APP
   - 點擊 X (Twitter) 登入按鈕
   - 在外部瀏覽器中授權
   - 確認 APP 正確返回並登入成功

## 預期結果

- ✅ 用戶點擊 X (Twitter) 登入按鈕
- ✅ APP 重定向到 Twitter 授權頁面
- ✅ 用戶在外部瀏覽器中授權
- ✅ **APP 立即返回並登入成功**（不再停留在網頁登入頁面）
