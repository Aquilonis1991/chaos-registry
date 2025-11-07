# 🎯 AdMob 快速參考

---

## 📱 測試廣告 ID（當前使用）

### Android
```
App ID:        ca-app-pub-3940256099942544~3347511713
Banner:        ca-app-pub-3940256099942544/6300978111
Interstitial:  ca-app-pub-3940256099942544/1033173712
Rewarded:      ca-app-pub-3940256099942544/5224354917
```

### iOS
```
App ID:        ca-app-pub-3940256099942544~1458002511
Banner:        ca-app-pub-3940256099942544/2934735716
Interstitial:  ca-app-pub-3940256099942544/4411468910
Rewarded:      ca-app-pub-3940256099942544/1712485313
```

---

## 🔧 常用函數

### 初始化
```typescript
import { AdMobService } from '@/lib/admob';

// APP 啟動時自動初始化（已在 main.tsx）
await AdMobService.initialize();
```

### 獎勵廣告（已整合）
```typescript
// 在 useMissionOperations 中使用
const { watchAd } = useMissionOperations();
await watchAd(); // 完整流程
```

### Banner 廣告
```typescript
await AdMobService.showBanner();    // 顯示
await AdMobService.hideBanner();    // 隱藏
await AdMobService.removeBanner();  // 移除
```

### 插頁廣告
```typescript
await AdMobService.prepareInterstitial();  // 準備
await AdMobService.showInterstitial();     // 顯示
```

---

## 📂 檔案位置

- **服務**: `src/lib/admob.ts`
- **Hook**: `src/hooks/useMissionOperations.tsx`
- **初始化**: `src/main.tsx`
- **Android 配置**: `android-config/AndroidManifest-admob.xml`
- **Capacitor 配置**: `capacitor.config.ts`

---

## ⚡ 快速測試

### Web 瀏覽器
```bash
npm run dev
# 訪問任務頁面 → 點擊觀看廣告 → 1秒後自動成功
```

### Android
```bash
npm run build
npx cap sync android
npx cap open android
# 在 Android Studio 運行 → 實際顯示測試廣告
```

---

## ⚠️ 重要提醒

### ✅ 測試階段（當前）
- 使用測試 ID
- 可以無限次測試
- 不會產生收益
- 不會違反政策

### ⚠️ 上線前
- 申請 AdMob 帳號
- 獲取正式 ID
- 替換所有測試 ID
- 更新 Manifest/Info.plist

### 🚫 禁止事項
- 禁止自己點擊正式廣告
- 禁止鼓勵用戶點擊
- 禁止誤導性廣告位置

---

## 📊 當前實現

- ✅ 獎勵廣告：完整整合
- 📦 Banner 廣告：已準備，未使用
- 🎬 插頁廣告：已準備，未使用

---

**詳細指南**: `ADMOB_INTEGRATION_GUIDE.md`


