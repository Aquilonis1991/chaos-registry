# 檢查 Supabase Dashboard 中的 Edge Function 設置

## 問題

CORS 預檢請求仍然失敗，錯誤訊息：
```
Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status.
```

這表示 OPTIONS 請求返回了非 2xx 狀態碼（可能是 401、403、500 等）。

## 可能的原因

Supabase 運行時層級的 JWT 檢查在我們的代碼執行前就執行了，即使：
- `config.toml` 中設置了 `verify_jwt = false`
- 代碼開頭就處理了 OPTIONS 請求

## 解決方案：在 Supabase Dashboard 中手動禁用 JWT 驗證

### 步驟 1：登入 Supabase Dashboard

1. 訪問：https://supabase.com/dashboard
2. 選擇您的專案：`idfqzcsxvuxperxfieam`

### 步驟 2：導航到 Edge Functions

1. 在左側導航欄中，點擊 **Edge Functions**
2. 找到 **line-auth** 函數
3. 點擊 **line-auth** 進入函數詳情頁面

### 步驟 3：檢查並禁用 JWT 驗證

1. 在函數詳情頁面中，找到 **Settings** 或 **Configuration** 選項卡
2. 查找 **"Verify JWT with legacy secret"** 或類似的 JWT 驗證選項
3. 確認該選項已**關閉**（Disabled/Off）
4. 如果它是開啟的，請**關閉它**
5. 點擊 **Save** 保存設置

### 步驟 4：驗證設置

1. 確認設置已保存
2. 重新測試 LINE 登入
3. 檢查是否還有 CORS 錯誤

## 替代方案：檢查 Edge Function 日誌

如果無法在 Dashboard 中找到 JWT 驗證設置，請：

1. 在 Supabase Dashboard 中，導航到 **Edge Functions** > **line-auth** > **Logs**
2. 查找 OPTIONS 請求的日誌
3. 確認返回的狀態碼：
   - 如果是 401：JWT 驗證仍在運行
   - 如果是 204：CORS 處理正常，可能是其他問題
   - 如果是 500：函數內部錯誤

## 如果 Dashboard 中沒有 JWT 驗證設置

某些 Supabase 版本可能沒有 Dashboard 中的 JWT 驗證設置。在這種情況下：

1. **確認 `config.toml` 已正確部署**：
   ```bash
   npx supabase db push
   ```

2. **檢查 Edge Function 日誌**：
   - 查看 OPTIONS 請求是否到達函數
   - 確認函數是否執行到 CORS 處理代碼

3. **嘗試使用 `serve()` 而不是 `Deno.serve()`**：
   - 某些情況下，`serve()` 可能有不同的行為
   - 但這可能會導致其他問題

## 驗證修復

修復後，請測試：

1. 點擊 LINE 登入按鈕
2. 確認不再出現 CORS 錯誤
3. 確認 Edge Function 能正常返回 `authUrl`
4. 確認能正常打開 LINE 授權頁面

## 如果問題仍然存在

如果修復後問題仍然存在，請：

1. 提供 Supabase Dashboard 中的 Edge Function 日誌
2. 特別是 OPTIONS 請求的日誌
3. 確認返回的狀態碼和錯誤訊息
