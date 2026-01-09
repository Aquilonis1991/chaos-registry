# X (Twitter) OAuth 2.0 2025 新接口要求清單

## 📋 更新日期
2025-01-29

---

## ✅ 已符合的要求

### 1. OAuth 2.0 PKCE 流程 ✅

**要求**：必須使用 OAuth 2.0 PKCE (Proof Key for Code Exchange) 流程

**當前實作**：
- ✅ 已生成 `code_verifier`（第 179 行）
- ✅ 已生成 `code_challenge`（第 182-187 行）
- ✅ 已使用 `code_challenge_method=S256`（第 207 行）
- ✅ 已在 token 交換時提供 `code_verifier`（第 303 行）

**狀態**：✅ **已符合要求**

---

### 2. 授權端點 ✅

**要求**：使用 `oauth2/authorize` 端點（不是舊的 `oauth/authenticate`）

**當前實作**：
- ✅ 使用 `https://twitter.com/i/oauth2/authorize`（第 200 行）

**狀態**：✅ **已符合要求**

---

### 3. Token 交換端點 ✅

**要求**：使用 `oauth2/token` 端點

**當前實作**：
- ✅ 使用 `https://api.twitter.com/2/oauth2/token`（第 292 行）

**狀態**：✅ **已符合要求**

---

## 🔄 已更新的項目

### 1. OAuth 2.0 Scope 更新 ✅

**更新前**：
```typescript
const scope = 'tweet.read users.read offline.access'
```

**更新後**：
```typescript
const scope = 'users.read offline.access'
```

**原因**：
- ✅ 移除 `tweet.read`：我們只需要用戶資訊進行登入，不需要讀取推文
- ✅ 保留 `users.read`：必須，用於獲取用戶基本資訊（用戶名、頭像等）
- ✅ 保留 `offline.access`：可選，用於 refresh token（如果需要）

**更新位置**：`supabase/functions/twitter-auth/index.ts` 第 199 行

**狀態**：✅ **已更新**

---

## ⚠️ 需要確認的項目

### 1. API v3 遷移需求 ⏳

**背景**：
- X 要求所有商業賬戶在 2025 年 6 月 30 日前遷移至 API v3
- 舊版 v1.1 和 v2 的速率限制已大幅降低

**當前實作**：
- 使用 API v2 端點：`https://api.twitter.com/2/oauth2/token`
- 使用 API v2 端點：`https://api.twitter.com/2/users/me`

**需要確認**：
1. 您的 X Developer Portal 帳號類型：
   - [ ] 免費版（Free）
   - [ ] 基礎版（Basic - $100/月）
   - [ ] 商業版（Business）
   - [ ] 企業版（Enterprise）

2. 是否需要遷移到 API v3：
   - **免費版**：可能仍可使用 v2（需要確認）
   - **商業版**：必須在 2025 年 6 月 30 日前遷移至 v3

3. 如果遷移到 v3，需要：
   - 更新 API 端點（如果 v3 有不同的端點）
   - 檢查 API 文件確認新的端點格式
   - 測試新的 API 調用

**狀態**：⏳ **需要確認**

---

### 2. X Developer Portal 設定檢查 ⏳

**需要確認的設定**：

#### 2.1 App Permissions
- [ ] 已設定為 **「Read」**（最小權限）
- [ ] 未選擇 **「Read and write」**（除非需要）

#### 2.2 Type of App
- [ ] 已設定為 **「Web App, Automated App or Bot」**
- [ ] 未設定為 **「Native App」**（除非直接與 X API 互動）

#### 2.3 OAuth 2.0 Scopes
- [ ] 至少勾選 **「users.read」**
- [ ] 未勾選 **「tweet.read」**（除非需要）
- [ ] 可選勾選 **「offline.access」**（如果需要 refresh token）

#### 2.4 Callback URI
- [ ] 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback`
- [ ] ⚠️ **注意**：這是 Edge Function 的回調 URL

**狀態**：⏳ **需要確認**

---

## 📝 完整要求清單

### 必須符合的要求

1. ✅ **OAuth 2.0 PKCE 流程**
   - ✅ 生成 `code_verifier`
   - ✅ 生成 `code_challenge`（使用 SHA256）
   - ✅ 使用 `code_challenge_method=S256`
   - ✅ 在 token 交換時提供 `code_verifier`

2. ✅ **授權端點**
   - ✅ 使用 `https://twitter.com/i/oauth2/authorize`

3. ✅ **Token 交換端點**
   - ✅ 使用 `https://api.twitter.com/2/oauth2/token`

4. ✅ **Scope 設定**
   - ✅ 只請求必要的 scope（`users.read` 和 `offline.access`）
   - ✅ 移除不必要的 scope（`tweet.read`）

### 建議檢查的項目

1. ⏳ **API v3 遷移**
   - 確認帳號類型
   - 確認是否需要遷移
   - 如果需要，準備遷移計劃

2. ⏳ **X Developer Portal 設定**
   - 確認所有設定正確
   - 確認 OAuth 2.0 Scopes 設定正確

---

## 🔧 更新後的代碼

### 授權請求（已更新）

```typescript
// 構建 X (Twitter) 授權 URL
// X 使用 OAuth 2.0 with PKCE (S256 method)
// 2025 更新：移除 tweet.read，僅保留必要的 users.read 和 offline.access
const scope = 'users.read offline.access'
const authUrl = `https://twitter.com/i/oauth2/authorize?` +
  `response_type=code&` +
  `client_id=${TWITTER_CLIENT_ID}&` +
  `redirect_uri=${encodeURIComponent(TWITTER_REDIRECT_URI)}&` +
  `scope=${encodeURIComponent(scope)}&` +
  `state=${encodeURIComponent(signedState)}&` +
  `code_challenge=${codeChallenge}&` +
  `code_challenge_method=S256`
```

**變更**：
- ✅ Scope 從 `tweet.read users.read offline.access` 更新為 `users.read offline.access`
- ✅ 移除 `tweet.read`（不需要讀取推文）

---

## 🧪 測試步驟

### 1. 重新部署 Edge Function

```bash
cd votechaos-main
npx supabase functions deploy twitter-auth
```

### 2. 測試登入流程

1. 打開 `https://chaos-registry.vercel.app/auth`
2. 點擊 X (Twitter) 登入按鈕
3. 確認授權頁面顯示的權限範圍：
   - ✅ 應該只顯示 `users.read` 和 `offline.access`
   - ❌ 不應該顯示 `tweet.read`
4. 授權後確認可以正常登入

### 3. 檢查授權頁面

**預期顯示**：
- ✅ 讀取用戶資訊（users.read）
- ✅ 離線訪問（offline.access）
- ❌ 不應該顯示「讀取推文」相關權限

---

## 📚 參考資源

### X Developer Portal
- **X Developer Portal**：https://developer.x.com/
- **OAuth 2.0 文件**：https://developer.x.com/en/docs/authentication/oauth-2-0
- **OAuth 2.0 PKCE 指南**：https://developer.x.com/en/docs/authentication/oauth-2-0/user-access-token

### API 遷移
- **API v3 文件**：https://developer.x.com/en/docs/twitter-api
- **API 遷移指南**：https://developer.x.com/en/docs/twitter-api/migrate

---

## 🎯 總結

### 已完成的更新
- ✅ Scope 已更新（移除 `tweet.read`）
- ✅ 代碼已符合 2025 年 OAuth 2.0 PKCE 要求
- ✅ 授權端點已正確使用

### 需要確認的項目
- ⏳ API v3 遷移需求（取決於帳號類型）
- ⏳ X Developer Portal 設定是否正確

### 下一步
1. **重新部署 Edge Function**（已更新 Scope）
2. **檢查 X Developer Portal 設定**
3. **確認 API v3 遷移需求**
4. **測試登入流程**

---

**更新完成日期**：2025-01-29  
**版本**：2025 最新版
