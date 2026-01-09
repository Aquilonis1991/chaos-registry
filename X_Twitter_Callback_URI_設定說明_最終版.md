# X (Twitter) Callback URI 設定說明 - 最終版

## ❓ 問題

**X Developer Portal 中的 Callback URI / Redirect URL 是否應該與 Edge Function 端點 URL 相同？**

**答案**：**不需要相同，而且不能相同！**

---

## ✅ 正確的設定

### X Developer Portal 中的 Callback URI

**必須設定為**：
```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
```

**不是**：
```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth  ❌
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback  ❌
```

---

### Edge Function 端點 URL

**Edge Function 的端點**：
- 授權端點：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth`（或 `/auth`）
- 回調端點：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback`

**但這些不是 X Developer Portal 中的 Callback URI！**

---

## 🔍 為什麼不能相同？

### 1. X Developer Portal 的限制

**X Developer Portal 強制要求**：
- Callback URI 必須是標準的 Supabase 回調 URL
- 格式：`https://{project-ref}.supabase.co/auth/v1/callback`
- 無法使用 Edge Function 端點

---

### 2. OAuth 2.0 流程

**實際流程**：
1. **用戶點擊 X 登入按鈕**
   - 前端調用 Edge Function：`/functions/v1/twitter-auth`
   - Edge Function 生成授權 URL，包含 `redirect_uri=https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

2. **用戶授權後，X 回調**
   - X 重定向到：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback?code=...&state=...`
   - 這是 X Developer Portal 中設定的 Callback URI

3. **`OAuthCallbackPage` 處理回調**
   - 檢測到 X Provider 的回調（通過檢查 `code` 和 `state` 參數）
   - 轉發到 Edge Function：`/functions/v1/twitter-auth/callback`

4. **Edge Function 處理回調**
   - 驗證 `state` 參數
   - 交換 access token
   - 創建 Supabase 用戶
   - 返回 magic link

---

## 📋 設定檢查清單

### X Developer Portal 設定

**位置**：User authentication settings

- [ ] **Callback URI / Redirect URL** 已設定為：
  ```
  https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
  ```
- [ ] **不是** Edge Function 端點
- [ ] **不是** `/functions/v1/twitter-auth`
- [ ] **不是** `/functions/v1/twitter-auth/callback`

---

### Edge Function 設定

**Edge Function 中的 `TWITTER_REDIRECT_URI`**：
- [ ] 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] 與 X Developer Portal 中的 Callback URI 完全一致

---

## 🎯 總結

### X Developer Portal 中的 Callback URI

**必須是**：
```
https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
```

**原因**：
- X Developer Portal 強制要求使用標準 Supabase 回調 URL
- 這是 OAuth 2.0 規範的要求
- 無法使用 Edge Function 端點

---

### Edge Function 端點

**Edge Function 的端點**：
- 授權端點：`/functions/v1/twitter-auth`（前端調用）
- 回調端點：`/functions/v1/twitter-auth/callback`（由 `OAuthCallbackPage` 轉發）

**這些不是 X Developer Portal 中的 Callback URI！**

---

## 📚 相關文件

- `X_Twitter_Callback_URL_為什麼要一樣.md` - Callback URL 設定說明
- `X_Twitter_標準回調URL_處理方案.md` - 標準回調 URL 處理方案
- `X_Twitter_回退到EdgeFunction_說明.md` - 回退到 Edge Function 說明

---

**結論**：X Developer Portal 中的 Callback URI 必須是標準 Supabase 回調 URL：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`，不能是 Edge Function 端點。
