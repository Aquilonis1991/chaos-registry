# X (Twitter) 回退到 Edge Function 說明

## ⚠️ 問題

**錯誤訊息**：`"requested path is invalid"`

**原因**：Supabase **不支援 X (Twitter) OAuth 2.0 作為內建 Provider**。

根據網路搜尋結果：
- Supabase 的 Twitter Provider 仍然使用 **OAuth 1.0a**，而非 **OAuth 2.0**
- X Developer Portal 現在要求使用 **OAuth 2.0**
- 因此 Supabase 的內建 Twitter Provider 無法使用

---

## ✅ 解決方案：回退到 Edge Function

**策略**：使用 Edge Function `twitter-auth` 處理 X (Twitter) OAuth 2.0 流程。

---

## 🔄 已完成的代碼更新

### 1. 恢復 `handleEdgeSocialLogin` 支援 `'twitter'`

**檔案**：`src/pages/AuthPage.tsx`

**變更**：
- 從 `handleEdgeSocialLogin` 的類型中添加 `'twitter'`
- 恢復判斷 provider 的邏輯

---

### 2. 恢復 X (Twitter) 按鈕使用 `handleEdgeSocialLogin`

**檔案**：`src/pages/AuthPage.tsx`

**變更**：
- 從 `handleSocialLogin('twitter')` 改為 `handleEdgeSocialLogin('twitter')`

---

### 3. 從 `handleSocialLogin` 移除 `'twitter'`

**檔案**：`src/pages/AuthPage.tsx`

**變更**：
- 從 `handleSocialLogin` 的類型中移除 `'twitter'`
- 從 providerNames 中移除 `twitter: 'X (Twitter)'`

---

### 4. 恢復 `OAuthCallbackPage` 中的 X (Twitter) 處理邏輯

**檔案**：`src/pages/OAuthCallbackPage.tsx`

**變更**：
- 恢復對 X (Twitter) Edge Function 的特殊處理
- 同時處理 LINE 和 X (Twitter) 的回調

---

## 📝 更新後的架構

### Supabase 內建 Provider（使用標準回調 URL）

| Provider | 回調 URL | 前端調用 |
|----------|---------|---------|
| **Google** | `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback` | `handleSocialLogin('google')` |
| **Apple** | `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback` | `handleSocialLogin('apple')` |
| **Discord** | `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback` | `handleSocialLogin('discord')` |

---

### Edge Functions Provider（使用自訂回調 URL）

| Provider | 回調 URL | 前端調用 |
|----------|---------|---------|
| **LINE** | `https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback` | `handleEdgeSocialLogin('line')` |
| **X (Twitter)** | `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback` → 轉發到 Edge Function | `handleEdgeSocialLogin('twitter')` ✅ **已恢復** |

**注意**：X (Twitter) 使用標準回調 URL（X Developer Portal 要求），但會由 `OAuthCallbackPage` 轉發到 Edge Function。

---

## ✅ 檢查清單

### 代碼更新
- [x] `handleEdgeSocialLogin` 已恢復支援 `'twitter'`
- [x] X (Twitter) 按鈕已恢復使用 `handleEdgeSocialLogin('twitter')`
- [x] `handleSocialLogin` 已移除 `'twitter'`
- [x] `OAuthCallbackPage` 已恢復 X (Twitter) 處理邏輯

### Edge Function
- [ ] Edge Function `twitter-auth` 已部署
- [ ] 環境變數已設定（`TWITTER_CLIENT_ID`、`TWITTER_CLIENT_SECRET`、`SERVICE_ROLE_KEY`）

### X Developer Portal 設定
- [ ] Callback URI 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] App permissions 設定為 "Read"
- [ ] Type of App 設定為 "Web App, Automated App or Bot"

### 測試
- [ ] 測試 X (Twitter) 登入功能
- [ ] 確認可以正常登入

---

## 🎯 總結

**問題**：Supabase 不支援 X (Twitter) OAuth 2.0 作為內建 Provider（只支援 OAuth 1.0a），導致 `"requested path is invalid"` 錯誤。

**解決方案**：回退到使用 Edge Function `twitter-auth`，這是正確的做法，因為：
- Edge Function 支援 OAuth 2.0
- 完全控制 OAuth 流程
- 符合 X Developer Portal 的要求

**架構**：
- ✅ **Google、Apple、Discord**：使用 Supabase 內建 Provider
- ✅ **LINE**：使用 Edge Function `line-auth`
- ✅ **X (Twitter)**：使用 Edge Function `twitter-auth`（回退）

---

## 📚 相關文件

- `X_Twitter_Supabase_不支援內建Provider_回退方案.md` - Supabase 不支援內建 Provider 的回退方案
- `X_Twitter_標準回調URL_處理方案.md` - 標準回調 URL 處理方案
- `X_Twitter_state_簽名驗證失敗_解決方案.md` - 簽名驗證失敗解決方案

---

**狀態**：✅ 代碼已恢復，使用 Edge Function 方案。
