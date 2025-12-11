# Edge Functions CORS 錯誤 - 最終解決方案

> **建立日期**：2025-01-29  
> **錯誤**：`No 'Access-Control-Allow-Origin' header is present on the requested resource`  
> **原因**：預檢請求沒有返回 CORS 標頭

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
2. 即使 Edge Function 代碼正確，預檢請求可能沒有到達 Edge Function

---

## 🔧 解決方案

### 方案 1：重新啟用 JWT 驗證（推薦）

**`supabase.functions.invoke` 會自動添加 Authorization 標頭**，所以啟用 JWT 驗證是安全的：

1. **登入 [Supabase Dashboard](https://app.supabase.com/)**

2. **進入 Edge Functions → line-auth**：
   - 找到 **「Verify JWT with legacy secret」** 選項
   - **啟用它**（勾選）
   - 點擊 **「Save」**

3. **進入 Edge Functions → twitter-auth**：
   - 找到 **「Verify JWT with legacy secret」** 選項
   - **啟用它**（勾選）
   - 點擊 **「Save」**

4. **等待 30-60 秒**讓設定生效

5. **重新測試**：
   - 完全關閉並重新開啟應用程式（清除快取）
   - 測試 LINE 登入
   - 測試 Twitter 登入

---

### 方案 2：檢查 Supabase 專案設定

**檢查是否有全域的 CORS 設定**：

1. **進入 Settings → API**
2. **查看是否有 CORS 相關設定**
3. **如果有，確保 `https://localhost` 在允許列表中**

---

## 🎯 為什麼啟用 JWT 驗證是安全的

**`supabase.functions.invoke` 會自動添加 Authorization 標頭**：

- 前端使用 `supabase.functions.invoke` 時，Supabase 客戶端會自動添加 `Authorization: Bearer <anon_key>` 標頭
- 這意味著即使啟用 JWT 驗證，來自前端的請求也會通過
- OAuth 回調請求（來自外部服務器）仍然不需要 JWT，因為它們直接訪問 `/callback` 端點

---

## 📝 需要確認的資訊

請提供以下資訊：

1. **Edge Functions 設定**：
   - `line-auth` 的 "Verify JWT with legacy secret" 選項狀態
   - `twitter-auth` 的 "Verify JWT with legacy secret" 選項狀態

2. **測試結果**：
   - 重新啟用 JWT 驗證後，LINE 登入是否成功？
   - Twitter 登入是否成功？

---

## 🔗 相關文件

- [EdgeFunctions-CORS錯誤-解決方案](./EdgeFunctions-CORS錯誤-解決方案.md)
- [EdgeFunctions-401錯誤-關閉JWT驗證](./EdgeFunctions-401錯誤-關閉JWT驗證.md)

---

**最後更新**：2025-01-29


