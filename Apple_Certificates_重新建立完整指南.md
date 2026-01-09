# Apple Certificates 重新建立完整指南

## 📋 概述

本指南將協助您重新建立 Apple Developer Portal 中的 Certificates（憑證）。

**需要重新建立的憑證**：
1. iOS Distribution (App Store Connect and Ad Hoc)
2. Apple Push Notification service SSL (Sandbox & Production)

---

## 🔄 步驟 1：準備 CSR（Certificate Signing Request）

### 1.1 在 macOS 上建立 CSR

1. **打開「鑰匙圈存取」**
   - 應用程式 > 工具程式 > 鑰匙圈存取
   - 或使用 Spotlight 搜尋「Keychain Access」

2. **建立 CSR**
   - 選單列：**鑰匙圈存取** > **憑證輔助程式** > **從憑證授權要求憑證...**

3. **填寫資訊**
   - **使用者電子郵件地址**：您的 Apple Developer 帳號 Email
   - **一般名稱**：您的名稱或公司名稱（例如：`VoteChaos Developer`）
   - **CA 電子郵件地址**：留空
   - **選擇「儲存到磁碟」**

4. **儲存 CSR**
   - 點擊「繼續」
   - 選擇儲存位置（建議：桌面或 `secrets/` 資料夾）
   - 檔案名稱：`CertificateSigningRequest.certSigningRequest`
   - 點擊「儲存」

### 1.2 在 Windows 上建立 CSR（如果沒有 macOS）

1. **安裝 OpenSSL**
   - 下載：https://slproweb.com/products/Win32OpenSSL.html
   - 安裝 Win64 OpenSSL（建議版本 3.x）

2. **建立 CSR**
   ```powershell
   # 導航到您想儲存 CSR 的目錄
   cd C:\Users\USER\Documents\Mywork\votechaos-main\secrets
   
   # 建立私鑰和 CSR
   openssl req -new -newkey rsa:2048 -nodes -keyout apple_certificate.key -out CertificateSigningRequest.certSigningRequest -subj "/CN=VoteChaos Developer/emailAddress=your-email@example.com"
   ```
   
   **替換資訊**：
   - `your-email@example.com`：您的 Apple Developer 帳號 Email
   - `VoteChaos Developer`：您的名稱或公司名稱

3. **確認檔案已建立**
   - `CertificateSigningRequest.certSigningRequest`（CSR 檔案）
   - `apple_certificate.key`（私鑰檔案，請妥善保存）

---

## 🗑️ 步驟 2：刪除舊的憑證（可選）

### 2.1 前往 Certificates 頁面

1. 登入 [Apple Developer Portal](https://developer.apple.com/)
2. 點擊右上角的 **Account**（帳號）
3. 在左側導航欄，點擊 **Certificates, Identifiers & Profiles**
4. 在左側選單，點擊 **Certificates**

### 2.2 刪除舊的憑證

1. **找到要刪除的憑證**
   - iOS Distribution Certificate
   - Apple Push Notification Certificate

2. **刪除憑證**
   - 點擊憑證進入詳細頁面
   - 點擊 **Revoke**（撤銷）按鈕
   - 確認刪除

⚠️ **重要提醒**：
- 刪除憑證後，使用該憑證的 Provisioning Profiles 也會失效
- 如果正在使用這些憑證，請先建立新憑證再刪除舊的
- 建議：先建立新憑證，確認正常後再刪除舊的

---

## 📝 步驟 3：建立 iOS Distribution Certificate

### 3.1 導航到建立頁面

1. 在 **Certificates** 頁面，點擊左上角的 **+** 按鈕
2. 選擇 **Software** 分類
3. 選擇 **iOS Distribution (App Store Connect and Ad Hoc)**
4. 點擊 **Continue**

### 3.2 上傳 CSR

1. 點擊 **Choose File** 或 **選擇檔案** 按鈕
2. 選擇剛才建立的 CSR 檔案（`CertificateSigningRequest.certSigningRequest`）
3. 點擊 **Continue**

### 3.3 下載憑證

1. 等待憑證生成（通常幾秒鐘）
2. 點擊 **Download** 按鈕下載 `.cer` 檔案
3. ⚠️ **重要**：憑證只能下載一次，請立即下載
4. 儲存到安全位置（建議：`secrets/` 資料夾）

### 3.4 匯入憑證到鑰匙圈（macOS）

1. 雙擊下載的 `.cer` 檔案
2. 系統會自動打開「鑰匙圈存取」
3. 確認憑證已匯入到「登入」鑰匙圈
4. 確認憑證顯示為「有效」

---

## 📱 步驟 4：建立 Apple Push Notification Certificate

### 4.1 導航到建立頁面

1. 在 **Certificates** 頁面，點擊左上角的 **+** 按鈕
2. 選擇 **Services** 分類
3. 選擇 **Apple Push Notification service SSL (Sandbox & Production)**
4. 點擊 **Continue**

### 4.2 選擇 App ID

1. 在 **App ID** 下拉選單中，選擇：`com.votechaos.app`
2. 點擊 **Continue**

### 4.3 上傳 CSR

1. 點擊 **Choose File** 或 **選擇檔案** 按鈕
2. 選擇剛才建立的 CSR 檔案（可以使用同一個 CSR）
3. 點擊 **Continue**

### 4.4 下載憑證

1. 等待憑證生成（通常幾秒鐘）
2. 點擊 **Download** 按鈕下載 `.cer` 檔案
3. ⚠️ **重要**：憑證只能下載一次，請立即下載
4. 儲存到安全位置（建議：`secrets/` 資料夾）

### 4.5 匯入憑證到鑰匙圈（macOS）

1. 雙擊下載的 `.cer` 檔案
2. 系統會自動打開「鑰匙圈存取」
3. 確認憑證已匯入到「登入」鑰匙圈
4. 確認憑證顯示為「有效」

---

## ✅ 步驟 5：驗證憑證

### 5.1 檢查憑證列表

1. 在 **Certificates** 頁面，確認以下憑證已建立：
   - ✅ iOS Distribution (App Store Connect and Ad Hoc)
   - ✅ Apple Push Notification service SSL (Sandbox & Production)

### 5.2 檢查憑證詳細資訊

1. 點擊每個憑證進入詳細頁面
2. 確認以下資訊：
   - **Type**：正確的類型
   - **App ID**：`com.votechaos.app`（Push Notification 憑證）
   - **Status**：Active（有效）
   - **Expires**：到期日期

### 5.3 在鑰匙圈中驗證（macOS）

1. 打開「鑰匙圈存取」
2. 在左側選單，選擇「登入」>「我的憑證」
3. 確認以下憑證已匯入：
   - iOS Distribution
   - Apple Push Notification service SSL
4. 確認憑證顯示為「有效」

---

## 📦 步驟 6：更新 Provisioning Profiles（如果需要）

### 6.1 檢查 Provisioning Profiles

1. 在 Apple Developer Portal，點擊 **Profiles**
2. 檢查是否有使用舊憑證的 Provisioning Profiles
3. 如果有，需要更新或重新建立

### 6.2 更新 Provisioning Profiles

1. 點擊需要更新的 Provisioning Profile
2. 點擊 **Edit** 按鈕
3. 選擇新的憑證
4. 點擊 **Generate** 重新生成
5. 下載新的 Provisioning Profile

---

## 🔐 步驟 7：備份憑證和私鑰

### 7.1 備份檔案

請備份以下檔案到安全位置：

1. **CSR 檔案**：`CertificateSigningRequest.certSigningRequest`
2. **私鑰檔案**（如果使用 OpenSSL）：`apple_certificate.key`
3. **iOS Distribution 憑證**：`.cer` 檔案
4. **Apple Push Notification 憑證**：`.cer` 檔案

### 7.2 備份鑰匙圈（macOS）

1. 打開「鑰匙圈存取」
2. 選擇「登入」>「我的憑證」
3. 選擇憑證，右鍵 > **匯出**
4. 選擇格式：`.p12`
5. 設定密碼保護
6. 儲存到安全位置

---

## ⚠️ 重要提醒

### 關於 CSR

1. **同一個 CSR 可用於多個憑證**
   - iOS Distribution Certificate
   - Apple Push Notification Certificate
   - 可以使用同一個 CSR

2. **CSR 包含公鑰資訊**
   - 私鑰保留在您的電腦上
   - 不要分享私鑰

3. **CSR 檔案格式**
   - 必須是 `.certSigningRequest` 格式
   - 如果使用 OpenSSL，確保副檔名正確

### 關於憑證

1. **憑證下載**
   - 憑證只能下載一次
   - 請立即下載並妥善保存

2. **憑證格式**
   - 下載的是 `.cer` 檔案
   - 需要匯入到鑰匙圈或轉換為其他格式

3. **憑證有效期**
   - 通常有效期為 1 年
   - 到期前需要重新建立

### 關於私鑰

1. **私鑰安全**
   - 如果使用 OpenSSL 建立 CSR，會同時產生私鑰
   - 請妥善保存私鑰檔案
   - 不要分享或提交到 Git

2. **私鑰用途**
   - 用於簽署應用程式
   - 用於建立 Provisioning Profiles

---

## 📋 檢查清單

### 準備階段
- [ ] CSR 已建立
- [ ] CSR 檔案已保存
- [ ] 私鑰已保存（如果使用 OpenSSL）

### 建立憑證
- [ ] iOS Distribution Certificate 已建立
- [ ] iOS Distribution Certificate 已下載
- [ ] Apple Push Notification Certificate 已建立
- [ ] Apple Push Notification Certificate 已下載

### 驗證階段
- [ ] 憑證已在 Apple Developer Portal 中顯示
- [ ] 憑證狀態為「Active」
- [ ] 憑證已匯入到鑰匙圈（macOS）
- [ ] 憑證在鑰匙圈中顯示為「有效」

### 備份階段
- [ ] CSR 檔案已備份
- [ ] 私鑰檔案已備份
- [ ] 憑證檔案已備份
- [ ] 鑰匙圈已匯出（macOS，可選）

---

## 🆘 常見問題

### Q1：找不到 CSR 檔案？

**解決方案**：
- 檢查儲存位置
- 確認檔案名稱正確
- 如果遺失，重新建立 CSR

### Q2：憑證下載失敗？

**解決方案**：
- 檢查網路連接
- 重新整理頁面
- 嘗試使用不同的瀏覽器

### Q3：憑證無法匯入到鑰匙圈？

**解決方案**：
- 確認檔案格式正確（`.cer`）
- 確認檔案沒有損壞
- 嘗試重新下載

### Q4：舊憑證還在，需要刪除嗎？

**解決方案**：
- 如果舊憑證已過期或不再使用，可以刪除
- 如果正在使用，建議先建立新憑證，確認正常後再刪除舊的
- 刪除憑證不會影響已發布的應用程式

---

## 📞 需要協助？

如果遇到問題，請告訴我：
1. 您目前在哪個步驟？
2. 遇到了什麼錯誤訊息？
3. 需要我檢查什麼？

我可以協助：
- 檢查 CSR 格式
- 驗證憑證設定
- 解答問題
- 協助故障排除
