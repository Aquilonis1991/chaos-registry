# X / Twitter (OAuth 2.0) Supabase 內建 Provider 設定指南

## ✅ 已完成的設定

### Supabase Dashboard 設定

1. **前往 Supabase Dashboard**
   - 網址：https://app.supabase.com/
   - 選擇專案：`epyykzxxglkjombvozhr`

2. **導航到 Authentication > Providers > X / Twitter (OAuth 2.0)**

3. **填寫以下資訊**：
   - ✅ **X / Twitter enabled**：啟用
   - ✅ **Client ID**：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
   - ✅ **Client Secret**：`rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG`
   - ✅ **Callback URL (for OAuth)**：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - ✅ **Allow users without an email**：根據需求勾選（X API v2 不返回 email，除非申請特殊權限）

4. **點擊 Save**

---

## ✅ 前端代碼更新

### 已完成的修改

1. **`AuthPage.tsx`**：
   - ✅ 修改 `handleSocialLogin` 函數，添加 `twitter` 作為支持的 provider
   - ✅ 恢復 X (Twitter) 按鈕功能，調用 `handleSocialLogin('twitter')`
   - ✅ 移除按鈕的 `disabled` 狀態

2. **`OAuthCallbackPage.tsx`**：
   - ✅ 不需要特殊處理，Supabase 會自動處理回調

3. **`index.html`**：
   - ✅ 不需要特殊處理，Supabase 會自動處理回調

---

## 🔍 驗證步驟

### 步驟 1：確認 Supabase 設定

1. 前往 Supabase Dashboard
2. 確認 X / Twitter Provider 已啟用
3. 確認 Client ID 和 Client Secret 正確
4. 確認 Callback URL 正確

### 步驟 2：測試登入

1. 打開應用程式
2. 點擊 X (Twitter) 登入按鈕
3. 應該會跳轉到 X (Twitter) 授權頁面
4. 授權後應該會回到應用程式並成功登入

---

## 📋 X Developer Portal 設定確認

### 必須確認的設定

1. **Callback URI**：
   - 應該設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - 這與 Supabase 的 Callback URL 一致

2. **App Permissions**：
   - 確保已申請必要的權限（例如：`users.read`）

3. **Type of App**：
   - 確認 App 類型設定正確（Web App）

---

## ⚠️ 注意事項

1. **Email 處理**：
   - X API v2 預設不返回 email
   - 如果需要在 Supabase 中啟用「Allow users without an email」
   - 或者申請 X API 的特殊權限來獲取 email

2. **OAuth 2.0 vs OAuth 1.0a**：
   - Supabase 內建的 X / Twitter Provider 使用 OAuth 2.0
   - 這與 X (Twitter) 的新 API 要求一致

3. **回調處理**：
   - Supabase 會自動處理 OAuth 回調
   - 不需要額外的 Edge Function 或特殊處理

---

## 🐛 故障排除

### 問題 1：登入失敗

**檢查**：
- Supabase Dashboard 中的 Client ID 和 Client Secret 是否正確
- X Developer Portal 中的 Callback URI 是否與 Supabase 一致
- 是否已啟用 X / Twitter Provider

### 問題 2：回調錯誤

**檢查**：
- Callback URL 是否正確：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- X Developer Portal 中的 Callback URI 是否與 Supabase 一致

### 問題 3：Email 缺失

**解決方案**：
- 在 Supabase Dashboard 中啟用「Allow users without an email」
- 或者申請 X API 的特殊權限來獲取 email

---

## 📚 相關文件

- [Supabase Auth Providers Documentation](https://supabase.com/docs/guides/auth/social-login/auth-twitter)
- [X API v2 OAuth 2.0 Documentation](https://developer.twitter.com/en/docs/authentication/oauth-2-0)

---

**設定完成後，X (Twitter) 登入應該可以正常運作！**
