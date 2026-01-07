# Edge Functions CORS 錯誤 - 解決方案

> **建立日期**：2025-01-29  
> **錯誤**：`No 'Access-Control-Allow-Origin' header is present on the requested resource`  
> **狀態**：預檢請求沒有返回 CORS 標頭

---

## 🔍 問題分析

### 錯誤訊息

```
Access to fetch at 'https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/auth?platform=app' 
from origin 'https://localhost' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### 問題根源

**預檢請求（OPTIONS）沒有返回 CORS 標頭**，這表示：
1. Supabase 可能在路由層級攔截了預檢請求
2. 或者 Edge Function 沒有正確處理預檢請求

---

## 🔧 解決方案

### 方案 1：重新啟用 JWT 驗證（推薦）

**雖然 OAuth 回調不需要 JWT，但 `/auth` 端點可能需要**：

1. **登入 [Supabase Dashboard](https://app.supabase.com/)**

2. **進入 Edge Functions → line-auth**：
   - 找到 **「Verify JWT with legacy secret」** 選項
   - **啟用它**（勾選）
   - 點擊 **「Save」**

3. **進入 Edge Functions → twitter-auth**：
   - 找到 **「Verify JWT with legacy secret」** 選項
   - **啟用它**（勾選）
   - 點擊 **「Save」**

4. **修改前端代碼**：
   - 在調用 Edge Function 時，添加 `Authorization` 標頭
   - 使用 Supabase 的 `anon` key 作為 JWT

---

### 方案 2：檢查 Supabase 專案設定

**檢查是否有全域的 CORS 設定**：

1. **進入 Settings → API**
2. **查看是否有 CORS 相關設定**
3. **如果有，確保 `https://localhost` 在允許列表中**

---

### 方案 3：修改前端代碼（臨時解決方案）

**在調用 Edge Function 時添加 `Authorization` 標頭**：

```typescript
const { data, error } = await supabase.functions.invoke('line-auth/auth', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${supabase.supabaseKey}` // 使用 anon key
  },
  body: {
    platform: 'app'
  }
});
```

---

## 🎯 優先行動

### 立即操作（按順序）

1. **✅ 重新啟用 JWT 驗證**（最重要）
   - 啟用 `line-auth` 的 JWT 驗證
   - 啟用 `twitter-auth` 的 JWT 驗證

2. **✅ 修改前端代碼**
   - 在調用 Edge Function 時添加 `Authorization` 標頭

3. **✅ 重新測試**

---

## 📝 需要確認的資訊

請提供以下資訊：

1. **Edge Functions 設定**：
   - `line-auth` 的 "Verify JWT with legacy secret" 選項狀態
   - `twitter-auth` 的 "Verify JWT with legacy secret" 選項狀態

2. **前端代碼**：
   - 如何調用 Edge Function？
   - 是否有添加 `Authorization` 標頭？

---

## 🔗 相關文件

- [EdgeFunctions-401錯誤-關閉JWT驗證](./EdgeFunctions-401錯誤-關閉JWT驗證.md)
- [EdgeFunctions-401錯誤-完整解決](./EdgeFunctions-401錯誤-完整解決.md)

---

**最後更新**：2025-01-29




