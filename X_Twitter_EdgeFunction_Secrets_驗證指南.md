# X (Twitter) Edge Function Secrets 驗證指南

## 🔍 問題

Edge Function Secrets 中顯示的是 hash 值，不是實際的 Client ID 和 Secret：

- `TWITTER_CLIENT_ID`: `4536a331b969cd2b4869490e46147da5e43092246a0414627afd4b55abcd0ff3`
- `TWITTER_CLIENT_SECRET`: `7c452c96c246a4337c16a0908baec6e7121cc5ed87c322cba56471f8d6b828af`

---

## ✅ 說明

### Hash 值是什麼？

這些 hash 值是 **Supabase 對 secrets 進行加密存儲後的摘要**，不是實際的值。

- Supabase 會自動加密存儲 secrets
- 顯示的 hash 值只是用於識別和驗證，不是實際的 Client ID 或 Secret
- Edge Function 運行時，Supabase 會自動解密並提供實際的值

---

## 🔑 實際的 Client ID 和 Secret

根據專案文檔，實際的值應該是：

- **Client ID**: `R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
- **Client Secret**: `rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG`

---

## ✅ 驗證 Secrets 是否正確設定

### 方法 1：檢查 Edge Function 日誌

1. 在 Supabase Dashboard 中，導航到 **Edge Functions** > **twitter-auth**
2. 點擊 **Logs** 標籤
3. 查看 Edge Function 的執行日誌
4. 如果看到錯誤訊息提到 Client ID 或 Secret 無效，表示值可能不正確

---

### 方法 2：測試 X (Twitter) 登入

1. **清除瀏覽器快取和 Cookie**
2. **嘗試使用 X (Twitter) 登入**
3. **檢查錯誤訊息**：
   - 如果看到 `invalid_client` 錯誤，表示 Client ID 或 Secret 不正確
   - 如果看到 `400 Bad Request`，可能是 `redirect_uri` 不匹配
   - 如果看到 `token signature is invalid`，可能是 JWT Secret 問題

---

### 方法 3：使用 Supabase CLI 驗證

```bash
cd votechaos-main

# 列出所有 secrets（只顯示名稱，不顯示值）
npx supabase secrets list

# 確認 TWITTER_CLIENT_ID 和 TWITTER_CLIENT_SECRET 存在
```

---

## 🔧 如果 Secrets 不正確，如何更新？

### 使用 Supabase CLI 更新

```bash
cd votechaos-main

# 更新 TWITTER_CLIENT_ID
npx supabase secrets set TWITTER_CLIENT_ID=R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ

# 更新 TWITTER_CLIENT_SECRET
npx supabase secrets set TWITTER_CLIENT_SECRET=rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG

# 重新部署 Edge Function
npx supabase functions deploy twitter-auth
```

---

## ⚠️ 重要提醒

1. **Hash 值不會影響功能**：
   - Hash 值只是 Supabase 的內部標識
   - 只要實際的值正確，功能就會正常運作

2. **實際值必須正確**：
   - 必須與 X Developer Portal 中的 Client ID 和 Secret 完全一致
   - 不能有多餘的空格或換行

3. **更新 Secrets 後需要重新部署**：
   - 更新 secrets 後，Edge Function 會自動使用新值
   - 但建議重新部署 Edge Function 以確保生效

---

## 📋 檢查清單

### Edge Function Secrets

- [ ] `TWITTER_CLIENT_ID` 已設定（hash 值存在）
- [ ] `TWITTER_CLIENT_SECRET` 已設定（hash 值存在）
- [ ] 實際的值與 X Developer Portal 中的完全一致
- [ ] 沒有多餘的空格或換行

### X Developer Portal 設定

- [ ] Client ID 為：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
- [ ] Client Secret 為：`rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG`
- [ ] Callback URI 為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

---

## 🐛 常見問題

### 問題 1：Hash 值改變了

**說明**：
- 如果更新了 secrets，hash 值會改變
- 這是正常的，表示 secrets 已更新

---

### 問題 2：Hash 值存在但功能不工作

**可能原因**：
1. 實際的值不正確（與 X Developer Portal 不匹配）
2. 值中有多餘的空格或換行
3. Edge Function 沒有重新部署

**解決方案**：
1. 使用 Supabase CLI 重新設定 secrets
2. 確認值完全正確（沒有多餘的空格或換行）
3. 重新部署 Edge Function

---

### 問題 3：如何確認實際的值？

**方法**：
- 無法直接查看實際的值（安全考量）
- 只能通過測試 X (Twitter) 登入來驗證
- 或檢查 Edge Function 日誌中的錯誤訊息

---

## 📚 相關文件

- `X-API憑證保管說明.md` - X API 憑證說明
- `X_Twitter_設定JWT_SECRET_立即修復步驟.md` - JWT Secret 設定指南
- `supabase/functions/twitter-auth/index.ts` - Edge Function 實作

---

**結論**：Hash 值本身不會影響功能，只要實際的 Client ID 和 Secret 正確設定即可。如果功能不工作，請檢查實際的值是否與 X Developer Portal 中的完全一致。
