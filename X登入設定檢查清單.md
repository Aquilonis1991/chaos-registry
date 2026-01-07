# X (Twitter) 第三方登入設定檢查清單

> **建立日期**：2025-01-29  
> **用途**：確認 X (Twitter) 第三方登入是否已完整設定

---

## ✅ 檢查項目

### 1. X Developer Portal 設定

#### 1.1 開發者帳號
- [ ] 已建立 X Developer Portal 帳號
- [ ] 開發者帳號已通過審核

#### 1.2 專案和應用程式
- [ ] 已建立專案（Project）
- [ ] 已建立應用程式（App）
- [ ] 應用程式狀態為 **Active**

#### 1.3 OAuth 2.0 憑證
- [ ] 已取得 Client ID：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
- [ ] 已取得 Client Secret：`rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG`
- [ ] 憑證已記錄在 `X-API憑證保管說明.md`

#### 1.4 User authentication settings
- [ ] App permissions 已設定為 **Read**
- [ ] Type of App 已設定為 **Web App, Automated App or Bot**
- [ ] Callback URI 已設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] Website URL 已設定為：`https://chaos-registry.vercel.app`
- [ ] Terms of service 已設定為：`https://chaos-registry.vercel.app/terms`
- [ ] Privacy policy 已設定為：`https://chaos-registry.vercel.app/privacy`
- [ ] 所有設定已儲存

---

### 2. Supabase 設定

#### 2.1 X Provider 啟用
- [ ] 已進入 Supabase Dashboard
- [ ] 已選擇專案：`votechaos` (epyykzxxglkjombvozhr)
- [ ] 已進入 Authentication → Providers
- [ ] X (Twitter) Provider 已啟用（開關已打開）

#### 2.2 API 憑證設定
- [ ] API Key 已填入：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
- [ ] API Secret Key 已填入：`rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG`
- [ ] 憑證與 X Developer Portal 中的憑證完全匹配

#### 2.3 其他設定
- [ ] Allow users without an email 已勾選
- [ ] 設定已儲存
- [ ] 沒有錯誤訊息

---

### 3. 前端代碼檢查

#### 3.1 登入按鈕
- [ ] `src/pages/AuthPage.tsx` 中有 Twitter 登入按鈕
- [ ] 按鈕圖示正確顯示
- [ ] 按鈕可以點擊

#### 3.2 處理函數
- [ ] `handleSocialLogin` 函數支援 `'twitter'` provider
- [ ] 錯誤處理已實作
- [ ] 成功/失敗訊息已實作

#### 3.3 路由設定
- [ ] Deep Link 已設定：`votechaos://auth/callback`
- [ ] Web 版重定向 URL 已設定：`https://chaos-registry.vercel.app/home`
- [ ] `OAuthCallbackHandler` 可以處理 Twitter 回調

---

### 4. 測試

#### 4.1 Web 版測試
- [ ] 訪問 `https://chaos-registry.vercel.app/auth`
- [ ] 點擊 Twitter 登入按鈕
- [ ] 成功跳轉到 X 授權頁面
- [ ] 授權後成功重定向回應用
- [ ] 用戶成功登入
- [ ] 用戶資訊正確顯示

#### 4.2 App 版測試
- [ ] 在 Android Studio 或 Xcode 中運行 App
- [ ] 點擊 Twitter 登入按鈕
- [ ] 成功打開瀏覽器顯示 X 授權頁面
- [ ] 授權後成功透過 Deep Link 返回 App
- [ ] App 自動完成登入
- [ ] 用戶資訊正確顯示

---

## 🔍 快速檢查方法

### 方法 1：檢查 Supabase Dashboard

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇專案：`votechaos`
3. 進入 **Authentication** → **Providers**
4. 找到 **X (Twitter)** 或 **Twitter**
5. 確認：
   - ✅ 開關已啟用
   - ✅ API Key 已填入
   - ✅ API Secret Key 已填入
   - ✅ 沒有錯誤訊息

### 方法 2：檢查前端代碼

1. 打開 `src/pages/AuthPage.tsx`
2. 搜尋 `twitter` 或 `Twitter`
3. 確認：
   - ✅ 有 Twitter 登入按鈕
   - ✅ `handleSocialLogin` 支援 `'twitter'`
   - ✅ 按鈕可以正常點擊

### 方法 3：實際測試

1. 打開應用程式（Web 或 App）
2. 進入登入頁面
3. 點擊 Twitter 登入按鈕
4. 觀察是否：
   - ✅ 成功跳轉到 X 授權頁面
   - ✅ 授權後成功返回
   - ✅ 用戶成功登入

---

## ⚠️ 常見問題檢查

### 問題 1：Supabase Provider 未啟用

**症狀**：點擊 Twitter 登入按鈕後沒有反應或出現錯誤

**檢查**：
- 確認 Supabase Dashboard 中 X Provider 已啟用
- 確認 API Key 和 API Secret Key 已正確填入

### 問題 2：回調 URL 不匹配

**症狀**：授權後出現 `redirect_uri_mismatch` 錯誤

**檢查**：
- 確認 X Developer Portal 中的 Callback URI 為：
  ```
  https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
  ```
- 確認 URL 完全匹配（包括協議和路徑）

### 問題 3：憑證錯誤

**症狀**：出現 `Invalid client credentials` 錯誤

**檢查**：
- 確認 Supabase 中的 API Key 和 API Secret Key 與 X Developer Portal 中的完全一致
- 確認沒有多餘的空格或特殊字元
- 如果憑證遺失，在 X Developer Portal 中重新生成

### 問題 4：前端按鈕未顯示

**症狀**：登入頁面看不到 Twitter 登入按鈕

**檢查**：
- 確認 `src/pages/AuthPage.tsx` 中有 Twitter 按鈕代碼
- 確認按鈕沒有被 CSS 隱藏
- 確認已重新建置前端（`npm run build`）

---

## 📝 設定確認步驟

### 步驟 1：檢查 X Developer Portal

1. 登入 [X Developer Portal](https://developer.x.com/)
2. 進入您的專案和應用程式
3. 檢查 **Keys and tokens** 頁面：
   - ✅ Client ID 存在
   - ✅ Client Secret 存在
4. 檢查 **User authentication settings** 頁面：
   - ✅ Callback URI 正確
   - ✅ Website URL 正確
   - ✅ 所有設定已儲存

### 步驟 2：檢查 Supabase Dashboard

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇專案：`votechaos`
3. 進入 **Authentication** → **Providers**
4. 找到 **X (Twitter)**
5. 確認：
   - ✅ 開關已啟用
   - ✅ API Key 已填入：`R05yT2N5QUFWTEhoeUpScHVZR3A6MTpjaQ`
   - ✅ API Secret Key 已填入：`rS6Tm4i1gZA0jg11lJUEHRDWg-98wu3Tk_X3iyA3QmC4SYWgQG`
   - ✅ Allow users without an email 已勾選

### 步驟 3：測試登入

1. 打開應用程式
2. 進入登入頁面
3. 點擊 Twitter 登入按鈕
4. 完成授權流程
5. 確認成功登入

---

## ✅ 完成確認

如果所有檢查項目都已完成，X (Twitter) 第三方登入應該已經設定完成！

**下一步**：
- 進行實際測試
- 檢查用戶資訊是否正確顯示
- 確認登入流程順暢

---

**最後更新**：2025-01-29




