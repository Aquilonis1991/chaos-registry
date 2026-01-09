# X (Twitter) 和 LINE 登入 - 網頁版檢查報告

## 📋 檢查日期
2025-01-29

---

## ✅ 前端代碼檢查

### 1. 登入按鈕

**位置**：`src/pages/AuthPage.tsx`

#### X (Twitter) 登入按鈕
- ✅ **按鈕存在**：第 447-459 行
- ✅ **圖示正確**：使用 X (Twitter) 新 Logo
- ✅ **處理函數**：`handleEdgeSocialLogin('twitter')`
- ✅ **標題文字**：`auth_twitter_login`（使用 UI 文字管理）

#### LINE 登入按鈕
- ✅ **按鈕存在**：第 461-472 行
- ✅ **圖示正確**：使用 LINE Logo
- ✅ **處理函數**：`handleEdgeSocialLogin('line')`
- ✅ **標題文字**：`auth_line_login`（使用 UI 文字管理）

---

### 2. 處理函數

**位置**：`src/pages/AuthPage.tsx` 第 286-322 行

#### `handleEdgeSocialLogin` 函數

```typescript
const handleEdgeSocialLogin = async (provider: 'line' | 'twitter') => {
  // 1. 檢查環境變數
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  // 2. 判斷平台（web 或 app）
  const platform = isNative() ? 'app' : 'web';
  
  // 3. 調用 Edge Function
  const endpoint = provider === 'line'
    ? `${supabaseUrl}/functions/v1/line-auth/auth?platform=${platform}`
    : `${supabaseUrl}/functions/v1/twitter-auth/auth?platform=${platform}`;
  
  // 4. 獲取授權 URL
  const res = await fetch(endpoint, { method: 'GET' });
  const json = await res.json();
  const authUrl = json?.authUrl;
  
  // 5. 重定向到授權頁面
  window.location.href = authUrl;
}
```

**檢查結果**：
- ✅ 函數已正確實作
- ✅ 支援 `line` 和 `twitter` 兩個 provider
- ✅ 正確判斷平台（web/app）
- ✅ 錯誤處理已實作
- ✅ 使用 UI 文字管理顯示錯誤訊息

---

## ✅ Edge Functions 檢查

### 1. Twitter Auth Edge Function

**位置**：`supabase/functions/twitter-auth/index.ts`

#### 功能檢查
- ✅ **授權端點**：`/auth` - 生成授權 URL
- ✅ **回調端點**：`/callback` - 處理 OAuth 回調
- ✅ **PKCE 支援**：使用 OAuth 2.0 with PKCE (S256)
- ✅ **State 驗證**：使用 HMAC-SHA256 簽名保護
- ✅ **用戶建立**：自動建立或更新用戶
- ✅ **Magic Link**：使用 Supabase Admin API 生成 magic link

#### 環境變數需求
- ✅ `TWITTER_CLIENT_ID` - X Developer Portal 的 Client ID
- ✅ `TWITTER_CLIENT_SECRET` - X Developer Portal 的 Client Secret
- ✅ `SUPABASE_URL` - Supabase 專案 URL
- ✅ `SUPABASE_ANON_KEY` - Supabase Anon Key
- ✅ `SERVICE_ROLE_KEY` - Supabase Service Role Key
- ✅ `FRONTEND_URL` - 前端網址（Web 版）
- ✅ `FRONTEND_DEEP_LINK` - Deep Link（App 版）

#### 回調 URL
- ✅ 設定為：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback`

---

### 2. LINE Auth Edge Function

**位置**：`supabase/functions/line-auth/index.ts`

#### 功能檢查
- ✅ **授權端點**：`/auth` - 生成授權 URL
- ✅ **回調端點**：`/callback` - 處理 OAuth 回調
- ✅ **OpenID Connect**：使用 LINE OpenID Connect
- ✅ **Nonce 驗證**：防止重放攻擊
- ✅ **State 驗證**：使用 HMAC-SHA256 簽名保護
- ✅ **ID Token 驗證**：使用 LINE 驗證端點驗證 JWT
- ✅ **用戶建立**：自動建立或更新用戶
- ✅ **Magic Link**：使用 Supabase Admin API 生成 magic link

#### 環境變數需求
- ✅ `LINE_CHANNEL_ID` - LINE Developers Console 的 Channel ID
- ✅ `LINE_CHANNEL_SECRET` - LINE Developers Console 的 Channel Secret
- ✅ `SUPABASE_URL` - Supabase 專案 URL
- ✅ `SUPABASE_ANON_KEY` - Supabase Anon Key
- ✅ `SERVICE_ROLE_KEY` - Supabase Service Role Key
- ✅ `FRONTEND_URL` - 前端網址（Web 版）
- ✅ `FRONTEND_DEEP_LINK` - Deep Link（App 版）

#### 回調 URL
- ✅ 設定為：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback`

---

## ⚠️ 需要檢查的項目

### 1. Edge Functions 部署狀態

**檢查方法**：
```bash
# 檢查 Edge Functions 是否已部署
curl https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/auth
curl https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/auth
```

**預期結果**：
- 應該返回 JSON，包含 `authUrl` 和 `state`
- 如果返回 404 或錯誤，表示 Edge Function 未部署

**狀態**：⏳ **需要確認**

---

### 2. 環境變數設定

**位置**：Supabase Dashboard > Project Settings > Edge Functions > Secrets

#### Twitter Auth 需要的環境變數
- [ ] `TWITTER_CLIENT_ID`
- [ ] `TWITTER_CLIENT_SECRET`
- [ ] `SERVICE_ROLE_KEY`
- [ ] `FRONTEND_URL`（可選，預設：`https://chaos-registry.vercel.app`）
- [ ] `FRONTEND_DEEP_LINK`（可選，預設：`votechaos://auth/callback`）

#### LINE Auth 需要的環境變數
- [ ] `LINE_CHANNEL_ID`
- [ ] `LINE_CHANNEL_SECRET`
- [ ] `SERVICE_ROLE_KEY`
- [ ] `FRONTEND_URL`（可選，預設：`https://chaos-registry.vercel.app`）
- [ ] `FRONTEND_DEEP_LINK`（可選，預設：`votechaos://auth/callback`）

**狀態**：⏳ **需要確認**

---

### 3. 資料庫 Migration

#### Twitter User ID 欄位
**Migration 檔案**：`supabase/migrations/20250129000001_add_twitter_user_id_to_profiles.sql`

**檢查**：
- [ ] Migration 已執行
- [ ] `profiles` 表中有 `twitter_user_id` 欄位
- [ ] 索引已建立

#### LINE User ID 欄位
**Migration 檔案**：`supabase/migrations/20250129000000_add_line_user_id_to_profiles.sql`

**檢查**：
- [ ] Migration 已執行
- [ ] `profiles` 表中有 `line_user_id` 欄位
- [ ] 索引已建立

**狀態**：⏳ **需要確認**

---

### 4. X Developer Portal 設定

#### 應用程式設定
- [ ] 應用程式狀態為 **Active**
- [ ] App permissions 已設定為 **Read**
- [ ] Type of App 已設定為 **Web App, Automated App or Bot**

#### OAuth 2.0 設定
- [ ] Callback URI 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback`
- [ ] Website URL 已設定為：`https://chaos-registry.vercel.app`
- [ ] Terms of service 已設定
- [ ] Privacy policy 已設定

#### API 憑證
- [ ] Client ID 已取得
- [ ] Client Secret 已取得
- [ ] 憑證已添加到 Supabase Edge Functions Secrets

**狀態**：⏳ **需要確認**

---

### 5. LINE Developers Console 設定

#### Channel 設定
- [ ] Channel 類型為 **LINE Login**
- [ ] Channel 狀態為 **Active**

#### Callback URL
- [ ] Callback URL 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback`
- [ ] 必須與 Edge Function 中的設定完全一致

#### API 憑證
- [ ] Channel ID 已取得
- [ ] Channel Secret 已取得
- [ ] 憑證已添加到 Supabase Edge Functions Secrets

**狀態**：⏳ **需要確認**

---

## 🔍 快速檢查步驟

### 步驟 1：檢查前端代碼

1. 打開 `src/pages/AuthPage.tsx`
2. 確認：
   - ✅ 第 447-459 行有 X (Twitter) 登入按鈕
   - ✅ 第 461-472 行有 LINE 登入按鈕
   - ✅ 第 286-322 行有 `handleEdgeSocialLogin` 函數

**結果**：✅ **前端代碼已正確實作**

---

### 步驟 2：檢查 Edge Functions 檔案

1. 確認檔案存在：
   - ✅ `supabase/functions/twitter-auth/index.ts`
   - ✅ `supabase/functions/line-auth/index.ts`

**結果**：✅ **Edge Functions 檔案存在**

---

### 步驟 3：檢查 Edge Functions 部署狀態

**方法 1：使用 curl 測試**
```bash
# 測試 Twitter Auth
curl https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/auth?platform=web

# 測試 LINE Auth
curl https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/auth?platform=web
```

**預期結果**：
```json
{
  "authUrl": "https://...",
  "state": "..."
}
```

**如果返回錯誤**：
- 404：Edge Function 未部署
- 500：環境變數未設定或設定錯誤

**方法 2：檢查 Supabase Dashboard**
1. 登入 Supabase Dashboard
2. 進入 **Edge Functions**
3. 確認 `twitter-auth` 和 `line-auth` 已部署

**狀態**：⏳ **需要確認**

---

### 步驟 4：檢查環境變數

1. 登入 Supabase Dashboard
2. 進入 **Project Settings** > **Edge Functions** > **Secrets**
3. 確認以下環境變數已設定：

#### Twitter Auth
- `TWITTER_CLIENT_ID`
- `TWITTER_CLIENT_SECRET`
- `SERVICE_ROLE_KEY`

#### LINE Auth
- `LINE_CHANNEL_ID`
- `LINE_CHANNEL_SECRET`
- `SERVICE_ROLE_KEY`

**狀態**：⏳ **需要確認**

---

### 步驟 5：檢查資料庫 Migration

**檢查 Twitter User ID 欄位**：
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name = 'twitter_user_id';
```

**檢查 LINE User ID 欄位**：
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name = 'line_user_id';
```

**如果欄位不存在**：
- 需要執行 Migration
- 參考：`supabase/migrations/20250129000000_add_line_user_id_to_profiles.sql`
- 參考：`supabase/migrations/20250129000001_add_twitter_user_id_to_profiles.sql`

**狀態**：⏳ **需要確認**

---

### 步驟 6：檢查 X Developer Portal 設定

1. 登入 [X Developer Portal](https://developer.x.com/)
2. 進入您的應用程式
3. 檢查 **User authentication settings**：
   - ✅ Callback URI：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback`
   - ✅ Website URL：`https://chaos-registry.vercel.app`
4. 檢查 **Keys and tokens**：
   - ✅ Client ID 已取得
   - ✅ Client Secret 已取得

**狀態**：⏳ **需要確認**

---

### 步驟 7：檢查 LINE Developers Console 設定

1. 登入 [LINE Developers Console](https://developers.line.biz/console/)
2. 選擇您的 Provider 和 Channel
3. 進入 **LINE Login** 設定
4. 檢查 **Callback URL**：
   - ✅ 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback`
5. 檢查 **Channel ID** 和 **Channel Secret**：
   - ✅ 已取得並記錄

**狀態**：⏳ **需要確認**

---

## 🧪 測試步驟

### Web 版測試

#### 測試 X (Twitter) 登入
1. 打開 `https://chaos-registry.vercel.app/auth`
2. 點擊 X (Twitter) 登入按鈕
3. 應該跳轉到 X 授權頁面
4. 授權後應該返回並完成登入

#### 測試 LINE 登入
1. 打開 `https://chaos-registry.vercel.app/auth`
2. 點擊 LINE 登入按鈕
3. 應該跳轉到 LINE 授權頁面
4. 授權後應該返回並完成登入

---

## 📝 檢查清單總結

### ✅ 已完成項目
- [x] 前端代碼已實作（按鈕和處理函數）
- [x] Edge Functions 檔案存在
- [x] Edge Functions 代碼已正確實作

### ⏳ 待確認項目
- [ ] Edge Functions 已部署
- [ ] 環境變數已設定
- [ ] 資料庫 Migration 已執行
- [ ] X Developer Portal 設定正確
- [ ] LINE Developers Console 設定正確

---

## 🔧 如果發現問題

### 問題 1：Edge Function 未部署

**解決方案**：
```bash
cd votechaos-main
npx supabase login
npx supabase link --project-ref epyykzxxglkjombvozhr
npx supabase functions deploy twitter-auth
npx supabase functions deploy line-auth
```

---

### 問題 2：環境變數未設定

**解決方案**：
1. 登入 Supabase Dashboard
2. 進入 **Project Settings** > **Edge Functions** > **Secrets**
3. 添加所需的環境變數
4. 重新部署 Edge Functions

---

### 問題 3：資料庫 Migration 未執行

**解決方案**：
```bash
# 使用 Supabase CLI
npx supabase db push

# 或手動在 Supabase Dashboard 執行 SQL
```

---

### 問題 4：回調 URL 不匹配

**解決方案**：
- **X Developer Portal**：確認 Callback URI 為 `https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback`
- **LINE Developers Console**：確認 Callback URL 為 `https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback`

---

## 📚 參考文件

- `X登入設定檢查清單.md` - X 登入詳細設定指南
- `LINE登入-實作檢查清單.md` - LINE 登入詳細設定指南
- `X登入-EdgeFunction實作步驟.md` - Edge Function 實作步驟
- `LINE登入-EdgeFunction實作步驟.md` - Edge Function 實作步驟

---

## 🎯 下一步

請按照以下順序檢查：

1. **檢查 Edge Functions 部署狀態**（最重要）
2. **檢查環境變數設定**
3. **檢查資料庫 Migration**
4. **檢查 X Developer Portal 設定**
5. **檢查 LINE Developers Console 設定**
6. **實際測試登入功能**

完成所有檢查後，請告訴我結果，我會協助解決任何問題。
