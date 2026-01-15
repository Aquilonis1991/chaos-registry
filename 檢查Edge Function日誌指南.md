# 檢查 Edge Function 日誌指南

## 🔍 問題

LINE 登入仍然出現 CORS 錯誤，需要檢查 Edge Function 日誌來診斷問題。

## 📋 檢查步驟

### 1. 登入 Supabase Dashboard

1. 前往 https://supabase.com/dashboard
2. 選擇 VoteChaos 專案（epyykzxxglkjombvozhr）

### 2. 查看 Edge Function 日誌

1. 點擊左側選單的 **Edge Functions**
2. 找到 `line-auth` 函數
3. 點擊 **Logs** 或 **Invocations** 標籤
4. 查看最近的請求日誌

### 3. 尋找關鍵資訊

在日誌中尋找：

#### OPTIONS 請求日誌
- 查看是否有 OPTIONS 請求的日誌
- 檢查狀態碼（應該是 200，不是 503）
- 查看是否有 `[line-auth] CORS preflight request handled immediately` 日誌

#### 錯誤訊息
- 🔴 紅色的錯誤訊息
- ⚠️ Stack trace（錯誤堆疊）
- 📝 具體的錯誤原因

#### 常見錯誤
- `BOOT_ERROR` - Edge Function 啟動失敗
- `503 Service Unavailable` - Edge Function 無法啟動
- `SyntaxError` - 語法錯誤
- `ImportError` - 導入錯誤

### 4. 檢查特定時間的請求

根據錯誤時間（2026-01-15 17:37:48），查找該時間段的日誌：
- 查找 OPTIONS 請求
- 檢查返回的狀態碼
- 查看是否有錯誤訊息

## 🔧 如果看到 503 錯誤

如果日誌顯示 OPTIONS 請求返回 503，這表示 Edge Function 沒有正常啟動。可能的原因：

1. **語法錯誤**：檢查代碼是否有語法錯誤
2. **導入錯誤**：檢查導入的模組是否存在
3. **環境變數缺失**：檢查環境變數是否正確設置
4. **運行時錯誤**：檢查是否有運行時錯誤

## 🔧 如果沒有看到 OPTIONS 請求日誌

如果日誌中完全沒有 OPTIONS 請求的記錄，這表示：
- OPTIONS 請求可能被 Supabase 路由層攔截
- 或者請求沒有到達 Edge Function

## 📝 需要提供的資訊

請提供以下資訊：

1. **OPTIONS 請求的狀態碼**：是 200、503 還是其他？
2. **是否有日誌輸出**：是否看到 `[line-auth] CORS preflight request handled immediately`？
3. **錯誤訊息**：如果有錯誤，具體的錯誤訊息是什麼？
4. **請求時間**：OPTIONS 請求的具體時間

這些資訊將幫助我們診斷問題的根本原因。
