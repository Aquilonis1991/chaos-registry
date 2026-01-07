# X (Twitter) 登入 - 測試步驟

> **建立日期**：2025-01-29  
> **狀態**：已添加 Web URL 回調處理，可以開始測試

---

## 🔧 已完成的修改

1. **添加 Web URL 回調處理**：
   - 創建了 `src/pages/OAuthCallbackPage.tsx`
   - 添加了 `/auth/callback` 路由
   - 暫時修改 `redirectTo` 使用 Web URL 而不是 Deep Link

2. **重新建置和同步**：
   - ✅ 已重新建置前端
   - ✅ 已同步到 Android 專案

---

## 📋 測試前檢查清單

### 1. Supabase URL Configuration

**檢查步驟**：

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 進入 **Authentication** → **URL Configuration**
3. **確認以下 URL 都在 Redirect URLs 列表中**：
   - ✅ `votechaos://auth/callback`（Deep Link，未來使用）
   - ✅ `https://chaos-registry.vercel.app/auth/callback`（Web URL，當前測試用）

4. **如果缺少，請添加**：
   - 點擊 **Add URL**
   - 輸入：`https://chaos-registry.vercel.app/auth/callback`
   - 點擊 **Save**
   - 等待 30 秒

---

### 2. Supabase Provider 狀態

**檢查步驟**：

1. 進入 **Authentication** → **Providers** → **X (Twitter)**
2. **確認開關狀態**：
   - 開關必須是**綠色**（啟用）
   - 不能是灰色（停用）

3. **確認憑證**：
   - API Key：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
   - API Secret Key：已正確填入（不顯示）

4. **如果開關未啟用**：
   - 點擊開關啟用
   - 確認憑證正確
   - 點擊 **Save**
   - 等待 30 秒

---

### 3. X Developer Portal Callback URI

**檢查步驟**：

1. 登入 [X Developer Portal](https://developer.x.com/)
2. 進入您的專案和應用程式
3. 進入 **User authentication settings**
4. **確認 Callback URI**：
   - 必須是：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - 不能是：`votechaos://auth/callback` 或 `https://chaos-registry.vercel.app/auth/callback`

---

## 🧪 測試步驟

### 步驟 1：在 Android Studio 中測試

1. **打開 Android Studio**
2. **運行應用程式**（在模擬器或實體設備上）
3. **打開 Logcat**：
   - 過濾器：`com.votechaos.app`
   - 或不過濾，查看所有日誌

4. **點擊 Twitter 登入按鈕**

5. **觀察行為**：
   - 瀏覽器是否打開？
   - 顯示什麼內容？
     - ✅ X 授權頁面（成功）
     - ❌ Supabase 錯誤頁面（失敗）
     - ❌ 空白頁（可能有問題）

6. **如果顯示 X 授權頁面**：
   - 點擊「授權應用程式」
   - 觀察是否正確回調到應用程式
   - 觀察是否成功登入

---

### 步驟 2：查看 Logcat 輸出

**關鍵日誌**：

1. **OAuth URL 生成**：
   ```
   [OAuth] Starting OAuth flow: { provider: 'twitter', redirectUrl: '...', ... }
   [OAuth] Response: { data: { url: '...' }, error: null }
   ```

2. **瀏覽器打開**：
   ```
   App paused
   ```

3. **回調處理**（如果成功）：
   ```
   [OAuthCallbackPage] Processing OAuth callback
   [OAuthCallbackPage] Session established, user authenticated: ...
   ```

4. **錯誤訊息**（如果失敗）：
   ```
   [OAuth] Error details: { message: '...', status: ..., ... }
   ```

---

### 步驟 3：檢查 Supabase Authentication Logs

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 進入 **Authentication** → **Logs**
3. **查看最近的認證請求**：
   - 找到 Twitter 相關的請求
   - 查看請求狀態（成功/失敗）
   - 查看錯誤訊息（如果有）

---

## 🎯 預期結果

### 成功情況

1. ✅ 點擊 Twitter 登入按鈕
2. ✅ 瀏覽器打開，顯示 X 授權頁面
3. ✅ 點擊「授權應用程式」
4. ✅ 瀏覽器關閉，應用程式恢復
5. ✅ 顯示「登入成功！」提示
6. ✅ 自動導航到首頁（`/home`）

### 失敗情況

如果仍然顯示 `{"error":"請求的路徑無效"}`：

1. **檢查 Supabase URL Configuration**：
   - 確認 `https://chaos-registry.vercel.app/auth/callback` 在列表中
   - 確認沒有多餘空格

2. **檢查 Supabase Provider**：
   - 確認開關真的啟用
   - 嘗試重新啟用

3. **查看 Supabase Logs**：
   - 查看實際的錯誤詳情
   - 了解 Supabase 為什麼拒絕請求

---

## 📝 測試結果記錄

請記錄以下資訊：

1. **測試時間**：__________
2. **測試設備**：__________（模擬器/實體設備）
3. **瀏覽器行為**：
   - [ ] 瀏覽器打開
   - [ ] 顯示 X 授權頁面
   - [ ] 顯示 Supabase 錯誤頁面
   - [ ] 顯示空白頁
   - [ ] 其他：__________

4. **回調行為**：
   - [ ] 成功回調到應用程式
   - [ ] 顯示「登入成功！」
   - [ ] 自動導航到首頁
   - [ ] 錯誤：__________

5. **Logcat 輸出**：
   - 關鍵日誌：__________
   - 錯誤訊息：__________

6. **Supabase Logs**：
   - 請求狀態：__________
   - 錯誤訊息：__________

---

## 🔗 相關文件

- [X 登入設定指南 - 2025 最新版](./X登入設定指南-2025最新版.md)
- [X 登入-Supabase錯誤解決](./X登入-Supabase錯誤解決.md)
- [X 登入問題排查步驟](./X登入問題排查步驟.md)

---

**最後更新**：2025-01-29




