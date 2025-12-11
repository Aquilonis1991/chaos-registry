# X (Twitter) 登入 - Supabase 錯誤解決

> **建立日期**：2025-01-29  
> **錯誤**：瀏覽器顯示 `https://epyykzxxglkjombvozhr.supabase.co/` 並顯示 `{"error":"請求的路徑無效"}`  
> **分析**：Supabase 在處理 OAuth 請求時拒絕了 `redirect_to` 參數

---

## 🔍 錯誤分析

### 當前狀況

1. ✅ OAuth URL 已成功生成
2. ✅ 瀏覽器已打開
3. ❌ Supabase 返回錯誤：`{"error":"請求的路徑無效"}`
4. ❌ 顯示的 URL：`https://epyykzxxglkjombvozhr.supabase.co/`

### 問題根源

Supabase 在處理 OAuth 請求時，會檢查 `redirect_to` 參數（`votechaos://auth/callback`）是否在允許的列表中。如果不在，就會返回此錯誤。

---

## 🔧 解決方案

### 方案 1：詳細檢查 Supabase URL Configuration（最重要）

**步驟**：

1. **登入 Supabase Dashboard**
2. **進入 Authentication → URL Configuration**
   - 或 **Settings → Authentication → Redirect URLs**

3. **仔細檢查 Redirect URLs 列表**：
   - 確認 `votechaos://auth/callback` **確實存在**
   - 確認**沒有多餘的空格**（前後都不能有空格）
   - 確認**格式完全正確**（沒有多餘的斜線或特殊字元）

4. **如果已存在，嘗試以下操作**：
   - **刪除**現有的 `votechaos://auth/callback`
   - **重新添加**：`votechaos://auth/callback`
   - 確認輸入時沒有多餘空格
   - 點擊 **Save**
   - **等待 30-60 秒**讓設定完全生效

5. **檢查 Site URL**：
   - 確認 **Site URL** 設定
   - 可以是：`https://chaos-registry.vercel.app`
   - 或留空（如果沒有特定要求）

---

### 方案 2：檢查 Supabase Provider 實際啟用狀態

**可能問題**：Provider 看起來已啟用，但實際上未生效

**檢查步驟**：

1. **進入 Authentication → Providers → X (Twitter)**
2. **確認開關狀態**：
   - 開關必須是**綠色**或**開啟**狀態
   - 不能是灰色或關閉狀態

3. **如果開關是關閉的**：
   - 點擊開關啟用
   - 填入 API Key 和 Secret Key
   - 點擊 **Save**
   - 等待 30 秒

4. **如果開關已開啟但仍有問題**：
   - 關閉開關（停用）
   - 等待 10 秒
   - 重新啟用開關
   - 確認憑證正確
   - 點擊 **Save**
   - 等待 30 秒

---

### 方案 3：使用 Web URL 測試（診斷用）

**目的**：確認問題是否特定於 Deep Link

**暫時修改代碼**：

修改 `src/pages/AuthPage.tsx` 中的 `redirectTo`：

```typescript
// 暫時使用 Web URL 而不是 Deep Link
const redirectUrl = isNative() 
  ? `${publicSiteUrl}/auth/callback`  // 暫時改為 Web URL
  : `${publicSiteUrl}/home`;
```

**測試步驟**：

1. 修改代碼
2. 重新建置：`npm run build`
3. 同步到 Android：`npx cap sync android`
4. 測試 Twitter 登入
5. 觀察結果

**結果分析**：

- **如果 Web URL 成功**：
  - 問題可能是 Deep Link 的處理方式
  - 或 Supabase 對 Deep Link 的支援問題
  - 需要檢查 Supabase 版本或設定

- **如果 Web URL 也失敗**：
  - 問題可能是 Supabase Provider 配置
  - 或 X Developer Portal 設定
  - 需要檢查 Provider 和憑證

---

### 方案 4：檢查 Supabase Site URL 設定

**檢查步驟**：

1. **進入 Authentication → URL Configuration**
2. **檢查 Site URL**：
   - 確認 **Site URL** 設定
   - 可以是：`https://chaos-registry.vercel.app`
   - 或留空

3. **如果 Site URL 設定錯誤**：
   - 設定為：`https://chaos-registry.vercel.app`
   - 或留空
   - 點擊 **Save**

---

### 方案 5：查看 Supabase Authentication Logs

**檢查步驟**：

1. **登入 Supabase Dashboard**
2. **進入 Authentication → Logs**
3. **查看最近的認證請求**：
   - 找到 Twitter 相關的請求
   - 查看請求的詳細資訊
   - 查看錯誤訊息和狀態碼

4. **記錄**：
   - 請求時間
   - 請求狀態（成功/失敗）
   - 錯誤訊息
   - 請求參數（特別是 `redirect_to`）

---

## 🎯 優先行動

### 已完成的修改

1. **✅ 添加 Web URL 回調處理**：
   - 創建了 `OAuthCallbackPage.tsx` 來處理 Web URL 回調
   - 添加了 `/auth/callback` 路由
   - 暫時修改 `redirectTo` 使用 Web URL（`${publicSiteUrl}/auth/callback`）而不是 Deep Link

2. **✅ 重新建置和同步**：
   - 已重新建置前端
   - 已同步到 Android 專案

### 立即檢查（按順序）

1. **✅ Supabase URL Configuration**（最重要）
   - 確認 `votechaos://auth/callback` 在列表中
   - **同時確認** `https://chaos-registry.vercel.app/auth/callback` 也在列表中
   - 確認沒有多餘空格
   - 嘗試重新添加

2. **✅ Supabase Provider 狀態**
   - 確認開關真的啟用（綠色）
   - 嘗試重新啟用

3. **✅ 測試 Web URL 回調**（現在可以測試）
   - 現在 `redirectTo` 已改為使用 Web URL
   - 在 Android Studio 中測試 Twitter 登入
   - 觀察是否成功跳轉到 X 授權頁面
   - 觀察回調是否正確處理

4. **✅ 查看 Supabase Logs**
   - 查看實際的錯誤詳情
   - 了解 Supabase 為什麼拒絕請求

---

## 📝 需要確認的資訊

請提供：

1. **Supabase URL Configuration 截圖**：
   - 顯示 Redirect URLs 列表
   - 確認 `votechaos://auth/callback` 的實際顯示格式

2. **Supabase Provider 設定截圖**：
   - 顯示 X Provider 的完整設定頁面
   - 確認開關狀態（啟用/停用）

3. **Supabase Authentication Logs**：
   - 最近的 Twitter 登入請求
   - 錯誤詳情和狀態碼

4. **測試結果**：
   - 使用 Web URL 測試的結果

---

## 🔗 相關文件

- [X 登入設定指南 - 2025 最新版](./X登入設定指南-2025最新版.md)
- [X 登入問題排查步驟](./X登入問題排查步驟.md)
- [X 登入-進階排查](./X登入-進階排查.md)

---

**最後更新**：2025-01-29

