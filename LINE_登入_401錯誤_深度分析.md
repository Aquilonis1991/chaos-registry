# LINE 登入 401 錯誤 - 深度分析

## 🔍 問題現象

從日誌可以看到：
- **執行時間 178ms**：這表示 Edge Function 確實執行了
- **返回 401 錯誤**：這可能是 Supabase 路由層級在 Edge Function 處理之前就攔截了請求

## 📊 日誌分析

```
GET | 401 | /functions/v1/line-auth/callback?code=...&state=...
execution_time_ms: 178
```

**關鍵發現**：
- 執行時間 178ms 表示 Edge Function 確實執行了
- 但返回了 401 錯誤
- 這表示請求到達了 Edge Function，但在某個地方返回了 401

## 🔧 可能的原因

### 1. Supabase 路由層級攔截（最可能）

Supabase 路由層級可能在 Edge Function 代碼執行之前就檢查了授權，返回 401。即使使用 `Deno.serve`，Supabase 路由層級仍然可能在 Edge Function 處理之前就攔截請求。

### 2. Edge Function 代碼返回 401

Edge Function 的代碼執行了，但在某個地方返回了 401。但是，我已經將自動重定向邏輯移到了最開始，應該可以在 Edge Function 代碼的最開始就處理重定向。

## ✅ 已完成的修復

### 1. 提前自動重定向邏輯

已將自動重定向邏輯移到 Edge Function 的最開始，在驗證來源之前就執行：

```typescript
Deno.serve(async (req) => {
  // 記錄請求
  console.log('Edge Function request received:', {...})
  
  // 處理 CORS 預檢請求
  if (OPTIONS) return CORS response
  
  // 檢測回調路徑
  const isCallback = path.endsWith('/callback')
  
  // 【關鍵修復】如果是 GET 回調且沒有授權 header，立即重定向
  if (isCallback && GET && !authorization) {
    console.log('[CRITICAL] GET callback without authorization header detected')
    return Response.redirect(frontendUrl, 302)
  }
  
  // 驗證來源（只有非回調請求才驗證）
  ...
})
```

### 2. 環境變數已更新

- `LINE_REDIRECT_URI` 已設置為前端應用 URL

### 3. 前端代碼已準備就緒

- `OAuthCallbackPage.tsx` 已修改為支持 LINE 回調
- 會自動使用 `fetch` POST 請求調用 Edge Function

## 🔍 下一步檢查

### 1. 檢查 Edge Function 日誌

在 Supabase Dashboard 中查看 Edge Function 日誌，確認是否有以下日誌：

- ✅ `Edge Function request received` - 表示請求到達了 Edge Function
- ✅ `[CRITICAL] GET callback without authorization header detected` - 表示自動重定向邏輯執行了

**如果沒有這些日誌**：
- 表示請求在到達 Edge Function 之前就被攔截了
- 可能需要檢查 Supabase Dashboard 中的 Edge Function 設置

**如果有這些日誌**：
- 表示自動重定向邏輯執行了
- 但可能重定向沒有生效，或者 Supabase 路由層級在重定向之前就返回了 401

### 2. 檢查 Supabase Dashboard 設置

在 Supabase Dashboard 中檢查 Edge Function 設置：

1. **前往**：https://supabase.com/dashboard/project/epyykzxxglkjombvozhr/functions
2. **找到** `line-auth` 函數
3. **檢查**：
   - 是否設置為「公開」（不需要授權）
   - 是否有任何限制或攔截設置

### 3. 檢查 LINE Developer Console

確認 LINE Developer Console 中的回調 URL 是否已正確修改：

- ✅ 應該設置為：`https://chaos-registry.vercel.app/auth/callback?provider=line`
- ❌ 不應該是：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback`

## 💡 可能的解決方案

### 方案 1：檢查 Supabase Dashboard 設置

如果 Supabase Dashboard 中有 Edge Function 的「公開」設置，請確保 `line-auth` 函數設置為公開。

### 方案 2：使用不同的回調 URL

如果 Supabase 路由層級確實攔截了請求，可能需要使用不同的回調 URL，或者使用 Supabase 的內建 OAuth 處理。

### 方案 3：聯繫 Supabase 支持

如果問題仍然存在，可能需要聯繫 Supabase 支持，詢問為什麼 Edge Function 會返回 401 錯誤，即使使用 `Deno.serve`。

---

**分析完成時間**：2026-01-09
**Edge Function 版本**：38（已提前自動重定向邏輯）
