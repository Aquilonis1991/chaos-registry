# CORS 錯誤修復說明

## 問題描述

Edge Function 返回 CORS 錯誤：
```
Access to fetch at 'https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth' 
from origin 'https://localhost' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status.
```

## 可能的原因

1. **Supabase 運行時層級的 JWT 檢查**：
   - 即使 `config.toml` 中設置了 `verify_jwt = false`，Supabase 運行時可能還是在我們的代碼執行前就檢查了 JWT
   - 這會導致 OPTIONS 請求返回 401 或其他錯誤狀態碼

2. **CORS 預檢請求處理順序**：
   - 如果 CORS 預檢請求沒有在最前面處理，可能會導致錯誤

## 已實施的修復

### 1. 將 CORS 預檢請求處理移到最前面

```typescript
Deno.serve(async (req) => {
  // ✅ 最優先處理：CORS 預檢請求（OPTIONS）
  // 必須在任何其他處理之前，包括創建 URL 對象，否則會導致 CORS 錯誤
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin')
    const corsHeaders = getCorsHeaders(origin)
    console.log('[line-auth] CORS preflight request handled immediately')
    return new Response(null, { 
      headers: corsHeaders,
      status: 204
    })
  }
  
  // 其他處理...
})
```

### 2. 確認 config.toml 設置

```toml
[functions.line-auth]
verify_jwt = false
```

## 需要手動檢查的配置

### 在 Supabase Dashboard 中確認

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇您的專案
3. 導航到 **Edge Functions** > **line-auth**
4. 檢查 **Settings** 或 **Configuration**
5. 確認 **"Verify JWT with legacy secret"** 選項已**關閉**（Disabled）

如果這個選項是開啟的，即使 `config.toml` 中設置了 `verify_jwt = false`，Supabase 運行時仍然會檢查 JWT，導致 OPTIONS 請求返回 401 錯誤。

## 驗證步驟

1. **檢查 Edge Function 日誌**：
   - 在 Supabase Dashboard 中查看 `line-auth` 函數的日誌
   - 查找 OPTIONS 請求的日誌
   - 確認是否返回 204 狀態碼

2. **測試 CORS 預檢請求**：
   ```bash
   curl -X OPTIONS \
     -H "Origin: https://localhost" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: authorization,content-type" \
     -v \
     https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth
   ```
   
   預期響應：
   - Status: 204 No Content
   - Headers: 包含 `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods` 等

3. **如果仍然失敗**：
   - 檢查 Supabase Dashboard 中的 Edge Function 設置
   - 確認 JWT 驗證已禁用
   - 查看 Edge Function 日誌，確認 OPTIONS 請求的實際狀態碼

## 如果問題仍然存在

如果修復後問題仍然存在，可能需要：

1. **在 Supabase Dashboard 中手動禁用 JWT 驗證**：
   - Edge Functions > line-auth > Settings
   - 關閉 "Verify JWT with legacy secret"

2. **檢查 Supabase 專案設置**：
   - Settings > API
   - 確認 Edge Functions 的 JWT 驗證設置

3. **查看 Edge Function 日誌**：
   - 確認 OPTIONS 請求是否到達函數
   - 確認返回的狀態碼

## 預期行為

修復後：
- ✅ OPTIONS 請求會立即返回 204 狀態碼和正確的 CORS headers
- ✅ POST 請求會正常處理並返回 `authUrl`
- ✅ 不再出現 CORS 錯誤
