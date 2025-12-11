# LINE 第三方登入完整設定指南（2025 最新版）

> **適用範圍**：Web、iOS App、Android App  
> **更新日期**：2025-01-29  
> **LINE API 版本**：LINE Login API v2.1（最新）  
> **實作狀態**：✅ Deep Link 已在專案中實作完成  
> **介面版本**：根據 2025 年最新版 LINE Developers Console 介面撰寫

---

## 📋 目錄

1. [前置準備](#前置準備)
2. [Part 1：LINE Developers Console 設定](#part-1-line-developers-console-設定)
3. [多地區設定方案（台灣 + 日本）](#多地區設定方案台灣--日本) ⚠️ 重要
4. [Part 2：Supabase 設定](#part-2-supabase-設定)
5. [Part 3：App 端設定（iOS/Android）](#part-3-app-端設定iosandroid)
6. [Part 4：測試與驗證](#part-4-測試與驗證)
7. [Part 5：常見問題與排錯](#part-5-常見問題與排錯)
8. [進階：多地區動態選擇 Channel（可選）](#進階多地區動態選擇-channel可選)
9. [iOS 和 Android 設定說明](#line-登入-ios-和-android-設定說明) 📱

---

## 前置準備

### 需要準備的資訊

在開始之前，請先確認您有以下資訊：

1. **Supabase 專案資訊**
   - Project URL：`https://epyykzxxglkjombvozhr.supabase.co`
   - Project Reference ID：`epyykzxxglkjombvozhr`
   - Project Name：`votechaos`
   - 如何取得：Supabase Dashboard → Settings → API → Project URL

2. **LINE 帳號**
   - 需要一個有效的 LINE 帳號
   - 建議使用您要發布應用的官方帳號
   - 需要 LINE Developers 帳號（與一般 LINE 帳號相同）

3. **應用程式資訊**
   - 應用程式名稱：`ChaosRegistry`
   - 應用程式描述（可選）
   - 應用程式圖示（可選，建議 512x512 像素）
   - 服務地區：台灣（或您要服務的地區）

4. **LINE Channel 資訊**（台灣）✅ 已取得
   - Channel ID：`2008600116`
   - Channel Secret：`079ebaa784b4c00184e68bafb1841d77`
   - 服務地區：Taiwan

---

## Part 1：LINE Developers Console 設定

### 步驟 1.1：登入 LINE Developers Console

1. **前往 LINE Developers Console**
   - 網址：https://developers.line.biz/console/
   - 使用您的 LINE 帳號登入（與一般 LINE 帳號相同）

2. **首次使用**
   - 如果是第一次使用，LINE 會要求您同意開發者條款
   - 閱讀並同意後即可繼續

### 步驟 1.2：建立 Provider（提供者）

1. **點擊「Create」按鈕**
   - 在 Providers 頁面中，點擊右上角的 **「Create」** 按鈕
   - 或直接訪問：https://developers.line.biz/console/provider/

2. **填寫 Provider 資訊**
   - **Provider name（提供者名稱）**：
     ```
     ChaosRegistry
     ```
     - 這會顯示在 LINE 授權頁面上
     - 用戶會看到「ChaosRegistry 想要存取您的帳號」
   
   - **Provider description（描述）**：
     ```
     一個投票與討論平台，讓用戶可以發起投票並參與討論
     ```
     - 可選，但建議填寫

3. **點擊「Create」按鈕**
   - 建立完成後，會自動跳轉到 Provider 設定頁面

### 步驟 1.3：建立 LINE Login Channel

1. **進入 Provider 設定頁面**
   - 在 Provider 列表中，點擊您剛建立的 Provider（例如：`ChaosRegistry`）

2. **點擊「Add a channel」按鈕**
   - 在 Provider 設定頁面中，點擊 **「Add a channel」** 按鈕

3. **選擇 Channel 類型**
   - 選擇 **「LINE Login」**
   - 這會開啟 LINE Login 的設定流程

4. **填寫 Channel 基本資訊（Basic settings → Basic information）**

   在建立 Channel 時，您需要填寫以下欄位：

   - **Channel name（頻道名稱）**：
     ```
     ChaosRegistry
     ```
     - 這會顯示在 LINE 授權頁面上
     - **您的值**：`ChaosRegistry`
   
   - **Channel description（描述）**：
     ```
     ChaosRegistry是一款以虛構、趣味話題為核心的娛樂性投票平台。
     使用者可瀏覽主題、以代幣投票、發起投票，或使用代幣提高主題曝光度。
     平台具備內容治理與舉報機制，禁止真實政治人物、仇恨言論或敏感政治內容。
     本服務僅供娛樂用途，不反映任何真實政治行為或公共政策。
     ```
     - 可選，但建議填寫
     - 這會顯示在 LINE 授權頁面上
   
   - **App types（應用程式類型）**：
     - ✅ 勾選 **「Mobile app」**（用於 iOS/Android App）
     - ✅ 勾選 **「Web app」**（用於 Web 版）
     - **您的設定**：兩個都已勾選 ✅
   
   - **Email address（電子郵件）**：
     ```
     aquilonis1991@gmail.com
     ```
     - 用於接收 LINE 的通知和重要訊息
     - **您的值**：`aquilonis1991@gmail.com`
   
   - **Privacy policy URL（隱私權政策）**：
     ```
     https://chaos-registry.vercel.app/privacy
     ```
     - 建議填寫
     - **您的值**：`https://chaos-registry.vercel.app/privacy`
   
   - **Terms of use URL（服務條款）**（可選）：
     ```
     https://chaos-registry.vercel.app/terms
     ```
     - 可選，但建議填寫
     - **您的值**：`https://chaos-registry.vercel.app/terms`

5. **選擇服務地區** ⚠️ 重要
   - **Region to provide the service（服務地區）**：
     - 選擇 **「Taiwan（台灣）」**
     - ⚠️ **重要限制**：一個 Channel 只能服務一個地區
     - 如果您需要同時服務台灣和日本，請參考 [多地區設定方案](#多地區設定方案台灣--日本)
     - **您的設定**：Taiwan ✅
   
   - **Company or owner's country or region（公司或擁有者的國家或地區）**：
     - 公司應選擇公司所在國家或地區
     - 個人應選擇商店或居住地的國家或地區
     - 建議選擇 **「Taiwan（台灣）」**
   
   **建議**：
   - 如果主要用戶在台灣，選擇 **「Taiwan（台灣）」**
   - 如果主要用戶在日本，選擇 **「Japan（日本）」**
   - 如果需要同時服務兩個地區，請建立兩個 Channel（見下方說明）

6. **點擊「Create」按鈕**
   - 建立完成後，會自動跳轉到 Channel 設定頁面

### 步驟 1.4：取得 Channel ID 和 Channel Secret

建立 Channel 後，您會看到 Channel 的設定頁面。在 **Basic settings → Basic information** 區塊中：

1. **複製 Channel ID**
   - 在 **Basic information** 區塊中，您會看到 **「Channel ID」** 欄位
   - 直接複製 Channel ID
   - **您的台灣 Channel ID**：`2008600116` ✅
   - 格式類似：`1234567890`
   - **重要**：請先儲存這個 ID，稍後會用到

2. **取得 Channel Secret**
   - 在 **Basic information** 區塊中，您會看到 **「Channel secret」** 欄位
   - 點擊 **「Show」** 或 **「Reissue」** 按鈕來顯示 Secret
   - **⚠️ 警告**：LINE 只會顯示一次 Secret，請務必立即複製並妥善保存
   - **您的台灣 Channel Secret**：`079ebaa784b4c00184e68bafb1841d77` ✅
   - 格式類似：`abcdefghijklmnopqrstuvwxyz123456789`
   - **重要**：如果遺失 Secret，必須重新產生，舊的 Secret 會失效

3. **其他 Basic information 欄位**
   - **Assertion Signing Key**：LINE 自動產生的簽名金鑰（用於驗證）
   - **Your user ID**：`U02901d2e21fd6bda709906d79d2a16c6`（您的 LINE 用戶 ID）
   - **Localization**：多語言支援設定（目前顯示 "No data available"）
   - **Add friend option**：是否允許用戶加入好友（可選）
   - **Linked LINE Official Account**：連結的 LINE 官方帳號（可選）

### 步驟 1.5：設定 Callback URL

1. **進入 LINE Login 設定頁面**
   - 在 Channel 設定頁面中，點擊左側導航欄的 **「LINE Login」**
   - 或直接訪問：`https://developers.line.biz/console/channel/2008600116/settings/`

2. **找到「Callback URL」區塊**
   - 在 LINE Login 設定頁面中，您會看到 **「Callback URL」** 區塊
   - 這是 OAuth 2.0 授權後的重定向網址列表

3. **添加 Callback URL（Web 版）**
   - 點擊 **「Add」** 或 **「+」** 按鈕
   - 在輸入框中填入：
     ```
     https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
     ```
   - 點擊 **「Add」** 或 **「Save」** 按鈕

4. **添加 Callback URL（App 版 - Deep Link）**
   - 再次點擊 **「Add」** 或 **「+」** 按鈕
   - 在輸入框中填入：
     ```
     votechaos://auth/callback
     ```
   - **說明**：
     - `votechaos` 是您的 App 自訂 URL Scheme
     - ✅ **此 Deep Link 已在專案中實作完成**（AndroidManifest.xml、Info.plist、AuthPage.tsx）
   - 點擊 **「Add」** 或 **「Save」** 按鈕

5. **確認 Callback URLs 列表**
   - 您應該會看到兩個 Callback URL：
     ```
     https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
     votechaos://auth/callback
     ```
   - **重要**：請確認這兩個 URL 都已正確添加
   - 如果有多個專案或環境，可以添加更多 Callback URL

### 步驟 1.6：設定 OpenID Connect 和權限

1. **查看 Permissions（權限）區塊**
   - 在 **Basic settings** 中，您會看到 **「Permissions」** 區塊
   - 目前顯示的權限：
     - ✅ **PROFILE**：取得用戶基本資訊（名稱、頭像等）
     - ✅ **OPENID_CONNECT**：OpenID Connect 認證
   - 這些是 LINE Login 的基本權限，通常不需要修改

2. **設定 OpenID Connect → Email address permission**
   - 在 **Basic settings** 中，找到 **「OpenID Connect」** 區塊
   - 您會看到 **「Email address permission」** 選項
   - **目前狀態**：顯示 **「Unapplied」**（未申請）
   
   **如何申請 Email 權限**：
   - 點擊 **「Email address permission」** 旁的 **「Apply」** 或 **「Request」** 按鈕
   - 會開啟 Email 權限申請表單
   
   **申請表單需要填寫**：
   1. **同意條款**（兩個 checkbox）：
      - ☑ My app only collects a user's email address after asking for their consent and explaining the purpose of collecting, and complies with all privacy laws applicable to the locations where my app collects, stores, and processes personal data.
      - ☑ I comply with LINE User Data Policy.
   
   2. **上傳截圖**：
      - 檔案大小：不超過 3 MB
      - 檔案格式：PNG, JPG, JPEG, GIF, BMP
      - 截圖內容：必須顯示應用程式如何請求用戶同意並說明收集 Email 的目的
      - **建議截圖**：隱私權政策頁面（顯示 Email 收集說明）
      - **截圖位置**：`https://chaos-registry.vercel.app/privacy`
   
   **審核流程**：
   - 提交後，LINE 會進行審核（通常需要 1-3 個工作天）
   - 審核通過後，Email 權限狀態會從 **「Unapplied」** 變更為 **「Applied」**
   - 審核通過後，應用程式可以取得用戶的電子郵件地址（如果用戶已驗證 Email）
   
   **詳細說明**：請參考 [LINE Email 權限申請指南](./LINE-Email權限申請指南.md)
   
   **注意**：
   - 即使申請通過，用戶仍可以選擇不分享 Email
   - 如果用戶未驗證 Email，LINE 不會返回 Email 地址
   - 建議在 Supabase 中勾選 **「Allow users without an email」** 選項（見 Part 2）

3. **權限說明**
   - **PROFILE**：自動啟用，用於取得用戶基本資訊
   - **OPENID_CONNECT**：自動啟用，用於 OpenID Connect 認證流程
   - **EMAIL**：需要手動申請，用於取得用戶電子郵件

### 步驟 1.7：確認 Basic settings 設定

在 **Basic settings → Basic information** 區塊中，確認以下欄位都已正確填寫：

1. **Channel Information**
   - ✅ **Channel ID**：`2008600116`（自動產生，不可修改）
   - ✅ **Region to provide the service**：`Taiwan`
   - ✅ **Company or owner's country or region**：已選擇
   - ✅ **Channel icon**：可上傳應用程式圖示（建議 512x512 像素）
   - ✅ **Channel name**：`ChaosRegistry`
   - ✅ **Channel description**：已填寫
   - ✅ **Email address**：`aquilonis1991@gmail.com`
   - ✅ **Privacy policy URL**：`https://chaos-registry.vercel.app/privacy`
   - ✅ **Terms of use URL**：`https://chaos-registry.vercel.app/terms`

2. **App types**
   - ✅ **Mobile app**：已勾選
   - ✅ **Web app**：已勾選

3. **Permissions**
   - ✅ **PROFILE**：已啟用
   - ✅ **OPENID_CONNECT**：已啟用

4. **Channel secret**
   - ✅ **Channel secret**：`079ebaa784b4c00184e68bafb1841d77`（已保存）

5. **Assertion Signing Key** ✅ 已完成
   - **說明**：用於驗證應用程式發送給 LINE 的 JWT token 的公鑰
   - **狀態**：✅ 已生成 RSA 金鑰對並提交公鑰（2025-01-29）
   - **Key ID (kid)**：`cc31abb4-94d1-4655-aba2-2e7a7e4ab126`
   - **格式要求**：
     - ✅ 有效的 JSON（JWK 格式）
     - ✅ 有效的公鑰
     - ✅ **沒有 `kid` 欄位**（LINE 已自動生成）
   - **詳細說明**：請參考 [LINE Assertion Signing Key 設定指南](./LINE-AssertionSigningKey設定指南.md)

6. **其他資訊**
   - **Your user ID**：`U02901d2e21fd6bda709906d79d2a16c6`
   - **Localization**：目前無資料（可選）
   - **Add friend option**：可選設定
   - **Linked LINE Official Account**：可選設定

6. **OpenID Connect**
   - **Email address permission**：目前顯示 **「Unapplied」**
   - 如需取得用戶 Email，需要申請此權限

### 步驟 1.8：設定 Mobile App（iOS/Android）

1. **進入 LINE Login 設定頁面**
   - 在 Channel 設定頁面中，點擊左側導航欄的 **「LINE Login」**
   - 或直接訪問：`https://developers.line.biz/console/channel/2008600116/settings/line-login`
   - 在 LINE Login 設定頁面中，向下滾動找到 **「Use LINE Login in your mobile app」** 區塊

2. **iOS 設定**

   **iOS bundle ID**：
   ```
   com.votechaos.app
   ```
   - 這是 iOS 應用程式的唯一識別碼
   - 可在 Xcode 專案或 `capacitor.config.ts` 中確認

   **iOS universal link**：
   ```
   （留空，因為使用 Deep Link）
   ```
   - 如果您的專案使用 Deep Link（`votechaos://auth/callback`），可以留空
   - 如果需要 Universal Link，請參考 [LINE 登入 - iOS 和 Android 設定說明](./LINE登入-iOS和Android設定說明.md)

3. **Android 設定**

   **Package names**：
   ```
   com.votechaos.app
   ```
   - 這是 Android 應用程式的套件名稱
   - 可在 `android/app/build.gradle` 或 `capacitor.config.ts` 中確認

   **Package signatures**：
   - ⚠️ **如果只有一個欄位**，請填入 **SHA-1**：
     ```
     F5:86:DD:40:47:B2:40:A7:CD:89:75:34:B6:EB:17:64:6A:BD:10:1A
     ```
     - **注意**：LINE 可能會自動移除冒號，顯示為 `F586DD4047B240A7CD897534B6EB17646ABD101A`，這是正常的，兩種格式都可以
   - **如果有多個欄位**（SHA-1 和 SHA-256 分開）：
     - **SHA-1**：`F5:86:DD:40:47:B2:40:A7:CD:89:75:34:B6:EB:17:64:6A:BD:10:1A`
     - **SHA-256**：`DF:3C:34:62:86:6D:E0:78:D4:99:1D:CA:A9:63:76:F3:CF:8A:54:CE:2D:45:3B:B7:1D:62:ED:23:C5:23:CC:53`
   - **注意**：以上是 **Debug 簽名**（開發環境）
   - 生產環境需要使用 **Release 簽名**（從您的 release keystore 取得）
   - 如何取得：參考 [LINE 登入 - iOS 和 Android 設定說明](./LINE登入-iOS和Android設定說明.md)

   **Android URL scheme**：
   ```
   votechaos://auth/callback
   ```
   - 或簡化為：`votechaos`
   - 這是用於深度連結的 URL Scheme
   - 可在 `AndroidManifest.xml` 中確認

4. **儲存設定**
   - 點擊 **「Save」** 或 **「Update」** 按鈕
   - 確認所有設定都已正確填入

> **詳細說明**：如需更詳細的說明，請參考 [LINE 登入 - iOS 和 Android 設定說明](./LINE登入-iOS和Android設定說明.md)

### 步驟 1.9：記錄重要資訊

在繼續之前，請確認您已經記錄以下資訊：

**台灣 Channel - Basic settings**：
- ✅ **Channel ID**：`2008600116`
- ✅ **Channel Secret**：`079ebaa784b4c00184e68bafb1841d77`
- ✅ **Region to provide the service**：Taiwan
- ✅ **Channel name**：`ChaosRegistry`
- ✅ **Email address**：`aquilonis1991@gmail.com`
- ✅ **Privacy policy URL**：`https://chaos-registry.vercel.app/privacy`
- ✅ **Terms of use URL**：`https://chaos-registry.vercel.app/terms`
- ✅ **App types**：Mobile app ✅, Web app ✅
- ✅ **Permissions**：PROFILE ✅, OPENID_CONNECT ✅
- ⚠️ **Email address permission**：Unapplied（如需取得 Email，需要申請）

**LINE Login 設定**：
- ✅ **Callback URLs**：
  - `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
  - `votechaos://auth/callback`

**Mobile App 設定**（iOS/Android）：
- ✅ **iOS bundle ID**：`com.votechaos.app`
- ✅ **Package names**：`com.votechaos.app`
- ✅ **Package signatures (SHA-1)**：`F5:86:DD:40:47:B2:40:A7:CD:89:75:34:B6:EB:17:64:6A:BD:10:1A`
- ✅ **Android URL scheme**：`votechaos://auth/callback` 或 `votechaos`

**Assertion Signing Key**：
- **狀態**：✅ 已生成並註冊（2025-01-29）
- **Key ID (kid)**：`cc31abb4-94d1-4655-aba2-2e7a7e4ab126`
- **私鑰**：已記錄在 [私鑰保管說明](./LINE-AssertionSigningKey-私鑰保管說明.md)

**其他資訊**：
- **Your user ID**：`U02901d2e21fd6bda709906d79d2a16c6`

> **⚠️ 安全提醒**：Channel Secret 是敏感資訊，請妥善保管，不要公開分享。

---

## 多地區設定方案（台灣 + 日本）

### ⚠️ LINE Channel 地區限制

**重要說明**：
- LINE Login Channel 在建立時必須選擇一個服務地區（Service Region）
- **一個 Channel 只能服務一個地區**
- 台灣 Channel 無法服務日本用戶，反之亦然

### 解決方案

#### 方案 1：建立兩個 Channel（推薦）✅

**適用情況**：需要同時服務台灣和日本用戶

**步驟**：

1. **建立台灣 Channel** ✅ 已完成
   - 在 Provider 中建立第一個 LINE Login Channel
   - 選擇服務地區：**「Taiwan（台灣）」**
   - Channel 名稱：`ChaosRegistry Login (Taiwan)`
   - **Channel ID**：`2008600116`
   - **Channel Secret**：`079ebaa784b4c00184e68bafb1841d77`

2. **建立日本 Channel**
   - 在同一個 Provider 中建立第二個 LINE Login Channel
   - 選擇服務地區：**「Japan（日本）」**
   - Channel 名稱：`ChaosRegistry Login (Japan)`
   - 記錄 Channel ID 和 Channel Secret

3. **在 Supabase 中設定**
   - ⚠️ **限制**：Supabase 的 LINE Provider 只能設定一個 Channel ID 和 Channel Secret
   - **建議**：選擇主要地區的 Channel（例如：台灣）
   - 日本用戶可能需要使用其他登入方式（Email/Password、Discord 等）

4. **前端動態選擇（進階）**
   - 如果需要根據用戶地區動態選擇 Channel，需要自訂實作
   - 這需要修改前端程式碼，根據用戶語言或地區選擇不同的 OAuth 端點
   - **注意**：Supabase 不直接支援此功能，需要額外開發

#### 方案 2：選擇主要地區（簡單但有限制）

**適用情況**：主要用戶集中在一個地區

**步驟**：

1. **選擇主要地區**
   - 根據您的用戶分布，選擇台灣或日本
   - 例如：如果 80% 用戶在台灣，選擇台灣

2. **建立單一 Channel**
   - 只建立一個 Channel，選擇主要地區
   - 另一個地區的用戶可以使用其他登入方式

3. **優點**：
   - 設定簡單，無需額外開發
   - 符合 Supabase 的單一 Channel 限制

4. **缺點**：
   - 另一個地區的用戶無法使用 LINE 登入
   - 可能影響用戶體驗

#### 方案 3：使用 LINE 國際版 Channel（如果可用）

**說明**：
- 某些情況下，LINE 可能提供跨地區的 Channel
- 需要聯繫 LINE 官方確認是否支援

**步驟**：
1. 聯繫 LINE Developers 支援
2. 詢問是否有跨地區的 Channel 選項
3. 如果可用，按照官方指引設定

### 推薦方案

**對於您的專案（台灣 + 日本）**：

1. **短期方案**（推薦）✅ 已實作：
   - ✅ 台灣 Channel 已建立
   - ✅ Channel ID：`2008600116`
   - ✅ Channel Secret：`079ebaa784b4c00184e68bafb1841d77`
   - 在 Supabase 中設定台灣 Channel 的 ID 和 Secret
   - 日本用戶可以使用 Discord、Google 等其他登入方式
   - 優點：設定簡單，快速上線
   - 缺點：日本用戶無法使用 LINE 登入

2. **長期方案**（進階）：
   - 建立兩個 Channel（台灣 ✅ 已完成 和 日本）
   - 開發自訂的 OAuth 流程，根據用戶地區動態選擇 Channel
   - 或使用環境變數在不同環境使用不同的 Channel
   - 優點：兩個地區的用戶都能使用 LINE 登入
   - 缺點：需要額外開發工作（參考 [工作量評估](./LINE多地區登入-工作量評估.md)）

### 記錄多個 Channel 資訊

如果您建立了兩個 Channel，請記錄以下資訊：

**台灣 Channel**：
- Channel ID：`2008600116`
- Channel Secret：`079ebaa784b4c00184e68bafb1841d77`
- 服務地區：Taiwan

**日本 Channel**：
- Channel ID：`（請填入）`
- Channel Secret：`（請填入）`
- 服務地區：Japan

---

## Part 2：Supabase 設定

> **⚠️ 重要**：Supabase **不直接支援** LINE 作為第三方登入提供者  
> **解決方案**：需要使用自訂實作（Edge Function 或前端直接實作）  
> **詳細說明**：請參考 [LINE 登入 - 自訂實作指南](./LINE登入-自訂實作指南.md)

---

### ⚠️ Supabase 不支援 LINE Provider

**重要說明**：
- Supabase 的 Authentication → Providers 中**沒有 LINE 選項**
- 無法使用 `supabase.auth.signInWithOAuth({ provider: 'line' })`
- 需要自訂實作 LINE OAuth 2.0 流程

**替代方案**：
1. ✅ **使用 Supabase Edge Function**（推薦）
   - 在 Edge Function 中處理 LINE OAuth 流程
   - 安全性高，可以與 Supabase Auth 整合
   - 詳細說明：見 [LINE 登入 - 自訂實作指南](./LINE登入-自訂實作指南.md)

2. ⚠️ **前端直接實作**（不推薦）
   - 前端直接處理 LINE OAuth 流程
   - 安全性較低，不建議使用

**如果您需要實作 LINE 登入**：
- 請跳過以下 Supabase Provider 設定步驟
- 直接參考 [LINE 登入 - 自訂實作指南](./LINE登入-自訂實作指南.md)

---

### 以下內容僅供參考（如果未來 Supabase 支援 LINE）

以下步驟是假設 Supabase 支援 LINE 的情況下的設定步驟。**目前 Supabase 不支援 LINE**，這些步驟無法執行。

---

### 步驟 2.1：登入 Supabase Dashboard

1. **前往 Supabase Dashboard**
   - 網址：https://app.supabase.com/
   - 使用您的 Supabase 帳號登入

2. **選擇專案**
   - 在專案列表中，選擇專案名稱：`votechaos`
   - 或直接訪問：`https://app.supabase.com/project/epyykzxxglkjombvozhr`

### 步驟 2.2：設定 URL Configuration

1. **進入 Authentication 設定**
   - 在左側導航欄，點擊 **「Authentication」**
   - 然後點擊 **「URL Configuration」** 標籤

2. **設定 Site URL**
   - 在 **「Site URL」** 欄位中填入：
     ```
     https://chaos-registry.vercel.app
     ```
   - 或您的正式網站網址
   - 這是 OAuth 授權完成後的預設重定向網址

3. **設定 Additional Redirect URLs**
   - 在 **「Redirect URLs」** 區塊中，點擊 **「Add URL」** 或直接在輸入框中添加
   - 添加以下 URL（每行一個）：
     ```
     https://chaos-registry.vercel.app/home
     votechaos://auth/callback
     ```
   - **說明**：
     - 第一行是 Web 版完成登入後的重定向網址
     - 第二行是 App 版的 Deep Link
   - 點擊 **「Save」** 按鈕

### 步驟 2.3：啟用 LINE Provider

1. **進入 Providers 設定**
   - 在 **Authentication** 頁面中，點擊 **「Providers」** 標籤
   - 或直接訪問：`https://app.supabase.com/project/epyykzxxglkjombvozhr/auth/providers`

2. **找到 LINE Provider**
   - 在 Provider 列表中，找到 **「LINE」**
   - 如果找不到，可以使用搜尋功能

3. **啟用 LINE Provider**
   - 點擊 LINE 卡片右上角的 **開關**，切換為 **「Enabled」**
   - 或點擊 LINE 卡片進入詳細設定頁面

### 步驟 2.4：填入 LINE OAuth 憑證

1. **進入 LINE Provider 設定頁面**
   - 點擊 LINE 卡片，進入詳細設定頁面

2. **填入 Channel ID** ⚠️ 多地區注意
   - 在 **「Channel ID」** 欄位中
   - 貼上從 LINE Developers Console 複製的 **Channel ID**
   - **您的台灣 Channel ID**：`2008600116`
   - 格式：`1234567890`
   - **重要**：請確認 Channel ID 正確無誤
   
   **如果您建立了兩個 Channel（台灣和日本）**：
   - ⚠️ **Supabase 只能設定一個 Channel ID**
   - **建議**：選擇主要地區的 Channel（例如：台灣）
   - 另一個地區的用戶將無法使用 LINE 登入（需要使用其他登入方式）
   - 如果需要支援兩個地區，請參考 [多地區設定方案](#多地區設定方案) 中的進階方案

3. **填入 Channel Secret**
   - 在 **「Channel Secret」** 欄位中
   - 貼上從 LINE Developers Console 複製的 **Channel Secret**
   - **您的台灣 Channel Secret**：`079ebaa784b4c00184e68bafb1841d77`
   - 格式：`abcdefghijklmnopqrstuvwxyz123456789`
   - **注意**：此欄位會自動隱藏，輸入後只會顯示部分字元
   - **⚠️ 安全提醒**：Channel Secret 是敏感資訊，請妥善保管

4. **設定「Allow users without an email」** ✅ 建議勾選
   - 在 LINE Provider 設定頁面中，找到 **「Allow users without an email」** 選項
   - **建議勾選此選項** ✅
   - **原因**：
     - LINE 用戶可能沒有驗證 Email
     - 如果未勾選，當 LINE 沒有返回 Email 時，用戶登入可能會失敗
     - 勾選後，即使 LINE 沒有返回 Email，用戶也能成功登入
     - 專案的用戶系統支援沒有 Email 的用戶（使用 nickname 作為識別）
   - **注意**：即使勾選此選項，如果 LINE 有返回 Email，系統仍會記錄該 Email

5. **確認 Scopes（可選）**
   - Supabase 預設會使用 `profile`、`openid` 和 `email` scopes
   - 通常不需要修改

6. **儲存設定**
   - 點擊頁面底部的 **「Save」** 按鈕
   - 或點擊右上角的 **「Save」** 按鈕
   - 儲存成功後，會顯示綠色成功訊息

### 步驟 2.5：驗證設定

1. **檢查 Provider 狀態**
   - 回到 Providers 列表頁面
   - 確認 LINE Provider 顯示為 **「Enabled」**（綠色）

2. **檢查 Redirect URL**
   - 在 LINE Provider 設定頁面中
   - 確認 **「Redirect URL」** 顯示為：
     ```
     https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
     ```
   - 這應該與您在 LINE Developers Console 中設定的 Callback URL 一致

---

## Part 3：App 端設定（iOS/Android）

### 3.1：Deep Link 設定（已完成）✅

**說明**：Deep Link (`votechaos://auth/callback`) 已在專案中實作完成，無需額外設定。

**已完成的設定**：
- ✅ Android：`AndroidManifest.xml` 已添加 Intent Filter
- ✅ iOS：`Info.plist` 已添加 URL Types，`AppDelegate.swift` 已更新處理 URL
- ✅ 前端：`src/pages/AuthPage.tsx` 已更新 `redirectTo` 邏輯，`src/lib/app-lifecycle.ts` 已更新處理 OAuth 回調

**參考文件**：
- [Deep Link 設定完成報告](./DeepLink設定完成報告.md)

### 3.2：前端程式碼檢查

前端程式碼已經正確實現，位於 `src/pages/AuthPage.tsx`：

```typescript
const handleSocialLogin = async (provider: 'google' | 'apple' | 'discord' | 'facebook' | 'line') => {
  try {
    // 在 App 版使用 Deep Link，Web 版使用 HTTPS URL
    const redirectUrl = isNative() 
      ? 'votechaos://auth/callback'  // App 版使用 Deep Link
      : `${publicSiteUrl}/home`;      // Web 版使用 HTTPS URL

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      const providerNames: Record<string, string> = {
        'google': 'Google',
        'apple': 'Apple',
        'discord': 'Discord',
        'facebook': 'Facebook',
        'line': 'LINE'
      };
      const providerName = providerNames[provider] || provider;
      toast.error(getText('auth_social_login_error', `${providerName}登入失敗`));
    }
  } catch (error) {
    toast.error(getText('auth_login_error', '登入失敗，請稍後再試'));
  }
};
```

**UI 按鈕**：
- ✅ LINE 登入按鈕已存在於 `AuthPage.tsx` 中
- ✅ 點擊按鈕會觸發 `handleSocialLogin('line')`

---

## Part 4：測試與驗證

### 4.1：Web 版測試

1. **開啟應用**
   - 在瀏覽器中打開：`https://chaos-registry.vercel.app/auth`
   - 或本地開發環境：`http://localhost:8080/auth`

2. **點擊 LINE 登入按鈕**
   - 應該會跳轉到 LINE 授權頁面
   - 頁面會顯示應用程式名稱和請求的權限

3. **完成授權**
   - 使用您的 LINE 帳號登入
   - 點擊 **「同意」** 授權應用
   - 應該會重定向回應用（`/home`）

4. **驗證登入狀態**
   - 檢查是否成功登入
   - 檢查用戶資料是否正確載入
   - 檢查是否顯示 LINE 頭像和名稱

### 4.2：App 版測試（Android/iOS）

1. **在 App 中點擊 LINE 登入按鈕**
   - 應該會打開瀏覽器或 LINE App，顯示授權頁面

2. **完成授權**
   - 使用您的 LINE 帳號登入
   - 點擊 **「同意」** 授權應用
   - 應該會透過 Deep Link (`votechaos://auth/callback`) 返回 App

3. **驗證登入狀態**
   - 檢查是否成功登入
   - 檢查是否顯示「登入成功！」提示
   - 檢查是否自動導航到首頁

### 4.3：檢查日誌

在測試過程中，請檢查以下日誌：

**Web 版（瀏覽器控制台）**：
```javascript
// 應該看到
[AuthPage] handleSocialLogin: line
// 應該跳轉到 LINE 授權頁面
```

**App 版（Logcat / Xcode Console）**：
```
// 應該看到
App opened with URL: votechaos://auth/callback#access_token=...
OAuth callback detected, handling authentication...
[OAuthCallbackHandler] Processing OAuth callback
[OAuthCallbackHandler] Setting session from OAuth callback tokens
[OAuthCallbackHandler] Session set successfully, user authenticated
```

---

## Part 5：常見問題與排錯

### 問題 1：Callback URL 不匹配

**錯誤訊息**：
- `redirect_uri_mismatch`
- `Invalid redirect URI`

**解決方案**：
1. 確認 LINE Developers Console 中的 Callback URL 與 Supabase 的 Redirect URL 完全一致
2. 確認兩個 Callback URL 都已添加：
   - `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - `votechaos://auth/callback`
3. 確認 Supabase Dashboard 中的 Additional Redirect URLs 也包含這兩個 URL

### 問題 2：Channel ID 或 Channel Secret 錯誤

**錯誤訊息**：
- `Invalid client credentials`
- `Authentication failed`

**解決方案**：
1. 確認 Channel ID 和 Channel Secret 已正確複製（沒有多餘空格）
2. 確認在 Supabase Dashboard 中填入的是 Channel ID（不是 Provider ID）
3. 如果 Channel Secret 遺失，需要在 LINE Developers Console 中重新產生

### 問題 3：App 版無法返回 App

**錯誤訊息**：
- App 授權後停留在瀏覽器
- 沒有觸發 Deep Link

**解決方案**：
1. 確認 `AndroidManifest.xml` 中的 Intent Filter 已正確設定
2. 確認 `Info.plist` 中的 URL Types 已正確設定
3. 確認 `AppDelegate.swift` 中的 URL 處理邏輯已正確實作
4. 檢查 Logcat / Xcode Console 中是否有 `appUrlOpen` 事件

### 問題 4：LINE 登入後沒有 Email

**錯誤訊息**：
- `Email not provided`
- `User email is missing`

**解決方案**：
1. **在 LINE Developers Console 中申請 Email 權限**：
   - 進入 Channel 設定 → Basic settings → OpenID Connect
   - 找到 **「Email address permission」**
   - 如果顯示 **「Unapplied」**，點擊 **「Apply」** 或 **「Request」** 按鈕
   - 填寫申請表單：
     - 勾選兩個同意條款
     - 上傳截圖（顯示應用程式如何請求用戶同意並說明收集 Email 的目的）
     - 建議截圖：隱私權政策頁面（`https://chaos-registry.vercel.app/privacy`）
   - 提交後等待 LINE 審核（通常需要 1-3 個工作天）
   - **詳細說明**：請參考 [LINE Email 權限申請指南](./LINE-Email權限申請指南.md)

2. **在 Supabase Dashboard 中，勾選 **「Allow users without an email」** 選項**：
   - 這可以讓沒有 Email 的用戶也能成功登入
   - 即使 LINE 未返回 Email，用戶仍可使用應用程式
   - **重要**：即使申請通過 Email 權限，仍建議勾選此選項

3. **確認 LINE 用戶已驗證 Email**：
   - 用戶需要在 LINE 設定中驗證 Email
   - 如果用戶未驗證 Email，LINE 可能不會返回 Email 地址
   - 即使申請通過 Email 權限，未驗證 Email 的用戶仍無法取得 Email

4. **確認 LINE Login Channel 已啟用 OpenID Connect**：
   - 在 Basic settings 中，確認 **「OPENID_CONNECT」** 權限已啟用
   - 這是取得 Email 的前提條件

### 問題 5：授權頁面顯示錯誤

**錯誤訊息**：
- `Application not found`
- `Channel not found`

**解決方案**：
1. 確認 Channel 已正確建立
2. 確認 Channel 狀態為 **「Published」**（已發布）
3. 確認服務地區設定正確（例如：台灣）

### 問題 6：測試環境限制

**說明**：
- LINE Login 在開發階段可能需要通過審核才能在生產環境中使用
- 開發階段可以在 LINE Developers Console 中設定測試環境

**解決方案**：
1. 在 LINE Developers Console 中，確認 Channel 狀態
2. 如果需要，申請 Channel 審核
3. 在審核通過前，可以使用測試帳號進行測試

### 問題 7：如何同時支援台灣和日本用戶？

**問題**：
- 建立了一個台灣 Channel，但日本用戶無法使用 LINE 登入
- 或者建立了一個日本 Channel，但台灣用戶無法使用

**解決方案**：

**方案 A：選擇主要地區（簡單）**
1. 根據用戶分布選擇主要地區
2. 只建立一個 Channel（例如：台灣）
3. 另一個地區的用戶使用其他登入方式（Discord、Google 等）

**方案 B：建立兩個 Channel（需要進階實作）**
1. 建立兩個 Channel（台灣和日本各一個）
2. 在 Supabase 中設定主要地區的 Channel
3. 開發自訂邏輯，根據用戶地區動態選擇 Channel
   - 這需要修改前端程式碼，不直接使用 Supabase 的 `signInWithOAuth`
   - 需要直接調用 LINE Login API，並手動處理 OAuth 流程

**方案 C：使用環境變數（開發/生產分離）**
1. 開發環境使用台灣 Channel
2. 生產環境使用日本 Channel（或反之）
3. 通過環境變數切換 Channel ID 和 Secret

---

## 📝 檢查清單

在完成設定後，請確認以下項目：

### LINE Developers Console - Basic settings
- [ ] Provider 已建立
- [ ] LINE Login Channel 已建立（台灣）
- [ ] Channel ID 已複製：`2008600116` ✅
- [ ] Channel Secret 已複製並妥善保存：`079ebaa784b4c00184e68bafb1841d77` ✅
- [ ] Region to provide the service：Taiwan ✅
- [ ] Company or owner's country or region：已選擇 ✅
- [ ] Channel name：`ChaosRegistry` ✅
- [ ] Channel description：已填寫 ✅
- [ ] Email address：`aquilonis1991@gmail.com` ✅
- [ ] Privacy policy URL：`https://chaos-registry.vercel.app/privacy` ✅
- [ ] Terms of use URL：`https://chaos-registry.vercel.app/terms` ✅
- [ ] App types：Mobile app ✅, Web app ✅
- [ ] Permissions：PROFILE ✅, OPENID_CONNECT ✅
- [ ] Email address permission：已申請（如需取得 Email）⚠️ 目前顯示 Unapplied
  - [ ] 已勾選兩個同意條款
  - [ ] 已上傳截圖（顯示 Email 收集說明）
  - [ ] 已提交申請，等待審核（1-3 個工作天）
- [ ] Assertion Signing Key：✅ 已生成並註冊
  - [x] 已生成 RSA 金鑰對 ✅
  - [x] 公鑰已提交到 LINE Console ✅
  - [x] Key ID (kid) 已記錄：`cc31abb4-94d1-4655-aba2-2e7a7e4ab126` ✅
  - [ ] 私鑰已妥善備份 ⚠️ 請查看 [私鑰保管說明](./LINE-AssertionSigningKey-私鑰保管說明.md)

### LINE Developers Console - LINE Login 設定
- [ ] Callback URL 已添加（兩個：HTTPS 和 Deep Link）✅
  - `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
  - `votechaos://auth/callback`
- [ ] Mobile App 設定已完成（iOS/Android）✅
  - iOS bundle ID：`com.votechaos.app`
  - Package names：`com.votechaos.app`
  - Package signatures (SHA-1)：`F5:86:DD:40:47:B2:40:A7:CD:89:75:34:B6:EB:17:64:6A:BD:10:1A`
  - Android URL scheme：`votechaos://auth/callback` 或 `votechaos`

### Supabase Dashboard ⚠️ 不支援 LINE Provider

**重要**：Supabase **不直接支援** LINE 作為第三方登入提供者，無法在 Supabase Dashboard 中設定 LINE Provider。

**替代方案**：
- [ ] 已閱讀 [LINE 登入 - 自訂實作指南](./LINE登入-自訂實作指南.md)
- [ ] 已選擇實作方案（推薦：Supabase Edge Function）
- [ ] Edge Function 已建立並部署（如果使用方案 1）
- [ ] 前端程式碼已更新（處理 LINE 登入）
- [ ] 環境變數已設定（LINE_CHANNEL_ID, LINE_CHANNEL_SECRET）
- [ ] LINE 登入功能已測試

**如果未來 Supabase 支援 LINE**（目前不支援）：
- [ ] URL Configuration 已設定 Site URL (`https://chaos-registry.vercel.app`)
- [ ] Additional Redirect URLs 已添加 `votechaos://auth/callback`
- [ ] LINE Provider 已啟用
- [ ] Channel ID 已填入：`2008600116`
- [ ] Channel Secret 已填入：`079ebaa784b4c00184e68bafb1841d77`
- [ ] 「Allow users without an email」已勾選（建議）

### App 端（已完成）✅
- [ ] AndroidManifest.xml 已添加 Intent Filter
- [ ] iOS Info.plist 已添加 URL Types
- [ ] iOS AppDelegate.swift 已更新處理 URL
- [ ] AuthPage.tsx 已更新 `redirectTo` 邏輯
- [ ] app-lifecycle.ts 已更新處理 OAuth 回調
- [ ] OAuthCallbackHandler 組件已實作

### 測試
- [ ] Web 版 LINE 登入測試成功
- [ ] App 版 LINE 登入測試成功
- [ ] 登入後用戶資料正確載入
- [ ] 登入後自動導航到首頁

---

## 🔗 相關文件

- [LINE 登入 - 自訂實作指南](./LINE登入-自訂實作指南.md) ⚠️ **重要：Supabase 不支援 LINE，需要自訂實作**
- [LINE Assertion Signing Key 設定指南](./LINE-AssertionSigningKey設定指南.md) 🔑 **如何生成和提交公鑰**
- [LINE Email 權限申請指南](./LINE-Email權限申請指南.md) 📧 **如何申請 Email 權限**
- [LINE 登入 - iOS 和 Android 設定說明](./LINE登入-iOS和Android設定說明.md) 📱 **詳細說明每個欄位**
- [Discord 第三方登入完整設定指南](./Discord第三方登入完整設定指南.md)
- [第三方登入共用設定](./第三方登入共用設定.md)
- [Deep Link 設定完成報告](./DeepLink設定完成報告.md)
- [Discord 登入 - 帳號連結說明](./Discord登入-帳號連結說明.md)

---

## 📞 支援資源

- [LINE Developers 官方文件](https://developers.line.biz/zh-hant/docs/line-login/)
- [LINE Login API 參考](https://developers.line.biz/zh-hant/reference/line-login-api/)
- [Supabase LINE Provider 文件](https://supabase.com/docs/guides/auth/social-login/auth-line)

---

## 進階：多地區動態選擇 Channel（可選）

### 說明

如果您需要同時支援台灣和日本用戶使用 LINE 登入，且 Supabase 的單一 Channel 限制無法滿足需求，可以實作自訂的 OAuth 流程。

### 實作方式

**注意**：此方案需要額外開發工作，且不直接使用 Supabase 的 `signInWithOAuth`。

1. **建立兩個 Channel**
   - 台灣 Channel：記錄 Channel ID 和 Secret
   - 日本 Channel：記錄 Channel ID 和 Secret

2. **根據用戶地區選擇 Channel**
   ```typescript
   // 在 AuthPage.tsx 中
   const handleLineLogin = async () => {
     // 根據用戶語言或地區選擇 Channel
     const userLanguage = language; // 'zh-TW' 或 'ja'
     const isJapan = userLanguage === 'ja';
     
     const channelId = isJapan 
       ? process.env.VITE_LINE_CHANNEL_ID_JP 
       : process.env.VITE_LINE_CHANNEL_ID_TW;
     
     // 直接調用 LINE Login API（需要自訂實作）
     // 或使用環境變數切換 Supabase 的 Channel 設定
   };
   ```

3. **使用環境變數**
   - 在 `.env` 中設定不同環境的 Channel ID
   - 根據部署環境切換使用

### 限制

- Supabase 的 LINE Provider 只能設定一個 Channel
- 需要額外開發工作
- 維護成本較高

### 建議

**對於大多數情況**：
- 建議選擇主要地區的 Channel
- 另一個地區的用戶使用其他登入方式
- 這樣可以保持設定的簡單性和維護性

---

## ✅ 完成

完成以上所有步驟後，LINE 第三方登入功能應該可以正常運作。如果遇到任何問題，請參考 [Part 5：常見問題與排錯](#part-5常見問題與排錯) 或查看相關文件。

**多地區提醒**：
- 如果只需要服務一個地區，按照指南設定即可
- 如果需要同時服務台灣和日本，請參考 [多地區設定方案](#多地區設定方案) 選擇適合的方案

