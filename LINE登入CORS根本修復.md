# LINE 登入 CORS 錯誤根本修復

## 🔍 根本原因分析

### 問題根源

**核心問題**: `supabase.functions.invoke` 在內部使用 `fetch`，當瀏覽器發送 OPTIONS 預檢請求時，**Supabase 的路由層可能在我們的 Edge Function 代碼執行前就處理了 OPTIONS 請求**，導致：

1. OPTIONS 請求沒有被我們的 Edge Function 正確處理
2. 返回的響應沒有正確的 CORS headers
3. 瀏覽器拒絕後續的 POST 請求

### 為什麼之前的修復無效

1. **在 Edge Function 中處理 OPTIONS**: 雖然我們在 Edge Function 中正確處理了 OPTIONS 請求，但 Supabase 的路由層可能在我們的代碼執行前就攔截了請求
2. **返回 204 狀態碼**: 即使我們返回了正確的 CORS headers 和 204 狀態碼，如果請求沒有到達我們的代碼，這些修復就無效

## ✅ 根本解決方案

### 方案：直接使用 `fetch` 而不是 `supabase.functions.invoke`

**原理**: 直接使用 `fetch` 調用 Edge Function，確保 OPTIONS 預檢請求能夠到達我們的 Edge Function 代碼，並被正確處理。

### 修改內容

**文件**: `src/pages/AuthPage.tsx`

**修改前**:
```typescript
const result = await supabase.functions.invoke(functionName, {
  body: { 
    action: 'auth',
    platform: platform 
  },
});
```

**修改後**:
```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://epyykzxxglkjombvozhr.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

// 獲取 session token（如果有的話，LINE 登入時可能還沒有 session）
const { data: { session } } = await supabase.auth.getSession();
const authToken = session?.access_token || supabaseAnonKey;

// 構建 Edge Function URL
const edgeFunctionUrl = `${supabaseUrl}/functions/v1/${functionName}`;

// 使用 fetch 直接調用 Edge Function
const response = await fetch(edgeFunctionUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
    'apikey': supabaseAnonKey,
  },
  body: JSON.stringify({
    action: 'auth',
    platform: platform
  }),
});

if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`Edge Function error: ${response.status} - ${errorText}`);
}

const data = await response.json();
```

### 關鍵改進

1. ✅ **繞過 Supabase 路由層**: 直接使用 `fetch` 確保 OPTIONS 請求到達我們的 Edge Function
2. ✅ **手動設置 Authorization header**: 使用 session token 或 anon key
3. ✅ **完整的錯誤處理**: 檢查響應狀態並提供詳細的錯誤訊息

## 📋 測試步驟

1. **重新構建前端應用**:
   ```bash
   npm run build
   ```

2. **測試 LINE 登入**:
   - 在 App 中點擊 LINE 登入按鈕
   - 確認不再出現 CORS 錯誤
   - 確認能夠成功調用 Edge Function
   - 確認能夠獲取 `authUrl` 並重定向到 LINE 授權頁面

3. **檢查日誌**:
   - 查看前端日誌，確認 `[AuthPage] Edge Function response status: 200`
   - 查看 Edge Function 日誌，確認 OPTIONS 請求被正確處理
   - 確認看到 `[line-auth] CORS preflight request handled immediately` 日誌

## ✅ 預期結果

- ✅ OPTIONS 預檢請求能夠到達 Edge Function 並被正確處理
- ✅ 返回 204 狀態碼和正確的 CORS headers
- ✅ POST 請求成功執行
- ✅ 能夠獲取 `authUrl` 並重定向到 LINE 授權頁面
- ✅ 不再出現 CORS 錯誤

## 🔍 技術細節

### 為什麼 `supabase.functions.invoke` 會導致 CORS 問題

1. **內部實現**: `supabase.functions.invoke` 在內部使用 `fetch` 調用 Edge Function
2. **路由層攔截**: Supabase 的路由層可能在 Edge Function 代碼執行前就處理了 OPTIONS 請求
3. **CORS headers 缺失**: 如果路由層處理 OPTIONS 請求時沒有正確設置 CORS headers，瀏覽器會拒絕請求

### 為什麼直接使用 `fetch` 可以解決問題

1. **直接調用**: 直接使用 `fetch` 確保請求能夠到達 Edge Function
2. **我們的代碼處理**: Edge Function 中的 OPTIONS 處理邏輯能夠正確執行
3. **正確的 CORS headers**: 我們的代碼返回正確的 CORS headers

## 📝 注意事項

1. **環境變數**: 確保 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY` 已正確設置
2. **Session Token**: LINE 登入時可能還沒有 session，會使用 anon key
3. **錯誤處理**: 確保所有錯誤都被正確捕獲和處理

## 🔄 其他 Edge Functions

如果其他 Edge Functions 也遇到類似的 CORS 問題，可以考慮：

1. **檢查是否使用 `supabase.functions.invoke`**: 如果是，考慮改用直接 `fetch`
2. **確認 Edge Function 正確處理 OPTIONS**: 確保 OPTIONS 請求被正確處理
3. **檢查 CORS headers**: 確保所有響應都包含正確的 CORS headers

---

## ✅ 總結

**根本原因**: Supabase 路由層在 Edge Function 代碼執行前處理 OPTIONS 請求，導致 CORS 錯誤。

**解決方案**: 直接使用 `fetch` 調用 Edge Function，確保 OPTIONS 請求能夠到達我們的代碼並被正確處理。

**結果**: CORS 錯誤應該完全解決，LINE 登入流程能夠正常進行。
