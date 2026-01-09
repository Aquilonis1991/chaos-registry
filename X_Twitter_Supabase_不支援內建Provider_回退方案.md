# X (Twitter) Supabase 不支援內建 Provider - 回退方案

## ⚠️ 問題診斷

**錯誤訊息**：`{"error":"requested path is invalid"}`

**原因**：Supabase **不支援 X (Twitter) 作為內建 Provider**。

根據 Supabase 官方文檔和實際測試，Supabase 的內建 OAuth Providers 包括：
- ✅ Google
- ✅ Apple
- ✅ Discord
- ✅ Facebook
- ✅ GitHub
- ✅ Azure
- ✅ Bitbucket
- ✅ GitLab
- ✅ Keycloak
- ✅ LinkedIn
- ✅ Notion
- ✅ Spotify
- ✅ Slack
- ✅ Twitch
- ✅ WorkOS
- ✅ Zoom
- ✅ LINE（部分支援）
- ❌ **X (Twitter) - 不支援**

---

## 🔄 解決方案：回退到 Edge Function

由於 Supabase 不支援 X (Twitter) 作為內建 Provider，我們需要**回退到使用 Edge Function**。

---

## 📝 需要恢復的代碼

### 1. 恢復 `handleEdgeSocialLogin` 支援 `'twitter'`

**檔案**：`src/pages/AuthPage.tsx`

**需要修改**：
```typescript
// 從
const handleEdgeSocialLogin = async (provider: 'line') => {
  // ...
  const endpoint = `${supabaseUrl}/functions/v1/line-auth/auth?platform=${platform}`;
  // ...
}

// 改為
const handleEdgeSocialLogin = async (provider: 'line' | 'twitter') => {
  // ...
  const endpoint =
    provider === 'line'
      ? `${supabaseUrl}/functions/v1/line-auth/auth?platform=${platform}`
      : `${supabaseUrl}/functions/v1/twitter-auth/auth?platform=${platform}`;
  // ...
  const providerName = provider === 'line' ? 'LINE' : 'X (Twitter)';
}
```

---

### 2. 恢復 X (Twitter) 按鈕使用 `handleEdgeSocialLogin`

**檔案**：`src/pages/AuthPage.tsx`

**需要修改**：
```typescript
// 從
onClick={() => handleSocialLogin('twitter')}

// 改為
onClick={() => handleEdgeSocialLogin('twitter')}
```

---

### 3. 從 `handleSocialLogin` 移除 `'twitter'`

**檔案**：`src/pages/AuthPage.tsx`

**需要修改**：
```typescript
// 從
const handleSocialLogin = async (provider: 'google' | 'apple' | 'discord' | 'twitter') => {
  // ...
  const providerNames: Record<string, string> = {
    google: 'Google',
    apple: 'Apple',
    discord: 'Discord',
    twitter: 'X (Twitter)',
  };
}

// 改為
const handleSocialLogin = async (provider: 'google' | 'apple' | 'discord') => {
  // ...
  const providerNames: Record<string, string> = {
    google: 'Google',
    apple: 'Apple',
    discord: 'Discord',
  };
}
```

---

## 🔧 需要更新的設定

### 1. X Developer Portal 設定

**Callback URI 應該設定為**：
```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback
```

**不是**：
```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback  ❌
```

---

### 2. Supabase Dashboard 設定

**不需要在 Supabase Dashboard 中設定 X Provider**，因為：
- Supabase 不支援 X (Twitter) 作為內建 Provider
- 所有 OAuth 流程由 Edge Function `twitter-auth` 處理

---

## ✅ 完整的回退步驟

### 步驟 1：恢復前端代碼

1. **恢復 `handleEdgeSocialLogin` 支援 `'twitter'`**
2. **恢復 X (Twitter) 按鈕使用 `handleEdgeSocialLogin('twitter')`**
3. **從 `handleSocialLogin` 移除 `'twitter'`**

---

### 步驟 2：確認 Edge Function 已部署

確認 Edge Function `twitter-auth` 已部署：
```bash
npx supabase functions deploy twitter-auth
```

---

### 步驟 3：更新 X Developer Portal 設定

1. 登入 [X Developer Portal](https://developer.x.com/)
2. 進入您的專案和應用程式
3. 進入 **「User authentication settings」**
4. 更新 **Callback URI** 為：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback
   ```
5. 儲存設定

---

### 步驟 4：確認環境變數

確認 Edge Function `twitter-auth` 的環境變數已設定：
- `TWITTER_CLIENT_ID`
- `TWITTER_CLIENT_SECRET`
- `SERVICE_ROLE_KEY`

---

## 📋 檢查清單

### 代碼恢復
- [ ] `handleEdgeSocialLogin` 已恢復支援 `'twitter'`
- [ ] X (Twitter) 按鈕已恢復使用 `handleEdgeSocialLogin('twitter')`
- [ ] `handleSocialLogin` 已移除 `'twitter'`

### Edge Function
- [ ] Edge Function `twitter-auth` 已部署
- [ ] 環境變數已設定

### X Developer Portal
- [ ] Callback URI 已更新為：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback`
- [ ] 設定已儲存

### 測試
- [ ] 測試 X (Twitter) 登入功能
- [ ] 確認可以正常登入

---

## 🎯 總結

**問題**：Supabase 不支援 X (Twitter) 作為內建 Provider，導致 `"requested path is invalid"` 錯誤。

**解決方案**：回退到使用 Edge Function `twitter-auth`，這是原本的設計，也是正確的做法。

**架構**：
- ✅ **Google、Apple、Discord**：使用 Supabase 內建 Provider
- ✅ **LINE**：使用 Edge Function `line-auth`
- ✅ **X (Twitter)**：使用 Edge Function `twitter-auth`（回退）

---

## 📚 相關文件

- `X_LINE_登入_網頁版檢查報告.md` - 完整的檢查報告
- `X登入設定指南-2025最新版.md` - X 登入詳細設定指南
- `supabase/functions/twitter-auth/index.ts` - Edge Function 實作

---

**狀態**：需要回退到 Edge Function 方案
