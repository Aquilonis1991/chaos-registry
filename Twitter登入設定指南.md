# Twitter 登入設定指南

> **更新日期**：2025-01-29

---

## 📋 概述

本指南說明如何在 Supabase 中設定 Twitter (X) 第三方登入。

---

## 🔧 步驟 1：在 Twitter Developer Portal 建立應用

### 1.1 登入 Twitter Developer Portal

1. 前往：https://developer.twitter.com/
2. 登入您的 Twitter 帳號
3. 如果還沒有開發者帳號，請先申請

### 1.2 建立新應用

1. 進入 **Developer Portal** → **Projects & Apps** → **Overview**
2. 點擊 **「Create App」** 或 **「+ Add App」**
3. 填寫應用資訊：
   - **App name**：`ChaosRegistry`（或您想要的應用名稱）
   - **App environment**：選擇 **Development** 或 **Production**
   - **App permissions**：選擇 **Read and write**（或根據需求選擇）

### 1.3 取得 API Key 和 Secret

1. 進入應用設定頁面
2. 找到 **「Keys and tokens」** 區塊
3. 複製以下資訊：
   - **API Key**（也稱為 Consumer Key）
   - **API Key Secret**（也稱為 Consumer Secret）

⚠️ **重要**：請妥善保管這些資訊，不要洩露給他人。

---

## 🔧 步驟 2：設定 OAuth 2.0 回調 URL

### 2.1 設定回調 URL

1. 在應用設定頁面，找到 **「User authentication settings」**
2. 點擊 **「Set up」** 或 **「Edit」**
3. 在 **「Callback URI / Redirect URL」** 中添加：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
   ```
4. 在 **「Website URL」** 中添加：
   ```
   https://chaos-registry.vercel.app
   ```
5. 點擊 **「Save」** 儲存設定

### 2.2 確認 OAuth 設定

- **Type of App**：選擇 **Web App, Automated App or Bot**
- **App permissions**：根據需求選擇（通常選擇 **Read and write**）
- **Callback URI**：必須包含 Supabase 的回調 URL

---

## 🔧 步驟 3：在 Supabase 中設定 Twitter Provider

### 3.1 進入 Supabase Dashboard

1. 登入 [Supabase Dashboard](https://app.supabase.com/)
2. 選擇專案：`votechaos` (epyykzxxglkjombvozhr)
3. 進入 **Authentication** → **Providers**

### 3.2 啟用 Twitter Provider

1. 找到 **「Twitter」** provider
2. 點擊開關啟用 Twitter 登入
3. 填入以下資訊：
   - **Client ID (API Key)**：從 Twitter Developer Portal 複製的 API Key
   - **Client Secret (API Key Secret)**：從 Twitter Developer Portal 複製的 API Key Secret
4. 點擊 **「Save」** 儲存設定

---

## 🔧 步驟 4：測試 Twitter 登入

### 4.1 Web 版測試

1. 打開瀏覽器，訪問：`https://chaos-registry.vercel.app/auth`
2. 點擊「使用 Twitter 登入」按鈕
3. 應該會跳轉到 Twitter 授權頁面
4. 使用 Twitter 帳號登入並授權應用
5. 應該會重定向回應用並完成登入

### 4.2 App 版測試

1. 在 Android Studio 或 Xcode 中運行 App
2. 在登入頁面點擊「使用 Twitter 登入」按鈕
3. 應該會打開瀏覽器，顯示 Twitter 授權頁面
4. 授權後會透過 Deep Link `votechaos://auth/callback` 返回 App
5. App 應該會自動完成登入

---

## ⚠️ 常見問題

### 問題 1：Twitter 登入失敗

**錯誤訊息**：`Invalid client credentials`

**解決方案**：
1. 確認 API Key 和 API Key Secret 是否正確
2. 確認回調 URL 是否正確設定
3. 確認 Supabase 中的 Twitter Provider 是否已啟用

### 問題 2：回調 URL 不匹配

**錯誤訊息**：`Callback URL mismatch`

**解決方案**：
1. 確認 Twitter Developer Portal 中的回調 URL 為：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
   ```
2. 確認 Supabase 中的設定正確

### 問題 3：權限不足

**錯誤訊息**：`Insufficient permissions`

**解決方案**：
1. 確認 Twitter 應用權限設定是否正確
2. 確認應用是否已通過 Twitter 審核（如果需要）

---

## 📝 檢查清單

- [ ] Twitter Developer Portal 帳號已建立
- [ ] Twitter 應用已建立
- [ ] API Key 和 API Key Secret 已取得
- [ ] 回調 URL 已正確設定
- [ ] Supabase 中的 Twitter Provider 已啟用
- [ ] Client ID 和 Client Secret 已正確填入
- [ ] Web 版測試成功
- [ ] App 版測試成功（如果適用）

---

## 🔗 相關文件

- [Supabase Authentication 文件](https://supabase.com/docs/guides/auth/social-login/auth-twitter)
- [Twitter Developer Portal](https://developer.twitter.com/)

---

## 📞 需要幫助？

如果遇到問題：
1. 檢查上述檢查清單中的所有項目
2. 查看 Supabase Authentication 日誌
3. 查看 Twitter Developer Portal 中的應用設定
4. 確認所有 URL 和憑證都正確

---

**完成所有步驟後，Twitter 登入功能就可以使用了！** 🎉



