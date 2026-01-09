# X (Twitter) OAuth 2.0 2025 新接口更新指南

## 📋 更新日期
2025-01-29

---

## 🔄 2025 年 X/Twitter API 主要變更

### 1. 強制升級至 Twitter API v3 商業版

**重要變更**：
- ⚠️ **所有商業賬戶必須在 2025 年 6 月 30 日前遷移至 Twitter API v3**
- ⚠️ **舊版 v1.1 和 v2 的速率限制已大幅降低**
- ⚠️ **未及時遷移可能導致 API 調用失敗**

**影響**：
- 當前實作使用 `api.twitter.com/2/`（API v2）
- 需要確認是否需要遷移到 v3
- 需要檢查 API 定價方案

---

### 2. OAuth 2.0 PKCE 流程（已實作 ✅）

**要求**：
- ✅ **必須使用 OAuth 2.0 PKCE 流程**
- ✅ **必須使用 `code_challenge_method=S256`**

**當前實作狀態**：
- ✅ 已使用 PKCE (S256 method)
- ✅ 已生成 `code_verifier` 和 `code_challenge`
- ✅ 已在 token 交換時提供 `code_verifier`

**檢查位置**：`supabase/functions/twitter-auth/index.ts`
- 第 178-187 行：生成 PKCE code verifier 和 challenge
- 第 206 行：使用 `code_challenge_method=S256`
- 第 303 行：在 token 交換時提供 `code_verifier`

---

### 3. API 端點檢查

#### 當前使用的端點

**授權端點**（第 200 行）：
```typescript
https://twitter.com/i/oauth2/authorize
```
- ✅ **正確**：這是 OAuth 2.0 標準授權端點
- ✅ **已更新**：從舊的 `oauth/authenticate` 更新為 `oauth2/authorize`

**Token 交換端點**（第 292 行）：
```typescript
https://api.twitter.com/2/oauth2/token
```
- ⚠️ **需要確認**：這是 API v2 端點
- ⚠️ **可能需要更新**：如果 X 要求使用 v3，可能需要更新

**用戶資訊端點**（第 324 行）：
```typescript
https://api.twitter.com/2/users/me?user.fields=profile_image_url,username,name
```
- ⚠️ **需要確認**：這是 API v2 端點
- ⚠️ **可能需要更新**：如果 X 要求使用 v3，可能需要更新

---

### 4. OAuth 2.0 Scope 檢查

**當前使用的 Scope**（第 199 行）：
```typescript
const scope = 'tweet.read users.read offline.access'
```

**建議更新**：
根據 2025 年最新要求，對於**僅用於第三方登入**的應用，建議使用：

```typescript
const scope = 'users.read offline.access'
```

**原因**：
- ✅ `users.read`：讀取用戶資訊（**必須**，用於登入）
- ❌ `tweet.read`：讀取推文（**不需要**，僅用於登入）
- ✅ `offline.access`：離線訪問（**可選**，用於 refresh token）

**最小權限原則**：
- 只請求必要的權限
- 降低安全風險
- 提高審核通過率

---

## 🔧 需要更新的項目

### 1. 更新 Scope（建議）

**檔案**：`supabase/functions/twitter-auth/index.ts`

**位置**：第 199 行

**當前**：
```typescript
const scope = 'tweet.read users.read offline.access'
```

**建議更新為**：
```typescript
const scope = 'users.read offline.access'
```

**原因**：
- 我們只需要用戶資訊進行登入
- 不需要讀取推文
- 遵循最小權限原則

---

### 2. 檢查 API v3 遷移需求

**需要確認**：
1. 您的 X Developer Portal 帳號類型：
   - [ ] 免費版（Free）
   - [ ] 基礎版（Basic - $100/月）
   - [ ] 商業版（Business）
   - [ ] 企業版（Enterprise）

2. 是否需要遷移到 API v3：
   - 如果使用**免費版**：可能仍可使用 v2
   - 如果使用**商業版**：必須在 2025 年 6 月 30 日前遷移至 v3

3. 檢查 API 調用限制：
   - 當前實作只調用：
     - Token 交換：1 次/登入
     - 用戶資訊：1 次/登入
   - 總計：2 次 API 調用/登入
   - 應該在免費版限制內

---

### 3. 檢查 X Developer Portal 設定

**需要確認的設定**：

#### 3.1 App Permissions
- [ ] 已設定為 **「Read」**（最小權限）
- [ ] 未選擇 **「Read and write」**（除非需要）

#### 3.2 Type of App
- [ ] 已設定為 **「Web App, Automated App or Bot」**
- [ ] 未設定為 **「Native App」**（除非直接與 X API 互動）

#### 3.3 OAuth 2.0 Scopes
- [ ] 至少勾選 **「users.read」**
- [ ] 未勾選 **「tweet.read」**（除非需要）
- [ ] 可選勾選 **「offline.access」**（如果需要 refresh token）

#### 3.4 Callback URI
- [ ] 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback`
- [ ] ⚠️ **注意**：這是 Edge Function 的回調 URL，不是 Supabase 的標準回調 URL

---

## 📝 更新步驟

### 步驟 1：更新 Scope（建議）

**檔案**：`supabase/functions/twitter-auth/index.ts`

**修改**：
```typescript
// 第 199 行
// 舊的：
const scope = 'tweet.read users.read offline.access'

// 新的：
const scope = 'users.read offline.access'
```

**原因**：
- 移除 `tweet.read`（不需要讀取推文）
- 保留 `users.read`（必須，用於獲取用戶資訊）
- 保留 `offline.access`（可選，用於 refresh token）

---

### 步驟 2：檢查 X Developer Portal 設定

1. **登入 X Developer Portal**：https://developer.x.com/
2. **進入應用程式設定**：
   - 選擇您的專案
   - 選擇您的應用程式
   - 進入 **「User authentication settings」**
3. **檢查 OAuth 2.0 Scopes**：
   - 確認只勾選必要的 scope
   - 建議：只勾選 `users.read` 和 `offline.access`
4. **儲存設定**

---

### 步驟 3：檢查 API 版本需求

1. **確認您的 X Developer Portal 帳號類型**
2. **檢查是否需要遷移到 API v3**：
   - 如果使用商業版，必須遷移
   - 如果使用免費版，可能仍可使用 v2
3. **如果需要遷移到 v3**：
   - 需要更新 API 端點
   - 需要檢查 API 文件確認新的端點格式

---

### 步驟 4：測試更新後的實作

1. **重新部署 Edge Function**：
   ```bash
   cd votechaos-main
   npx supabase functions deploy twitter-auth
   ```

2. **測試登入流程**：
   - 打開 `https://chaos-registry.vercel.app/auth`
   - 點擊 X (Twitter) 登入按鈕
   - 確認可以正常登入

3. **檢查授權頁面**：
   - 確認授權頁面顯示的權限範圍正確
   - 確認只請求 `users.read` 和 `offline.access`

---

## ⚠️ 重要提醒

### 1. API v3 遷移時間表

- **2025 年 6 月 30 日**：商業版必須完成遷移
- **建議**：盡早檢查並準備遷移

### 2. 當前實作狀態

**已符合的要求**：
- ✅ OAuth 2.0 PKCE 流程
- ✅ 使用 `oauth2/authorize` 端點
- ✅ 使用 `code_challenge_method=S256`

**需要確認的項目**：
- ⏳ API v3 遷移需求
- ⏳ Scope 是否需要更新
- ⏳ X Developer Portal 設定是否正確

### 3. 如果遇到問題

**錯誤訊息**：`invalid_client`
- 檢查 Client ID 和 Client Secret 是否正確
- 檢查 X Developer Portal 中的應用程式狀態
- 確認 Type of App 設定正確

**錯誤訊息**：`insufficient_scope`
- 檢查請求的 scope 是否在 X Developer Portal 中已啟用
- 確認 OAuth 2.0 Scopes 設定正確

**錯誤訊息**：`rate_limit_exceeded`
- 檢查 API 調用頻率
- 確認是否需要升級到商業版
- 考慮實現請求限流

---

## 🔍 檢查清單

### 代碼檢查
- [ ] Scope 已更新為 `users.read offline.access`（移除 `tweet.read`）
- [ ] PKCE 流程已正確實作
- [ ] 授權端點使用 `oauth2/authorize`
- [ ] Token 交換端點正確
- [ ] 用戶資訊端點正確

### X Developer Portal 檢查
- [ ] App Permissions 設定為 **「Read」**
- [ ] Type of App 設定為 **「Web App, Automated App or Bot」**
- [ ] OAuth 2.0 Scopes 只勾選必要的 scope
- [ ] Callback URI 正確設定
- [ ] 應用程式狀態為 **「Active」**

### 測試檢查
- [ ] Edge Function 已重新部署
- [ ] 登入流程測試成功
- [ ] 授權頁面顯示的權限範圍正確
- [ ] 用戶資訊正確獲取

---

## 📚 參考資源

### X Developer Portal
- **X Developer Portal**：https://developer.x.com/
- **OAuth 2.0 文件**：https://developer.x.com/en/docs/authentication/oauth-2-0
- **API v3 文件**：https://developer.x.com/en/docs/twitter-api

### 遷移指南
- **API v3 遷移指南**：https://developer.x.com/en/docs/twitter-api/migrate
- **OAuth 2.0 PKCE 指南**：https://developer.x.com/en/docs/authentication/oauth-2-0/user-access-token

---

## 🎯 下一步

1. **更新 Scope**（移除 `tweet.read`）
2. **檢查 X Developer Portal 設定**
3. **確認 API v3 遷移需求**
4. **重新部署 Edge Function**
5. **測試登入流程**

完成所有步驟後，請告訴我結果，我會協助解決任何問題。
