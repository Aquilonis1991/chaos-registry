# Discord 第三方登入完整設定指南（2025 最新版）

> **適用範圍**：Web、iOS App、Android App  
> **更新日期**：2025-01-29  
> **Discord API 版本**：OAuth 2.0（最新）  
> **實作狀態**：✅ Deep Link 已在專案中實作完成

---

## 📋 目錄

1. [前置準備](#前置準備)
2. [Part 1：Discord Developer Portal 設定](#part-1-discord-developer-portal-設定)
3. [Part 2：Supabase 設定](#part-2-supabase-設定)
4. [Part 3：App 端設定（iOS/Android）](#part-3-app-端設定iosandroid)
5. [Part 4：測試與驗證](#part-4-測試與驗證)
6. [Part 5：常見問題與排錯](#part-5-常見問題與排錯)

---

## 前置準備

### 需要準備的資訊

在開始之前，請先確認您有以下資訊：

1. **Supabase 專案資訊**
   - Project URL：`https://epyykzxxglkjombvozhr.supabase.co`
   - Project Reference ID：`epyykzxxglkjombvozhr`
   - Project Name：`votechaos`
   - 如何取得：Supabase Dashboard → Settings → API → Project URL

2. **Discord 帳號**
   - 需要一個有效的 Discord 帳號
   - 建議使用您要發布應用的官方帳號

3. **應用程式資訊**
   - 應用程式名稱：`ChaosRegistry`
   - 應用程式描述（可選）
   - 應用程式圖示（可選，建議 512x512 像素）

---

## Part 1：Discord Developer Portal 設定

### 步驟 1.1：登入 Discord Developer Portal

1. **前往 Discord Developer Portal**
   - 網址：https://discord.com/developers/applications
   - 使用您的 Discord 帳號登入

2. **首次使用**
   - 如果是第一次使用，Discord 會要求您同意開發者條款
   - 閱讀並同意後即可繼續

### 步驟 1.2：建立新的 Application

1. **點擊「New Application」按鈕**
   - 位於右上角
   - 或直接訪問：https://discord.com/developers/applications/new

2. **填寫應用程式基本資訊**
   - **Name（應用程式名稱）**：
     ```
     ChaosRegistry
     ```
     - 這會顯示在 Discord 授權頁面上
     - 用戶會看到「ChaosRegistry 想要存取您的帳號」
   
   - **Icon（應用程式圖示）**：
     - 可選，建議上傳 512x512 像素的 PNG 或 JPG
     - 這會顯示在 Discord 授權頁面上
   
   - **Description（描述）**：
     ```
     一個投票與討論平台，讓用戶可以發起投票並參與討論
     ```
     - 可選，但建議填寫，有助於用戶理解您的應用

3. **點擊「Create」按鈕**
   - 建立完成後，會自動跳轉到應用程式設定頁面

### 步驟 1.3：取得 Client ID 和 Client Secret

建立應用程式後，您會看到應用程式的 **General Information** 頁面：

1. **複製 Client ID**
   - 在頁面頂部，您會看到 **APPLICATION ID** 區塊
   - 點擊 **「Copy」** 按鈕複製 Client ID
   - **您的 Application ID**：`1444352797418979458`
   - 格式類似：`1234567890123456789`
   - **重要**：請先儲存這個 ID，稍後會用到

2. **取得 Client Secret**
   - 在 **APPLICATION ID** 區塊下方，您會看到 **APPLICATION SECRET** 區塊
   - 如果顯示 **「Reset Secret」**，表示還沒有產生 Secret
   - 點擊 **「Reset Secret」** 按鈕
   - **⚠️ 警告**：Discord 只會顯示一次 Secret，請務必立即複製並妥善保存
   - 格式類似：`abcdefghijklmnopqrstuvwxyz123456789`
   - **重要**：如果遺失 Secret，必須重新產生，舊的 Secret 會失效

### 步驟 1.4：設定 OAuth2 Redirect URIs

1. **進入 OAuth2 設定頁面**
   - 在左側導航欄，點擊 **「OAuth2」**
   - 或直接訪問：`https://discord.com/developers/applications/1444352797418979458/oauth2/general`

2. **找到「Redirects」區塊**
   - 在頁面中下方，您會看到 **「Redirects」** 區塊
   - 這是 OAuth 2.0 授權後的重定向網址列表

3. **添加 Redirect URI（Web 版）**
   - 點擊 **「Add Redirect」** 按鈕
   - 在輸入框中填入：
     ```
     https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
     ```
   - 點擊 **「Save Changes」** 按鈕

4. **添加 Redirect URI（App 版 - Deep Link）**
   - 再次點擊 **「Add Redirect」** 按鈕
   - 在輸入框中填入：
     ```
     votechaos://auth/callback
     ```
   - **說明**：
     - `votechaos` 是您的 App 自訂 URL Scheme
     - ✅ **此 Deep Link 已在專案中實作完成**（AndroidManifest.xml、Info.plist、AuthPage.tsx）
   - 點擊 **「Save Changes」** 按鈕

5. **確認 Redirect URIs 列表**
   - 您應該會看到兩個 Redirect URI：
     ```
     https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
     votechaos://auth/callback
     ```
   - **重要**：請確認這兩個 URI 都已正確添加
   - 如果有多個專案或環境，可以添加更多 Redirect URI

### 步驟 1.5：設定 OAuth2 Scopes（權限範圍）

1. **找到「Scopes」區塊**
   - 在 OAuth2 頁面中，您會看到 **「Scopes」** 區塊
   - 這是應用程式請求的權限範圍

2. **選擇必要的 Scopes**
   - 勾選以下 Scopes：
     - ✅ **`identify`**：取得用戶基本資訊（用戶名、頭像、Discord ID）
     - ✅ **`email`**：取得用戶電子郵件（如果用戶已驗證）
   
   - **其他可選 Scopes**（通常不需要）：
     - `guilds`：取得用戶加入的伺服器列表
     - `guilds.join`：代表用戶加入伺服器
     - `connections`：取得用戶的第三方連接（如 Steam、Spotify）
     - `bot`：機器人權限（僅用於機器人應用）

3. **預設 Scopes**
   - Discord 預設會包含 `identify` 和 `email`
   - 對於一般登入功能，這兩個就足夠了

### 步驟 1.6：確認應用程式設定（可選）

1. **General Information**
   - 確認應用程式名稱、圖示、描述都已填寫
   - 這些資訊會顯示在 Discord 授權頁面上

2. **Privacy Policy URL（隱私權政策）**
   - 在 **General Information** 頁面底部
   - 如果您的應用有隱私權政策，建議填寫
   - 格式：`https://your-domain.com/privacy-policy`

3. **Terms of Service URL（服務條款）**
   - 在 **General Information** 頁面底部
   - 如果您的應用有服務條款，建議填寫
   - 格式：`https://your-domain.com/terms-of-service`

### 步驟 1.7：記錄重要資訊

在繼續之前，請確認您已經記錄以下資訊：

- ✅ **Application ID (Client ID)**：`1444352797418979458`
- ✅ **Public Key**：`a7bb72b180bfdde943ccc2552cb9fb0b3b897ba7e458c4e98b76d0c719b9d3e3`
- ✅ **Client Secret**：`OnVMwX382G4zfwNBobV34udRE17132KA`
- ✅ **Redirect URIs**：
  - `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`
  - `votechaos://auth/callback`

> **⚠️ 安全提醒**：Client Secret 是敏感資訊，請妥善保管，不要公開分享。

---

## Part 2：Supabase 設定

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

### 步驟 2.3：啟用 Discord Provider

1. **進入 Providers 設定**
   - 在 **Authentication** 頁面中，點擊 **「Providers」** 標籤
   - 或直接訪問：`https://app.supabase.com/project/epyykzxxglkjombvozhr/auth/providers`

2. **找到 Discord Provider**
   - 在 Provider 列表中，找到 **「Discord」**
   - 如果找不到，可以使用搜尋功能

3. **啟用 Discord Provider**
   - 點擊 Discord 卡片右上角的 **開關**，切換為 **「Enabled」**
   - 或點擊 Discord 卡片進入詳細設定頁面

### 步驟 2.4：填入 Discord OAuth 憑證

1. **進入 Discord Provider 設定頁面**
   - 點擊 Discord 卡片，進入詳細設定頁面

2. **填入 Client ID**
   - 在 **「Client ID (for OAuth)」** 欄位中
   - 貼上從 Discord Developer Portal 複製的 **Client ID**
   - **您的 Client ID**：`1444352797418979458`
   - 格式：`1234567890123456789`

3. **填入 Client Secret**
   - 在 **「Client Secret (for OAuth)」** 欄位中
   - 貼上從 Discord Developer Portal 複製的 **Client Secret**
   - **您的 Client Secret**：`OnVMwX382G4zfwNBobV34udRE17132KA`
   - 格式：`abcdefghijklmnopqrstuvwxyz123456789`
   - **注意**：此欄位會自動隱藏，輸入後只會顯示部分字元
   - **⚠️ 安全提醒**：Client Secret 是敏感資訊，請妥善保管

4. **設定「Allow users without an email」** ✅ 建議勾選
   - 在 Discord Provider 設定頁面中，找到 **「Allow users without an email」** 選項
   - **建議勾選此選項** ✅
   - **原因**：
     - Discord 用戶可能沒有驗證 Email
     - 如果未勾選，當 Discord 沒有返回 Email 時，用戶登入可能會失敗
     - 勾選後，即使 Discord 沒有返回 Email，用戶也能成功登入
     - 專案的用戶系統支援沒有 Email 的用戶（使用 nickname 作為識別）
   - **注意**：即使勾選此選項，如果 Discord 有返回 Email，系統仍會記錄該 Email

5. **確認 Scopes（可選）**
   - Supabase 預設會使用 `identify` 和 `email` scopes
   - 通常不需要修改

6. **儲存設定**
   - 點擊頁面底部的 **「Save」** 按鈕
   - 或點擊右上角的 **「Save」** 按鈕
   - 儲存成功後，會顯示綠色成功訊息

### 步驟 2.5：驗證設定

1. **檢查 Provider 狀態**
   - 回到 Providers 列表頁面
   - 確認 Discord Provider 顯示為 **「Enabled」**（綠色）

2. **檢查 Redirect URL**
   - 在 Discord Provider 設定頁面中
   - 確認 **「Redirect URL」** 顯示為：
     ```
     https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
     ```
   - 這應該與您在 Discord Developer Portal 中設定的 Redirect URI 一致

---

## Part 3：App 端設定（iOS/Android）

### 3.1：Android 設定

#### 步驟 3.1.1：設定 Deep Link（AndroidManifest.xml）

1. **打開 AndroidManifest.xml**
   - 路徑：`android/app/src/main/AndroidManifest.xml`

2. **添加 Intent Filter**
   - 在 `<activity>` 標籤內（通常是 `MainActivity`），添加以下內容：

```xml
<activity
    android:name=".MainActivity"
    android:exported="true"
    android:launchMode="singleTask">
    
    <!-- 現有的 intent-filter -->
    
    <!-- Discord OAuth Deep Link -->
    <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data
            android:scheme="votechaos"
            android:host="auth"
            android:pathPrefix="/callback" />
    </intent-filter>
</activity>
```

3. **說明**
   - `android:scheme="votechaos"`：對應 Discord Redirect URI 中的 `votechaos://`
   - `android:host="auth"`：對應 `votechaos://auth/`
   - `android:pathPrefix="/callback"`：對應完整的 `votechaos://auth/callback`

#### 步驟 3.1.2：驗證 AndroidManifest.xml

確認您的 AndroidManifest.xml 包含以下內容：

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application>
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask">
            
            <!-- 其他 intent-filter -->
            
            <!-- Discord OAuth Deep Link -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data
                    android:scheme="votechaos"
                    android:host="auth"
                    android:pathPrefix="/callback" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

### 3.2：iOS 設定

#### 步驟 3.2.1：設定 URL Scheme（Info.plist）

1. **打開 Info.plist**
   - 路徑：`ios/App/App/Info.plist`
   - 或在 Xcode 中：選擇專案 → Target → Info

2. **添加 URL Types**
   - 在 Xcode 中：
     - 選擇專案 → Target → Info
     - 找到 **「URL Types」** 區塊
     - 點擊 **「+」** 添加新的 URL Type
     - 填寫以下資訊：
       - **Identifier**：`com.votechaos.auth`
       - **URL Schemes**：`votechaos`
   
   - 或在 Info.plist 中直接添加：

```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleTypeRole</key>
        <string>Editor</string>
        <key>CFBundleURLName</key>
        <string>com.votechaos.auth</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>votechaos</string>
        </array>
    </dict>
</array>
```

#### 步驟 3.2.2：處理 Deep Link（AppDelegate.swift 或 AppDelegate.m）

1. **打開 AppDelegate.swift**（Swift）或 **AppDelegate.m**（Objective-C）
   - 路徑：`ios/App/App/AppDelegate.swift` 或 `ios/App/App/AppDelegate.m`

2. **添加 URL 處理方法**

**Swift 版本：**

```swift
import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
        // 處理 Discord OAuth 回調
        if url.scheme == "votechaos" && url.host == "auth" {
            NotificationCenter.default.post(
                name: Notification.Name("CAPPlugin.handleOpenURL"),
                object: [
                    "url": url.absoluteString
                ]
            )
            return true
        }
        return false
    }
}
```

**Objective-C 版本：**

```objc
#import "AppDelegate.h"
#import <Capacitor/Capacitor.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)app 
            openURL:(NSURL *)url 
            options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options {
    // 處理 Discord OAuth 回調
    if ([url.scheme isEqualToString:@"votechaos"] && [url.host isEqualToString:@"auth"]) {
        [[NSNotificationCenter defaultCenter] 
         postNotificationName:@"CAPPlugin.handleOpenURL" 
         object:nil 
         userInfo:@{@"url": url.absoluteString}];
        return YES;
    }
    return NO;
}

@end
```

---

## Part 4：測試與驗證

### 步驟 4.1：Web 版測試

1. **啟動開發伺服器**
   ```bash
   npm run dev
   ```

2. **打開瀏覽器**
   - 訪問：http://localhost:8080/auth
   - 或您的開發環境網址

3. **點擊「使用 Discord 登入」按鈕**
   - 應該會跳轉到 Discord 授權頁面
   - URL 格式：`https://discord.com/oauth2/authorize?...`
   - 確認顯示的應用程式名稱是 `ChaosRegistry`

4. **授權應用程式**
   - 在 Discord 授權頁面上，確認應用程式名稱、圖示、權限範圍
   - 點擊 **「Authorize」** 按鈕

5. **驗證重定向**
   - 授權完成後，應該會重定向回您的應用
   - Web 版應該重定向到：`http://localhost:8080/home`
   - ✅ 前端程式碼已設定為根據平台自動選擇 redirectTo

6. **檢查登入狀態**
   - 確認用戶已成功登入
   - 檢查用戶資訊（頭像、用戶名、Email）
   - 在 Supabase Dashboard → Authentication → Users 中確認用戶已建立

### 步驟 4.2：App 版測試（Android）

1. **編譯並安裝 App**
   ```bash
   cd android
   ./gradlew assembleDebug
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```
   > ✅ AndroidManifest.xml 已設定 Deep Link，可直接使用

2. **啟動 App**
   - 在 Android 裝置上打開 App
   - 進入登入頁面

3. **點擊「使用 Discord 登入」按鈕**
   - 應該會打開瀏覽器或 Discord App
   - 顯示 Discord 授權頁面
   - ✅ 前端程式碼會自動使用 `votechaos://auth/callback` 作為 redirectTo

4. **授權應用程式**
   - 點擊 **「Authorize」** 按鈕

5. **驗證 Deep Link 重定向** ✅ 已實作
   - 授權完成後，應該會自動返回 App
   - ✅ App 已設定處理 `votechaos://auth/callback` Deep Link
   - ✅ `app-lifecycle.ts` 會自動處理 OAuth 回調
   - 確認用戶已成功登入

6. **測試 Deep Link（可選）**
   ```bash
   adb shell am start -W -a android.intent.action.VIEW -d "votechaos://auth/callback"
   ```
   應該會打開 App 並導向到 `/home` 頁面

### 步驟 4.3：App 版測試（iOS）

1. **在 Xcode 中編譯並執行**
   - 打開 `ios/App/App.xcworkspace`
   - 選擇目標裝置（模擬器或實體裝置）
   - 點擊 **「Run」** 按鈕
   > ✅ Info.plist 已設定 URL Types，可直接使用

2. **啟動 App**
   - 在 iOS 裝置上打開 App
   - 進入登入頁面

3. **點擊「使用 Discord 登入」按鈕**
   - 應該會打開 Safari 或 Discord App
   - 顯示 Discord 授權頁面
   - ✅ 前端程式碼會自動使用 `votechaos://auth/callback` 作為 redirectTo

4. **授權應用程式**
   - 點擊 **「Authorize」** 按鈕

5. **驗證 Deep Link 重定向** ✅ 已實作
   - 授權完成後，應該會自動返回 App
   - ✅ App 已設定處理 `votechaos://auth/callback` Deep Link
   - ✅ `app-lifecycle.ts` 會自動處理 OAuth 回調
   - 確認用戶已成功登入

6. **測試 Deep Link（可選）**
   - 在 Safari 網址列輸入：`votechaos://auth/callback`
   - 應該會自動打開 App 並導向到 `/home` 頁面

### 步驟 4.4：檢查 Supabase 用戶資料

1. **登入 Supabase Dashboard**
   - 訪問：https://app.supabase.com/project/epyykzxxglkjombvozhr

2. **查看 Authentication 用戶**
   - 在左側導航欄，點擊 **「Authentication」**
   - 然後點擊 **「Users」** 標籤

3. **確認 Discord 用戶**
   - 在用戶列表中，找到使用 Discord 登入的用戶
   - 確認 **「Provider」** 欄位顯示為 **「discord」**
   - 確認用戶資訊（Email、頭像等）已正確同步
   - 檢查 `user_metadata` 欄位，應該包含 Discord 相關資訊

4. **檢查 Redirect URL 設定**
   - 前往 **Authentication → URL Configuration**
   - 確認 Additional Redirect URLs 包含：
     - `https://chaos-registry.vercel.app/home`
     - `votechaos://auth/callback` ✅

---

## Part 5：常見問題與排錯

### 問題 1：Discord 授權後無法重定向

**症狀**：
- 點擊「Authorize」後，停留在 Discord 頁面
- 或顯示「Invalid redirect URI」錯誤

**可能原因**：
1. Redirect URI 在 Discord Developer Portal 中設定錯誤
2. Redirect URI 在 Supabase 中設定錯誤
3. Redirect URI 格式不正確

**解決方法**：
1. **檢查 Discord Developer Portal**
   - 確認 Redirect URI 完全匹配：
     ```
     https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback
     ```
   - 注意：不能有多餘的空格、斜線、或大小寫錯誤

2. **檢查 Supabase URL Configuration**
   - 確認 Additional Redirect URLs 包含：
     ```
     https://chaos-registry.vercel.app/home
     votechaos://auth/callback
     ```

3. **檢查程式碼中的 redirectTo**
   - 在 `AuthPage.tsx` 中，確認 `redirectTo` 設定正確：
     ```typescript
     // 在 App 版使用 Deep Link，Web 版使用 HTTPS URL
     const redirectUrl = isNative() 
       ? 'votechaos://auth/callback'
       : `${publicSiteUrl}/home`;
     ```
   - ✅ **此設定已在專案中實作完成**

### 問題 2：App 版無法返回 App

**症狀**：
- Discord 授權完成後，無法自動返回 App
- 停留在瀏覽器或 Discord App

**可能原因**：
1. Deep Link 未正確設定
2. AndroidManifest.xml 或 Info.plist 設定錯誤
3. App 未正確處理 Deep Link

**解決方法**：
1. **檢查 AndroidManifest.xml** ✅ 已實作
   - ✅ Intent Filter 已正確設定
   - ✅ `android:scheme="votechaos"`、`android:host="auth"`、`android:pathPrefix="/callback"` 已設定
   - 檔案位置：`android/app/src/main/AndroidManifest.xml`

2. **檢查 iOS Info.plist** ✅ 已實作
   - ✅ URL Types 已正確設定
   - ✅ `CFBundleURLSchemes` 包含 `votechaos`
   - 檔案位置：`ios/App/App/Info.plist`

3. **檢查 AppDelegate** ✅ 已實作
   - ✅ URL 處理方法已正確實作（透過 ApplicationDelegateProxy）
   - ✅ `app-lifecycle.ts` 已更新，可處理 OAuth 回調
   - 檔案位置：`ios/App/App/AppDelegate.swift`、`src/lib/app-lifecycle.ts`

4. **測試 Deep Link**
   - 在 Android 上，使用 ADB 測試：
     ```bash
     adb shell am start -W -a android.intent.action.VIEW -d "votechaos://auth/callback"
     ```
   - 在 iOS 上，使用 Safari 測試：
     - 在 Safari 網址列輸入：`votechaos://auth/callback`
     - 應該會自動打開 App

### 問題 3：Client Secret 遺失或無效

**症狀**：
- Supabase 顯示「Invalid client secret」錯誤
- Discord 授權失敗

**解決方法**：
1. **重新產生 Client Secret**
   - 前往 Discord Developer Portal
   - 進入您的 Application → OAuth2
   - 點擊 **「Reset Secret」** 按鈕
   - **⚠️ 重要**：立即複製新的 Secret，Discord 只會顯示一次

2. **更新 Supabase 設定**
   - 前往 Supabase Dashboard → Authentication → Providers → Discord
   - 貼上新的 Client Secret：`OnVMwX382G4zfwNBobV34udRE17132KA`
   - 點擊 **「Save」**

### 問題 4：用戶資訊未正確同步

**症狀**：
- Discord 登入成功，但用戶資訊（頭像、Email）未顯示

**可能原因**：
1. Discord 用戶未驗證 Email
2. Scopes 設定不正確
3. Supabase 未正確取得用戶資訊

**解決方法**：
1. **檢查 Discord Scopes**
   - 確認 Discord Developer Portal 中已勾選 `email` scope
   - 確認 Supabase Discord Provider 設定中 Scopes 包含 `email`

2. **檢查用戶 Email 驗證狀態**
   - 在 Discord 中，確認用戶已驗證 Email
   - 未驗證的 Discord 帳號可能無法取得 Email

3. **檢查 Supabase 用戶資料**
   - 前往 Supabase Dashboard → Authentication → Users
   - 查看用戶的 `user_metadata` 欄位
   - 確認是否包含 `avatar_url`、`email` 等資訊

### 問題 5：Web 版重定向到錯誤的 URL

**症狀**：
- Discord 授權完成後，重定向到錯誤的網址
- 或顯示 404 錯誤

**解決方法**：
1. **檢查 Supabase Site URL**
   - 確認 Site URL 設定正確：
     ```
     https://chaos-registry.vercel.app
     ```

2. **檢查 Additional Redirect URLs**
   - 確認包含：
     ```
     https://chaos-registry.vercel.app/home
     ```

3. **檢查程式碼中的 redirectTo** ✅ 已實作
   - ✅ `AuthPage.tsx` 已更新，根據平台選擇不同的 redirectTo：
     ```typescript
     const redirectUrl = isNative() 
       ? 'votechaos://auth/callback'  // App 版
       : `${publicSiteUrl}/home`;      // Web 版
     ```
   - 檔案位置：`src/pages/AuthPage.tsx`

### 問題 6：Discord 授權頁面顯示錯誤

**症狀**：
- Discord 授權頁面顯示「Invalid client」或「Application not found」

**可能原因**：
1. Client ID 錯誤
2. Application 已被刪除或停用

**解決方法**：
1. **檢查 Client ID**
   - 確認 Discord Developer Portal 中的 Client ID 與 Supabase 中的一致
   - 確認沒有多餘的空格或字元

2. **檢查 Application 狀態**
   - 前往 Discord Developer Portal
   - 確認 Application 仍然存在且未被刪除
   - 確認 Application 未被停用

---

## 📝 檢查清單

在完成設定後，請確認以下項目：

### Discord Developer Portal
- [x] Application 已建立（名稱：ChaosRegistry）✅
- [x] Application ID (Client ID)：`1444352797418979458` ✅
- [x] Public Key：`a7bb72b180bfdde943ccc2552cb9fb0b3b897ba7e458c4e98b76d0c719b9d3e3` ✅
- [x] Client Secret：`OnVMwX382G4zfwNBobV34udRE17132KA` ✅
- [ ] Redirect URI 已添加：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`（需在 Discord Portal 設定）
- [ ] Redirect URI 已添加：`votechaos://auth/callback`（需在 Discord Portal 設定）
- [x] Scopes 已設定：`identify`、`email` ✅（預設已包含）

### Supabase Dashboard
- [x] 專案已選擇：`votechaos` (epyykzxxglkjombvozhr) ✅
- [ ] Site URL 已設定：`https://chaos-registry.vercel.app`（需確認）
- [ ] Additional Redirect URLs 已添加：`https://chaos-registry.vercel.app/home`（需確認）
- [ ] Additional Redirect URLs 已添加：`votechaos://auth/callback`（需在 Supabase 設定）
- [ ] Discord Provider 已啟用（需確認）
- [x] Client ID 已填入：`1444352797418979458` ✅（需確認）
- [x] Client Secret 已填入：`OnVMwX382G4zfwNBobV34udRE17132KA` ✅（需確認）
- [ ] **「Allow users without an email」已勾選** ✅ 建議勾選（需確認）
- [x] Redirect URL 顯示為：`https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback` ✅

### Android App ✅ 已完成
- [x] AndroidManifest.xml 已添加 Intent Filter ✅
- [x] Deep Link Scheme 設定正確：`votechaos://auth/callback` ✅
- [x] 專案已重新編譯並同步 ✅

### iOS App ✅ 已完成
- [x] Info.plist 已添加 URL Types ✅
- [x] URL Scheme 設定正確：`votechaos` ✅
- [x] AppDelegate 已實作 URL 處理方法 ✅（透過 ApplicationDelegateProxy）

### 程式碼設定 ✅ 已完成
- [x] AuthPage.tsx 已更新，App 版使用 `votechaos://auth/callback` ✅
- [x] app-lifecycle.ts 已更新，可處理 OAuth 回調 ✅
- [x] 專案已重新編譯（`npm run build`）✅
- [x] Android 專案已同步（`npx cap sync android`）✅

### 測試
- [ ] Web 版 Discord 登入測試通過（需測試）
- [ ] Android App Discord 登入測試通過（需測試）
- [ ] iOS App Discord 登入測試通過（需測試）
- [ ] 用戶資訊（頭像、Email）正確顯示（需測試）

> **注意**：✅ 標記表示已在專案中實作完成，但仍需在外部服務（Discord Portal、Supabase Dashboard）中完成設定。

---

## 🔗 相關資源

### 外部服務
- [Discord Developer Portal](https://discord.com/developers/applications)
- [Discord OAuth2 文檔](https://discord.com/developers/docs/topics/oauth2)
- [Supabase Discord Auth 文檔](https://supabase.com/docs/guides/auth/social-login/auth-discord)
- [Supabase Dashboard](https://app.supabase.com/)

### 專案相關文件
- [DeepLink設定完成報告.md](./DeepLink設定完成報告.md) - Deep Link 實作詳細說明
- [第三方登入共用設定.md](./第三方登入共用設定.md) - 所有第三方登入的共用設定
- [第三方登錄設置指南.md](./第三方登錄設置指南.md) - 其他第三方登入設定指南
- [相關文件更新記錄.md](./相關文件更新記錄.md) - 文件更新記錄

---

## 📞 需要協助？

如果遇到問題，請檢查：

### 外部服務設定
1. **Discord Developer Portal** 的設定是否正確
   - 確認兩個 Redirect URI 都已添加
   - 確認 Client ID 和 Client Secret 正確

2. **Supabase Dashboard** 的設定是否正確
   - 確認 Additional Redirect URLs 包含 `votechaos://auth/callback`
   - 確認 Discord Provider 已啟用並填入正確的憑證

### 專案設定 ✅ 已完成
3. **App 端的 Deep Link 設定** ✅ 已實作完成
   - AndroidManifest.xml 已設定
   - Info.plist 已設定
   - 前端程式碼已更新

### 除錯
4. **檢查錯誤訊息**
   - 瀏覽器 Console（Web 版）
   - App Log（Android/iOS）
   - Supabase Dashboard → Logs

### 詳細資訊
- 完整的 Deep Link 設定說明請參考：[DeepLink設定完成報告.md](./DeepLink設定完成報告.md)

---

**版本**：1.2  
**最後更新**：2025-01-29  
**適用於**：Discord OAuth 2.0、Supabase Auth、Capacitor App

---

## 📌 專案資訊

### Supabase 專案
- **Project URL**：`https://epyykzxxglkjombvozhr.supabase.co`
- **Project Reference ID**：`epyykzxxglkjombvozhr`
- **Project Name**：`votechaos`
- **Dashboard**：https://app.supabase.com/project/epyykzxxglkjombvozhr

### Discord Application
- **Application Name**：`ChaosRegistry`
- **Application ID (Client ID)**：`1444352797418979458`
- **Public Key**：`a7bb72b180bfdde943ccc2552cb9fb0b3b897ba7e458c4e98b76d0c719b9d3e3`
- **Client Secret**：`OnVMwX382G4zfwNBobV34udRE17132KA`
- **OAuth2 設定頁面**：https://discord.com/developers/applications/1444352797418979458/oauth2/general

### App 設定
- **App 對外名稱**：`ChaosRegistry`
- **App URL Scheme**：`votechaos://`
- **Redirect URIs**：
  - `https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback`（Web 版）
  - `votechaos://auth/callback`（App 版）✅ 已實作

### 實作狀態 ✅
- ✅ Android Deep Link 已實作（AndroidManifest.xml）
- ✅ iOS Deep Link 已實作（Info.plist）
- ✅ 前端程式碼已更新（AuthPage.tsx、app-lifecycle.ts）
- ✅ 專案已編譯並同步

### 待完成的外部設定
- [ ] Discord Developer Portal：添加 `votechaos://auth/callback` Redirect URI
- [ ] Supabase Dashboard：添加 `votechaos://auth/callback` Additional Redirect URL
- [ ] Supabase Dashboard：啟用 Discord Provider 並填入憑證

