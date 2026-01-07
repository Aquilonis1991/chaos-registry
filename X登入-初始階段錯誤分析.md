# X (Twitter) 登入 - 初始階段錯誤分析

> **建立日期**：2025-01-29  
> **狀態**：點擊按鈕後立即出現錯誤，錯誤 URL 是 Supabase 根路徑

---

## 🔍 問題分析

### 錯誤特徵

1. ✅ **X Developer Portal Callback URI 正確**：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
2. ✅ **Supabase Redirect URLs 已添加**：
   - `votechaos://auth/callback`
   - `https://chaos-registry.vercel.app/auth/callback`
3. ❌ **點擊按鈕後立即出現錯誤**：`{"error":"請求的路徑無效"}`
4. ❌ **錯誤 URL**：`https://epyykzxxglkjombvozhr.supabase.co/`

### 問題根源

錯誤發生在 **Supabase 處理 OAuth 請求的初始階段**，而不是 Twitter 回調階段。

**可能的原因**：

1. **Supabase Site URL 設定問題**：
   - Supabase 需要設定 Site URL 來驗證請求來源
   - 如果 Site URL 不正確，Supabase 可能會拒絕請求

2. **`redirect_to` 參數驗證問題**：
   - 雖然 URL 已添加到 Redirect URLs 列表
   - 但 Supabase 可能在驗證時發現格式不匹配

3. **Provider 配置問題**：
   - X Provider 可能未正確啟用
   - 或憑證有問題

---

## 🔧 解決方案

### 方案 1：檢查 Supabase Site URL（最重要）

**檢查步驟**：

1. **登入 [Supabase Dashboard](https://app.supabase.com/)**
2. **進入 Settings → Authentication**
3. **找到「Site URL」設定**：
   - 應該設定為：`https://chaos-registry.vercel.app`
   - 或留空（如果沒有特定要求）

4. **如果 Site URL 不正確**：
   - 修改為：`https://chaos-registry.vercel.app`
   - 點擊 **「Save」**
   - 等待 30-60 秒

5. **檢查「Additional Redirect URLs」**：
   - 確認 `https://chaos-registry.vercel.app/auth/callback` 在列表中
   - 確認 `votechaos://auth/callback` 在列表中

---

### 方案 2：檢查 Supabase Provider 實際狀態

**詳細檢查**：

1. **進入 Authentication → Providers → X (Twitter)**

2. **確認開關狀態**：
   - 開關必須是**綠色**（啟用）
   - 不能是灰色（停用）

3. **確認憑證**：
   - API Key：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
   - API Secret Key：已正確填入（不顯示）

4. **如果開關未啟用或憑證有問題**：
   - 關閉開關（停用）
   - 等待 10 秒
   - 重新啟用開關
   - 重新輸入憑證：
     - API Key：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
     - API Secret Key：`rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG`
   - 點擊 **「Save」**
   - 等待 30-60 秒

---

### 方案 3：檢查 Redirect URLs 格式

**確認格式完全正確**：

1. **進入 Authentication → URL Configuration**

2. **檢查每個 URL 的格式**：

   ✅ **正確格式**：
   - `votechaos://auth/callback`
   - `https://chaos-registry.vercel.app/auth/callback`

   ❌ **錯誤格式**：
   - `votechaos://auth/callback/`（結尾多了一個斜線）
   - `https://chaos-registry.vercel.app/auth/callback/`（結尾多了一個斜線）
   - `https://chaos-registry.vercel.app/auth/callback `（結尾有空格）
   - `chaos-registry.vercel.app/auth/callback`（缺少 `https://`）

3. **如果格式不正確**：
   - 刪除錯誤的 URL
   - 重新添加正確格式的 URL
   - 點擊 **「Save」**
   - 等待 30-60 秒

---

### 方案 4：嘗試使用不同的 redirectTo

**臨時測試**：使用 Supabase 的預設回調 URL

修改 `src/pages/AuthPage.tsx`：

```typescript
// 暫時使用 Supabase 的預設回調 URL（不指定 redirectTo）
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'twitter',
  // 不指定 options.redirectTo，讓 Supabase 使用預設值
});
```

**測試步驟**：

1. 修改代碼
2. 重新建置：`npm run build`
3. 同步到 Android：`npx cap sync android`
4. 測試 Twitter 登入
5. 觀察是否成功

**如果成功**：
- 問題可能是 `redirectTo` 參數的驗證
- 需要檢查 Supabase 的 Redirect URLs 設定

**如果仍然失敗**：
- 問題可能是 Provider 配置
- 需要檢查 Provider 狀態和憑證

---

### 方案 5：查看完整的 Supabase 錯誤日誌

**檢查詳細錯誤**：

1. **登入 Supabase Dashboard**
2. **進入 Authentication → Logs**
3. **查看最近的 Twitter 登入請求**：
   - 找到狀態為 **「error」** 的請求
   - 查看完整的錯誤訊息
   - 查看請求參數（特別是 `redirect_to`）

4. **記錄**：
   - 錯誤訊息
   - 請求參數
   - 時間戳

---

## 🎯 優先行動

### 立即檢查（按順序）

1. **✅ Supabase Site URL**（最重要）
   - 確認設定為：`https://chaos-registry.vercel.app`
   - 或留空

2. **✅ Supabase Provider 狀態**
   - 確認開關真的啟用（綠色）
   - 嘗試重新啟用

3. **✅ Redirect URLs 格式**
   - 確認格式完全正確
   - 沒有多餘空格或斜線

4. **✅ 查看 Supabase Logs**
   - 查看詳細的錯誤訊息
   - 了解 Supabase 為什麼拒絕請求

---

## 📝 需要提供的資訊

請提供以下資訊以進一步診斷：

1. **Supabase Site URL**：
   - 當前設定值：__________

2. **Supabase Provider 狀態**：
   - [ ] 啟用（綠色）
   - [ ] 停用（灰色）
   - 截圖：__________

3. **Supabase Authentication Logs**：
   - 最近的錯誤請求詳情：__________
   - 錯誤訊息：__________

4. **Redirect URLs 列表截圖**：
   - 顯示所有 URL 的完整列表
   - 確認格式

---

## 🔗 相關文件

- [X 登入設定指南 - 2025 最新版](./X登入設定指南-2025最新版.md)
- [X 登入-Supabase錯誤解決](./X登入-Supabase錯誤解決.md)
- [X 登入-回調階段錯誤分析](./X登入-回調階段錯誤分析.md)

---

**最後更新**：2025-01-29




