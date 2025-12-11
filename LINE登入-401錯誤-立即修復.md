# LINE 登入 401 錯誤 - 立即修復

> **建立日期**：2025-12-05  
> **問題**：LINE 回調返回 `{"code":401,"message":"Missing authorization header"}`  
> **原因**：Supabase 路由層級要求 JWT 驗證，但 OAuth 回調請求來自外部服務器

---

## 🔍 問題分析

### 錯誤訊息

```
https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback?code=...
{"code":401,"message":"Missing authorization header"}
```

### 問題根源

**LINE 回調請求來自 LINE 服務器**，不會包含 Supabase 的 JWT，因此被 Supabase 路由層級拒絕。

---

## 🔧 立即修復步驟

### 步驟 1：關閉 JWT 驗證（最重要）

1. **登入 [Supabase Dashboard](https://app.supabase.com/)**

2. **進入 Edge Functions**：
   - 左側選單 → **Edge Functions**
   - 點擊 **`line-auth`** 函數

3. **關閉 JWT 驗證**：
   - 找到 **「Verify JWT with legacy secret」** 選項
   - **取消勾選**（關閉）
   - 點擊 **「Save」** 或 **「Update」**

4. **等待 30-60 秒**讓設定生效

---

### 步驟 2：確認設定已生效

1. **重新整理 Supabase Dashboard 頁面**

2. **確認 JWT 驗證已關閉**：
   - 回到 `line-auth` 函數頁面
   - 確認 **「Verify JWT with legacy secret」** 是 **未勾選**狀態

---

### 步驟 3：重新測試

1. **完全關閉並重新開啟應用程式**（清除快取）

2. **測試 LINE 登入**：
   - 點擊 LINE 登入按鈕
   - 完成 LINE 授權
   - 檢查是否成功登入

---

## 🔍 如果仍然失敗

### 檢查項目

1. **確認 JWT 驗證已關閉**：
   - 回到 Supabase Dashboard
   - 確認 `line-auth` 函數的 JWT 驗證是 **關閉**狀態

2. **檢查 Edge Function 日誌**：
   - Supabase Dashboard → Edge Functions → `line-auth` → Logs
   - 查看是否有新的錯誤訊息

3. **重新部署 Edge Function**（如果需要）：
   ```bash
   cd votechaos-main
   npx supabase functions deploy line-auth
   ```

---

## 📝 安全性說明

**關閉 JWT 驗證是安全的**，因為：

1. **Edge Function 內部有安全檢查**：
   - 驗證 `state` 參數（防止 CSRF 攻擊）
   - 驗證 `code` 參數（OAuth 授權碼）
   - 驗證來源（CORS 檢查）

2. **OAuth 回調已經通過提供商的驗證**：
   - LINE 已經驗證了用戶身份
   - 回調請求包含有效的授權碼

3. **Edge Function 使用 SERVICE_ROLE_KEY**：
   - 內部操作使用服務角色密鑰
   - 不會暴露給外部請求

---

## 🔗 相關文件

- [EdgeFunctions-401錯誤-關閉JWT驗證](./EdgeFunctions-401錯誤-關閉JWT驗證.md)
- [LINE登入-完整實作步驟](./LINE登入-完整實作步驟.md)

---

**最後更新**：2025-12-05


