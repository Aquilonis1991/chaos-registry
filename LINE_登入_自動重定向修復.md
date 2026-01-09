# LINE 登入自動重定向修復

## ✅ 已完成的修復

### Edge Function 自動重定向邏輯

修改了 `line-auth` Edge Function，當收到來自 LINE 服務器的直接 GET 回調請求（沒有授權 header）時，會自動重定向到前端應用，讓前端使用 POST 請求調用 Edge Function。

### 修復後的流程

```
LINE 服務器 → 直接重定向到 Edge Function（GET 請求，沒有授權 header）
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback?code=...&state=...
↓
Edge Function 檢測到 GET 請求且沒有授權 header
↓
自動重定向到前端應用
https://chaos-registry.vercel.app/auth/callback?provider=line&code=...&state=...
↓
前端 OAuthCallbackPage 檢測到 LINE 回調
↓
使用 fetch POST 請求調用 Edge Function
POST https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback
Body: { code, state, error }
↓
Edge Function 處理回調（POST 請求不會被攔截）
↓
返回 magic link 重定向
↓
用戶登入成功 ✅
```

---

## 🔧 技術細節

### 修改內容

在 `line-auth` Edge Function 的回調處理邏輯中添加了自動重定向：

```typescript
// 如果是 GET 請求且沒有授權 header（來自 LINE 服務器直接重定向），
// 重定向到前端應用，讓前端使用 POST 請求調用 Edge Function
if (req.method === 'GET' && !req.headers.get('authorization')) {
  console.log('GET callback without authorization header, redirecting to frontend')
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  
  // 構建前端應用的回調 URL
  const frontendCallbackUrl = new URL(`${FRONTEND_URL}/auth/callback`)
  if (code) frontendCallbackUrl.searchParams.set('code', code)
  if (state) frontendCallbackUrl.searchParams.set('state', state)
  if (error) frontendCallbackUrl.searchParams.set('error', error)
  frontendCallbackUrl.searchParams.set('provider', 'line')
  
  console.log('Redirecting to frontend:', frontendCallbackUrl.toString())
  return Response.redirect(frontendCallbackUrl.toString(), 302)
}
```

---

## 📋 優勢

### 1. 不需要修改 LINE Developer Console
- 即使 LINE Developer Console 中的回調 URL 仍然是 Edge Function 的 URL，也能正常工作
- Edge Function 會自動處理重定向

### 2. 兼容兩種回調方式
- **直接重定向到 Edge Function**（GET 請求）→ 自動重定向到前端
- **重定向到前端應用**（推薦）→ 前端使用 POST 請求調用 Edge Function

### 3. 避免 401 錯誤
- GET 請求會被 Supabase 路由層級攔截（401 錯誤）
- POST 請求不會被攔截（200 成功）

---

## ⚠️ 重要提醒

1. **仍然建議修改 LINE Developer Console**
   - 雖然現在可以自動處理，但修改 LINE Developer Console 中的回調 URL 為前端應用 URL 仍然是推薦的做法
   - 這樣可以減少一次重定向，提高性能

2. **環境變數已更新**
   - `LINE_REDIRECT_URI` 已設置為前端應用 URL
   - Edge Function 會使用此 URL 進行驗證

3. **前端代碼已準備就緒**
   - `OAuthCallbackPage.tsx` 已修改為支持 LINE 回調
   - 會自動使用 `fetch` POST 請求調用 Edge Function

---

## 🧪 測試步驟

1. **清除瀏覽器快取和 Cookie**
2. **嘗試使用 LINE 登入**
3. **檢查流程**：
   - LINE 服務器重定向到 Edge Function（GET 請求）
   - Edge Function 自動重定向到前端應用
   - 前端使用 POST 請求調用 Edge Function
   - 登入成功

---

**修復完成時間**：2026-01-09
**Edge Function 版本**：最新（已支持自動重定向）
