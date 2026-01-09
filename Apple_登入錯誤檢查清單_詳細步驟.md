# Apple 登入錯誤檢查清單 - 詳細步驟

## 🔍 錯誤訊息

```
invalid_request
Invalid client id or web redirect url.
```

## 📋 完整檢查步驟

---

## 第一部分：Apple Developer Portal 檢查

### 1. 檢查 Services ID 的 Return URL

#### 步驟 1.1：前往 Apple Developer Portal
1. 開啟瀏覽器
2. 前往：https://developer.apple.com/account/
3. 使用您的 Apple ID 登入

#### 步驟 1.2：導航到 Services IDs
1. 在首頁，找到並點擊「**Certificates, Identifiers & Profiles**」
   - 位置：頁面頂部或左側導航欄
2. 在左側導航欄，點擊「**Identifiers**」
   - 位置：左側選單中的第一個項目
3. 在頂部標籤，點擊「**Services IDs**」
   - 位置：Identifiers 頁面頂部的標籤（App IDs、Services IDs、Website IDs 等）

#### 步驟 1.3：找到您的 Services ID
1. 在 Services IDs 列表中，找到並點擊：
   - **Identifier**：`com.votechaos.app.services`
   - **Name**：`ChaosRegistry Web Services`
2. 點擊進入詳細頁面

#### 步驟 1.4：檢查 Sign In with Apple 設定
1. 在 Services ID 詳細頁面中，找到「**Sign In with Apple**」項目
   - 位置：頁面中間的 Capabilities 區域
2. 確認狀態：
   - 應該顯示「**Enabled**」或「**已啟用**」
   - 應該有「**Configure**」按鈕
3. 點擊「**Configure**」按鈕

#### 步驟 1.5：檢查 Return URL 設定
1. 在彈出視窗或設定頁面中，找到「**Website URLs**」區塊
   - 位置：設定頁面的中間區域
2. 檢查「**Domains and Subdomains**」：
   - 應該顯示：`chaos-registry.vercel.app`
   - 只包含網域，不包含 `https://` 或路徑
3. 檢查「**Return URLs**」：
   - 必須包含：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
   - 必須完全匹配，包括：
     - ✅ `https://`（必須包含）
     - ✅ `epyykzxxglkjombvozhr.supabase.co`（完整網域）
     - ✅ `/auth/v1/callback`（完整路徑）
4. 如果 Return URL 不存在或錯誤：
   - 點擊「**Edit**」或「**+**」按鈕
   - 在 Return URLs 欄位中輸入：
     ```
     https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
     ```
   - 點擊「**Save**」
   - 點擊「**Continue**」或「**Done**」
   - 在 Services ID 頁面點擊「**Save**」

#### 步驟 1.6：檢查 Primary App ID
1. 在 Sign In with Apple 設定頁面中，找到「**Primary App ID**」欄位
   - 位置：設定頁面的頂部
2. 確認已選擇：
   - `com.votechaos.app`
   - 如果沒有下拉選單，可能已自動關聯

#### 步驟 1.7：檢查 Server-to-Server Notification Endpoint（可選）
1. 在 Sign In with Apple 設定頁面底部，找到「**Server-to-Server Notification Endpoint**」欄位
2. 可以填入（可選）：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/functions/v1/apple-notification
   ```
   - 或留空（如果尚未部署 Edge Function）

#### 步驟 1.8：儲存設定
1. 確認所有設定正確後
2. 點擊「**Save**」按鈕
3. 如果是在彈出視窗中，點擊「**Continue**」或「**Done**」
4. 在 Services ID 頁面，點擊「**Save**」（如果有）
5. 等待設定儲存完成

---

### 2. 檢查 App ID 的 Capabilities

#### 步驟 2.1：導航到 App IDs
1. 在 Apple Developer Portal > Identifiers 頁面
2. 在頂部標籤，點擊「**App IDs**」
   - 位置：Identifiers 頁面頂部的標籤

#### 步驟 2.2：找到您的 App ID
1. 在 App IDs 列表中，找到並點擊：
   - **Identifier**：`com.votechaos.app`
   - **Name**：`ChaosRegistry iOS App`
2. 點擊進入詳細頁面

#### 步驟 2.3：檢查 Capabilities
1. 在 App ID 詳細頁面中，找到「**Capabilities**」區域
   - 位置：頁面中間
2. 確認已啟用：
   - ✅ **Sign In with Apple**：必須啟用
   - ✅ **Push Notifications**：建議啟用
   - ✅ **In-App Purchase**：建議啟用（如果使用內購）

---

## 第二部分：Supabase Dashboard 檢查

### 3. 檢查 Supabase Apple Provider 設定

#### 步驟 3.1：前往 Supabase Dashboard
1. 開啟瀏覽器
2. 前往：https://app.supabase.com/
3. 使用您的帳號登入

#### 步驟 3.2：選擇專案
1. 在 Dashboard 首頁，找到並點擊專案：
   - **Project Name**：您的專案名稱
   - **Project ID**：`epyykzxxglkjombvozhr`
   - 或從專案列表中選擇

#### 步驟 3.3：導航到 Authentication 設定
1. 在左側導航欄，找到並點擊「**Authentication**」
   - 位置：左側選單中的第三或第四個項目（通常在 Database、Storage 之後）
2. 點擊後會展開子選單

#### 步驟 3.4：導航到 Providers
1. 在 Authentication 子選單中，點擊「**Providers**」
   - 位置：Authentication 下的第一個選項
2. 您會看到所有 OAuth providers 的列表

#### 步驟 3.5：找到並開啟 Apple Provider
1. 在 Providers 列表中，找到「**Apple**」卡片
   - 位置：列表中的某個位置（按字母順序或位置排序）
2. 確認狀態：
   - 如果開關是「**關閉**」狀態：
     - 點擊開關按鈕，將其切換為「**開啟**」
   - 如果開關是「**開啟**」狀態：
     - 點擊「**Configure**」按鈕（通常在卡片上）
3. 點擊「**Configure**」按鈕或點擊「**Apple**」卡片

#### 步驟 3.6：檢查 Enable Apple provider
1. 在 Apple Provider 設定頁面頂部，找到「**Enable Apple provider**」開關
   - 位置：頁面頂部
2. 確認開關是「**開啟**」狀態
   - 如果是關閉，請點擊切換為開啟

#### 步驟 3.7：檢查 Client IDs（重要）
1. 找到「**Client IDs**」欄位
   - 位置：設定頁面的中間區域，通常在 Enable Apple provider 下方
2. 確認內容：
   - 必須包含兩個 ID，用逗號分隔：
     ```
     com.votechaos.app.services,com.votechaos.app
     ```
   - ✅ 第一個 ID：`com.votechaos.app.services`（Services ID）
   - ✅ 第二個 ID：`com.votechaos.app`（App ID）
   - ✅ 用逗號分隔，沒有空格
3. 如果只有一個 ID 或格式錯誤：
   - 請修改為：`com.votechaos.app.services,com.votechaos.app`
   - 確保沒有多餘的空格

#### 步驟 3.8：檢查 Secret Key (for OAuth)
1. 找到「**Secret Key (for OAuth)**」欄位
   - 位置：Client IDs 下方
2. 確認格式：
   - 應該是一個長字串，類似：
     ```
     eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik05VTc0S0daREEifQ.eyJpc3MiOiI3NDQ0WDk1OTlSIiwiaWF0IjoxNzY3OTIwNzUyLCJleHAiOjE3ODM0NzI3NTIsImF1ZCI6Imh0dHBzOi8vYXBwbGVpZC5hcHBsZS5jb20iLCJzdWIiOiJjb20udm90ZWNoYW9zLmFwcC5zZXJ2aWNlcyJ9.ZeK82xqRpUN47IkLGJYPNnx6Md201dTih-K-DQ_60ntosgeWZ3G4_bch2jgo4UK46VsiXnZ6lD0CEupaYwEd5A
     ```
   - 這是 JWT Token（通常包含三個部分，用 `.` 分隔）
   - ✅ 正確：長字串，包含 `.` 分隔符
   - ❌ 錯誤：如果顯示 `-----BEGIN PRIVATE KEY-----` 開頭，這是 `.p8` 檔案內容，不是 JWT Token
3. 如果顯示的是 `.p8` 檔案內容：
   - 需要使用 JWT Token 替換
   - 從 `secrets/apple-jwt-token.txt` 檔案中複製 JWT Token
   - 或重新生成 JWT Token

#### 步驟 3.9：檢查 Allow users without an email
1. 找到「**Allow users without an email**」選項
   - 位置：Secret Key 下方
2. 確認狀態：
   - ✅ 建議：已勾選
   - 允許用戶選擇隱藏郵件地址時仍能登入

#### 步驟 3.10：檢查 Callback URL (for OAuth)
1. 找到「**Callback URL (for OAuth)**」欄位
   - 位置：Allow users without an email 下方
2. 確認內容：
   - 必須是：
     ```
     https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
     ```
   - 必須完全匹配 Apple Developer 的 Return URL
   - 包括：
     - ✅ `https://`（必須包含）
     - ✅ `epyykzxxglkjombvozhr.supabase.co`（完整網域）
     - ✅ `/auth/v1/callback`（完整路徑）
3. 如果內容不同或錯誤：
   - 請修改為上述正確格式

#### 步驟 3.11：儲存設定
1. 確認所有欄位都已正確填寫
2. 向下滾動到頁面底部
3. 找到並點擊「**Save**」按鈕
   - 位置：頁面底部，通常在最右側
4. 等待儲存完成
5. 確認沒有錯誤訊息

---

### 4. 檢查 Supabase Redirect URLs

#### 步驟 4.1：導航到 URL Configuration
1. 在 Supabase Dashboard，左側導航欄
2. 點擊「**Authentication**」
3. 在 Authentication 子選單中，點擊「**URL Configuration**」
   - 位置：Authentication 下的選項之一

#### 步驟 4.2：檢查 Redirect URLs
1. 找到「**Redirect URLs**」區域
   - 位置：URL Configuration 頁面的中間區域
2. 檢查是否包含：
   ```
   https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
   ```
   - 這是 Supabase 的標準回調 URL
   - 必須完全匹配
3. 可能還包含其他 URL：
   ```
   https://chaos-registry.vercel.app/**
   ```
   ```
   http://localhost:8080/**
   ```
   - 這些是額外的 Redirect URLs，不影響 Apple 登入

#### 步驟 4.3：添加 Redirect URL（如果需要）
1. 如果缺少標準回調 URL：
   - 點擊「**Add URL**」或「**+**」按鈕
   - 輸入：
     ```
     https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
     ```
   - 點擊「**Save**」

#### 步驟 4.4：檢查 Site URL
1. 找到「**Site URL**」欄位
   - 位置：URL Configuration 頁面頂部
2. 確認內容：
   - 應該是：
     ```
     https://chaos-registry.vercel.app
     ```
   - 或您的應用程式主要 URL
3. 如果不同，可以保持現有設定（不影響 Apple 登入）

---

## 第三部分：檢查本地 JWT Token

### 5. 檢查本地 JWT Token 檔案

#### 步驟 5.1：前往專案目錄
1. 開啟檔案總管（Windows Explorer）
2. 導航到：
   ```
   C:\Users\USER\Documents\Mywork\votechaos-main
   ```

#### 步驟 5.2：檢查 secrets 資料夾
1. 在專案根目錄中，找到「**secrets**」資料夾
   - 位置：專案根目錄
2. 確認資料夾存在
   - 如果不存在，需要建立

#### 步驟 5.3：檢查 apple-jwt-token.txt 檔案
1. 在 secrets 資料夾中，找到「**apple-jwt-token.txt**」檔案
2. 打開檔案（使用記事本或任何文字編輯器）
3. 檢查內容：
   - 應該是一個長字串，類似：
     ```
     eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ik05VTc0S0daREEifQ.eyJpc3MiOiI3NDQ0WDk1OTlSIiwiaWF0IjoxNzY3OTIwNzUyLCJleHAiOjE3ODM0NzI3NTIsImF1ZCI6Imh0dHBzOi8vYXBwbGVpZC5hcHBsZS5jb20iLCJzdWIiOiJjb20udm90ZWNoYW9zLmFwcC5zZXJ2aWNlcyJ9.ZeK82xqRpUN47IkLGJYPNnx6Md201dTih-K-DQ_60ntosgeWZ3G4_bch2jgo4UK46VsiXnZ6lD0CEupaYwEd5A
     ```
   - ✅ 正確：長字串，包含 `.` 分隔符，沒有換行
   - ❌ 錯誤：如果顯示 `-----BEGIN PRIVATE KEY-----`，這是錯誤的檔案

#### 步驟 5.4：如果檔案不存在或內容錯誤
1. 如果檔案不存在或內容錯誤：
   - 需要重新生成 JWT Token
   - 在終端機中執行：
     ```powershell
     cd C:\Users\USER\Documents\Mywork\votechaos-main
     $env:APPLE_TEAM_ID='7444X9599R'
     $env:APPLE_KEY_ID='M9U74KGZDA'
     node scripts/update-apple-jwt.cjs
     ```
2. 複製生成的 JWT Token
3. 貼到 Supabase Dashboard 的 Secret Key 欄位

---

## 📋 完整檢查清單

### Apple Developer Portal
- [ ] Services ID `com.votechaos.app.services` 已建立
- [ ] Services ID 的 Return URL 設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] Services ID 的 Primary App ID 設定為：`com.votechaos.app`
- [ ] Services ID 的 Domain 設定為：`chaos-registry.vercel.app`
- [ ] App ID `com.votechaos.app` 已建立
- [ ] App ID 已啟用 Sign In with Apple

### Supabase Dashboard
- [ ] Apple Provider 已啟用
- [ ] Client IDs 設定為：`com.votechaos.app.services,com.votechaos.app`（兩個 ID，逗號分隔）
- [ ] Secret Key 是 JWT Token（不是 `.p8` 檔案內容）
- [ ] Allow users without an email 已勾選（建議）
- [ ] Callback URL 設定為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
- [ ] Redirect URLs 包含：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

### 本地檔案
- [ ] `secrets/apple-jwt-token.txt` 檔案存在
- [ ] 檔案內容是 JWT Token（不是 `.p8` 檔案內容）

---

## 🧪 測試步驟

修正所有設定後：

1. 清除瀏覽器快取和 Cookie（可選）
2. 前往應用程式登入頁面
3. 點擊「使用 Apple 登入」按鈕
4. 應該會跳轉到 Apple 登入頁面
5. 完成登入後應該會重定向回應用程式

---

## ⚠️ 常見錯誤

### 錯誤 1：Client IDs 格式錯誤
- ❌ 錯誤：`com.votechaos.app.services`（只有一個 ID）
- ✅ 正確：`com.votechaos.app.services,com.votechaos.app`（兩個 ID，逗號分隔）

### 錯誤 2：Return URL / Callback URL 不匹配
- ❌ 錯誤：`epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`（缺少 `https://`）
- ✅ 正確：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`（包含 `https://`）

### 錯誤 3：Secret Key 格式錯誤
- ❌ 錯誤：`.p8` 檔案內容（`-----BEGIN PRIVATE KEY-----` 開頭）
- ✅ 正確：JWT Token（長字串，包含 `.` 分隔符）

---

## 📞 需要協助？

如果按照以上步驟檢查後仍有問題，請告訴我：
1. 每個項目的當前設定值
2. 哪個步驟遇到困難
3. 是否有任何錯誤訊息

我可以協助您逐步修正。
