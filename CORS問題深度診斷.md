# CORS 問題深度診斷指南

## 🔍 當前問題

即使已經修復了 OPTIONS 請求處理，CORS 錯誤仍然存在：
- 錯誤訊息：`Response to preflight request doesn't pass access control check: It does not have HTTP ok status.`
- 這表示 OPTIONS 請求可能返回了非 200 狀態碼（如 503）

## 📋 診斷步驟

### 1. 檢查 Supabase Dashboard 日誌（最重要）

**步驟**：
1. 登入 https://supabase.com/dashboard
2. 選擇項目：epyykzxxglkjombvozhr
3. 前往 **Edge Functions** → **line-auth** → **Logs**
4. 查找最近的 OPTIONS 請求（時間：2026-01-15 18:05:48 左右）

**需要確認**：
- ✅ 是否有 `[line-auth] Request received:` 日誌？
- ✅ 是否有 `[line-auth] OPTIONS request detected, handling immediately` 日誌？
- ✅ 是否有 `[line-auth] CORS preflight request handled immediately` 日誌？
- ✅ 狀態碼是什麼？（應該是 200，如果是 503 則表示 Edge Function 啟動失敗）

**如果沒有看到任何日誌**：
- 這表示 OPTIONS 請求沒有到達我們的代碼
- 可能被 Supabase 路由層攔截了

**如果看到 503 錯誤**：
- 這表示 Edge Function 啟動失敗
- 需要檢查是否有語法錯誤、導入錯誤或環境變數問題

### 2. 使用 curl 測試 OPTIONS 請求

在 PowerShell 中執行：

```powershell
curl -X OPTIONS `
  -H "Origin: https://localhost" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: authorization,content-type" `
  -v `
  https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth
```

**預期結果**：
- 狀態碼：200
- 響應體：`ok`
- Headers 包含：`Access-Control-Allow-Origin: https://localhost`

**如果返回 503**：
- Edge Function 啟動失敗
- 需要檢查 Supabase Dashboard 日誌中的錯誤訊息

### 3. 檢查環境變數

**步驟**：
1. Supabase Dashboard → Edge Functions → line-auth → Settings → Secrets
2. 確認以下環境變數已設置：
   - `LINE_CHANNEL_ID`
   - `LINE_CHANNEL_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SERVICE_ROLE_KEY`
   - `LINE_REDIRECT_URI`
   - `FRONTEND_URL`
   - `FRONTEND_DEEP_LINK`

### 4. 檢查 Edge Function 部署狀態

**步驟**：
1. Supabase Dashboard → Edge Functions → line-auth
2. 檢查部署狀態是否為 "Active"
3. 查看最近的部署時間

## 🔧 可能的根本原因

### 原因 1：Edge Function 啟動失敗（503）

**症狀**：
- OPTIONS 請求返回 503
- Supabase Dashboard 日誌顯示 BOOT_ERROR 或其他啟動錯誤

**可能的原因**：
- 語法錯誤
- 導入錯誤
- 環境變數缺失（但我們已經修復了這個問題）
- 模組載入時執行的代碼導致錯誤

**解決方案**：
- 檢查 Supabase Dashboard 日誌中的錯誤訊息
- 確認所有導入的模組都存在
- 確認環境變數已正確設置

### 原因 2：Supabase 路由層攔截

**症狀**：
- OPTIONS 請求沒有到達我們的代碼（沒有日誌）
- 直接返回錯誤響應

**可能的原因**：
- Supabase 路由層在我們的代碼執行前就處理了 OPTIONS 請求
- `verify_jwt = false` 設置可能不夠

**解決方案**：
- 聯繫 Supabase 支援
- 或使用其他 OAuth 流程（如 PKCE）

### 原因 3：瀏覽器緩存

**症狀**：
- 即使修復了代碼，錯誤仍然存在
- 使用無痕模式測試則正常

**解決方案**：
- 清除瀏覽器緩存
- 使用無痕模式測試
- 重新安裝 App（清除 App 緩存）

## 📝 需要提供的信息

請提供以下信息以進一步診斷：

1. **Supabase Dashboard 日誌**：
   - 是否有 `[line-auth] Request received:` 日誌？
   - 是否有 `[line-auth] OPTIONS request detected` 日誌？
   - 狀態碼是什麼？

2. **curl 測試結果**：
   - 使用上述 curl 命令測試的結果
   - 狀態碼和響應頭

3. **環境變數確認**：
   - 所有環境變數是否已正確設置？

4. **部署狀態**：
   - Edge Function 是否為 "Active" 狀態？

---

## ✅ 當前狀態

- ✅ 前端代碼已修復（使用直接 fetch）
- ✅ Edge Function 代碼已修復（返回 'ok' 字符串，添加診斷日誌）
- ✅ OPTIONS 請求處理已優化
- ⚠️ **需要檢查 Supabase Dashboard 日誌來確認問題的根本原因**

**下一步**：請檢查 Supabase Dashboard 中的 Edge Function 日誌，確認 OPTIONS 請求是否到達我們的代碼，以及返回的狀態碼是什麼。
