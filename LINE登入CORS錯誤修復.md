# LINE 登入 CORS 錯誤修復

## 🐛 問題描述

在 App 中調用 LINE 登入時，出現 CORS 錯誤：

```
Access to fetch at 'https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth' 
from origin 'https://localhost' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status.
```

## 🔍 問題分析

1. **CORS 預檢請求失敗**: 當使用 `supabase.functions.invoke` 時，瀏覽器會自動發送 OPTIONS 預檢請求，但 Edge Function 沒有正確處理。

2. **OPTIONS 請求處理位置不當**: OPTIONS 請求處理在 try-catch 中，如果 `getCorsHeaders` 出錯，可能導致響應不正確。

3. **錯誤響應缺少 CORS headers**: `validateOrigin` 函數返回的 403 錯誤響應沒有包含 CORS headers。

## ✅ 修復方案

### 1. 修復 OPTIONS 請求處理順序

**文件**: `supabase/functions/line-auth/index.ts`

**修改前**:
```typescript
Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      // ... OPTIONS 處理
    }
  } catch (corsError) {
    // ... 錯誤處理
  }
  // ... 其他處理
})
```

**修改後**:
```typescript
Deno.serve(async (req) => {
  // ✅ 最優先處理：CORS 預檢請求（OPTIONS）
  // 必須在任何其他處理之前，包括創建 URL 對象和 try-catch
  if (req.method === 'OPTIONS') {
    try {
      const origin = req.headers.get('origin')
      const corsHeaders = getCorsHeaders(origin)
      console.log('[line-auth] CORS preflight request handled immediately, origin:', origin)
      return new Response(null, { 
        headers: corsHeaders,
        status: 204
      })
    } catch (corsError) {
      // 如果 CORS 處理出錯，至少返回基本的 CORS headers
      console.error('[line-auth] Error handling CORS preflight:', corsError)
      const origin = req.headers.get('origin') || 'https://localhost'
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'Access-Control-Max-Age': '86400',
        },
        status: 204
      })
    }
  }
  
  try {
    // ... 其他處理
  }
})
```

**關鍵改進**:
- ✅ OPTIONS 請求處理移到 try-catch 之外，確保優先處理
- ✅ 即使 `getCorsHeaders` 出錯，也會返回基本的 CORS headers
- ✅ 使用 `https://localhost` 作為默認 origin（適用於 Capacitor App）

### 2. 修復錯誤響應的 CORS headers

**文件**: `supabase/functions/_shared/cors.ts`

**修改前**:
```typescript
export const validateOrigin = (req: Request): Response | null => {
  // ...
  if (origin && !isOriginAllowed(origin)) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: Invalid origin' }), 
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  // ...
};
```

**修改後**:
```typescript
export const validateOrigin = (req: Request): Response | null => {
  // ...
  if (origin && !isOriginAllowed(origin)) {
    // 即使來源無效，也要返回 CORS headers，以便瀏覽器能夠讀取錯誤訊息
    const corsHeaders = getCorsHeaders(origin);
    return new Response(
      JSON.stringify({ error: 'Forbidden: Invalid origin' }), 
      { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
  // ...
};
```

**關鍵改進**:
- ✅ 錯誤響應也包含 CORS headers，確保瀏覽器能夠讀取錯誤訊息

## 📋 測試步驟

1. **重新部署 Edge Function**:
   ```bash
   supabase functions deploy line-auth
   ```

2. **測試 LINE 登入**:
   - 在 App 中點擊 LINE 登入按鈕
   - 確認不再出現 CORS 錯誤
   - 確認能夠成功調用 Edge Function

3. **檢查日誌**:
   - 查看 Edge Function 日誌，確認 OPTIONS 請求被正確處理
   - 確認看到 `[line-auth] CORS preflight request handled immediately` 日誌

## ✅ 預期結果

- ✅ OPTIONS 預檢請求返回 204 狀態碼
- ✅ 所有響應都包含正確的 CORS headers
- ✅ LINE 登入流程能夠正常進行
- ✅ 不再出現 CORS 錯誤

## 🔍 相關文件

- `supabase/functions/line-auth/index.ts` - LINE 登入 Edge Function
- `supabase/functions/_shared/cors.ts` - CORS 共享配置

## 📝 注意事項

1. **環境變數**: 確保 `LINE_REDIRECT_URI` 等環境變數已正確設置
2. **允許的來源**: 確認 `ALLOWED_ORIGINS` 中包含 `https://localhost`（Capacitor App）
3. **部署**: 修復後需要重新部署 Edge Function 才能生效
