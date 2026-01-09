# X (Twitter) 停用內建 Provider 後仍被攔截 - 解決方案

## ❌ 問題

即使已停用 Supabase Dashboard 中的 X Provider，Supabase 的 `/auth/v1/callback` 端點仍然會攔截回調並嘗試驗證 `state` 參數，導致錯誤：

```
token signature is invalid: signature is invalid
400: OAuth callback with invalid state
```

---

## 🔍 問題分析

### 為什麼會被攔截？

1. **Supabase 的標準回調端點**：
   - `/auth/v1/callback` 是 Supabase 的標準 OAuth 回調端點
   - 即使停用了 X Provider，Supabase 仍然會嘗試處理所有回調到這個端點的請求
   - Supabase 會嘗試驗證 `state` 參數（期望它是 Supabase 自己生成的 JWT）

2. **OAuthCallbackPage 的檢測時機**：
   - `OAuthCallbackPage` 在瀏覽器中運行
   - 但 Supabase 的服務端處理邏輯在 `OAuthCallbackPage` 之前就執行了
   - 所以 Supabase 會先嘗試驗證 `state`，然後才返回給前端

3. **JWT Secret 不匹配**：
   - Edge Function 使用 `JWT_SECRET` 環境變數來簽名 `state` JWT
   - 如果 `JWT_SECRET` 沒有正確設定，或與 Supabase 的 JWT Secret 不匹配，就會導致簽名驗證失敗

---

## ✅ 解決方案

### 方案 1：確保 Edge Function 使用正確的 JWT Secret（優先）

**步驟**：

1. **獲取 Supabase JWT Secret**：
   - 登入 [Supabase Dashboard](https://app.supabase.com/)
   - 選擇專案：`epyykzxxglkjombvozhr`
   - 導航到 **Settings** > **API**
   - 找到 **JWT Secret**（在 "Project API keys" 區塊下方）
   - 複製 JWT Secret

2. **設定 Edge Function 環境變數**：
   - 在 Supabase Dashboard 中，導航到 **Edge Functions** > **twitter-auth**
   - 點擊 **Settings** 或 **Environment Variables**
   - 添加環境變數：
     - **Key**: `JWT_SECRET`
     - **Value**: 貼上剛才複製的 JWT Secret
   - 點擊 **Save**

3. **重新部署 Edge Function**：
   ```bash
   cd votechaos-main
   npx supabase functions deploy twitter-auth
   ```

---

### 方案 2：修改 OAuthCallbackPage 提前檢測（備用）

如果方案 1 無法解決問題，可以修改 `OAuthCallbackPage` 在 Supabase 處理之前就檢測並轉發：

**修改 `src/pages/OAuthCallbackPage.tsx`**：

```typescript
useEffect(() => {
  const handleCallback = async () => {
    try {
      // 立即檢查 URL 參數，在 Supabase 處理之前就轉發
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');
      
      // 如果檢測到 code 和 state，且沒有 Supabase 的 hash fragment，立即轉發到 Edge Function
      if (code && state && !window.location.hash.includes('access_token')) {
        console.log('[OAuthCallbackPage] Detected X (Twitter) OAuth callback, forwarding to Edge Function immediately');
        
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const edgeFunctionUrl = new URL(`${supabaseUrl}/functions/v1/twitter-auth/callback`);
        edgeFunctionUrl.searchParams.set('code', code);
        edgeFunctionUrl.searchParams.set('state', state);
        if (error) edgeFunctionUrl.searchParams.set('error', error);
        
        // 立即重定向，避免 Supabase 處理
        window.location.href = edgeFunctionUrl.toString();
        return;
      }
      
      // ... 其餘邏輯
    } catch (error) {
      // ... 錯誤處理
    }
  };
  
  // 立即執行，不延遲
  handleCallback();
}, [navigate]);
```

---

### 方案 3：使用不同的回調 URL（不推薦）

**不推薦的原因**：
- X Developer Portal 強制要求使用標準 Supabase 回調 URL
- 無法使用 Edge Function 端點作為回調 URL

---

## 📋 檢查清單

### 1. 確認 Supabase X Provider 已停用

- [ ] 登入 [Supabase Dashboard](https://app.supabase.com/)
- [ ] 選擇專案：`epyykzxxglkjombvozhr`
- [ ] 導航到 **Authentication** > **Providers**
- [ ] 找到 **X / Twitter** 或 **Twitter**
- [ ] 確認開關已關閉（Disabled）

---

### 2. 確認 Edge Function 環境變數

- [ ] 登入 [Supabase Dashboard](https://app.supabase.com/)
- [ ] 選擇專案：`epyykzxxglkjombvozhr`
- [ ] 導航到 **Edge Functions** > **twitter-auth**
- [ ] 點擊 **Settings** 或 **Environment Variables**
- [ ] 確認 `JWT_SECRET` 環境變數已設定
- [ ] 確認 `JWT_SECRET` 的值與 Supabase Dashboard 中的 JWT Secret 完全一致

---

### 3. 確認 Edge Function 代碼

**檢查 `supabase/functions/twitter-auth/index.ts`**：

```typescript
// 應該優先使用 JWT_SECRET 環境變數
const JWT_SECRET = Deno.env.get('JWT_SECRET') || Deno.env.get('SUPABASE_JWT_SECRET')
const STATE_SECRET = JWT_SECRET || SERVICE_ROLE_KEY.substring(0, 32)
```

- [ ] 確認代碼優先使用 `JWT_SECRET` 環境變數
- [ ] 確認 `generateSignedState` 函數使用 `STATE_SECRET` 來簽名 JWT

---

### 4. 重新部署 Edge Function

- [ ] 執行 `npx supabase functions deploy twitter-auth`
- [ ] 確認部署成功
- [ ] 測試 X (Twitter) 登入

---

## 🔧 立即修復步驟

### 步驟 1：獲取 Supabase JWT Secret

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇專案：`epyykzxxglkjombvozhr`
3. 導航到 **Settings** > **API**
4. 找到 **JWT Secret**（在 "Project API keys" 區塊下方）
5. 複製 JWT Secret

---

### 步驟 2：設定 Edge Function 環境變數

1. 在 Supabase Dashboard 中，導航到 **Edge Functions**
2. 找到 **twitter-auth** 函數
3. 點擊 **Settings** 或 **Environment Variables**
4. 添加環境變數：
   - **Key**: `JWT_SECRET`
   - **Value**: 貼上剛才複製的 JWT Secret
5. 點擊 **Save**

---

### 步驟 3：重新部署 Edge Function

```bash
cd votechaos-main
npx supabase functions deploy twitter-auth
```

---

### 步驟 4：測試

1. 清除瀏覽器快取和 Cookie
2. 嘗試使用 X (Twitter) 登入
3. 檢查 Supabase Auth Logs 是否還有 `token signature is invalid` 錯誤

---

## 📚 相關文件

- `X_Twitter_state_簽名驗證失敗_解決方案.md` - JWT 簽名驗證說明
- `X_Twitter_設定JWT_SECRET環境變數指南.md` - 環境變數設定指南
- `supabase/functions/twitter-auth/index.ts` - Edge Function 實作

---

**結論**：即使停用了 Supabase 內建的 X Provider，Supabase 的標準回調端點仍然會嘗試處理回調。解決方案是確保 Edge Function 使用與 Supabase 相同的 JWT Secret 來簽名 `state` JWT。
