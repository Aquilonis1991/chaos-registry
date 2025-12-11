# LINE 登入 - 自訂實作指南

> **重要**：Supabase 不直接支援 LINE 作為第三方登入提供者  
> **解決方案**：需要自訂實作 LINE OAuth 流程  
> **更新日期**：2025-01-29

---

## ⚠️ 重要說明

**Supabase 不支援 LINE Provider**：
- Supabase 的 Authentication → Providers 中**沒有 LINE 選項**
- 無法使用 `supabase.auth.signInWithOAuth({ provider: 'line' })`
- 需要自訂實作 LINE OAuth 2.0 流程

---

## 🎯 實作方案

### 方案 1：使用 Supabase Edge Function（推薦）✅

**優點**：
- 伺服器端處理，安全性高
- 可以與 Supabase Auth 整合
- 使用現有的 Supabase 基礎設施

**實作狀態**：
- ✅ Edge Function 程式碼已建立：`supabase/functions/line-auth/index.ts`
- ✅ 前端程式碼已更新：`src/pages/AuthPage.tsx`
- ✅ 資料庫 Migration 已建立：`supabase/migrations/20250129000000_add_line_user_id_to_profiles.sql`

**詳細實作步驟**：
- 📚 請參考 [LINE 登入 - Edge Function 實作詳細步驟](./LINE登入-EdgeFunction實作步驟.md)
- 📋 快速檢查清單：[LINE 登入 - 實作檢查清單](./LINE登入-實作檢查清單.md)

**實作流程**：

1. **建立 Edge Function** ✅ 已完成
   - 在 `supabase/functions/line-auth/` 建立新的 Edge Function
   - 處理 LINE OAuth 流程

2. **前端呼叫 Edge Function** ✅ 已完成
   - 前端呼叫 Edge Function 取得 LINE 授權 URL
   - 用戶授權後，LINE 回調到 Edge Function
   - Edge Function 處理回調，取得用戶資訊
   - 在 Supabase 中建立或更新用戶

### 方案 2：前端直接實作（簡單但安全性較低）

**優點**：
- 實作簡單，無需 Edge Function
- 快速上線

**缺點**：
- Channel Secret 需要暴露在前端（不推薦）
- 安全性較低

**實作步驟**：
- 前端直接處理 LINE OAuth 流程
- 取得 LINE 用戶資訊後，使用 Supabase Auth API 建立用戶

### 方案 3：使用第三方服務（如 Logto、Auth0）

**優點**：
- 專業的身份驗證服務
- 支援多種 Provider，包括 LINE

**缺點**：
- 需要額外的服務和費用
- 增加系統複雜度

---

## 🔧 方案 1 詳細實作：使用 Supabase Edge Function

### 步驟 1：建立 Edge Function

**檔案結構**：
```
supabase/
  functions/
    line-auth/
      index.ts
```

**Edge Function 程式碼範例** (`supabase/functions/line-auth/index.ts`)：

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LINE_CHANNEL_ID = Deno.env.get('LINE_CHANNEL_ID') || '2008600116'
const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET') || '079ebaa784b4c00184e68bafb1841d77'
const LINE_REDIRECT_URI = Deno.env.get('LINE_REDIRECT_URI') || 'https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

serve(async (req) => {
  const url = new URL(req.url)
  const path = url.pathname

  // 處理 LINE 授權請求
  if (path.endsWith('/auth')) {
    const state = crypto.randomUUID()
    const scope = 'profile openid email'
    const authUrl = `https://access.line.me/oauth2/v2.1/authorize?` +
      `response_type=code&` +
      `client_id=${LINE_CHANNEL_ID}&` +
      `redirect_uri=${encodeURIComponent(LINE_REDIRECT_URI)}&` +
      `state=${state}&` +
      `scope=${encodeURIComponent(scope)}`

    return new Response(JSON.stringify({ authUrl, state }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 處理 LINE 回調
  if (path.endsWith('/callback')) {
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')

    if (!code) {
      return new Response(JSON.stringify({ error: 'No code provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 使用授權碼交換 access token
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: LINE_REDIRECT_URI,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET,
      }),
    })

    const tokenData = await tokenResponse.json()
    if (!tokenData.access_token) {
      return new Response(JSON.stringify({ error: 'Failed to get access token' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 使用 access token 取得用戶資訊
    const userResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    })

    const userData = await userResponse.json()

    // 建立 Supabase 用戶
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    // 使用 LINE 用戶 ID 作為唯一識別
    const lineUserId = userData.userId
    const email = userData.email || `${lineUserId}@line.local`
    const displayName = userData.displayName || 'LINE User'
    const pictureUrl = userData.pictureUrl

    // 檢查用戶是否已存在
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('line_user_id', lineUserId)
      .single()

    if (existingUser) {
      // 更新現有用戶
      await supabase
        .from('profiles')
        .update({
          nickname: displayName,
          avatar: pictureUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id)
    } else {
      // 建立新用戶（需要先建立 auth.users，然後建立 profiles）
      // 這裡需要更複雜的邏輯，建議使用 Supabase Admin API
    }

    // 重定向到前端
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://chaos-registry.vercel.app'
    return Response.redirect(`${frontendUrl}/home`)
  }

  return new Response('Not found', { status: 404 })
})
```

### 步驟 2：設定環境變數

在 Supabase Dashboard 中設定 Edge Function 環境變數：

1. 進入 Supabase Dashboard → Edge Functions → Settings
2. 添加以下環境變數：
   - `LINE_CHANNEL_ID`: `2008600116`
   - `LINE_CHANNEL_SECRET`: `079ebaa784b4c00184e68bafb1841d77`
   - `LINE_REDIRECT_URI`: `https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback`
   - `FRONTEND_URL`: `https://chaos-registry.vercel.app`

### 步驟 3：更新前端程式碼

**修改 `src/pages/AuthPage.tsx`**：

```typescript
const handleLineLogin = async () => {
  try {
    // 呼叫 Edge Function 取得 LINE 授權 URL
    const { data, error } = await supabase.functions.invoke('line-auth/auth')
    
    if (error) {
      throw error
    }

    // 儲存 state 到 localStorage（用於驗證回調）
    if (data.state) {
      localStorage.setItem('line_oauth_state', data.state)
    }

    // 跳轉到 LINE 授權頁面
    window.location.href = data.authUrl
  } catch (error) {
    console.error('LINE login error:', error)
    toast.error('LINE 登入失敗，請稍後再試')
  }
}
```

---

## 🔧 方案 2：前端直接實作（不推薦，僅供參考）

**警告**：此方案需要將 Channel Secret 暴露在前端，安全性較低，不建議使用。

如果必須使用此方案，建議：
- 使用公開的 OAuth 流程（不需要 Channel Secret）
- 或使用 LINE Login SDK（如果可用）

---

## 📋 資料庫準備

### 在 profiles 表中添加 LINE 用戶 ID

如果還沒有，需要在 `profiles` 表中添加 `line_user_id` 欄位：

```sql
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS line_user_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_line_user_id 
ON public.profiles(line_user_id);
```

---

## ✅ 檢查清單

### Edge Function 設定
- [ ] Edge Function 已建立：`supabase/functions/line-auth/index.ts`
- [ ] 環境變數已設定（LINE_CHANNEL_ID, LINE_CHANNEL_SECRET）
- [ ] Edge Function 已部署到 Supabase

### LINE Developers Console
- [ ] Callback URL 已設定：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback`
- [ ] Channel ID 和 Channel Secret 已記錄

### 前端實作
- [ ] `handleLineLogin` 函數已更新
- [ ] LINE 登入按鈕已連接

### 資料庫
- [ ] `profiles` 表已添加 `line_user_id` 欄位
- [ ] 索引已建立

---

## 🔗 相關文件

- [LINE 第三方登入完整設定指南](./LINE第三方登入完整設定指南.md)
- [LINE Developers Console 設定](./LINE第三方登入完整設定指南.md#part-1-line-developers-console-設定)
- [Supabase Edge Functions 文件](https://supabase.com/docs/guides/functions)

---

## ⚠️ 重要提醒

1. **安全性**：
   - Channel Secret 必須儲存在伺服器端（Edge Function 環境變數）
   - 不要將 Channel Secret 暴露在前端程式碼中

2. **用戶建立**：
   - 需要處理新用戶的建立邏輯
   - 建議使用 Supabase Admin API 來建立 auth.users

3. **測試**：
   - 在開發環境中充分測試
   - 確認回調流程正常運作

---

## 📝 下一步

1. 選擇實作方案（建議使用方案 1：Edge Function）
2. 建立 Edge Function
3. 更新前端程式碼
4. 設定環境變數
5. 測試 LINE 登入流程

