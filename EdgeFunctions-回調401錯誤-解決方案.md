# Edge Functions 回調 401 錯誤 - 解決方案

> **建立日期**：2025-01-29  
> **問題**：啟用 JWT 驗證後，OAuth 回調請求返回 401 錯誤  
> **原因**：OAuth 回調請求來自外部服務器，不會包含 JWT

---

## 🔍 問題分析

### 錯誤訊息

```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback?code=...&state=...
{"code":401,"message":"缺少授權標頭"}
```

### 問題根源

**啟用 JWT 驗證後**：
- ✅ `/auth` 端點可以正常工作（因為 `supabase.functions.invoke` 會自動添加 JWT）
- ❌ `/callback` 端點失敗（因為 OAuth 回調請求來自外部服務器，不會有 JWT）

---

## 🔧 解決方案

### 方案 1：關閉 JWT 驗證（推薦）

**雖然 `/auth` 端點需要 JWT，但我們可以在前端手動添加**：

1. **登入 [Supabase Dashboard](https://app.supabase.com/)**

2. **進入 Edge Functions → line-auth**：
   - 找到 **「Verify JWT with legacy secret」** 選項
   - **關閉它**（取消勾選）
   - 點擊 **「Save」**

3. **進入 Edge Functions → twitter-auth**：
   - 找到 **「Verify JWT with legacy secret」** 選項
   - **關閉它**（取消勾選）
   - 點擊 **「Save」**

4. **修改前端代碼**：
   - 在調用 Edge Function 時，手動添加 `Authorization` 標頭
   - 使用 Supabase 的 `anon` key 作為 JWT

---

### 方案 2：修改前端代碼添加 Authorization 標頭

**如果保持 JWT 驗證啟用，需要修改前端代碼**：

```typescript
const handleLineLogin = async () => {
  try {
    const platform = isNative() ? 'app' : 'web'
    
    // 獲取 Supabase anon key
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    
    // 手動添加 Authorization 標頭
    const { data, error } = await supabase.functions.invoke(`line-auth/auth?platform=${platform}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${anonKey}`
      }
    })
    
    // ... 其餘代碼
  } catch (error) {
    // ... 錯誤處理
  }
}
```

---

## 🎯 推薦方案

**建議使用方案 1（關閉 JWT 驗證）**，因為：
1. 更簡單，不需要修改前端代碼
2. OAuth 回調請求不需要 JWT（已經通過 OAuth 提供商的驗證）
3. Edge Function 內部有安全檢查（驗證 `state`、`code`、CORS）

---

## 📝 需要確認的資訊

請提供以下資訊：

1. **Edge Functions 設定**：
   - `line-auth` 的 "Verify JWT with legacy secret" 選項狀態
   - `twitter-auth` 的 "Verify JWT with legacy secret" 選項狀態

2. **測試結果**：
   - 關閉 JWT 驗證後，LINE 登入是否成功？
   - Twitter 登入是否成功？

---

## 🔗 相關文件

- [EdgeFunctions-401錯誤-關閉JWT驗證](./EdgeFunctions-401錯誤-關閉JWT驗證.md)
- [EdgeFunctions-CORS錯誤-最終解決](./EdgeFunctions-CORS錯誤-最終解決.md)

---

**最後更新**：2025-01-29



