# Deep Link 設定完成報告

**日期**：2025-01-29  
**Deep Link URL**：`votechaos://auth/callback`  
**狀態**：✅ 已完成設定

---

## ✅ 已完成的設定

### 1. Android 設定

**檔案**：`android/app/src/main/AndroidManifest.xml`

已添加 Intent Filter 處理 Deep Link：

```xml
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
```

### 2. iOS 設定

**檔案**：`ios/App/App/Info.plist`

已添加 URL Types：

```xml
<!-- Discord OAuth Deep Link -->
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

**檔案**：`ios/App/App/AppDelegate.swift`

已確認有處理 URL 的方法（透過 ApplicationDelegateProxy），無需額外修改。

### 3. 前端程式碼設定

**檔案**：`src/pages/AuthPage.tsx`

已更新 `handleSocialLogin` 函數，根據平台選擇不同的 redirectTo：

```typescript
const handleSocialLogin = async (provider: 'google' | 'apple' | 'discord' | 'facebook' | 'line') => {
  try {
    // 在 App 版使用 Deep Link，Web 版使用 HTTPS URL
    const redirectUrl = isNative() 
      ? 'votechaos://auth/callback'
      : `${publicSiteUrl}/home`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
      },
    });
    // ...
  }
};
```

**檔案**：`src/lib/app-lifecycle.ts`

已更新 `appUrlOpen` 監聽器，處理 OAuth 回調：

```typescript
App.addListener('appUrlOpen', (data) => {
  console.log('App opened with URL:', data.url);
  
  // 處理 OAuth 回調（votechaos://auth/callback）
  if (data.url.startsWith('votechaos://auth/callback')) {
    console.log('OAuth callback detected, handling authentication...');
    // Supabase 會自動處理 OAuth 回調，這裡只需要觸發頁面刷新
    window.location.href = '/home';
    return;
  }
  
  // 處理其他深層連結...
});
```

---

## 📋 需要設定的外部服務

### Discord Developer Portal

需要在 Discord Developer Portal 中添加 Redirect URI：

1. 前往：https://discord.com/developers/applications/1444352797418979458/oauth2/general
2. 在 **Redirects** 區塊中，點擊 **「Add Redirect」**
3. 添加：`votechaos://auth/callback`
4. 點擊 **「Save Changes」**

### Supabase Dashboard

需要在 Supabase Dashboard 中添加 Additional Redirect URL：

1. 前往：https://app.supabase.com/project/epyykzxxglkjombvozhr/auth/url-configuration
2. 在 **Redirect URLs** 區塊中，添加：`votechaos://auth/callback`
3. 點擊 **「Save」**

---

## 🧪 測試方法

### Android 測試

1. **編譯並安裝 App**
   ```bash
   cd android
   ./gradlew assembleDebug
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

2. **測試 Deep Link**
   ```bash
   adb shell am start -W -a android.intent.action.VIEW -d "votechaos://auth/callback"
   ```
   應該會打開 App 並導向到 `/home` 頁面。

3. **測試 Discord 登入**
   - 在 App 中點擊「使用 Discord 登入」
   - 授權後應該會自動返回 App
   - 確認用戶已成功登入

### iOS 測試

1. **在 Xcode 中編譯並執行**
   - 打開 `ios/App/App.xcworkspace`
   - 選擇目標裝置
   - 點擊 **「Run」**

2. **測試 Deep Link**
   - 在 Safari 網址列輸入：`votechaos://auth/callback`
   - 應該會自動打開 App

3. **測試 Discord 登入**
   - 在 App 中點擊「使用 Discord 登入」
   - 授權後應該會自動返回 App
   - 確認用戶已成功登入

---

## 📝 檢查清單

- [x] AndroidManifest.xml 已添加 Intent Filter
- [x] iOS Info.plist 已添加 URL Types
- [x] AuthPage.tsx 已更新 redirectTo 邏輯
- [x] app-lifecycle.ts 已更新處理 OAuth 回調
- [x] 專案已重新編譯（`npm run build`）
- [x] Android 專案已同步（`npx cap sync android`）
- [ ] Discord Developer Portal 已添加 `votechaos://auth/callback`
- [ ] Supabase Dashboard 已添加 `votechaos://auth/callback`

---

## 🔗 相關文件

- [Discord 第三方登入完整設定指南](./Discord第三方登入完整設定指南.md)
- [第三方登入共用設定](./第三方登入共用設定.md)

---

**完成時間**：2025-01-29  
**專案路徑**：`C:\Users\USER\Documents\Mywork\votechaos-main`





