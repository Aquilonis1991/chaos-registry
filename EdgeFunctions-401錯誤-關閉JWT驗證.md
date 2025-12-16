# Edge Functions 401 錯誤 - 關閉 JWT 驗證

> **建立日期**：2025-01-29  
> **問題**：即使 "Verify JWT with legacy secret" 已啟用，仍然返回 401 錯誤  
> **原因**：OAuth 回調請求來自外部服務器，不會包含 Supabase 的 JWT

---

## 🔍 問題分析

### 發現

- **"Verify JWT with legacy secret"** = **已啟用** ✅
- **LINE 登入** = **仍然失敗（401 錯誤）** ❌
- **Twitter 登入** = **仍然失敗（401 錯誤）** ❌

### 問題根源

**即使啟用了 "Verify JWT with legacy secret"**，Supabase 仍然在路由層級檢查授權標頭。

**OAuth 回調請求來自外部服務器（LINE 和 X）**，不會包含 Supabase 的 JWT，因此被拒絕。

---

## 🔧 解決方案

### 方案 1：關閉 JWT 驗證（推薦）

**OAuth 回調請求不需要 JWT 驗證**，因為：
1. 回調請求來自外部服務器（LINE/X），不是用戶的瀏覽器
2. 回調請求已經通過 OAuth 提供商的驗證
3. Edge Function 內部會進行自己的安全檢查

**詳細步驟**：

1. **登入 [Supabase Dashboard](https://app.supabase.com/)**

2. **進入 Edge Functions**：
   - 左側選單 → **Edge Functions**

3. **關閉 `line-auth` 函數的 JWT 驗證**：
   - 在函數列表中，找到 `line-auth`
   - **點擊函數名稱**進入詳細頁面
   - 找到 **「Verify JWT with legacy secret」** 選項
   - **取消勾選**此選項（關閉）
   - 點擊 **「Save」** 或 **「Update」**

4. **關閉 `twitter-auth` 函數的 JWT 驗證**：
   - 在函數列表中，找到 `twitter-auth`
   - **點擊函數名稱**進入詳細頁面
   - 找到 **「Verify JWT with legacy secret」** 選項
   - **取消勾選**此選項（關閉）
   - 點擊 **「Save」** 或 **「Update」**

5. **等待 30-60 秒**讓設定生效

---

### 方案 2：檢查 Supabase 專案的全域設定

**檢查 Edge Functions 的全域設定**：

1. **進入 Settings → Edge Functions**

2. **檢查全域設定**：
   - 查看是否有 **「Require JWT for all functions」** 的選項
   - 如果有，確認是否啟用
   - 如果啟用，**關閉**它

---

### 方案 3：重新部署 Edge Functions

**如果設定都正確，嘗試重新部署**：

```bash
cd votechaos-main
npx supabase functions deploy line-auth
npx supabase functions deploy twitter-auth
```

---

## 🎯 優先行動

### 立即操作（按順序）

1. **✅ 關閉 JWT 驗證**（最重要）
   - 關閉 `line-auth` 函數的 JWT 驗證
   - 關閉 `twitter-auth` 函數的 JWT 驗證

2. **✅ 等待 30-60 秒**讓設定生效

3. **✅ 重新測試**：
   - 完全關閉並重新開啟應用程式（清除快取）
   - 測試 LINE 登入
   - 測試 Twitter 登入

---

## 📝 安全性說明

**關閉 JWT 驗證是安全的**，因為：

1. **Edge Function 內部有安全檢查**：
   - 驗證 `state` 參數（防止 CSRF 攻擊）
   - 驗證 `code` 參數（OAuth 授權碼）
   - 驗證來源（CORS 檢查）

2. **OAuth 回調已經通過提供商的驗證**：
   - LINE 和 X 已經驗證了用戶身份
   - 回調請求包含有效的授權碼

3. **Edge Function 使用 SERVICE_ROLE_KEY**：
   - 內部操作使用服務角色密鑰
   - 不會暴露給外部請求

---

## 🔗 相關文件

- [EdgeFunctions-401錯誤-完整解決](./EdgeFunctions-401錯誤-完整解決.md)
- [X 登入-401錯誤-啟用JWT驗證](./X登入-401錯誤-啟用JWT驗證.md)

---

**最後更新**：2025-01-29



