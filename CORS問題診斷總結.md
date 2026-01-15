# LINE 登入 CORS 問題診斷總結

## 🔍 問題現狀

即使經過多次修復，CORS 錯誤仍然存在：
- 錯誤訊息：`Response to preflight request doesn't pass access control check: It does not have HTTP ok status.`
- OPTIONS 請求可能返回 503 或沒有正確的 CORS headers

## ✅ 已完成的修復

### 1. 前端修復
- ✅ 改用直接 `fetch` 調用（繞過 `supabase.functions.invoke`）
- ✅ 手動設置 Authorization header
- ✅ 完整的錯誤處理

### 2. Edge Function 修復
- ✅ 移除 `!` 斷言運算符（修復 503 錯誤）
- ✅ 修復 STATE_SECRET 生成
- ✅ 在實際使用時驗證環境變數
- ✅ OPTIONS 請求處理簡化（不依賴外部函數）
- ✅ 返回 200 狀態碼（而不是 204）

### 3. CORS 配置修復
- ✅ 優先處理 `localhost`（包括 `https://localhost`）
- ✅ 直接構建 CORS headers（不調用函數）

## ⚠️ 可能的根本原因

### 1. Supabase 路由層攔截

**可能性**：Supabase 的路由層可能在 Edge Function 代碼執行前就處理了 OPTIONS 請求。

**證據**：
- 即使我們的代碼正確處理 OPTIONS，CORS 錯誤仍然存在
- 從日誌來看，OPTIONS 請求可能返回 503（Edge Function 未啟動）

### 2. Edge Function 啟動失敗

**可能性**：Edge Function 可能因為某些原因無法啟動。

**需要檢查**：
- Supabase Dashboard → Edge Functions → line-auth → Logs
- 查看是否有 BOOT_ERROR 或其他啟動錯誤

### 3. 環境變數問題

**可能性**：即使我們移除了模組載入時的驗證，環境變數缺失可能仍然導致問題。

**需要檢查**：
- Supabase Dashboard → Edge Functions → line-auth → Settings → Secrets
- 確認所有環境變數都已正確設置

## 🔧 下一步診斷

### 1. 檢查 Edge Function 日誌

**步驟**：
1. 登入 Supabase Dashboard
2. 前往 Edge Functions → line-auth → Logs
3. 查找 OPTIONS 請求的日誌
4. 檢查：
   - 狀態碼（應該是 200）
   - 是否有 `[line-auth] CORS preflight request handled immediately` 日誌
   - 是否有錯誤訊息

### 2. 檢查環境變數

**步驟**：
1. Supabase Dashboard → Edge Functions → line-auth → Settings → Secrets
2. 確認以下環境變數已設置：
   - `LINE_CHANNEL_ID`
   - `LINE_CHANNEL_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SERVICE_ROLE_KEY`
   - `LINE_REDIRECT_URI`
   - `FRONTEND_URL`
   - `FRONTEND_DEEP_LINK`

### 3. 測試 Edge Function

**使用 curl 測試 OPTIONS 請求**：
```bash
curl -X OPTIONS \
  -H "Origin: https://localhost" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -v \
  https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth
```

**預期結果**：
- 狀態碼：200
- Headers 包含：`Access-Control-Allow-Origin: https://localhost`

## 💡 可能的解決方案

### 方案 1：使用 Supabase 的 `serve()` 函數

如果 `Deno.serve()` 無法正確處理 CORS，可以嘗試使用 Supabase 的 `serve()` 函數：

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  // OPTIONS 處理
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  // ...
}, {
  onListen: ({ port }) => {
    console.log(`Server listening on port ${port}`)
  }
})
```

### 方案 2：檢查 Supabase 項目設置

可能需要在 Supabase Dashboard 中配置 CORS 設置：
1. Settings → API
2. 檢查 CORS 相關設置

### 方案 3：使用代理服務器

如果 Supabase 路由層確實攔截了 OPTIONS 請求，可以考慮：
- 使用代理服務器處理 CORS
- 或使用其他 OAuth 流程（如 PKCE）

## 📝 需要的信息

請提供以下信息以進一步診斷：

1. **Supabase Dashboard 日誌**：
   - OPTIONS 請求的狀態碼
   - 是否有 `[line-auth] CORS preflight request handled immediately` 日誌
   - 是否有錯誤訊息

2. **環境變數確認**：
   - 所有環境變數是否已正確設置

3. **curl 測試結果**：
   - 使用上述 curl 命令測試的結果

---

## ✅ 當前狀態

- ✅ 前端代碼已修復（使用直接 fetch）
- ✅ Edge Function 代碼已修復（簡化 OPTIONS 處理）
- ⚠️ CORS 錯誤仍然存在（需要進一步診斷）

**下一步**：檢查 Supabase Dashboard 中的 Edge Function 日誌，確認 OPTIONS 請求是否到達我們的代碼。
