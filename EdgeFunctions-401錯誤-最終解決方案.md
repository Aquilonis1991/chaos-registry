# Edge Functions 401 錯誤 - 最終解決方案

> **建立日期**：2025-01-29  
> **問題**：即使關閉 JWT 驗證並使用 `Deno.serve`，仍然返回 401 錯誤  
> **狀態**：需要檢查 Supabase 專案設定或聯繫支持

---

## 🔍 問題分析

### 已嘗試的解決方案

1. ✅ **關閉 "Verify JWT with legacy secret"** - 無效
2. ✅ **將 `serve` 改為 `Deno.serve`** - 無效
3. ✅ **重新部署 Edge Functions** - 無效

### 問題根源

**Supabase 在路由層級強制要求授權標頭**，即使：
- JWT 驗證已關閉
- 使用 `Deno.serve` 而不是 `serve`

這可能是 Supabase 的專案級設定或平台限制。

---

## 🔧 可能的解決方案

### 方案 1：檢查 Supabase 專案設定

**檢查專案級設定**：

1. **登入 [Supabase Dashboard](https://app.supabase.com/)**

2. **進入 Settings → API**：
   - 檢查是否有 **「Require JWT for Edge Functions」** 的選項
   - 如果有，**關閉**它

3. **進入 Settings → Edge Functions**：
   - 檢查是否有全域的 JWT 驗證設定
   - 如果有，**關閉**它

---

### 方案 2：聯繫 Supabase 支持

**如果以上方法都無效，可能需要聯繫 Supabase 支持**：

1. **進入 [Supabase Support](https://supabase.com/support)**

2. **提供以下資訊**：
   - 問題描述：OAuth 回調請求返回 401 錯誤
   - 已嘗試的解決方案：
     - 關閉 JWT 驗證
     - 使用 `Deno.serve` 而不是 `serve`
     - 重新部署 Edge Functions
   - 錯誤訊息：`{"code":401,"message":"缺少授權標頭"}`
   - 請求 URL：`https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback?code=...&state=...`

3. **詢問**：
   - 如何允許 OAuth 回調請求（沒有 JWT）訪問 Edge Functions？
   - 是否有專案級設定需要調整？

---

### 方案 3：使用替代方案（臨時解決方案）

**如果無法解決，可以考慮使用替代方案**：

1. **使用 Webhook**：
   - 讓 OAuth 提供商回調到一個公開的 Webhook URL
   - Webhook 處理回調，然後調用 Edge Function（帶有 JWT）

2. **使用中間層**：
   - 建立一個公開的 API 端點（不在 Supabase 上）
   - 處理 OAuth 回調，然後調用 Supabase Edge Function

---

## 🎯 立即行動

### 步驟 1：檢查 Supabase 專案設定

1. **進入 Settings → API**
2. **進入 Settings → Edge Functions**
3. **檢查是否有全域的 JWT 驗證設定**
4. **如果有，關閉它**

### 步驟 2：如果仍然失敗

1. **聯繫 Supabase 支持**
2. **提供詳細的問題描述和已嘗試的解決方案**

---

## 📝 需要確認的資訊

請提供以下資訊：

1. **Supabase 專案設定截圖**：
   - Settings → API 的截圖
   - Settings → Edge Functions 的截圖

2. **Edge Function 設定截圖**：
   - `line-auth` 函數的設定頁面截圖
   - `twitter-auth` 函數的設定頁面截圖

3. **Supabase 版本資訊**：
   - 專案的 Supabase 版本
   - Edge Functions 的運行時版本

---

## 🔗 相關文件

- [EdgeFunctions-401錯誤-關閉JWT驗證](./EdgeFunctions-401錯誤-關閉JWT驗證.md)
- [EdgeFunctions-401錯誤-完整解決](./EdgeFunctions-401錯誤-完整解決.md)

---

**最後更新**：2025-01-29


