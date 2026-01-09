# Edge Functions 401 錯誤 - 檢查清單

> **建立日期**：2025-01-29  
> **狀態**：已確認 API 設定中沒有相關選項

---

## ✅ 已完成的檢查

1. **API 設定**：
   - ✅ 已檢查 Settings → API
   - ❌ 沒有 "Require JWT for Edge Functions" 選項
   - ❌ 只有 API Keys 設定

2. **Edge Function 設定**：
   - ✅ 已關閉 "Verify JWT with legacy secret"
   - ❓ 需要檢查是否有其他選項

3. **代碼修改**：
   - ✅ 已將 `serve` 改為 `Deno.serve`
   - ✅ 已重新部署 Edge Functions

---

## 🔍 需要檢查的項目

### 1. Edge Functions 設定頁面

請檢查 Edge Functions 的設定頁面，查看是否有以下選項：

1. **進入 Edge Functions → line-auth**
2. **點擊函數名稱進入詳細頁面**
3. **查看設定選項**：
   - [ ] **"Public Endpoint"** 或 **"Allow Public Access"**
   - [ ] **"Skip JWT Verification"** 或 **"Bypass JWT"**
   - [ ] **"Require Authentication"**（應該關閉）
   - [ ] 其他相關選項

4. **截圖設定頁面**，特別是：
   - 所有可用的選項
   - 當前選項的狀態

---

### 2. Supabase 專案設定

請檢查以下設定：

1. **Settings → General**：
   - 查看是否有與 Edge Functions 相關的設定

2. **Settings → Edge Functions**：
   - 查看是否有全域設定
   - 查看是否有 "Default JWT Verification" 選項

---

## 🎯 如果沒有找到相關選項

### 建議：聯繫 Supabase 支持

**如果 Edge Functions 設定頁面沒有其他選項，建議聯繫 Supabase 支持**：

1. **進入 [Supabase Support](https://supabase.com/support)**

2. **提供以下資訊**：

   **問題描述**：
   ```
   我在使用 Supabase Edge Functions 處理 OAuth 回調時遇到 401 錯誤。
   
   問題：
   - OAuth 回調請求來自外部服務器（LINE/X），不會包含 Supabase 的 JWT
   - 即使關閉了 "Verify JWT with legacy secret" 選項，仍然返回 401 錯誤
   - 錯誤訊息：{"code":401,"message":"缺少授權標頭"}
   ```

   **已嘗試的解決方案**：
   ```
   1. 關閉 "Verify JWT with legacy secret" 選項
   2. 使用 Deno.serve 而不是 serve
   3. 重新部署 Edge Functions
   4. 檢查 Settings → API（沒有相關選項）
   5. 檢查 Settings → Edge Functions（沒有全域設定）
   ```

   **請求 URL**：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback?code=...&state=...
   ```

   **詢問**：
   ```
   如何允許 OAuth 回調請求（沒有 JWT）訪問 Edge Functions？
   是否有專案級設定需要調整？
   是否有其他方法處理 OAuth 回調？
   ```

---

## 📝 需要提供的資訊

請提供以下資訊：

1. **Edge Functions 設定頁面截圖**：
   - `line-auth` 函數的完整設定頁面
   - 所有可用的選項和當前狀態

2. **Settings → Edge Functions 截圖**：
   - 如果有全域設定，請截圖

3. **Supabase 版本資訊**：
   - 專案的 Supabase 版本
   - Edge Functions 的運行時版本

---

## 🔗 相關文件

- [EdgeFunctions-401錯誤-替代解決方案](./EdgeFunctions-401錯誤-替代解決方案.md)
- [EdgeFunctions-401錯誤-最終解決方案](./EdgeFunctions-401錯誤-最終解決方案.md)

---

**最後更新**：2025-01-29





