# X (Twitter) 登入 - 進階排查指南

> **建立日期**：2025-01-29  
> **錯誤**：`{"error":"請求的路徑無效"}`  
> **已確認**：
> - ✅ Supabase URL Configuration 已包含 `votechaos://auth/callback`
> - ✅ Provider 名稱使用 `'twitter'`（正確）
> - ✅ X Developer Portal 基本設定已完成

---

## 🔍 進一步檢查項目

### 1. X Developer Portal Callback URI 檢查

**問題**：X Developer Portal 中的 Callback URI 可能不正確

**檢查步驟**：

1. 登入 [X Developer Portal](https://developer.x.com/)
2. 進入您的專案和應用程式
3. 進入 **User authentication settings**
4. 檢查 **Callback URI / Redirect URL**：
   - ✅ 必須是：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - ❌ 不能是：`votechaos://auth/callback`（這是 App 的 Deep Link，不是 X 的回調 URL）

**重要區別**：
- **X Developer Portal 的 Callback URI**：X 會重定向到這個 URL（必須是 Supabase 的回調 URL）
- **Supabase 的 Redirect URL**：Supabase 會重定向到這個 URL（可以是 Deep Link 或 Web URL）

**正確設定**：
```
X Developer Portal:
  Callback URI: https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback

Supabase URL Configuration:
  Redirect URLs:
    - votechaos://auth/callback (App 版)
    - https://chaos-registry.vercel.app/home (Web 版)
```

---

### 2. Supabase Provider 憑證驗證

**問題**：API Key 或 Secret Key 可能有問題

**檢查步驟**：

1. 登入 Supabase Dashboard
2. 進入 **Authentication** → **Providers** → **X (Twitter)**
3. 確認：
   - ✅ API Key：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
   - ✅ API Secret Key：`rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG`
   - ✅ 沒有多餘的空格
   - ✅ 沒有複製錯誤

4. **重新輸入憑證**（如果可能）：
   - 暫時刪除 API Secret Key
   - 重新輸入完整的 Secret Key
   - 點擊 Save

---

### 3. 查看實際的錯誤詳情

**已添加的調試代碼會輸出詳細資訊**

在 Android Studio Logcat 中：

1. **過濾關鍵字**：`OAuth`、`Twitter`、`supabase`、`error`
2. **點擊 Twitter 登入按鈕**
3. **查看日誌輸出**，應該會看到：

   ```
   [OAuth] Starting OAuth flow: {
     provider: 'twitter',
     redirectUrl: 'votechaos://auth/callback',
     supabaseUrl: 'https://epyykzxxglkjombvozhr.supabase.co',
     ...
   }
   
   [OAuth] Response: {
     data: null,
     error: {
       message: '請求的路徑無效',
       status: 400,
       name: 'AuthApiError',
       ...
     }
   }
   
   [OAuth] Error details: {
     message: '...',
     status: ...,
     name: '...',
     fullError: { ... }
   }
   ```

4. **記錄完整的錯誤物件**，特別是：
   - `error.message` 的完整內容
   - `error.status` 代碼
   - `error` 物件的完整結構

---

### 4. 檢查 Supabase API 請求

**問題**：實際發送的 API 請求可能有問題

**檢查方法**：

1. **在 Android Studio Logcat 中**：
   - 過濾：`OkHttp`、`network`、`http`、`supabase`
   - 點擊 Twitter 登入按鈕
   - 查看實際發送的 HTTP 請求

2. **預期的請求格式**：
   ```
   POST https://epyykzxxglkjombvozhr.supabase.co/auth/v1/authorize
   Headers:
     apikey: ...
     Authorization: Bearer ...
   Body:
     provider: twitter
     redirect_to: votechaos://auth/callback
   ```

3. **如果請求 URL 不正確**：
   - 檢查環境變數 `VITE_SUPABASE_URL`
   - 確認 Supabase Client 初始化正確

---

### 5. 測試其他 Provider

**目的**：確認問題是否特定於 Twitter Provider

**測試步驟**：

1. **測試 Google 登入**：
   - 點擊 Google 登入按鈕
   - 觀察是否成功或出現相同錯誤
   
2. **結果分析**：
   - **如果 Google 成功**：
     - 問題特定於 Twitter Provider
     - 可能是 Supabase 的 Twitter Provider 配置問題
     - 或 X Developer Portal 設定問題
   
   - **如果 Google 也失敗**：
     - 問題可能是 Supabase 整體配置
     - 或 URL Configuration 設定問題
     - 或 Supabase 專案狀態問題

---

### 6. Supabase Provider 重新設定

**如果其他檢查都正常，嘗試重新設定**：

1. **在 Supabase Dashboard 中**：
   - 進入 **Authentication** → **Providers** → **X (Twitter)**
   - 關閉開關（停用 Provider）
   - 等待 5 秒
   - 重新啟用開關
   - 確認 API Key 和 Secret Key 正確
   - 點擊 **Save**

2. **等待 30 秒**讓設定完全生效

3. **重新測試**

---

### 7. 檢查 Supabase 專案狀態

**檢查項目**：

1. **專案是否正常運行**：
   - 進入 Supabase Dashboard
   - 檢查是否有服務中斷通知
   - 檢查專案狀態是否為 **Active**

2. **Authentication 服務狀態**：
   - 進入 **Authentication** → **Logs**
   - 查看最近的認證請求
   - 檢查是否有相關錯誤或警告

3. **API 服務狀態**：
   - 進入 **Settings** → **API**
   - 確認 Project URL 正確
   - 確認 API Keys 正確

---

### 8. 環境變數檢查

**檢查步驟**：

1. **確認 `.env.local` 或 `.env` 檔案存在**：
   ```env
   VITE_SUPABASE_URL=https://epyykzxxglkjombvozhr.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=您的_ANON_KEY
   ```

2. **確認沒有多餘的斜線**：
   ❌ `https://epyykzxxglkjombvozhr.supabase.co/`（多餘斜線）
   ✅ `https://epyykzxxglkjombvozhr.supabase.co`（正確）

3. **確認 URL 正確**：
   - 必須是 `https://` 協議
   - 不能是 `http://`
   - 不能有多餘的路徑

---

## 🔧 診斷步驟

### 步驟 1：收集錯誤資訊

1. 在 Android Studio 中運行 App
2. 打開 Logcat
3. 過濾：`OAuth`
4. 點擊 Twitter 登入按鈕
5. **複製完整的錯誤日誌**，包括：
   - `[OAuth] Starting OAuth flow` 的完整輸出
   - `[OAuth] Response` 的完整輸出
   - `[OAuth] Error details` 的完整輸出

### 步驟 2：檢查 X Developer Portal

1. 確認 Callback URI 為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
2. 確認應用程式狀態為 **Active**
3. 確認沒有違規或暫停通知

### 步驟 3：測試其他 Provider

1. 測試 Google 登入
2. 記錄結果（成功/失敗）
3. 如果 Google 成功，問題特定於 Twitter

### 步驟 4：檢查 Supabase 日誌

1. 進入 Supabase Dashboard → Authentication → Logs
2. 查看最近的認證請求
3. 檢查是否有 Twitter 相關的錯誤

---

## 📝 需要收集的資訊

如果問題仍然存在，請提供：

1. **完整的錯誤日誌**（從 Logcat）
2. **X Developer Portal 的 Callback URI**（截圖或文字）
3. **Supabase Provider 設定**（截圖，隱藏敏感資訊）
4. **Google 登入測試結果**（成功/失敗）
5. **Supabase Authentication Logs**（最近的 Twitter 登入請求）

---

## 🔗 相關文件

- [X 登入設定指南 - 2025 最新版](./X登入設定指南-2025最新版.md)
- [X 登入問題排查步驟](./X登入問題排查步驟.md)
- [X 登入-URL配置檢查](./X登入-URL配置檢查.md)
- [X 登入深度除錯指南](./X登入深度除錯指南.md)

---

**最後更新**：2025-01-29



