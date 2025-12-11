# Edge Functions 401 錯誤 - 替代解決方案

> **建立日期**：2025-01-29  
> **問題**：Supabase 路由層級強制要求 JWT，無法通過設定關閉  
> **解決方案**：在 Edge Function 中添加公開端點處理邏輯

---

## 🔍 問題分析

### 發現

- **API 設定**：沒有 "Require JWT for Edge Functions" 選項
- **Edge Function 設定**：已關閉 JWT 驗證，但仍然返回 401
- **代碼修改**：已使用 `Deno.serve`，但仍然返回 401

### 問題根源

**Supabase 在路由層級強制檢查授權標頭**，即使 Edge Function 本身不要求。這可能是 Supabase 的平台限制。

---

## 🔧 替代解決方案

### 方案 1：在 Edge Function 中處理 OPTIONS 請求（已實現）

**當前代碼已經處理了 OPTIONS 請求**，但可能還需要處理其他情況。

### 方案 2：使用 Supabase 的公開端點功能（如果可用）

**檢查 Supabase 是否有公開端點功能**：

1. **進入 Edge Functions → line-auth**
2. **查看是否有 "Public Endpoint" 或 "Allow Public Access" 選項**
3. **如果有，啟用它**

### 方案 3：聯繫 Supabase 支持（推薦）

**如果以上方法都無效，建議聯繫 Supabase 支持**：

1. **進入 [Supabase Support](https://supabase.com/support)**

2. **提供以下資訊**：
   - **問題描述**：
     ```
     我在使用 Supabase Edge Functions 處理 OAuth 回調時遇到 401 錯誤。
     OAuth 回調請求來自外部服務器（LINE/X），不會包含 Supabase 的 JWT。
     即使關閉了 "Verify JWT with legacy secret" 選項，仍然返回 401 錯誤。
     ```
   
   - **已嘗試的解決方案**：
     - 關閉 "Verify JWT with legacy secret" 選項
     - 使用 `Deno.serve` 而不是 `serve`
     - 重新部署 Edge Functions
     - 檢查 Settings → API 和 Settings → Edge Functions
   
   - **錯誤訊息**：
     ```
     {"code":401,"message":"缺少授權標頭"}
     ```
   
   - **請求 URL**：
     ```
     https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback?code=...&state=...
     ```
   
   - **詢問**：
     - 如何允許 OAuth 回調請求（沒有 JWT）訪問 Edge Functions？
     - 是否有專案級設定需要調整？
     - 是否有其他方法處理 OAuth 回調？

---

### 方案 4：使用中間層（臨時解決方案）

**如果無法解決，可以考慮使用中間層**：

1. **建立一個公開的 API 端點**（不在 Supabase 上，例如 Vercel、Netlify）
2. **處理 OAuth 回調**
3. **調用 Supabase Edge Function**（帶有 JWT）

**優點**：
- 可以完全控制授權邏輯
- 不依賴 Supabase 的 JWT 驗證

**缺點**：
- 需要額外的基礎設施
- 增加複雜度

---

## 🎯 立即行動

### 步驟 1：檢查 Edge Functions 設定

1. **進入 Edge Functions → line-auth**
2. **查看是否有 "Public Endpoint" 或 "Allow Public Access" 選項**
3. **如果有，啟用它**

### 步驟 2：如果仍然失敗

1. **聯繫 Supabase 支持**
2. **提供詳細的問題描述和已嘗試的解決方案**

---

## 📝 需要確認的資訊

請提供以下資訊：

1. **Edge Functions 設定截圖**：
   - `line-auth` 函數的完整設定頁面截圖
   - `twitter-auth` 函數的完整設定頁面截圖
   - 特別注意是否有 "Public Endpoint" 或類似選項

2. **Supabase 版本資訊**：
   - 專案的 Supabase 版本
   - Edge Functions 的運行時版本

---

## 🔗 相關文件

- [EdgeFunctions-401錯誤-最終解決方案](./EdgeFunctions-401錯誤-最終解決方案.md)
- [EdgeFunctions-401錯誤-關閉JWT驗證](./EdgeFunctions-401錯誤-關閉JWT驗證.md)

---

**最後更新**：2025-01-29


