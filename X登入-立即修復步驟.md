# X (Twitter) 登入 - 立即修復步驟

> **建立日期**：2025-01-29  
> **問題**：Supabase 返回 `{"error":"請求的路徑無效"}`  
> **原因**：`redirect_to` URL 未在 Supabase URL Configuration 中註冊

---

## 🔍 問題分析

從 Logcat 可以看到：

1. ✅ OAuth URL 已成功生成：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/auth/v1/authorize?provider=twitter&redirect_to=https%3A%2F%2Fchaos-registry.vercel.app%2Fauth%2Fcallback
   ```

2. ✅ 應用程式已暫停（瀏覽器已打開）

3. ❌ Supabase 返回錯誤：`{"error":"請求的路徑無效"}`

**根本原因**：Supabase 檢查 `redirect_to` 參數時，發現 `https://chaos-registry.vercel.app/auth/callback` 不在允許的列表中。

---

## 🔧 修復步驟

### 步驟 1：登入 Supabase Dashboard

1. 前往 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇您的專案（`epyykzxxglkjombvozhr`）

---

### 步驟 2：進入 URL Configuration

1. 在左側選單中，點擊 **Authentication**
2. 在 Authentication 頁面中，點擊 **URL Configuration**
   - 或直接前往：**Settings** → **Authentication** → **Redirect URLs**

---

### 步驟 3：添加 Web URL

1. **查看當前的 Redirect URLs 列表**

2. **確認是否包含以下 URL**：
   - `votechaos://auth/callback`（Deep Link，應該已存在）
   - `https://chaos-registry.vercel.app/auth/callback`（Web URL，**需要添加**）

3. **如果缺少 Web URL，請添加**：
   - 點擊 **「Add URL」** 或 **「+ Add redirect URL」** 按鈕
   - 在輸入框中輸入：
     ```
     https://chaos-registry.vercel.app/auth/callback
     ```
   - ⚠️ **重要**：確認沒有多餘的空格（前後都不能有空格）
   - 確認 URL 完全正確（包括 `https://` 和結尾沒有斜線）

4. **點擊「Save」或「儲存」**

5. **等待 30-60 秒**讓設定完全生效

---

### 步驟 4：確認添加成功

1. **刷新頁面**（F5 或重新載入）
2. **確認 URL 在列表中**：
   - 應該看到：`https://chaos-registry.vercel.app/auth/callback`
   - 確認格式完全正確

---

### 步驟 5：重新測試

1. **在 Android Studio 中**：
   - 重新運行應用程式（或重新載入）
   - 點擊 Twitter 登入按鈕

2. **觀察行為**：
   - ✅ **成功**：瀏覽器顯示 X 授權頁面
   - ❌ **失敗**：仍然顯示 Supabase 錯誤頁面

---

## 📋 完整的 Redirect URLs 列表

您的 Supabase URL Configuration 應該包含以下 URL：

1. ✅ `votechaos://auth/callback`（Deep Link，用於 App 登入）
2. ✅ `https://chaos-registry.vercel.app/auth/callback`（Web URL，用於當前測試）

**可選**（如果未來需要）：
3. `https://chaos-registry.vercel.app/home`（Web 版登入後重定向）
4. `http://localhost:5173/auth/callback`（本地開發環境）

---

## ⚠️ 常見錯誤

### 錯誤 1：URL 格式不正確

❌ **錯誤**：
- `https://chaos-registry.vercel.app/auth/callback/`（結尾多了一個斜線）
- `chaos-registry.vercel.app/auth/callback`（缺少 `https://`）
- `https://chaos-registry.vercel.app/auth/callback `（結尾有空格）

✅ **正確**：
- `https://chaos-registry.vercel.app/auth/callback`

### 錯誤 2：忘記保存

- 添加 URL 後，**必須點擊「Save」**
- 等待 30-60 秒讓設定生效

### 錯誤 3：立即測試

- 添加 URL 後，**等待 30-60 秒**再測試
- Supabase 需要時間同步設定

---

## 🎯 預期結果

### 成功情況

1. ✅ 點擊 Twitter 登入按鈕
2. ✅ 瀏覽器打開，顯示 **X 授權頁面**（不是 Supabase 錯誤頁面）
3. ✅ 點擊「授權應用程式」
4. ✅ 瀏覽器關閉，應用程式恢復
5. ✅ 顯示「登入成功！」提示
6. ✅ 自動導航到首頁（`/home`）

### 如果仍然失敗

如果添加 URL 後仍然顯示錯誤：

1. **確認 URL 格式完全正確**（複製貼上，不要手動輸入）
2. **確認已點擊「Save」**
3. **等待更長時間**（60-120 秒）
4. **檢查 Supabase Provider 狀態**：
   - 進入 **Authentication** → **Providers** → **X (Twitter)**
   - 確認開關是**啟用**狀態（綠色）
5. **查看 Supabase Authentication Logs**：
   - 進入 **Authentication** → **Logs**
   - 查看最近的 Twitter 登入請求
   - 查看錯誤詳情

---

## 📝 測試結果記錄

請在添加 URL 後記錄：

1. **添加時間**：__________
2. **URL 格式**：`https://chaos-registry.vercel.app/auth/callback` ✅
3. **測試時間**：__________（添加後 30-60 秒）
4. **測試結果**：
   - [ ] 成功：顯示 X 授權頁面
   - [ ] 失敗：仍然顯示 Supabase 錯誤頁面
5. **如果失敗，錯誤訊息**：__________

---

## 🔗 相關文件

- [X 登入設定指南 - 2025 最新版](./X登入設定指南-2025最新版.md)
- [X 登入-Supabase錯誤解決](./X登入-Supabase錯誤解決.md)
- [X 登入-測試步驟](./X登入-測試步驟.md)

---

**最後更新**：2025-01-29




