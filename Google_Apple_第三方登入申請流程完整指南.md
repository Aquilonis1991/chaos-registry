# Google 與 Apple 第三方登入申請流程完整指南

## 📋 目錄

1. [Google 第三方登入申請流程](#google-第三方登入申請流程)
2. [Apple 第三方登入申請流程](#apple-第三方登入申請流程)
3. [Supabase 整合設定](#supabase-整合設定)
4. [測試與驗證](#測試與驗證)
5. [常見問題與解決方案](#常見問題與解決方案)

---

## 🔐 Google 第三方登入申請流程

### 前置準備

- ✅ Google 帳號
- ✅ 應用程式網域（例如：`chaos-registry.vercel.app`）
- ✅ 隱私權政策 URL（可選但建議）
- ✅ 服務條款 URL（可選但建議）

---

### 步驟 1：登入 Google Cloud Console

1. 打開瀏覽器，前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 使用您的 Google 帳號登入
3. 如果這是第一次使用，系統會要求您接受服務條款

---

### 步驟 2：建立或選擇專案

#### 2.1 建立新專案

1. 點擊頂部導航欄的「**選取專案**」下拉選單
2. 點擊「**新增專案**」
3. 填寫專案資訊：
   - **專案名稱**：輸入 `ChaosRegistry`（或您喜歡的名稱）
   - **組織**：選擇您的組織（如果有）
   - **位置**：選擇專案位置
4. 點擊「**建立**」
5. 等待專案建立完成（約 10-30 秒）

#### 2.2 選擇現有專案

1. 點擊頂部導航欄的「**選取專案**」下拉選單
2. 從列表中選擇您要使用的專案

---

### 步驟 3：設定 OAuth 同意畫面

#### 3.1 導航到 OAuth 同意畫面

1. 在左側導航欄，點擊「**API 和服務**」
2. 點擊「**OAuth 同意畫面**」
3. 如果這是第一次設定，系統會顯示設定頁面

#### 3.2 選擇使用者類型

1. **外部**：適用於一般應用程式（推薦）
   - 任何擁有 Google 帳號的用戶都可以使用
   - 需要通過 Google 驗證（如果應用程式是公開的）
   
2. **內部**：僅適用於 Google Workspace 組織
   - 只有組織內的用戶可以使用
   - 不需要 Google 驗證

**選擇「外部」**，然後點擊「**建立**」

#### 3.3 填寫應用程式資訊

1. **應用程式名稱**：
   - 輸入：`ChaosRegistry`
   - 這會顯示在 OAuth 同意畫面中
   - 最多 100 個字元

2. **使用者支援電子郵件**：
   - 從下拉選單中選擇您的電子郵件
   - 或輸入一個新的電子郵件地址
   - 用戶可以透過這個電子郵件聯絡您

3. **應用程式標誌**（可選但建議）：
   - 點擊「**上傳**」
   - 選擇一個圖示檔案（建議 120x120px，PNG 或 JPG）
   - 這會顯示在 OAuth 同意畫面中

4. **應用程式首頁連結**：
   - 輸入：`https://chaos-registry.vercel.app`
   - 或您的應用程式首頁 URL

5. **應用程式隱私權政策連結**：
   - 輸入：`https://chaos-registry.vercel.app/privacy`
   - 或您的隱私權政策 URL
   - ⚠️ **重要**：如果應用程式是公開的，這是必需的

6. **應用程式服務條款連結**：
   - 輸入：`https://chaos-registry.vercel.app/terms`
   - 或您的服務條款 URL
   - ⚠️ **重要**：如果應用程式是公開的，這是必需的

7. **已授權的網域**：
   - 點擊「**新增網域**」
   - 輸入：`chaos-registry.vercel.app`
   - 只輸入網域，不要包含 `https://` 或路徑
   - 可以添加多個網域

8. **開發者聯絡資訊**：
   - 輸入您的電子郵件地址
   - 這用於 Google 與您聯絡

9. 點擊「**儲存並繼續**」

#### 3.4 設定範圍（Scopes）

1. 在「範圍」頁面，您會看到預設範圍：
   - `email`：存取使用者的電子郵件地址
   - `profile`：存取使用者的基本個人資料
   - `openid`：使用 OpenID Connect 進行身份驗證

2. 這些預設範圍已經足夠，**不需要添加額外範圍**

3. 點擊「**儲存並繼續**」

#### 3.5 添加測試使用者（如果選擇「外部」）

1. 如果應用程式還在測試階段，可以添加測試使用者
2. 點擊「**新增使用者**」
3. 輸入測試使用者的 Google 帳號電子郵件
4. 點擊「**新增**」
5. 可以添加多個測試使用者
6. 點擊「**儲存並繼續**」

#### 3.6 檢查摘要

1. 在「摘要」頁面，檢查所有設定
2. 確認資訊正確無誤
3. 點擊「**返回資訊主頁**」

---

### 步驟 4：建立 OAuth 2.0 憑證

#### 4.1 導航到憑證頁面

1. 在左側導航欄，點擊「**API 和服務**」
2. 點擊「**憑證**」
3. 您會看到憑證列表（目前應該是空的）

#### 4.2 建立 OAuth 用戶端 ID

1. 點擊頂部的「**建立憑證**」按鈕
2. 從下拉選單中選擇「**OAuth 用戶端 ID**」
3. 如果這是第一次建立，系統可能會提示您設定 OAuth 同意畫面（已完成步驟 3，直接點擊「**建立**」或「**繼續**」）

#### 4.3 選擇應用程式類型

1. 在「應用程式類型」下拉選單中，選擇「**網頁應用程式**」
2. ⚠️ **重要**：即使您的應用程式是行動應用，也選擇「網頁應用程式」，因為 Supabase 使用網頁應用程式類型的 OAuth

#### 4.4 填寫應用程式資訊

1. **名稱**：
   - 輸入：`ChaosRegistry Web Client`
   - 或您喜歡的名稱
   - 這只是內部識別名稱

2. **已授權的 JavaScript 來源**：
   - 點擊「**新增 URI**」
   - 添加以下 URI（每行一個）：
     ```
     https://epyykzxxglkjombvozhr.supabase.co
     https://chaos-registry.vercel.app
     http://localhost:8080
     ```
   - ⚠️ **注意**：
     - 只包含網域和協議，不要包含路徑
     - 不要包含尾隨斜線
     - `localhost:8080` 用於本地開發（可選）

3. **已授權的重新導向 URI**：
   - 點擊「**新增 URI**」
   - 添加以下 URI（每行一個）：
     ```
     https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
     https://chaos-registry.vercel.app/home
     http://localhost:8080/home
     ```
   - ⚠️ **重要**：
     - `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback` 是 Supabase 的標準回調 URL，**必須包含**
     - 其他 URI 用於應用程式重定向（可選）
     - URI 必須完全匹配，包括協議（`https://`）和路徑

4. 點擊「**建立**」

#### 4.5 複製憑證資訊

1. 系統會顯示一個彈窗，包含：
   - **您的用戶端 ID**：類似 `123456789-abcdefghijklmnop.apps.googleusercontent.com`
   - **您的用戶端密鑰**：類似 `GOCSPX-abcdefghijklmnopqrstuvwxyz`

2. ⚠️ **重要**：
   - **用戶端密鑰只會顯示一次**，請立即複製並妥善保存
   - 如果遺失，需要重新建立 OAuth 用戶端 ID
   - 建議將這些資訊保存在安全的地方（例如：密碼管理器）

3. 點擊「**確定**」關閉彈窗

#### 4.6 驗證憑證設定

1. 在「憑證」頁面，您應該會看到剛建立的 OAuth 2.0 用戶端 ID
2. 點擊用戶端 ID 名稱可以查看詳細資訊
3. 確認「已授權的重新導向 URI」包含：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
   ```

---

## 🍎 Apple 第三方登入申請流程

### 前置準備

- ✅ Apple ID
- ✅ Apple Developer Program 會員資格（每年 $99 USD）
- ✅ 應用程式網域（例如：`chaos-registry.vercel.app`）

---

### 步驟 1：註冊 Apple Developer Program

#### 1.1 前往 Apple Developer

1. 打開瀏覽器，前往 [Apple Developer](https://developer.apple.com/)
2. 使用您的 Apple ID 登入

#### 1.2 註冊 Apple Developer Program

1. 如果尚未註冊，點擊「**註冊**」或「**Enroll**」
2. 選擇「**Apple Developer Program**」
3. 選擇實體類型：
   - **個人**：個人開發者
   - **組織**：公司或組織
4. 填寫個人或組織資訊：
   - 姓名/組織名稱
   - 地址
   - 電話號碼
   - 電子郵件
5. 支付年費：**$99 USD**
6. 等待審核（通常 1-2 個工作天）

#### 1.3 驗證帳號

1. 收到確認電子郵件後，點擊確認連結
2. 登入 Apple Developer 帳號
3. 確認會員資格狀態為「**Active**」

---

### 步驟 2：建立 App ID

#### 2.1 導航到 Identifiers

1. 在 Apple Developer 首頁，點擊「**Certificates, Identifiers & Profiles**」
2. 在左側導航欄，點擊「**Identifiers**」
3. 點擊左上角的「**+**」按鈕

#### 2.2 選擇識別碼類型

1. 選擇「**App IDs**」
2. 點擊「**Continue**」

#### 2.3 填寫 App ID 資訊

1. **描述**：
   - 輸入：`ChaosRegistry App ID`
   - 這只是內部識別名稱

2. **Bundle ID**：
   - 選擇「**Explicit**」
   - 輸入：`com.votechaos.app`
   - ⚠️ **重要**：這必須與您的應用程式 Bundle ID 一致

3. **功能**：
   - 勾選「**Sign In with Apple**」
   - 其他功能根據需要勾選

4. 點擊「**Continue**」

#### 2.4 確認並註冊

1. 檢查所有資訊
2. 點擊「**Register**」
3. 等待註冊完成

---

### 步驟 3：建立 Services ID

#### 3.1 建立新的 Services ID

1. 在「Identifiers」頁面，點擊「**+**」按鈕
2. 選擇「**Services IDs**」
3. 點擊「**Continue**」

#### 3.2 填寫 Services ID 資訊

1. **描述**：
   - 輸入：`ChaosRegistry Web Services`
   - 這只是內部識別名稱

2. **Identifier**：
   - 輸入：`com.votechaos.app.services`
   - ⚠️ **重要**：這個 ID 會用於 Supabase 設定

3. 點擊「**Continue**」

#### 3.3 啟用 Sign In with Apple

1. 勾選「**Sign In with Apple**」
2. 點擊「**Configure**」

#### 3.4 設定 Sign In with Apple

1. **Primary App ID**：
   - 從下拉選單中選擇：`com.votechaos.app`（剛才建立的 App ID）

2. **Website URLs**：
   - **Domains and Subdomains**：
     - 輸入：`chaos-registry.vercel.app`
     - 只輸入網域，不要包含 `https://` 或路徑
   
   - **Return URLs**：
     - 點擊「**Add Website**」
     - 輸入：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
     - ⚠️ **重要**：這是 Supabase 的標準回調 URL，必須完全匹配

3. 點擊「**Save**」
4. 點擊「**Continue**」
5. 點擊「**Register**」

---

### 步驟 4：建立密鑰（Key）

#### 4.1 建立新密鑰

1. 在左側導航欄，點擊「**Keys**」
2. 點擊左上角的「**+**」按鈕

#### 4.2 填寫密鑰資訊

1. **Key Name**：
   - 輸入：`Supabase Sign In with Apple`
   - 這只是內部識別名稱

2. **Enable Services**：
   - 勾選「**Sign In with Apple**」
   - 點擊「**Configure**」

#### 4.3 設定 Sign In with Apple

1. **Primary App ID**：
   - 從下拉選單中選擇：`com.votechaos.app`

2. 點擊「**Save**」
3. 點擊「**Continue**」

#### 4.4 確認並註冊

1. 檢查所有資訊
2. 點擊「**Register**」

#### 4.5 下載密鑰檔案

1. ⚠️ **重要**：密鑰檔案（.p8）**只能下載一次**
2. 點擊「**Download**」下載 `.p8` 檔案
3. 立即保存到安全的地方
4. 記下 **Key ID**（例如：`ABC123DEF4`）

---

### 步驟 5：取得 Team ID

1. 在 Apple Developer 首頁右上角，點擊您的帳號名稱
2. 在帳號資訊中，找到 **Team ID**
3. 複製 Team ID（例如：`ABC123DEF4`）
4. ⚠️ **重要**：這個 ID 會用於 Supabase 設定

---

## 🔧 Supabase 整合設定

### 步驟 1：設定 Google Provider

#### 1.1 登入 Supabase Dashboard

1. 前往 [Supabase Dashboard](https://app.supabase.com/)
2. 使用您的帳號登入
3. 選擇專案：`epyykzxxglkjombvozhr`

#### 1.2 導航到 Authentication 設定

1. 在左側導航欄，點擊「**Authentication**」
2. 點擊「**Providers**」標籤
3. 您會看到所有可用的 OAuth providers 列表

#### 1.3 啟用 Google Provider

1. 在 Providers 列表中，找到「**Google**」
2. 點擊 Google 卡片上的開關按鈕，或點擊「**Configure**」按鈕
3. 這會打開 Google Provider 的設定頁面

#### 1.4 填入 Google OAuth 憑證

在 Google Provider 設定頁面中，您會看到以下欄位：

1. **Enable Google provider**（啟用 Google 提供者）
   - 確保開關是「**開啟**」狀態

2. **Client ID (for OAuth)**（OAuth 用戶端 ID）
   - 從 Google Cloud Console 複製的「**您的用戶端 ID**」
   - 格式：`123456789-abcdefghijklmnop.apps.googleusercontent.com`
   - 貼上到此欄位

3. **Client Secret (for OAuth)**（OAuth 用戶端密鑰）
   - 從 Google Cloud Console 複製的「**您的用戶端密鑰**」
   - 格式：`GOCSPX-abcdefghijklmnopqrstuvwxyz`
   - 貼上到此欄位

4. **Additional scopes**（額外範圍）
   - 預設為空，通常不需要修改
   - 預設會請求：`email`、`profile`、`openid`

5. 點擊「**Save**」按鈕

---

### 步驟 2：設定 Apple Provider

#### 2.1 啟用 Apple Provider

1. 在 Supabase Dashboard > **Authentication** > **Providers**
2. 找到「**Apple**」
3. 點擊 Apple 卡片上的開關按鈕，或點擊「**Configure**」按鈕
4. 這會打開 Apple Provider 的設定頁面

#### 2.2 填入 Apple OAuth 憑證

在 Apple Provider 設定頁面中，您會看到以下欄位：

1. **Enable Apple provider**（啟用 Apple 提供者）
   - 確保開關是「**開啟**」狀態

2. **Services ID**（服務 ID）
   - 輸入：`com.votechaos.app.services`
   - 這是剛才在 Apple Developer 中建立的 Services ID

3. **Secret Key**（密鑰）
   - 打開剛才下載的 `.p8` 檔案
   - 複製整個檔案內容（包括 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`）
   - 貼上到此欄位

4. **Key ID**（密鑰 ID）
   - 輸入：`ABC123DEF4`（從 Apple Developer 中複製的 Key ID）

5. **Team ID**（團隊 ID）
   - 輸入：`ABC123DEF4`（從 Apple Developer 中複製的 Team ID）

6. 點擊「**Save**」按鈕

---

### 步驟 3：驗證 URL 設定

#### 3.1 檢查 Redirect URLs

1. 在 Supabase Dashboard，導航到「**Authentication**」>「**URL Configuration**」
2. 確認「**Redirect URLs**」包含：
   - `https://chaos-registry.vercel.app/**`（Web 版）
   - `votechaos://auth/callback`（App 版 Deep Link）
   - `http://localhost:8080/**`（本地開發用，可選）

#### 3.2 檢查 Site URL

1. 確認「**Site URL**」設定為：`https://chaos-registry.vercel.app`
2. 或您的應用程式主要 URL

---

## ✅ 測試與驗證

### 測試 Google 登入

#### Web 版測試

1. 開啟您的應用程式（Web 版）
2. 導航到登入頁面
3. 點擊「**使用 Google 登入**」按鈕
4. 應該會跳轉到 Google 登入頁面
5. 選擇您的 Google 帳號（或輸入帳號密碼）
6. 如果這是第一次使用，會顯示 OAuth 同意畫面：
   - 檢查應用程式名稱和權限
   - 點擊「**繼續**」或「**允許**」
7. 登入成功後，應該會重定向回應用程式首頁
8. 確認用戶已成功登入（檢查右上角用戶資訊）

#### App 版測試（iOS/Android）

1. 在 App 中開啟應用程式
2. 導航到登入頁面
3. 點擊「**使用 Google 登入**」按鈕
4. 應該會打開瀏覽器或 Google App，顯示登入頁面
5. 選擇您的 Google 帳號並完成登入
6. 授權完成後，應該會自動返回 App（透過 `votechaos://auth/callback` Deep Link）
7. 確認用戶已成功登入

---

### 測試 Apple 登入

#### Web 版測試

1. 開啟您的應用程式（Web 版）
2. 導航到登入頁面
3. 點擊「**使用 Apple 登入**」按鈕
4. 應該會顯示 Apple 登入對話框
5. 輸入您的 Apple ID 和密碼
6. 如果這是第一次使用，會顯示授權畫面：
   - 檢查應用程式名稱和權限
   - 選擇是否隱藏電子郵件
   - 點擊「**繼續**」
7. 登入成功後，應該會重定向回應用程式首頁
8. 確認用戶已成功登入

#### App 版測試（iOS）

1. 在 iOS App 中開啟應用程式
2. 導航到登入頁面
3. 點擊「**使用 Apple 登入**」按鈕
4. 應該會顯示系統原生的 Apple 登入對話框
5. 使用 Face ID、Touch ID 或密碼完成登入
6. 登入成功後，應該會自動返回應用程式
7. 確認用戶已成功登入

---

## ❓ 常見問題與解決方案

### Google 登入問題

#### 問題 1：`redirect_uri_mismatch` 錯誤

**錯誤訊息**：
```
Error 400: redirect_uri_mismatch
```

**原因**：
- Google Cloud Console 中設定的「已授權的重新導向 URI」與實際使用的 URI 不匹配

**解決方案**：
1. 前往 Google Cloud Console >「API 和服務」>「憑證」
2. 點擊您的 OAuth 2.0 用戶端 ID
3. 在「已授權的重新導向 URI」中，確認包含：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
   ```
4. 確保 URI 完全一致（包括 `https://`、沒有尾隨斜線）
5. 點擊「儲存」
6. 等待幾分鐘讓變更生效
7. 重新測試

#### 問題 2：`invalid_client` 錯誤

**錯誤訊息**：
```
Error 401: invalid_client
```

**原因**：
- Client ID 或 Client Secret 不正確
- 憑證已被刪除或停用

**解決方案**：
1. 前往 Google Cloud Console >「API 和服務」>「憑證」
2. 確認 OAuth 2.0 用戶端 ID 仍然存在且啟用
3. 如果已刪除，需要重新建立
4. 前往 Supabase Dashboard >「Authentication」>「Providers」>「Google」
5. 重新複製並貼上 Client ID 和 Client Secret
6. 點擊「Save」
7. 重新測試

#### 問題 3：OAuth 同意畫面顯示「未驗證的應用程式」

**說明**：
- 這是正常的，如果您的應用程式還在開發或測試階段
- Google 會顯示警告訊息，但不會阻止登入

**解決方案**：
1. 如果只是測試，可以忽略此警告
2. 如果要移除警告，需要提交應用程式進行 Google 驗證：
   - 前往「OAuth 同意畫面」
   - 點擊「發布應用程式」
   - 填寫所有必要資訊
   - 提交審核（可能需要幾天到幾週）

---

### Apple 登入問題

#### 問題 1：`invalid_client` 錯誤

**錯誤訊息**：
```
invalid_client
```

**原因**：
- Services ID、Key ID、Team ID 或 Secret Key 不正確

**解決方案**：
1. 檢查 Supabase Dashboard 中的 Apple Provider 設定：
   - Services ID：`com.votechaos.app.services`
   - Key ID：從 Apple Developer 中複製
   - Team ID：從 Apple Developer 中複製
   - Secret Key：從 `.p8` 檔案中複製（包含完整內容）
2. 確認所有資訊正確無誤
3. 點擊「Save」
4. 重新測試

#### 問題 2：Apple Sign In 需要 HTTPS

**說明**：
- Apple Sign In 只能在 HTTPS 環境下運作
- 本地開發時需要使用 Supabase 的本地開發環境或使用 ngrok 等工具

**解決方案**：
- 使用 Supabase 的生產環境進行測試
- 或使用 ngrok 等工具建立 HTTPS 隧道

#### 問題 3：Apple Developer 帳號需要付費

**說明**：
- Apple Sign In 需要 Apple Developer Program 會員資格（每年 $99 USD）
- 如果沒有付費帳號，無法使用 Apple Sign In

**解決方案**：
- 註冊 Apple Developer Program（$99 USD/年）
- 或暫時只使用 Google 登入

---

## ✅ 完成檢查清單

### Google 登入

- [ ] Google Cloud Console 專案已建立
- [ ] OAuth 同意畫面已設定
- [ ] OAuth 2.0 憑證已建立
- [ ] Client ID 和 Client Secret 已複製
- [ ] 已授權的重新導向 URI 包含：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] Supabase Dashboard 中已啟用 Google Provider
- [ ] Client ID 和 Client Secret 已正確填入
- [ ] URL Configuration 已設定
- [ ] Web 版登入測試成功
- [ ] App 版登入測試成功（如果適用）

### Apple 登入

- [ ] Apple Developer Program 會員資格已取得（$99 USD/年）
- [ ] App ID 已建立並啟用 Sign In with Apple
- [ ] Services ID 已建立並設定回調 URL
- [ ] 密鑰已建立並下載 `.p8` 檔案
- [ ] Key ID 和 Team ID 已複製
- [ ] Supabase Dashboard 中已啟用 Apple Provider
- [ ] Services ID、Key ID、Team ID 和 Secret Key 已正確填入
- [ ] URL Configuration 已設定
- [ ] Web 版登入測試成功
- [ ] App 版登入測試成功（如果適用）

---

**最後更新**：2025年1月
**適用版本**：Supabase 最新版、Google Cloud Console 2025 最新介面、Apple Developer Portal 最新版

