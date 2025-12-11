# LINE 第三方登入流程說明

## 📱 整體流程圖

```
用戶點擊 LINE 登入按鈕
    ↓
前端請求 Edge Function 取得授權 URL
    ↓
跳轉到 LINE 授權頁面
    ↓
用戶在 LINE 授權頁面同意授權
    ↓
LINE 重定向回 Edge Function（帶授權碼）
    ↓
Edge Function 用授權碼換取 Token
    ↓
Edge Function 從 Token 取得用戶資訊
    ↓
Edge Function 在 Supabase 建立/更新用戶
    ↓
Edge Function 生成登入 Session
    ↓
重定向回 App（帶 Token）
    ↓
App 設定 Session，完成登入
```

---

## 🔍 詳細步驟說明

### 步驟 1：用戶點擊 LINE 登入按鈕

**位置**：`src/pages/AuthPage.tsx`

**動作**：
- 用戶在登入頁面點擊 LINE 登入按鈕
- 前端判斷是 App 還是 Web 環境

**程式碼邏輯**：
```typescript
const platform = isNative() ? 'app' : 'web'  // 判斷平台
```

---

### 步驟 2：前端請求 Edge Function 取得授權 URL

**位置**：`src/pages/AuthPage.tsx` → `handleLineLogin()`

**動作**：
- 前端呼叫 Supabase Edge Function：`line-auth/auth?platform=app`
- Edge Function 生成隨機的 `state` 和 `nonce`（用於安全驗證）
- Edge Function 構建 LINE 授權 URL 並返回給前端

**Edge Function 做的事情**：
```typescript
// 生成安全參數
const state = crypto.randomUUID()      // 防止 CSRF 攻擊
const nonce = crypto.randomUUID()      // 防止重放攻擊

// 構建 LINE 授權 URL
const authUrl = `https://access.line.me/oauth2/v2.1/authorize?
  response_type=code&
  client_id=你的LINE頻道ID&
  redirect_uri=回調網址&
  state=安全參數&
  scope=profile openid email&
  nonce=防重放參數`
```

**返回給前端**：
```json
{
  "authUrl": "https://access.line.me/oauth2/v2.1/authorize?...",
  "state": "安全參數"
}
```

---

### 步驟 3：跳轉到 LINE 授權頁面

**位置**：`src/pages/AuthPage.tsx`

**動作**：
- 前端收到授權 URL 後，使用 `window.location.href` 跳轉
- 瀏覽器/App 開啟 LINE 授權頁面
- 用戶看到 LINE 的登入授權介面

**LINE 授權方式的自動判斷**：
- **手機 + 已安裝 LINE App**：LINE 會**優先使用 LINE App** 進行授權
  - 會自動開啟 LINE App
  - 用戶在 LINE App 中完成授權
  - 授權完成後自動返回原應用
- **電腦或未安裝 LINE App**：使用**網頁版**授權
  - 在瀏覽器中顯示 LINE 授權頁面
  - 用戶在網頁上完成授權

**注意**：
- 這是 LINE 的**自動判斷機制**，我們無法強制指定使用哪種方式
- LINE 會根據用戶的設備和環境，自動選擇最適合的授權方式
- 用戶需要同意授權才能繼續

---

### 步驟 4：用戶在 LINE 授權頁面同意授權

**位置**：LINE 官方伺服器

**動作**：
- 用戶輸入 LINE 帳號密碼（如果需要）
- 用戶點擊「同意」授權
- LINE 伺服器生成一個**授權碼（authorization code）**

**授權碼特點**：
- 只能使用一次
- 有效期很短（通常幾分鐘）
- 不能直接用來取得用戶資訊，需要換成 Token

---

### 步驟 5：LINE 重定向回 Edge Function（帶授權碼）

**位置**：`supabase/functions/line-auth/index.ts` → `handleCallback()`

**動作**：
- LINE 伺服器重定向到我們設定的回調網址
- 回調網址：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback`
- URL 參數包含：
  - `code`：授權碼
  - `state`：我們之前發送的安全參數（用於驗證）

**URL 範例**：
```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback?
  code=ABC123XYZ&
  state=我們的安全參數
```

---

### 步驟 6：Edge Function 用授權碼換取 Token

**位置**：`supabase/functions/line-auth/index.ts`

**動作**：
- Edge Function 收到授權碼後，向 LINE 伺服器發送請求
- 用授權碼換取 `access_token` 和 `id_token`

**請求內容**：
```typescript
POST https://api.line.me/oauth2/v2.1/token
{
  grant_type: 'authorization_code',
  code: '授權碼',
  redirect_uri: '回調網址',
  client_id: 'LINE頻道ID',
  client_secret: 'LINE頻道密鑰'
}
```

**LINE 返回**：
```json
{
  "access_token": "用於呼叫LINE API的token",
  "id_token": "包含用戶資訊的JWT token",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

---

### 步驟 7：Edge Function 從 Token 取得用戶資訊

**位置**：`supabase/functions/line-auth/index.ts`

**動作**：
- `id_token` 是 JWT 格式，包含用戶資訊
- Edge Function 解析 JWT 取得：
  - `sub`：LINE 用戶 ID（唯一識別碼）
  - `name`：用戶顯示名稱
  - `picture`：用戶頭像網址
  - `email`：用戶 Email（如果有申請權限）

**解析過程**：
```typescript
// JWT 格式：header.payload.signature
const idTokenParts = idToken.split('.')
const payload = JSON.parse(atob(idTokenParts[1]))  // 解碼 payload

const lineUserId = payload.sub        // LINE 用戶 ID
const displayName = payload.name      // 顯示名稱
const pictureUrl = payload.picture   // 頭像網址
const email = payload.email           // Email（可能為空）
```

---

### 步驟 8：Edge Function 在 Supabase 建立/更新用戶

**位置**：`supabase/functions/line-auth/index.ts`

**動作**：
- 使用 Supabase Admin API（需要 Service Role Key）
- 檢查資料庫中是否已有這個 LINE 用戶

**情況 A：現有用戶（已用 LINE 登入過）**
```typescript
// 查詢 profiles 表，找 line_user_id 匹配的記錄
const existingProfile = await supabaseAdmin
  .from('profiles')
  .select('id')
  .eq('line_user_id', lineUserId)
  .single()

// 更新用戶資訊
await supabaseAdmin
  .from('profiles')
  .update({
    nickname: displayName,
    avatar: pictureUrl,
    last_login: new Date()
  })
  .eq('id', userId)
```

**情況 B：新用戶（第一次用 LINE 登入）**
```typescript
// 建立新的 auth.users 記錄
const { data: authUser } = await supabaseAdmin.auth.admin.createUser({
  email: email || `line_${lineUserId}@line.local`,  // 如果沒有 email，生成一個假的
  email_confirm: true,  // 自動確認 email
  user_metadata: {
    line_user_id: lineUserId,
    nickname: displayName,
    avatar: pictureUrl
  }
})

// 更新 profiles 表的 line_user_id
await supabaseAdmin
  .from('profiles')
  .update({
    line_user_id: lineUserId,
    nickname: displayName,
    avatar: pictureUrl
  })
  .eq('id', userId)
```

**資料庫結構**：
- `auth.users`：Supabase 認證用戶表
- `public.profiles`：用戶資料表（包含 `line_user_id` 欄位）

---

### 步驟 9：Edge Function 生成登入 Session

**位置**：`supabase/functions/line-auth/index.ts`

**動作**：
- 使用 Supabase Admin API 為用戶生成 Session
- Session 包含 `access_token` 和 `refresh_token`

**程式碼**：
```typescript
const { data: sessionData } = await supabaseAdmin.auth.admin.generateSession(userId)

const access_token = sessionData.session.access_token
const refresh_token = sessionData.session.refresh_token
```

**Session 的作用**：
- `access_token`：用於 API 請求的身份驗證（有效期短）
- `refresh_token`：用於刷新 `access_token`（有效期長）

---

### 步驟 10：重定向回 App（帶 Token）

**位置**：`supabase/functions/line-auth/index.ts`

**動作**：
- 根據 `platform` 參數決定重定向目標
- **App 登入**：使用 Deep Link `votechaos://auth/callback?access_token=...&refresh_token=...`
- **Web 登入**：使用 HTTPS URL `https://chaos-registry.vercel.app/auth/callback?access_token=...&refresh_token=...`

**重定向 URL 範例**：
```
votechaos://auth/callback?
  access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...&
  refresh_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...&
  expires_in=3600&
  token_type=Bearer&
  provider=line&
  is_new_user=false
```

---

### 步驟 11：App 設定 Session，完成登入

**位置**：`src/components/OAuthCallbackHandler.tsx`

**動作**：
- App 收到 Deep Link 回調
- `app-lifecycle.ts` 監聽 Deep Link，觸發 `oauth-callback` 事件
- `OAuthCallbackHandler` 組件監聽事件，取得 Token
- 使用 Supabase Client 設定 Session

**程式碼邏輯**：
```typescript
// 從 URL 參數取得 Token
const access_token = params.access_token
const refresh_token = params.refresh_token

// 設定 Supabase Session
const { data: sessionData } = await supabase.auth.setSession({
  access_token,
  refresh_token
})

// 登入成功，導航到首頁
navigate('/home')
```

**完成**：
- 用戶已登入
- Supabase 會自動管理 Session
- 後續 API 請求會自動帶上 `access_token`

---

## 🔐 安全機制

### 1. CSRF 防護（state 參數）
- 在步驟 2 生成隨機 `state`
- 在步驟 5 驗證 `state` 是否匹配
- 防止跨站請求偽造攻擊

### 2. 重放攻擊防護（nonce 參數）
- 在步驟 2 生成隨機 `nonce`
- 在步驟 7 驗證 `nonce` 是否匹配
- 防止授權碼被重複使用

### 3. 授權碼一次性使用
- LINE 的授權碼只能使用一次
- 換成 Token 後就失效
- 防止授權碼被竊取後重複使用

### 4. Token 有效期限制
- `access_token` 有效期短（通常 1 小時）
- `refresh_token` 用於自動刷新
- 過期後需要重新登入

---

## 📊 資料流程圖

```
┌─────────┐
│  用戶   │
└────┬────┘
     │ 1. 點擊 LINE 登入
     ↓
┌─────────────────┐
│   前端 App      │
│ AuthPage.tsx    │
└────┬────────────┘
     │ 2. 請求授權 URL
     ↓
┌─────────────────────────┐
│  Supabase Edge Function │
│  line-auth/auth         │
└────┬────────────────────┘
     │ 3. 返回授權 URL
     ↓
┌─────────────────┐
│   前端 App      │
│ 跳轉到 LINE     │
└────┬────────────┘
     │ 4. 用戶授權
     ↓
┌─────────┐
│  LINE   │
│ 伺服器  │
└────┬────┘
     │ 5. 重定向 + 授權碼
     ↓
┌─────────────────────────┐
│  Supabase Edge Function │
│  line-auth/callback     │
└────┬────────────────────┘
     │ 6. 用授權碼換 Token
     ↓
┌─────────┐
│  LINE   │
│ 伺服器  │
└────┬────┘
     │ 7. 返回 Token
     ↓
┌─────────────────────────┐
│  Supabase Edge Function │
│  解析用戶資訊           │
│  建立/更新用戶          │
│  生成 Session           │
└────┬────────────────────┘
     │ 8. 重定向 + Token
     ↓
┌─────────────────┐
│   前端 App      │
│ OAuthCallback   │
│ Handler         │
└────┬────────────┘
     │ 9. 設定 Session
     ↓
┌─────────┐
│ Supabase│
│ 資料庫  │
└────┬────┘
     │ 10. 登入完成
     ↓
┌─────────┐
│  首頁   │
└─────────┘
```

---

## 🎯 關鍵要點

1. **為什麼需要 Edge Function？**
   - Supabase 不原生支援 LINE 登入
   - 需要自訂 OAuth 流程
   - Edge Function 作為中間層處理 LINE API 呼叫

2. **為什麼需要 Deep Link？**
   - App 無法直接處理 HTTPS 重定向
   - Deep Link 讓 App 能接收回調
   - 格式：`votechaos://auth/callback`

3. **為什麼需要 Service Role Key？**
   - 建立用戶需要 Admin 權限
   - 一般用戶無法直接建立其他用戶
   - Service Role Key 有完整權限

4. **為什麼需要 line_user_id？**
   - 用於識別 LINE 用戶
   - 防止重複建立用戶
   - 關聯 LINE 帳號和 Supabase 用戶

---

## ⚠️ 常見問題

### Q1：為什麼授權碼不能直接使用？
A：授權碼是臨時的，只能換成 Token。這是 OAuth 2.0 的安全設計。

### Q2：為什麼需要 nonce？
A：防止重放攻擊。即使有人截獲授權碼，沒有對應的 nonce 也無法使用。

### Q3：為什麼 App 和 Web 的重定向不同？
A：App 使用 Deep Link，Web 使用 HTTPS URL。兩者的處理方式不同。

### Q4：如果 LINE 沒有返回 email 怎麼辦？
A：系統會生成一個假的 email：`line_{lineUserId}@line.local`，用於 Supabase 認證。

### Q5：Session 過期了怎麼辦？
A：Supabase 會自動使用 `refresh_token` 刷新 `access_token`，用戶無感知。

### Q6：LINE 會優先使用 App 還是網頁進行授權？
A：**LINE 會自動判斷，優先使用 LINE App**：
- **手機 + 已安裝 LINE App**：優先使用 LINE App 進行授權（更流暢、更安全）
- **電腦或未安裝 LINE App**：使用網頁版授權
- 這是 LINE 的內建機制，我們無法強制指定，但通常會優先使用 App

---

## 📝 總結

LINE 登入流程是一個標準的 OAuth 2.0 + OpenID Connect 流程：

1. **授權階段**：用戶同意授權，取得授權碼
2. **換取階段**：用授權碼換取 Token
3. **認證階段**：用 Token 取得用戶資訊
4. **登入階段**：在 Supabase 建立/更新用戶，生成 Session
5. **完成階段**：App 設定 Session，用戶登入成功

整個流程設計考慮了安全性、用戶體驗和跨平台兼容性。

