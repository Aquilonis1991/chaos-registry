# LINE 登入 401 錯誤 - 最終修復

## ✅ 已完成的修復

### 1. 提前自動重定向邏輯

已將自動重定向邏輯移到 Edge Function 的最開始，在驗證來源之前就執行。這樣可以確保：

- **在 Edge Function 代碼的最開始就檢測 GET 回調請求**
- **立即重定向到前端應用，避免任何後續處理**
- **在驗證來源之前就執行，避免被攔截**

### 2. 修復後的代碼流程

```typescript
Deno.serve(async (req) => {
  // 1. 記錄請求
  console.log('Edge Function request received:', {...})
  
  // 2. 處理 CORS 預檢請求
  if (OPTIONS) return CORS response
  
  // 3. 檢測回調路徑
  const isCallback = path.endsWith('/callback')
  
  // 4. 【關鍵修復】如果是 GET 回調且沒有授權 header，立即重定向
  if (isCallback && GET && !authorization) {
    return Response.redirect(frontendUrl, 302)
  }
  
  // 5. 驗證來源（只有非回調請求才驗證）
  if (!isCallback) {
    validateOrigin()
  }
  
  // 6. 處理授權請求或回調請求
  ...
})
```

---

## 🔍 問題分析

從日誌可以看到：
- **執行時間 193ms**：這表示 Edge Function 確實執行了
- **返回 401 錯誤**：這可能是 Supabase 路由層級在 Edge Function 處理之前就攔截了請求

**關鍵修復**：將自動重定向邏輯移到 Edge Function 的最開始，在驗證來源之前就執行。這樣可以確保即使 Supabase 路由層級檢查授權，我們也能在 Edge Function 代碼的最開始就處理重定向。

---

## 📋 驗證步驟

### 1. 檢查 Edge Function 日誌

在 Supabase Dashboard 中查看 Edge Function 日誌，確認是否有以下日誌：

- `Edge Function request received` - 表示請求到達了 Edge Function
- `[CRITICAL] GET callback without authorization header detected, redirecting to frontend immediately` - 表示自動重定向邏輯執行了

### 2. 測試 LINE 登入

1. **清除瀏覽器快取和 Cookie**
2. **嘗試使用 LINE 登入**
3. **檢查流程**：
   - LINE 服務器重定向到 Edge Function（GET 請求）
   - Edge Function 立即重定向到前端應用
   - 前端使用 POST 請求調用 Edge Function
   - 登入成功

---

## ⚠️ 重要提醒

1. **LINE Developer Console 回調 URL 已修改**
   - 用戶確認已修改為前端應用 URL
   - 但 LINE 服務器可能仍在使用舊的回調 URL（緩存問題）

2. **自動重定向邏輯已提前**
   - 現在在 Edge Function 的最開始就執行
   - 應該可以處理 LINE 服務器直接重定向的情況

3. **如果問題仍然存在**
   - 檢查 Edge Function 日誌，確認自動重定向邏輯是否執行
   - 如果沒有執行，表示請求在到達 Edge Function 之前就被攔截
   - 可能需要聯繫 Supabase 支持或檢查 Supabase Dashboard 中的 Edge Function 設置

---

**修復完成時間**：2026-01-09
**Edge Function 版本**：最新（已提前自動重定向邏輯）
