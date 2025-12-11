# Edge Functions CORS 錯誤 - 日誌檢查

> **建立日期**：2025-01-29  
> **錯誤**：`It does not have HTTP ok status`  
> **需要檢查**：預檢請求是否到達 Edge Function

---

## 🔍 問題分析

### 錯誤訊息

```
Access to fetch at 'https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/auth?platform=app' 
from origin 'https://localhost' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status.
```

### 可能的原因

1. **預檢請求沒有到達 Edge Function**（被 Supabase 路由層級攔截）
2. **預檢請求到達了 Edge Function，但沒有返回正確的狀態碼**
3. **JWT 驗證在預檢請求之前就檢查了**

---

## 🔧 檢查步驟

### 步驟 1：檢查 Edge Function 日誌

**查看預檢請求是否到達 Edge Function**：

1. **登入 [Supabase Dashboard](https://app.supabase.com/)**

2. **進入 Edge Functions → line-auth → Logs**

3. **查看最近的請求日誌**：
   - 查找 **OPTIONS** 請求
   - 查看是否有預檢請求的記錄
   - 查看請求的狀態碼和回應

4. **如果沒有 OPTIONS 請求的記錄**：
   - 這表示預檢請求沒有到達 Edge Function
   - 可能是 Supabase 在路由層級攔截了預檢請求

5. **如果有 OPTIONS 請求的記錄**：
   - 查看返回的狀態碼（應該是 200）
   - 查看返回的標頭（應該包含 CORS 標頭）

---

### 步驟 2：檢查 JWT 驗證設定

**確認 JWT 驗證是否正確啟用**：

1. **進入 Edge Functions → line-auth**
2. **確認 "Verify JWT with legacy secret" 選項已啟用**（勾選）
3. **進入 Edge Functions → twitter-auth**
4. **確認 "Verify JWT with legacy secret" 選項已啟用**（勾選）

---

### 步驟 3：測試預檢請求

**直接在瀏覽器中測試預檢請求**：

1. **打開瀏覽器開發者工具**（F12）
2. **進入 Console**
3. **執行以下命令**：
   ```javascript
   fetch('https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/auth?platform=app', {
     method: 'OPTIONS',
     headers: {
       'Origin': 'https://localhost',
       'Access-Control-Request-Method': 'GET',
       'Access-Control-Request-Headers': 'authorization, x-client-info, apikey, content-type'
     }
   }).then(r => {
     console.log('Status:', r.status);
     console.log('Headers:', [...r.headers.entries()]);
     return r.text();
   }).then(text => console.log('Body:', text));
   ```

4. **查看回應**：
   - 狀態碼應該是 200
   - 應該包含 `Access-Control-Allow-Origin` 標頭

---

## 🎯 如果預檢請求沒有到達 Edge Function

**這表示 Supabase 在路由層級攔截了預檢請求**，可能需要：

1. **聯繫 Supabase 支持**：
   - 詢問如何允許預檢請求通過
   - 或者是否有其他配置選項

2. **使用替代方案**：
   - 使用 Supabase 的公開 API 端點
   - 或者使用中間層處理 CORS

---

## 📝 需要提供的資訊

請提供以下資訊：

1. **Edge Function 日誌**：
   - 是否有 OPTIONS 請求的記錄？
   - 如果有，返回的狀態碼和標頭是什麼？

2. **瀏覽器測試結果**：
   - 預檢請求的狀態碼
   - 返回的標頭

---

## 🔗 相關文件

- [EdgeFunctions-CORS錯誤-最終解決](./EdgeFunctions-CORS錯誤-最終解決.md)
- [EdgeFunctions-401錯誤-關閉JWT驗證](./EdgeFunctions-401錯誤-關閉JWT驗證.md)

---

**最後更新**：2025-01-29


