# @votechaos/native-ad-plugin

自訂的 Capacitor 插件，用來橋接 Android / iOS 上的 Google AdMob 原生廣告（Native Ad），並將資料回傳給 ChaosRegistry 前端。

> ⚠️ 目前僅提供骨架與暫時的 `not implemented` 實作，後續會逐步補上真正的 AdMob Native SDK 整合。

## 結構

```
native-ad-plugin/
 ├─ android/                # Kotlin 插件程式碼（待實作）
 ├─ ios/                    # Swift 插件程式碼（待實作）
 ├─ src/
 │   ├─ definitions.ts      # TypeScript 介面
 │   └─ index.ts            # Web JS 封裝
 ├─ NativeAdPlugin.podspec  # iOS Pod 規格
 ├─ package.json
 ├─ rollup.config.js
 └─ tsconfig.json
```

## TODO

- [ ] Android：使用 `AdLoader` 取得 `NativeAd` 並回傳 `NativeAdData`
- [ ] iOS：使用 `GADAdLoader` 取得 `GADNativeAd`
- [ ] JS：透過 `registerPlugin` 將原生方法暴露給 React 前端

## 開發指令

```bash
npm install
npm run build
```

編譯後即可透過 `npm install ../native-ad-plugin` 的方式在主專案中引用。

