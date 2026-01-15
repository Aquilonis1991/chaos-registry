# X (Twitter) 修正 Provider 名稱 - 從 'twitter' 改為 'x'

## 🔍 關鍵發現

根據 Supabase 官方文檔，**應該使用 `'x'` 而不是 `'twitter'` 作為 provider 名稱**！

這是問題的根源！我們一直使用 `'twitter'`，但 Supabase 現在要求使用 `'x'`。

---

## ✅ 修復內容

### 修改的文件

**`src/pages/AuthPage.tsx`**：

1. **類型定義**：
   - 從：`provider: 'google' | 'apple' | 'discord' | 'twitter'`
   - 改為：`provider: 'google' | 'apple' | 'discord' | 'x'`

2. **Provider 名稱映射**：
   - 從：`twitter: 'X (Twitter)'`
   - 改為：`x: 'X (Twitter)'`

3. **按鈕點擊處理**：
   - 從：`onClick={() => handleSocialLogin('twitter')}`
   - 改為：`onClick={() => handleSocialLogin('x')}`

---

## 📋 根據 Supabase 官方文檔的完整配置檢查

### 1. X Developer Portal 設定

根據官方文檔，需要確認以下設定：

- [ ] **Request email from users**：必須**啟用**（ON）
- [ ] **Type of App**：選擇 **"Web App..."**
- [ ] **Callback URL**：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] **Website URL**：已設定（例如：`https://chaos-registry.vercel.app`）
- [ ] **Terms of service URL**：已設定
- [ ] **Privacy policy URL**：已設定

**重要**：必須啟用 **"Request email from users"**！

---

### 2. Supabase Dashboard 設定

- [ ] **X / Twitter (OAuth 2.0) Enabled**：ON（綠色/啟用）
- [ ] **Client ID**：已填入（從 X Developer Portal 的 API Key）
- [ ] **Client Secret**：已填入（從 X Developer Portal 的 API Secret Key）
- [ ] **"Allow users without an email"**：已勾選

---

### 3. 代碼設定

- [x] 使用 `'x'` 作為 provider 名稱（已修正）
- [x] 使用 `signInWithOAuth({ provider: 'x' })`（已修正）
- [x] 已移除 Edge Function 調用（已完成）

---

## 🧪 測試步驟

1. **重新編譯 APP**：
   ```bash
   npm run build
   npm run cap:sync:android
   npm run android
   ```

2. **測試 Twitter 登入**：
   - 點擊 X (Twitter) 登入按鈕
   - 應該跳轉到 X 授權頁面
   - 授權後應該返回並完成登入
   - **不應該再出現 "provider is not enabled" 錯誤**

---

## ⚠️ 重要提醒

### 檢查 X Developer Portal 設定

根據 Supabase 官方文檔，必須確認：

1. **"Request email from users"** 必須**啟用**（ON）
   - 這在 X Developer Portal → User authentication settings 中
   - 如果沒有啟用，請啟用它

2. **Type of App** 必須是 **"Web App..."**
   - 不是 "Native App" 或其他選項

3. **所有必要的 URL 都已設定**：
   - Callback URL
   - Website URL
   - Terms of service URL
   - Privacy policy URL

---

## 📋 完整檢查清單

### X Developer Portal
- [ ] **"Request email from users"** 已啟用（ON）⚠️ **重要**
- [ ] Type of App 設定為 "Web App..."
- [ ] Callback URL 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] Website URL 已設定
- [ ] Terms of service URL 已設定
- [ ] Privacy policy URL 已設定

### Supabase Dashboard
- [ ] X / Twitter (OAuth 2.0) Enabled：ON（綠色/啟用）
- [ ] Client ID 已填入
- [ ] Client Secret 已填入
- [ ] "Allow users without an email" 已勾選

### 代碼
- [x] 使用 `'x'` 作為 provider 名稱（已修正）
- [x] 使用 `handleSocialLogin('x')`（已修正）
- [x] 已移除 Edge Function 調用

---

## 🎯 預期結果

修正 provider 名稱後，應該能夠：
- ✅ 成功跳轉到 X 授權頁面
- ✅ 授權後可以正常登入
- ✅ 不再出現 "provider is not enabled" 錯誤

---

**更新日期**：2026-01-14  
**狀態**：已修正 provider 名稱從 'twitter' 改為 'x'，等待測試結果
