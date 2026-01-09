# X (Twitter) OAuth 400 Bad Request 錯誤 - 詳細檢查清單

## ⚠️ 錯誤訊息

**錯誤**：`400 Bad Request`  
**URL**：`https://twitter.com/i/oauth2/authorize?...`

---

## 🔍 可能原因

### 原因 1：Callback URI 不匹配（最常見）

**X Developer Portal 中的 Callback URI 必須與 Edge Function 中使用的完全一致**。

**檢查步驟**：

1. **登入 X Developer Portal**：
   - https://developer.x.com/
   - 選擇您的專案
   - 選擇您的應用程式

2. **進入 User authentication settings**：
   - 點擊 **「User authentication settings」** 標籤頁

3. **檢查 Callback URI**：
   - 應該設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - **必須完全匹配**，包括：
     - ✅ 協議：`https://`（不是 `http://`）
     - ✅ 域名：`epyykzxxglkjombvozhr.supabase.co`（完全一致）
     - ✅ 路徑：`/auth/v1/callback`（完全一致）
     - ❌ **不能有尾隨斜線**：`/auth/v1/callback/`（錯誤）
     - ❌ **不能有多餘的空格**

4. **如果 Callback URI 不正確**：
   - 更新為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - 點擊 **「Save」** 儲存
   - 等待幾秒鐘讓設定生效

---

### 原因 2：應用程式狀態問題

**檢查應用程式狀態**：

1. **登入 X Developer Portal**
2. **檢查應用程式狀態**：
   - 應用程式是否為 **Active** 狀態？
   - 是否有任何警告或限制？
   - 是否通過審核？

3. **如果應用程式未啟用**：
   - 啟用應用程式
   - 等待審核通過（如果需要）

---

### 原因 3：Client ID 不匹配

**檢查 Client ID**：

1. **X Developer Portal**：
   - 進入 **「Keys and tokens」** 標籤頁
   - 複製 **OAuth 2.0 Client ID**

2. **Supabase Edge Function 環境變數**：
   - 確認 `TWITTER_CLIENT_ID` 與 X Developer Portal 中的完全一致

3. **從錯誤 URL 中看到的 Client ID**：
   - `R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
   - 確認這與 X Developer Portal 中的一致

---

### 原因 4：App permissions 設定錯誤

**檢查 App permissions**：

1. **X Developer Portal** → **User authentication settings**
2. **App permissions**：
   - 應該設定為 **「Read」**
   - 不應該是 "Read and Write" 或 "Read and Write and Direct Messages"

---

### 原因 5：Type of App 設定錯誤

**檢查 Type of App**：

1. **X Developer Portal** → **User authentication settings**
2. **Type of App**：
   - 應該設定為 **「Web App, Automated App or Bot」**
   - 不應該是其他類型

---

## ✅ 完整檢查清單

### X Developer Portal 設定

#### User authentication settings
- [ ] **Callback URI** 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] **沒有尾隨斜線**（不是 `/auth/v1/callback/`）
- [ ] **沒有多餘的空格**
- [ ] **完全匹配** Edge Function 中使用的 URL

#### App permissions
- [ ] 設定為 **「Read」**

#### Type of App
- [ ] 設定為 **「Web App, Automated App or Bot」**

#### 應用程式狀態
- [ ] 應用程式狀態為 **Active**
- [ ] 沒有警告或限制
- [ ] 已通過審核（如果需要）

---

### Keys and tokens

#### OAuth 2.0 Client ID
- [ ] Client ID 為：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
- [ ] 與 Supabase Edge Function 環境變數中的一致

#### OAuth 2.0 Client Secret
- [ ] Client Secret 已生成
- [ ] 與 Supabase Edge Function 環境變數中的一致

---

### Supabase Edge Function 環境變數

#### 檢查環境變數
- [ ] `TWITTER_CLIENT_ID` 已設定
- [ ] `TWITTER_CLIENT_SECRET` 已設定
- [ ] `TWITTER_REDIRECT_URI` 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

---

## 🔧 修復步驟

### 步驟 1：確認 X Developer Portal 設定

1. **登入 X Developer Portal**
2. **進入 User authentication settings**
3. **檢查並更新 Callback URI**：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
   ```
4. **確認其他設定**：
   - App permissions: **Read**
   - Type of App: **Web App, Automated App or Bot**
5. **儲存設定**

---

### 步驟 2：確認 Supabase Edge Function 環境變數

1. **登入 Supabase Dashboard**
2. **進入 Edge Functions** → **twitter-auth** → **Settings**
3. **檢查環境變數**：
   - `TWITTER_CLIENT_ID`
   - `TWITTER_CLIENT_SECRET`
   - `TWITTER_REDIRECT_URI`（如果設定）

---

### 步驟 3：檢查 Edge Function 日誌

1. **登入 Supabase Dashboard**
2. **進入 Edge Functions** → **twitter-auth** → **Logs**
3. **查看最近的日誌**：
   - 確認 `TWITTER_REDIRECT_URI` 的值
   - 確認構建的授權 URL

---

## 🎯 最可能的原因

根據 400 錯誤，**最可能的原因是 Callback URI 不匹配**。

**請確認**：
1. X Developer Portal 中的 Callback URI 是否為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
2. 是否完全匹配（沒有尾隨斜線、沒有多餘空格）
3. 設定是否已儲存

---

## 📚 相關文件

- `X_Twitter_400錯誤_解決方案.md` - 400 錯誤解決方案
- `X_Twitter_Supabase_設定確認指南.md` - Supabase 設定確認指南
- `X登入設定指南-2025最新版.md` - X 登入詳細設定指南

---

**下一步**：請檢查 X Developer Portal 中的 Callback URI 設定，確認是否完全匹配。
