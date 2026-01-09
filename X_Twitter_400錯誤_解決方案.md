# X (Twitter) OAuth 400 Bad Request 錯誤解決方案

## ⚠️ 問題

**錯誤訊息**：`400 Bad Request`

**發生位置**：X OAuth 授權 URL
```
https://twitter.com/i/oauth2/authorize?response_type=code&client_id=...&redirect_uri=...&scope=...&state=...&code_challenge=...&code_challenge_method=S256
```

**可能原因**：
1. `redirect_uri` 不匹配 X Developer Portal 中的設定
2. `state` 參數格式問題
3. `code_challenge` 格式問題
4. 其他參數問題

---

## 🔍 問題分析

### 從錯誤 URL 中看到的參數

- `client_id`: `R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ` ✅
- `redirect_uri`: `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback` ✅
- `scope`: `users.read offline.access` ✅
- `state`: `1767939586650|web|d98c567a-09b3-4102-820d-29323c18368bd5a8e499-5e6b-4549-984f-d5a9b1e56a27|juf8FyoDpyYA3infWKqGBKBeWf2S0xkN` ⚠️（包含管道符號，但應該已編碼）
- `code_challenge`: `ny1GH2SgMkHk2hWWLNCbObZ0q4URCL3QC6gpJb3caKs` ✅
- `code_challenge_method`: `S256` ✅

---

## ✅ 解決方案

### 方案 1：檢查 X Developer Portal 中的 Callback URI（優先）

**X Developer Portal 中的 Callback URI 必須完全匹配**：

1. **登入 X Developer Portal**：
   - https://developer.x.com/

2. **進入 User authentication settings**：
   - 選擇您的專案
   - 選擇您的應用程式
   - 進入 **「User authentication settings」** 標籤頁

3. **檢查 Callback URI**：
   - 確認 Callback URI 為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - **必須完全匹配**，包括：
     - 協議（`https://`）
     - 域名（`epyykzxxglkjombvozhr.supabase.co`）
     - 路徑（`/auth/v1/callback`）
     - **不能有尾隨斜線**（`/auth/v1/callback/` ❌）

4. **檢查其他設定**：
   - **App permissions**：應該是 **「Read」**
   - **Type of App**：應該是 **「Web App, Automated App or Bot」**

---

### 方案 2：檢查 Edge Function 中的 URL 構建

**確認 Edge Function 正確構建 URL**：

**檔案**：`supabase/functions/twitter-auth/index.ts`

**檢查點**：
1. `TWITTER_REDIRECT_URI` 是否正確
2. `state` 參數是否正確編碼
3. 所有參數是否正確編碼

---

### 方案 3：檢查 X Developer Portal 中的應用程式狀態

**確認應用程式狀態**：

1. **登入 X Developer Portal**
2. **檢查應用程式狀態**：
   - 應用程式是否為 **Active** 狀態？
   - 是否通過審核？
   - 是否有任何限制或警告？

---

## 🔧 立即檢查步驟

### 步驟 1：檢查 X Developer Portal 設定

1. **登入 X Developer Portal**
2. **進入 User authentication settings**
3. **確認 Callback URI**：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
   ```
   - [ ] 完全匹配（包括協議、域名、路徑）
   - [ ] 沒有尾隨斜線
   - [ ] 沒有多餘的空格

---

### 步驟 2：檢查 Edge Function 日誌

1. **登入 Supabase Dashboard**
2. **進入 Edge Functions** → **twitter-auth** → **Logs**
3. **查看最近的日誌**：
   - 確認 `TWITTER_REDIRECT_URI` 的值
   - 確認構建的授權 URL

---

### 步驟 3：測試 URL 編碼

**檢查 `state` 參數是否正確編碼**：

從錯誤 URL 中可以看到 `state` 參數包含管道符號 `|`，這應該被 URL 編碼為 `%7C`。

如果 `state` 參數沒有正確編碼，可能會導致 400 錯誤。

---

## 📋 檢查清單

### X Developer Portal 設定
- [ ] Callback URI 完全匹配：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] 沒有尾隨斜線
- [ ] 沒有多餘的空格
- [ ] App permissions 設定為 "Read"
- [ ] Type of App 設定為 "Web App, Automated App or Bot"
- [ ] 應用程式狀態為 Active

### Edge Function
- [ ] `TWITTER_REDIRECT_URI` 設定正確
- [ ] `state` 參數正確編碼
- [ ] 所有參數正確編碼

### 測試
- [ ] 檢查 Edge Function 日誌
- [ ] 確認構建的 URL 格式正確
- [ ] 測試 X 登入功能

---

## 🎯 最可能的原因

根據錯誤訊息，最可能的原因是：

1. **Callback URI 不匹配**：
   - X Developer Portal 中的 Callback URI 與 Edge Function 中使用的不一致
   - 或者 Callback URI 有尾隨斜線或其他格式問題

2. **應用程式狀態問題**：
   - 應用程式可能未通過審核
   - 或者有某些限制

---

## 📚 相關文件

- `X_Twitter_Supabase_設定確認指南.md` - Supabase 設定確認指南
- `X登入設定指南-2025最新版.md` - X 登入詳細設定指南

---

**下一步**：請檢查 X Developer Portal 中的 Callback URI 設定，確認是否完全匹配。
