# X (Twitter) OAuth "state format error" 解決方案

## ⚠️ 新錯誤

**錯誤訊息**：
```
"error": "token is malformed: token contains an invalid number of segments",
"msg": "400: OAuth callback with invalid state"
```

**進展**：
- ✅ `state` 參數現在存在了（不再是 "OAuth state parameter missing"）
- ❌ 但 `state` 參數的格式不正確

---

## 🔍 問題分析

### 問題原因

**Supabase 期望的 `state` 格式**：
- Supabase 的內建 OAuth 處理邏輯期望 `state` 參數是一個 **JWT token**
- JWT token 通常有 3 個部分，用 `.` 分隔：`header.payload.signature`

**Edge Function 生成的 `state` 格式**：
- Edge Function `twitter-auth` 生成的 `state` 參數是一個**簽名的字符串**
- 格式：`{timestamp}|{platform}|{codeVerifier}|{signature}`
- 這不是 JWT 格式，所以 Supabase 無法解析

---

## 🔧 解決方案

### 方案 1：修改 Edge Function 生成 JWT 格式的 `state`（推薦）

**策略**：修改 Edge Function，讓它生成 JWT 格式的 `state` 參數，這樣 Supabase 就不會報錯。

**實現步驟**：

1. **修改 `generateSignedState` 函數**：
   - 將 `state` 參數改為 JWT 格式
   - 使用 JWT 庫（例如 `djwt`）生成 JWT token
   - 在 JWT payload 中包含 `timestamp`、`platform`、`codeVerifier` 等資訊

2. **修改 `verifySignedState` 函數**：
   - 改為驗證 JWT token
   - 從 JWT payload 中提取 `timestamp`、`platform`、`codeVerifier` 等資訊

**優點**：
- Supabase 不會報錯（因為 `state` 是有效的 JWT）
- 仍然可以驗證 `state` 的簽名和時效性
- 符合 OAuth 2.0 最佳實踐

**缺點**：
- 需要修改 Edge Function 代碼
- 需要添加 JWT 庫依賴

---

### 方案 2：讓 Supabase 忽略 `state` 參數（不推薦）

**策略**：嘗試讓 Supabase 的內建處理邏輯忽略 `state` 參數。

**問題**：
- Supabase 的內建處理邏輯是服務器端的，無法直接修改
- 這不是一個可行的解決方案

---

### 方案 3：完全繞過 Supabase 的內建處理邏輯（困難）

**策略**：讓 Edge Function 直接處理回調，不經過 Supabase 的內建處理邏輯。

**問題**：
- X Developer Portal 強制要求使用標準回調 URL：`/auth/v1/callback`
- 無法更改為 Edge Function 端點：`/functions/v1/twitter-auth/callback`
- 因此無法完全繞過 Supabase 的內建處理邏輯

---

## ✅ 推薦解決方案：修改 Edge Function 生成 JWT 格式的 `state`

### 實現步驟

#### 步驟 1：添加 JWT 庫依賴

在 Edge Function 中使用 Deno 的 JWT 庫：

```typescript
import { create, verify } from 'https://deno.land/x/djwt/mod.ts'
```

---

#### 步驟 2：修改 `generateSignedState` 函數

**當前實現**：
```typescript
async function generateSignedState(platform: string, codeVerifier: string): Promise<string> {
  const timestamp = Date.now()
  const data = `${timestamp}|${platform}|${codeVerifier}`
  
  // 使用 HMAC-SHA256 簽名
  const encoder = new TextEncoder()
  const keyData = encoder.encode(STATE_SECRET)
  const messageData = encoder.encode(data)
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, messageData)
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
  
  return `${data}|${signatureBase64}`
}
```

**修改為 JWT 格式**：
```typescript
import { create } from 'https://deno.land/x/djwt/mod.ts'

async function generateSignedState(platform: string, codeVerifier: string): Promise<string> {
  const timestamp = Date.now()
  const expiresIn = 600 // 10 分鐘
  
  // 生成 JWT token
  const payload = {
    timestamp,
    platform,
    codeVerifier,
    exp: Math.floor(Date.now() / 1000) + expiresIn, // JWT 標準的過期時間
  }
  
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(STATE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const token = await create(
    { alg: 'HS256', typ: 'JWT' },
    payload,
    key
  )
  
  return token
}
```

---

#### 步驟 3：修改 `verifySignedState` 函數

**當前實現**：
```typescript
async function verifySignedState(state: string): Promise<{
  valid: boolean
  platform?: string
  codeVerifier?: string
}> {
  // ... 驗證邏輯
}
```

**修改為驗證 JWT**：
```typescript
import { verify } from 'https://deno.land/x/djwt/mod.ts'

async function verifySignedState(state: string): Promise<{
  valid: boolean
  platform?: string
  codeVerifier?: string
}> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(STATE_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    
    const payload = await verify(state, key)
    
    // 檢查過期時間
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false }
    }
    
    // 檢查時間戳（額外的時效性檢查）
    const timestamp = payload.timestamp as number
    const maxAge = 600000 // 10 分鐘
    if (Date.now() - timestamp > maxAge) {
      return { valid: false }
    }
    
    return {
      valid: true,
      platform: payload.platform as string,
      codeVerifier: payload.codeVerifier as string,
    }
  } catch (error) {
    console.error('State verification failed:', error)
    return { valid: false }
  }
}
```

---

## 📋 檢查清單

### 代碼修改
- [ ] 添加 JWT 庫依賴（`djwt`）
- [ ] 修改 `generateSignedState` 函數生成 JWT 格式
- [ ] 修改 `verifySignedState` 函數驗證 JWT
- [ ] 測試 Edge Function 的 `state` 生成和驗證

### 部署
- [ ] 重新部署 Edge Function `twitter-auth`
- [ ] 測試 X 登入功能
- [ ] 確認不再出現 "token is malformed" 錯誤

---

## 🎯 預期結果

修改後：
1. Edge Function 生成的 `state` 參數是 JWT 格式
2. Supabase 的內建處理邏輯不會報錯（因為 `state` 是有效的 JWT）
3. Edge Function 仍然可以驗證 `state` 的簽名和時效性
4. X 登入功能應該能夠正常工作

---

## 📚 相關文件

- `X_Twitter_OAuth_state_參數缺失_解決方案.md` - state 參數缺失問題解決方案
- `X_Twitter_state_參數缺失_立即修復步驟.md` - 立即修復步驟
- `X_Twitter_當前設定確認與問題分析.md` - 當前設定確認與問題分析

---

**下一步**：修改 Edge Function 生成 JWT 格式的 `state` 參數。
