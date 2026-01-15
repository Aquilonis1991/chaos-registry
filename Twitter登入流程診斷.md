# Twitter 登入流程診斷

**問題**: 授權後回到網頁版登入頁，而不是應用

---

## 🔍 當前流程分析

### 預期流程

1. ✅ 用戶點擊 Twitter 登入按鈕
2. ✅ WebView 載入 Twitter 授權頁面
3. ✅ 用戶完成授權
4. ✅ Twitter 重定向到 Supabase callback URL（`https://...supabase.co/auth/v1/callback?code=...&state=...`）
5. ⚠️ **Edge Function 應該檢測到 `platform='app'` 並返回 HTML 頁面重定向到 Deep Link**
6. ❌ **實際：回到網頁版登入頁**

---

## 🔎 可能的原因

### 原因 1: Edge Function 沒有檢測到 `platform='app'`

**檢查方法**:
1. 登入 Supabase Dashboard
2. 導航到 Edge Functions → twitter-auth
3. 點擊「Logs」標籤
4. 查看是否有以下日誌：
   ```
   [CRITICAL] GET callback from Supabase standard callback URL
   [CRITICAL] Detected platform from state: app
   [CRITICAL] App platform detected, redirecting to Deep Link
   ```

**如果沒有看到這些日誌**:
- Edge Function 可能沒有正確驗證 state
- 或 state 中沒有包含 `platform='app'`

---

### 原因 2: Edge Function 環境變數未設置

**檢查方法**:
1. 在 Supabase Dashboard → Edge Functions → twitter-auth
2. 點擊「Settings」標籤
3. 檢查環境變數：
   - `FRONTEND_DEEP_LINK` 應該設置為 `votechaos://auth/callback`
   - `FRONTEND_URL` 應該設置為網頁版 URL

**如果環境變數未設置**:
- Edge Function 無法構建 Deep Link URL
- 會回退到網頁版 URL

---

### 原因 3: Edge Function 未部署最新版本

**檢查方法**:
1. 確認本地 Edge Function 代碼已更新
2. 重新部署 Edge Function：
   ```bash
   cd votechaos-main
   npx supabase functions deploy twitter-auth
   ```

---

### 原因 4: WebView 無法執行 JavaScript 重定向

**可能原因**:
- WebView 的 JavaScript 被禁用
- Deep Link 重定向被瀏覽器攔截
- WebView 在載入 HTML 時出錯

---

## 🔧 診斷步驟

### 步驟 1: 檢查 Edge Function 日誌

1. **登入 Supabase Dashboard**
2. **導航到 Edge Functions → twitter-auth → Logs**
3. **查找最新的日誌**（應該在您完成授權時產生）

**應該看到的日誌**:
```
[CRITICAL] GET callback from Supabase standard callback URL
[CRITICAL] Detected platform from state: app
[CRITICAL] App platform detected, redirecting to Deep Link
[CRITICAL] Redirecting to Deep Link: votechaos://auth/callback?code=...&state=...
```

**如果看到**:
```
[CRITICAL] GET callback from Supabase standard callback URL
[CRITICAL] Failed to verify state, using default platform detection
[CRITICAL] Web platform detected, redirecting to frontend callback URL
```

**這表示**:
- State 驗證失敗
- 或 platform 不是 'app'

---

### 步驟 2: 檢查環境變數

在 Supabase Dashboard → Edge Functions → twitter-auth → Settings：

**必須設置**:
- `FRONTEND_DEEP_LINK`: `votechaos://auth/callback`
- `FRONTEND_URL`: 您的網頁版 URL（例如：`https://your-app.com`）

---

### 步驟 3: 檢查 WebView Logcat

在 Logcat 中查找：
```
WebView shouldOverrideUrlLoading: https://...supabase.co/auth/v1/callback?code=...&state=...
```

**然後應該看到**:
```
Supabase callback URL detected: ...
OAuth callback detected (code and state present), allowing WebView to load
```

**如果看到**:
```
WebView shouldOverrideUrlLoading: https://your-frontend-url/auth/callback?...
```

**這表示**:
- Edge Function 已經重定向到網頁版 URL
- 而不是 Deep Link

---

## 🛠️ 解決方案

### 解決方案 1: 重新部署 Edge Function

```bash
cd votechaos-main
npx supabase functions deploy twitter-auth
```

**確保**:
- 使用最新的代碼
- 環境變數已正確設置

---

### 解決方案 2: 檢查並設置環境變數

1. **在 Supabase Dashboard**:
   - Edge Functions → twitter-auth → Settings
   - 添加環境變數：
     - `FRONTEND_DEEP_LINK`: `votechaos://auth/callback`
     - `FRONTEND_URL`: 您的網頁版 URL

2. **重新部署 Edge Function**:
   ```bash
   npx supabase functions deploy twitter-auth
   ```

---

### 解決方案 3: 驗證 State 生成

檢查 `generateSignedState` 函數是否正確設置 `platform='app'`：

在 Edge Function 代碼中（`supabase/functions/twitter-auth/index.ts`）：
```typescript
const payload = {
  timestamp: Date.now(),
  platform: 'app', // 必須是 'app'
  codeVerifier: codeVerifier,
  provider: 'twitter',
  exp: Math.floor(Date.now() / 1000) + expiresIn,
}
```

---

### 解決方案 4: 改進 Deep Link 觸發機制

如果 Edge Function 正確返回了 HTML，但 Deep Link 沒有觸發，可能需要：

1. **使用 Intent 直接觸發**（在 Android 中）
2. **或使用更可靠的重定向方法**

---

## 📋 診斷檢查清單

### Edge Function 檢查

- [ ] Edge Function 已部署最新版本
- [ ] 環境變數 `FRONTEND_DEEP_LINK` 已設置
- [ ] 環境變數 `FRONTEND_URL` 已設置
- [ ] Edge Function 日誌顯示檢測到 `platform='app'`
- [ ] Edge Function 日誌顯示重定向到 Deep Link

### WebView 檢查

- [ ] Logcat 顯示 Supabase callback URL 被載入
- [ ] Logcat 顯示 OAuth callback 被檢測到
- [ ] WebView 允許載入 Supabase callback URL

### Deep Link 檢查

- [ ] AndroidManifest.xml 配置了 Deep Link
- [ ] Deep Link scheme 是 `votechaos://`
- [ ] Deep Link host 是 `auth`

---

## 🎯 下一步行動

1. **檢查 Supabase Dashboard 中的 Edge Function 日誌**
   - 確認是否檢測到 `platform='app'`
   - 確認是否嘗試重定向到 Deep Link

2. **檢查環境變數**
   - 確認 `FRONTEND_DEEP_LINK` 已設置

3. **如果問題仍然存在，提供以下信息**:
   - Edge Function 日誌截圖
   - 環境變數設置截圖
   - Logcat 中相關的日誌

---

**最後更新**: 2025年1月
