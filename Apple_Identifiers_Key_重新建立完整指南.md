# Apple Identifiers 和 Key 重新建立完整指南

## 📋 概述

本指南將協助您重新建立 Apple Developer Portal 中的以下項目：
1. App ID（`com.votechaos.app`）
2. Services ID（`com.votechaos.app.services`）
3. Key（密鑰）

**注意**：Team ID 不需要重新建立，它是固定的。

---

## 🗑️ 步驟 1：刪除舊的項目（可選）

### 1.1 刪除舊的 Key

1. 前往 Apple Developer Portal > **Keys**
2. 找到舊的 Key（例如：`Supabase Sign In with Apple`）
3. 點擊進入詳細頁面
4. 點擊 **Revoke**（撤銷）按鈕
5. 確認刪除

⚠️ **重要提醒**：
- 刪除 Key 後，使用該 Key 生成的 JWT Token 會失效
- 需要重新生成 JWT Token 並更新 Supabase
- 建議：先建立新的 Key，確認正常後再刪除舊的

### 1.2 刪除舊的 Services ID

1. 前往 Apple Developer Portal > **Identifiers** > **Services IDs**
2. 找到舊的 Services ID（`com.votechaos.app.services`）
3. 點擊進入詳細頁面
4. 點擊 **Delete**（刪除）按鈕
5. 確認刪除

⚠️ **重要提醒**：
- 刪除 Services ID 後，使用該 ID 的 Apple 登入會失效
- 需要更新 Supabase 設定
- 建議：先建立新的 Services ID，確認正常後再刪除舊的

### 1.3 刪除舊的 App ID（可選）

1. 前往 Apple Developer Portal > **Identifiers** > **App IDs**
2. 找到舊的 App ID（`com.votechaos.app`）
3. 點擊進入詳細頁面
4. 點擊 **Delete**（刪除）按鈕
5. 確認刪除

⚠️ **重要提醒**：
- 刪除 App ID 會影響所有相關的設定
- 如果 App ID 正在使用中，建議不要刪除
- 建議：如果 App ID 沒有問題，可以保留不刪除

---

## 📱 步驟 2：建立新的 App ID（如果需要）

### 2.1 導航到 App IDs

1. 前往 Apple Developer Portal
2. 點擊 **Certificates, Identifiers & Profiles**
3. 在左側選單，點擊 **Identifiers**
4. 在頂部標籤，選擇 **App IDs**
5. 點擊左上角的 **+** 按鈕

### 2.2 選擇 App ID 類型

1. 選擇 **App IDs**
2. 點擊 **Continue**

### 2.3 選擇 Bundle ID 類型

1. 選擇 **Explicit**（明確的）
2. 點擊 **Continue**

### 2.4 填寫 App ID 資訊

1. **Description**（描述）：
   ```
   ChaosRegistry iOS App
   ```

2. **Bundle ID**：
   ```
   com.votechaos.app
   ```
   - ⚠️ **重要**：必須使用反向網域名稱格式
   - 不能包含星號（`*`）

3. 點擊 **Continue**

### 2.5 選擇 Capabilities

勾選以下功能：

#### 必須勾選：
- ✅ **Sign In with Apple**
- ✅ **Push Notifications**
- ✅ **In-App Purchase**

#### 不需要勾選：
- ❌ 其他所有項目

### 2.6 完成註冊

1. 檢查所有資訊
2. 點擊 **Register**
3. 確認 App ID 已建立

---

## 🌐 步驟 3：建立新的 Services ID

### 3.1 導航到 Services IDs

1. 在 **Identifiers** 頁面，點擊頂部標籤 **Services IDs**
2. 點擊左上角的 **+** 按鈕

### 3.2 選擇 Services ID 類型

1. 選擇 **Services IDs**
2. 點擊 **Continue**

### 3.3 填寫 Services ID 資訊

1. **Description**（描述）：
   ```
   ChaosRegistry Web Services
   ```
   - ⚠️ **重要**：不能使用特殊字符：`@`, `&`, `*`, `"`

2. **Identifier**（Bundle ID）：
   ```
   com.votechaos.app.services
   ```
   - ⚠️ **重要**：必須使用反向網域名稱格式
   - 不能包含星號（`*`）

3. 點擊 **Continue**

### 3.4 啟用 Sign In with Apple

1. 勾選 **Sign In with Apple**
2. 點擊 **Configure**

### 3.5 設定 Sign In with Apple

1. **Primary App ID**：
   - 從下拉選單中選擇：`com.votechaos.app`
   - 如果沒有下拉選單，可能已自動關聯

2. **Website URLs**：
   - **Domains and Subdomains**：
     ```
     chaos-registry.vercel.app
     ```
     - 只輸入網域，不要包含 `https://` 或路徑
   
   - **Return URLs**：
     - 點擊 **Add Website** 或 **+** 按鈕
     - 輸入：
       ```
       https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
       ```
     - ⚠️ **重要**：必須完全匹配，包括 `https://` 和完整路徑

3. **Server-to-Server Notification Endpoint**（可選）：
   - 目前可留空
   - 或填入：
     ```
     https://epyykzxxglkjombvozhr.supabase.co/functions/v1/apple-notification
     ```

4. 點擊 **Save**

### 3.6 完成註冊

1. 點擊 **Continue**
2. 點擊 **Register**
3. 確認 Services ID 已建立

---

## 🔑 步驟 4：建立新的 Key（密鑰）

### 4.1 導航到 Keys

1. 在 Apple Developer Portal 左側導航欄，點擊 **Keys**
2. 點擊左上角的 **+** 按鈕

### 4.2 填寫 Key 資訊

1. **Key Name**：
   ```
   Supabase Sign In with Apple
   ```
   - 這只是內部識別名稱

2. **Enable Services**：
   - 勾選 **Sign In with Apple**
   - 點擊 **Configure**

### 4.3 設定 Sign In with Apple

1. **Primary App ID**：
   - 從下拉選單中選擇：`com.votechaos.app`
   - 如果沒有下拉選單，可能已自動關聯

2. 點擊 **Save**
3. 點擊 **Continue**

### 4.4 確認並註冊

1. 檢查所有資訊
2. 點擊 **Register**

### 4.5 下載 Key 檔案（重要）

1. ⚠️ **重要**：Key 檔案（.p8）**只能下載一次**
2. 點擊 **Download** 下載 `.p8` 檔案
3. 立即保存到安全的地方（建議：`secrets/apple-sign-in-key.p8`）
4. 記下 **Key ID**（例如：`ABC123DEF4`）
   - Key ID 會顯示在頁面上

---

## ✅ 步驟 5：驗證所有項目

### 5.1 檢查 App ID

1. 前往 **Identifiers** > **App IDs**
2. 確認 `com.votechaos.app` 已建立
3. 確認已啟用：
   - ✅ Sign In with Apple
   - ✅ Push Notifications
   - ✅ In-App Purchase

### 5.2 檢查 Services ID

1. 前往 **Identifiers** > **Services IDs**
2. 確認 `com.votechaos.app.services` 已建立
3. 確認已啟用 Sign In with Apple
4. 確認 Website URLs 已設定：
   - Domain: `chaos-registry.vercel.app`
   - Return URL: `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`

### 5.3 檢查 Key

1. 前往 **Keys**
2. 確認 Key 已建立
3. 確認 Key ID 已記錄
4. 確認 `.p8` 檔案已下載

---

## 🔄 步驟 6：更新 Supabase 設定

### 6.1 生成新的 JWT Token

1. 使用新的 Key 生成 JWT Token
2. 執行腳本：
   ```bash
   node scripts/generate-apple-jwt.cjs
   ```
3. 或使用 GitHub Actions 生成

### 6.2 更新 Supabase Dashboard

1. 前往 Supabase Dashboard > **Authentication** > **Providers** > **Apple**
2. 更新以下欄位：
   - **Client IDs**：`com.votechaos.app.services,com.votechaos.app`
   - **Secret Key**：新的 JWT Token
   - **Allow users without an email**：已勾選
   - **Callback URL**：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
3. 點擊 **Save**

### 6.3 更新 GitHub Secrets（如果使用 GitHub Actions）

1. 前往 GitHub Repository > **Settings** > **Secrets and variables** > **Actions**
2. 更新以下 Secrets：
   - `APPLE_KEY_ID`：新的 Key ID
   - `APPLE_KEY_FILE`：新的 .p8 檔案內容
3. 保留 `APPLE_TEAM_ID`（不變）

---

## 📋 檢查清單

### 刪除舊項目（可選）
- [ ] 舊的 Key 已刪除（可選）
- [ ] 舊的 Services ID 已刪除（可選）
- [ ] 舊的 App ID 已刪除（可選，不建議）

### 建立新項目
- [ ] App ID 已建立（`com.votechaos.app`）
- [ ] App ID 已啟用 Sign In with Apple
- [ ] App ID 已啟用 Push Notifications
- [ ] App ID 已啟用 In-App Purchase
- [ ] Services ID 已建立（`com.votechaos.app.services`）
- [ ] Services ID 已啟用 Sign In with Apple
- [ ] Services ID 的 Website URLs 已設定
- [ ] Services ID 的 Return URL 已設定
- [ ] Key 已建立
- [ ] Key ID 已記錄
- [ ] .p8 檔案已下載

### 更新設定
- [ ] 新的 JWT Token 已生成
- [ ] Supabase Dashboard 已更新
- [ ] GitHub Secrets 已更新（如果使用）

---

## ⚠️ 重要提醒

### 關於刪除舊項目

1. **Key**：
   - 刪除後，舊的 JWT Token 會失效
   - 需要立即更新 Supabase 設定
   - 建議：先建立新的，確認正常後再刪除舊的

2. **Services ID**：
   - 刪除後，使用該 ID 的 Apple 登入會失效
   - 需要立即更新 Supabase 設定
   - 建議：先建立新的，確認正常後再刪除舊的

3. **App ID**：
   - 如果 App ID 正在使用中，建議不要刪除
   - 刪除會影響所有相關的設定
   - 建議：如果 App ID 沒有問題，可以保留不刪除

### 關於建立新項目

1. **Identifier 必須唯一**：
   - 如果舊的 Identifier 還在，無法建立相同名稱的新項目
   - 需要先刪除舊的，或使用不同的名稱

2. **Key 檔案只能下載一次**：
   - 請立即下載並妥善保存
   - 如果遺失，需要重新建立 Key

3. **JWT Token 需要重新生成**：
   - 使用新的 Key 生成新的 JWT Token
   - 更新到 Supabase Dashboard

---

## 🆘 常見問題

### Q1：無法建立相同名稱的 Identifier？

**解決方案**：
- 確認舊的 Identifier 已刪除
- 或使用不同的名稱（例如：`com.votechaos.app.v2`）

### Q2：Key 檔案遺失？

**解決方案**：
- 無法重新下載
- 需要重新建立 Key
- 更新 GitHub Secrets（如果使用）

### Q3：Services ID 的 Return URL 設定錯誤？

**解決方案**：
- 編輯 Services ID
- 更新 Return URL
- 確認格式完全正確

---

## 📞 需要協助？

如果遇到問題，請告訴我：
1. 您目前在哪個步驟？
2. 遇到了什麼錯誤訊息？
3. 需要我檢查什麼？

我可以協助：
- 檢查 Identifier 設定
- 驗證 Key 設定
- 解答問題
- 協助故障排除
