# APP 圖示和啟動畫面資源

此資料夾用於存放 APP 的圖示和啟動畫面資源。

## 📁 資料夾結構

```
resources/
├── icon.png           # APP 圖示（至少 1024x1024px）
├── splash.png         # 啟動畫面（至少 2732x2732px）
└── android/           # Android 特定資源（自動生成）
    ├── icon/
    └── splash/
└── ios/               # iOS 特定資源（自動生成）
    ├── icon/
    └── splash/
```

## 🎨 圖示要求

### APP 圖示（icon.png）
- **尺寸**: 1024x1024px
- **格式**: PNG（帶透明背景）
- **內容**: VoteChaos Logo
- **注意**: 避免文字太小，確保在小圖示下可識別

### 啟動畫面（splash.png）
- **尺寸**: 2732x2732px（正方形）
- **格式**: PNG
- **內容**: VoteChaos Logo + 品牌標語
- **背景**: 純色或漸層（建議使用品牌色）

## 🛠️ 生成資源

使用 Capacitor 官方工具自動生成各種尺寸：

```bash
# 安裝工具
npm install -g @capacitor/assets

# 生成所有平台的圖示和啟動畫面
npx capacitor-assets generate --iconBackgroundColor '#000000' --splashBackgroundColor '#000000'
```

這會自動生成：
- Android: 各種密度的圖示（mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi）
- iOS: 各種尺寸的圖示和啟動畫面
- Web: favicon 和 PWA 圖示

## 📝 臨時使用

在正式設計完成前，可以：
1. 使用 `public/favicon.ico` 作為臨時圖示
2. 使用純色背景作為啟動畫面
3. 稍後再替換為正式設計

## 🎨 設計建議

### 圖示設計：
- 簡潔明瞭
- 品牌識別度高
- 在小尺寸下清晰可見
- 與品牌色系一致

### 啟動畫面設計：
- 品牌 Logo 居中
- 背景使用品牌色
- 可加入標語或動畫
- 載入時間不宜過長

## 🔧 手動配置（進階）

如果需要手動調整：

### Android
編輯 `android/app/src/main/res/` 下的各資源檔案

### iOS
編輯 `ios/App/App/Assets.xcassets/` 下的資源檔案

