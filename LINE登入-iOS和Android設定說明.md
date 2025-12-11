# LINE 登入 - iOS 和 Android 設定說明

> **適用於**：LINE Developers Console → LINE Login → Mobile app settings  
> **更新日期**：2025-01-29

---

## 📱 iOS 設定

### 1. iOS bundle ID

**欄位名稱**：`iOS bundle ID`  
**說明**：iOS 應用程式的唯一識別碼（Bundle Identifier）

**您的專案值**：
```
com.votechaos.app
```

**如何確認**：
1. 打開 Xcode 專案
2. 選擇 Target → General → Bundle Identifier
3. 或查看 `ios/App/App/Info.plist` 中的 `CFBundleIdentifier`
4. 或查看 `capacitor.config.ts` 中的 `appId`

**格式範例**：
- `com.yourcompany.appname`
- `com.votechaos.app` ✅ 您的值

---

### 2. iOS universal link

**欄位名稱**：`iOS universal link`  
**說明**：iOS 的通用連結（Universal Link），用於深度連結

**您的專案值**：
```
https://chaos-registry.vercel.app/.well-known/apple-app-site-association
```

**或（如果使用自訂域名）**：
```
https://your-domain.com/.well-known/apple-app-site-association
```

**說明**：
- Universal Link 需要設定 `apple-app-site-association` 檔案
- 如果您的專案**沒有設定 Universal Link**，可以**留空**或**不填寫**
- 專案目前使用 **Deep Link** (`votechaos://auth/callback`)，不需要 Universal Link

**如何設定 Universal Link（可選）**：
1. 在您的網站根目錄建立 `.well-known/apple-app-site-association` 檔案
2. 檔案內容範例：
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.votechaos.app",
        "paths": ["/auth/callback", "/home"]
      }
    ]
  }
}
```

**建議**：
- ⚠️ 如果沒有設定 Universal Link，**可以留空**
- ✅ 專案目前使用 Deep Link，Universal Link 是**可選的**

---

## 🤖 Android 設定

### 3. Package names

**欄位名稱**：`Package names`  
**說明**：Android 應用程式的套件名稱（Package Name / Application ID）

**您的專案值**：
```
com.votechaos.app
```

**如何確認**：
1. 查看 `android/app/build.gradle` 中的 `applicationId`
2. 或查看 `capacitor.config.ts` 中的 `appId`
3. 或查看 `AndroidManifest.xml` 中的 `package` 屬性

**格式範例**：
- `com.yourcompany.appname`
- `com.votechaos.app` ✅ 您的值

---

### 4. Package signatures ⚠️ 重要

**欄位名稱**：`Package signatures`  
**說明**：Android 應用程式的簽名指紋，用於驗證應用程式身份

**如果只有一個欄位，請填入 SHA-1**：
```
F5:86:DD:40:47:B2:40:A7:CD:89:75:34:B6:EB:17:64:6A:BD:10:1A
```

**⚠️ 重要：如果只有一個欄位**

如果 LINE Developers Console 中只有**一個** `Package signatures` 欄位，請填入 **SHA-1**：

**有冒號的格式**（keytool 輸出格式）：
```
F5:86:DD:40:47:B2:40:A7:CD:89:75:34:B6:EB:17:64:6A:BD:10:1A
```

**無冒號的格式**（LINE 可能會自動轉換）：
```
F586DD4047B240A7CD897534B6EB17646ABD101A
```

**兩種格式都可以！**
- ✅ LINE Developers Console 會自動處理冒號
- ✅ 如果輸入有冒號的格式，系統可能會自動轉換成無冒號的格式
- ✅ 兩種格式都代表同一個簽名，功能完全相同

**為什麼填 SHA-1？**
- SHA-1 是較舊但更廣泛使用的格式
- LINE 通常只需要 SHA-1 即可驗證應用程式身份
- 如果之後有單獨的 SHA-256 欄位，再填入 SHA-256

**如果有多個欄位**：
- **SHA-1 欄位**：`F5:86:DD:40:47:B2:40:A7:CD:89:75:34:B6:EB:17:64:6A:BD:10:1A`
- **SHA-256 欄位**：`DF:3C:34:62:86:6D:E0:78:D4:99:1D:CA:A9:63:76:F3:CF:8A:54:CE:2D:45:3B:B7:1D:62:ED:23:C5:23:CC:53`

**如何取得**：

#### 方法 1：使用 keytool（推薦）

**Debug 簽名**（開發環境）：
```bash
# Windows
keytool -list -v -keystore "%USERPROFILE%\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android

# macOS/Linux
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**Release 簽名**（生產環境）：
```bash
# 替換為您的 keystore 路徑和別名
keytool -list -v -keystore /path/to/your/keystore.jks -alias your-key-alias
```

**輸出範例**：
```
Certificate fingerprints:
     SHA1: AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12
     SHA256: 12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF
```

**需要填入的值**：
- **SHA-1**：`AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12`
- **SHA-256**：`12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF`

#### 方法 2：使用 Android Studio

1. 打開 Android Studio
2. 選擇 **Build** → **Generate Signed Bundle / APK**
3. 選擇 **APK** 或 **Android App Bundle**
4. 選擇您的 keystore
5. 在簽名資訊頁面可以看到 SHA-1 和 SHA-256

#### 方法 3：從已安裝的 App 取得（需要 root）

```bash
# 需要 root 權限
adb shell pm list packages | grep com.votechaos.app
adb shell dumpsys package com.votechaos.app | grep signatures
```

**重要提醒**：
- ⚠️ **Debug 和 Release 簽名不同**
- ⚠️ 如果使用 Google Play App Signing，需要使用 Google Play 提供的簽名
- ⚠️ 如果更改簽名，需要更新 LINE Developers Console 中的設定

---

### 5. Android URL scheme

**欄位名稱**：`Android URL scheme`  
**說明**：Android 的 URL Scheme，用於深度連結（Deep Link）

**您的專案值**：
```
votechaos://auth/callback
```

**或（如果只填 Scheme）**：
```
votechaos
```

**如何確認**：
1. 查看 `android/app/src/main/AndroidManifest.xml` 中的 `intent-filter`
2. 查看 `data` 標籤中的 `android:scheme` 屬性

**AndroidManifest.xml 中的設定**：
```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
        android:scheme="votechaos"
        android:host="auth"
        android:pathPrefix="/callback" />
</intent-filter>
```

**格式說明**：
- **完整格式**：`scheme://host/path`
  - Scheme：`votechaos`
  - Host：`auth`
  - Path：`/callback`
- **簡化格式**：只填 `votechaos`（LINE 通常只需要 Scheme）

**建議填入**：
```
votechaos://auth/callback
```

或

```
votechaos
```

---

## 📋 完整設定範例

### iOS 設定

```
iOS bundle ID: com.votechaos.app
iOS universal link: （留空，因為使用 Deep Link）
```

### Android 設定

```
Package names: com.votechaos.app
Package signatures:
  SHA-1: F5:86:DD:40:47:B2:40:A7:CD:89:75:34:B6:EB:17:64:6A:BD:10:1A
  SHA-256: DF:3C:34:62:86:6D:E0:78:D4:99:1D:CA:A9:63:76:F3:CF:8A:54:CE:2D:45:3B:B7:1D:62:ED:23:C5:23:CC:53
Android URL scheme: votechaos://auth/callback
```

> **注意**：以上是 **Debug 簽名**（開發環境）。生產環境需要使用 Release 簽名。

---

## 🔧 快速取得 Android 簽名（Windows）

### 步驟 1：開啟 PowerShell 或 CMD

### 步驟 2：執行 keytool 指令

**Debug 簽名**：
```powershell
keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
```

**輸出範例**：
```
別名: androiddebugkey
建立日期: 2024-01-01
項目類型: PrivateKeyEntry
憑證鏈長度: 1
憑證[1]:
擁有者: CN=Android Debug, O=Android, C=US
發行者: CN=Android Debug, O=Android, C=US
序號: 1234567890abcdef
有效期開始: Mon Jan 01 00:00:00 CST 2024
有效期結束: Mon Jan 01 00:00:00 CST 2054
憑證指紋:
     MD5:  AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90
     SHA1: AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12
     SHA256: 12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF
```

### 步驟 3：複製 SHA-1 和 SHA-256

從輸出中複製：
- **SHA1** 後面的值（冒號分隔的十六進位字串）
- **SHA256** 後面的值（冒號分隔的十六進位字串）

---

## ⚠️ 重要提醒

### 1. Debug vs Release 簽名

- **Debug 簽名**：用於開發和測試
- **Release 簽名**：用於生產環境（Google Play 上架）

**建議**：
- 開發階段：使用 Debug 簽名
- 生產環境：使用 Release 簽名（或 Google Play App Signing 提供的簽名）

### 2. 簽名變更

如果更改了簽名（例如：重新產生 keystore），需要：
1. 更新 LINE Developers Console 中的 Package signatures
2. 重新測試 LINE 登入功能

### 3. Universal Link vs Deep Link

- **Deep Link** (`votechaos://`)：已實作 ✅
- **Universal Link** (`https://`)：可選，目前未實作

**建議**：
- 如果沒有設定 Universal Link，iOS universal link 欄位可以**留空**
- 專案目前使用 Deep Link，已經足夠

---

## 📝 檢查清單

在 LINE Developers Console 中設定時，請確認：

### iOS
- [ ] iOS bundle ID：`com.votechaos.app`
- [ ] iOS universal link：留空（或填入您的 Universal Link）

### Android
- [ ] Package names：`com.votechaos.app`
- [ ] **Package signatures**：`F5:86:DD:40:47:B2:40:A7:CD:89:75:34:B6:EB:17:64:6A:BD:10:1A`（SHA-1，Debug 簽名）
  - ⚠️ **如果只有一個欄位，填這個 SHA-1 值**
  - 如果有多個欄位，SHA-256：`DF:3C:34:62:86:6D:E0:78:D4:99:1D:CA:A9:63:76:F3:CF:8A:54:CE:2D:45:3B:B7:1D:62:ED:23:C5:23:CC:53`
- [ ] Android URL scheme：`votechaos://auth/callback` 或 `votechaos`

---

## 🔗 相關文件

- [LINE 第三方登入完整設定指南](./LINE第三方登入完整設定指南.md)
- [Deep Link 設定完成報告](./DeepLink設定完成報告.md)

---

## ✅ 總結

**您的專案設定值**：

| 欄位 | 值 |
|------|-----|
| iOS bundle ID | `com.votechaos.app` |
| iOS universal link | （留空，使用 Deep Link） |
| Package names | `com.votechaos.app` |
| **Package signatures** ⚠️ | **`F5:86:DD:40:47:B2:40:A7:CD:89:75:34:B6:EB:17:64:6A:BD:10:1A`**<br>或 `F586DD4047B240A7CD897534B6EB17646ABD101A`（無冒號格式，LINE 會自動轉換） |
| Package signatures (SHA-256) | `DF:3C:34:62:86:6D:E0:78:D4:99:1D:CA:A9:63:76:F3:CF:8A:54:CE:2D:45:3B:B7:1D:62:ED:23:C5:23:CC:53`（如果有單獨欄位） |
| Android URL scheme | `votechaos://auth/callback` 或 `votechaos` |

> **⚠️ 重要**：
> - 如果 LINE Developers Console 中只有**一個** `Package signatures` 欄位，請填入上面的 **SHA-1** 值
> - 如果有多個欄位（SHA-1 和 SHA-256 分開），則分別填入對應的值
> - 以上是 **Debug 簽名**（開發環境）。生產環境需要使用 **Release 簽名**（從您的 release keystore 取得）

**下一步**：
1. 使用 keytool 取得 Android 簽名
2. 在 LINE Developers Console 中填入這些值
3. 測試 LINE 登入功能

