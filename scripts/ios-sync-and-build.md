# iOS 版本跟進說明

## 與 Android 共用內容

- **同一份網頁**：`dist/` 建置後會同步到 `ios/App/App/public/`，與 Android 使用相同的前端程式。
- **版號**：`package.json` 的 `version`（目前 1.0.77）會經由 build 帶入，個人頁會顯示相同版號。
- **Capacitor 設定**：根目錄 `capacitor.config.ts` 會同步到 iOS，Splash / StatusBar 等與 Android 一致。

## 同步到 iOS（跟進最新修改）

在專案根目錄執行：

```bash
npm run ios:sync
```

或：

```bash
npm run cap:sync:ios
```

會執行 `npm run build` 並將 `dist` 複製到 `ios/App/App/public`，以及更新 `ios/App/App/capacitor.config.json`。

## 在 Xcode 中建置 / 執行

1. **開啟專案**（可選，若已安裝 Xcode）：
   ```bash
   npx cap open ios
   ```
2. 在 **Xcode** 中：
   - 選擇目標裝置或模擬器。
   - 若在 Windows 上未執行過 `pod install`，需在 **Mac** 上於 `ios/App` 目錄執行 `pod install` 後再建置。
   - 按 **Run** 執行 App。

## 注意事項

- **CocoaPods**：需在 Mac 上安裝 CocoaPods，並在 `ios/App` 執行 `pod install` 才能完成 iOS 建置。
- **原生廣告**：目前 `native-ad-plugin` 僅實作 Android；iOS 上會使用 fallback（mock 或錯誤提示），不影響其餘功能。
- **強制更新連結**：`useForceUpdate` 的 App Store 連結可透過後台 `app_store_url_ios` 設定，或修改 `src/hooks/useForceUpdate.tsx` 中的 `APP_STORE_URL`（上架後改為實際 App ID）。
