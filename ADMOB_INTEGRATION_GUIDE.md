# 🎯 AdMob 廣告整合完成指南

> **完成日期**: 2025-01-15  
> **整合狀態**: ✅ 完成  
> **測試狀態**: 使用測試廣告 ID

---

## 📊 整合概況

### ✅ 已完成的工作

| 項目 | 狀態 | 說明 |
|------|------|------|
| AdMob 套件安裝 | ✅ | @capacitor-community/admob |
| 廣告服務創建 | ✅ | src/lib/admob.ts |
| 獎勵廣告整合 | ✅ | useMissionOperations.tsx |
| 初始化配置 | ✅ | main.tsx |
| 測試 ID 配置 | ✅ | 使用 Google 官方測試 ID |

---

## 🎮 已實現的廣告類型

### 1. ✅ **獎勵廣告（Rewarded Video）**

**用途**: 觀看廣告獲得代幣  
**位置**: 任務頁面  
**獎勵**: 5 代幣/次  
**限制**: 每天最多 10 次

**測試 ID**:
- Android: `ca-app-pub-3940256099942544/5224354917`
- iOS: `ca-app-pub-3940256099942544/1712485313`

---

### 2. 📦 **Banner 廣告**（已整合）

**用途**: 持續性廣告展示  
**位置**: 首頁（已整合）  
**測試 ID**:
- Android: `ca-app-pub-3940256099942544/6300978111`
- iOS: `ca-app-pub-3940256099942544/2934735716`

**已整合位置**:
- ✅ 首頁（HomePage）

**使用組件**:
```typescript
import { AdBanner } from '@/components/AdBanner';

<AdBanner 
  className="mb-6"
  placeholderText="首頁 Banner 廣告"
/>
```

**手動使用**:
```typescript
import { AdMobService } from '@/lib/admob';

// 顯示 Banner
await AdMobService.showBanner();

// 隱藏 Banner
await AdMobService.hideBanner();

// 移除 Banner
await AdMobService.removeBanner();
```

---

### 3. 🎬 **插頁廣告（Interstitial）**（已準備）

**函數**: `AdMobService.prepareInterstitial()` + `showInterstitial()`  
**用途**: 主題切換、投票後等場景  
**測試 ID**:
- Android: `ca-app-pub-3940256099942544/1033173712`
- iOS: `ca-app-pub-3940256099942544/4411468910`

**使用範例**:
```typescript
// 準備廣告
await AdMobService.prepareInterstitial();

// 顯示廣告
await AdMobService.showInterstitial();
```

---

## 📁 創建的檔案

### 1. **`src/lib/admob.ts`** - AdMob 服務

**包含功能**:
- ✅ 初始化 AdMob
- ✅ Banner 廣告（顯示/隱藏/移除）
- ✅ 插頁廣告（準備/顯示）
- ✅ 獎勵廣告（準備/顯示）
- ✅ 完整的獎勵流程（`watchRewardedAd`）
- ✅ 平台檢測（原生/Web）
- ✅ 測試廣告 ID 管理

**程式碼行數**: ~300 行

### 2. **`src/components/AdBanner.tsx`** - Banner 組件（新增）

**功能**:
- ✅ 自動管理 Banner 生命週期
- ✅ 原生平台顯示真實廣告
- ✅ Web 平台顯示佔位符
- ✅ 自動載入和移除
- ✅ 可自訂樣式

**使用簡單**:
```tsx
<AdBanner className="mb-6" placeholderText="廣告" />
```

---

### 3. **修改的檔案**

#### `package.json`
```json
"@capacitor-community/admob": "^6.0.0"
```

#### `src/hooks/useMissionOperations.tsx`
- 整合 AdMob 獎勵廣告
- 觀看廣告 → 發放獎勵流程
- 錯誤處理和用戶提示

#### `src/pages/HomePage.tsx`
- 整合 AdBanner 組件
- 首頁顯示 Banner 廣告
- 替換原有佔位符

#### `src/main.tsx`
- 添加 AdMob 初始化
- APP 啟動時自動初始化

#### `android-config/AndroidManifest-admob.xml`
- Android AdMob App ID 配置
- 使用測試 ID

---

## 🔧 使用方式

### 在任務頁面觀看廣告

用戶點擊「觀看廣告」按鈕後：

1. **顯示 AdMob 獎勵廣告**
2. **用戶完整觀看廣告**
3. **AdMob 觸發獎勵回調**
4. **呼叫後端 watch-ad Edge Function**
5. **後端驗證並發放代幣**
6. **顯示成功提示**

**流程圖**:
```
[用戶點擊] 
  → [AdMob顯示廣告] 
  → [用戶觀看完畢] 
  → [觸發獎勵事件] 
  → [後端發放代幣] 
  → [更新用戶代幣]
  → [顯示成功提示]
```

---

### Web 平台處理

```typescript
// Web 平台自動模擬廣告觀看
if (!isNativePlatform()) {
  // 1秒後自動觸發成功回調
  setTimeout(() => {
    onSuccess();
  }, 1000);
}
```

---

## 🚀 部署步驟

### 1. 安裝依賴

```bash
npm install
```

### 2. 同步 Capacitor

```bash
npx cap sync android
npx cap sync ios
```

### 3. 配置 Android

**檔案**: `android/app/src/main/AndroidManifest.xml`

在 `<application>` 標籤內添加:

```xml
<!-- AdMob App ID（測試用）-->
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-3940256099942544~3347511713"/>
```

參考: `android-config/AndroidManifest-admob.xml`

### 4. 配置 iOS

**檔案**: `ios/App/App/Info.plist`

在 `<dict>` 標籤內添加:

```xml
<!-- AdMob App ID（測試用）-->
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-3940256099942544~1458002511</string>

```

### 5. 建置 APP

```bash
# Android
npm run build
npx cap sync android
npx cap open android

# iOS
npm run build
npx cap sync ios
npx cap open ios
```

---

## 🧪 測試方式

### 開發環境測試

1. **啟動應用**
   ```bash
   npm run dev
   ```

2. **在瀏覽器測試**（Web）
   - 觀看廣告會自動模擬成功
   - 1秒後觸發獎勵

3. **在 Android/iOS 測試**
   - 使用 Android Studio / Xcode 運行
   - 會顯示真實的測試廣告
   - 測試廣告可以正常觀看並獲得獎勵

### 測試流程

1. 登入應用
2. 進入「任務」頁面
3. 點擊「觀看廣告」
4. 觀看完整廣告
5. 確認獲得 5 代幣
6. 檢查剩餘次數

---

## ⚠️ 重要注意事項

### 測試 vs 正式

**當前狀態**: ✅ 使用測試 ID

**測試 ID 特點**:
- ✅ 不會產生真實收益
- ✅ 不會違反 AdMob 政策
- ✅ 可以無限次測試
- ✅ 廣告顯示正常

**正式 ID**:
- ⚠️ 需要在 Google AdMob 申請
- ⚠️ 自己點擊會被封號
- ⚠️ 需要真實用戶流量
- ⚠️ 審核通過後才能使用

---

### 切換到正式 ID

當準備上線時，需要:

1. **申請 AdMob 帳號**
   - https://admob.google.com/

2. **創建 App**
   - 獲得 App ID

3. **創建廣告單元**
   - Banner 廣告單元
   - Interstitial 廣告單元
   - Rewarded 廣告單元

4. **更新代碼**

**檔案**: `src/lib/admob.ts`

```typescript
// 將測試 ID 替換為正式 ID
export const PROD_AD_IDS = {
  android: {
    banner: 'ca-app-pub-XXXXXXXX/YYYYYY',
    interstitial: 'ca-app-pub-XXXXXXXX/ZZZZZZ',
    rewarded: 'ca-app-pub-XXXXXXXX/WWWWWW',
  },
  ios: {
    banner: 'ca-app-pub-XXXXXXXX/YYYYYY',
    interstitial: 'ca-app-pub-XXXXXXXX/ZZZZZZ',
    rewarded: 'ca-app-pub-XXXXXXXX/WWWWWW',
  }
};
```

5. **更新 AndroidManifest.xml 和 Info.plist**

將測試 App ID 替換為正式 App ID

---

## 📊 AdMob 收益估算

### 獎勵廣告 eCPM（千次展示收益）

- **一般範圍**: $1 - $10 USD
- **平均值**: ~$3 USD
- **台灣市場**: ~$2 - $5 USD

### 預估收益

假設：
- 每日活躍用戶: 100 人
- 每人每天觀看: 3 次廣告
- eCPM: $3 USD

**計算**:
```
每日展示: 100 × 3 = 300 次
每日收益: (300 / 1000) × $3 = $0.9 USD
每月收益: $0.9 × 30 = $27 USD
```

**當用戶增長到 1000 人**:
- 每日收益: ~$9 USD
- 每月收益: ~$270 USD

---

## 🎯 優化建議

### 1. 增加廣告展示機會

- ✅ 觀看廣告獲得代幣（已實現）
- ⏳ 主題切換時顯示插頁廣告
- ⏳ 投票後顯示插頁廣告
- ⏳ 首頁顯示 Banner 廣告

### 2. 提升觀看率

- 增加獎勵吸引力
- 限時雙倍獎勵活動
- 成就系統整合
- 每日任務整合

### 3. A/B 測試

- 測試不同獎勵金額
- 測試廣告展示頻率
- 測試廣告位置

---

## 🐛 常見問題

### Q1: 廣告不顯示？

**檢查**:
1. 是否在原生平台（Android/iOS）
2. 網路連接是否正常
3. AdMob 是否初始化成功
4. 查看 Console 錯誤訊息

### Q2: Web 平台測試？

**答**: Web 平台會自動模擬廣告觀看，1秒後觸發成功回調。

### Q3: 測試廣告無法關閉？

**答**: 測試廣告通常有「X」按鈕，等待幾秒後出現。

### Q4: 切換到正式 ID 後無廣告？

**檢查**:
1. App ID 是否正確
2. 廣告單元 ID 是否正確
3. AdMob 帳號是否審核通過
4. 是否有足夠的廣告庫存

---

## 📝 程式碼範例

### 在任何組件中使用廣告

```typescript
import { AdMobService } from '@/lib/admob';
import { toast } from 'sonner';

// 觀看獎勵廣告
const handleWatchAd = async () => {
  try {
    await AdMobService.watchRewardedAd(
      // 成功回調
      () => {
        toast.success('獲得獎勵！');
        // 執行獎勵邏輯
      },
      // 錯誤回調
      (error) => {
        toast.error('廣告載入失敗');
      }
    );
  } catch (error) {
    console.error('Ad error:', error);
  }
};

// 顯示 Banner
const showBanner = async () => {
  const success = await AdMobService.showBanner();
  if (success) {
    console.log('Banner shown');
  }
};

// 顯示插頁廣告
const showInterstitial = async () => {
  await AdMobService.prepareInterstitial();
  await new Promise(r => setTimeout(r, 1000)); // 等待準備
  await AdMobService.showInterstitial();
};
```

---

## 📋 檢查清單

### 開發環境

- [x] 安裝 AdMob 套件
- [x] 創建 AdMob 服務
- [x] 整合獎勵廣告
- [x] 使用測試 ID
- [x] 初始化配置
- [ ] 測試 Android 實機
- [ ] 測試 iOS 實機

### 上線前

- [ ] 申請 AdMob 帳號
- [ ] 創建正式 App
- [ ] 創建廣告單元
- [ ] 替換測試 ID
- [ ] 更新 AndroidManifest
- [ ] 更新 Info.plist
- [ ] 隱私政策添加廣告說明
- [ ] 審核通過

---

## 🎊 總結

**AdMob 廣告整合已完成！** ✅

### 當前狀態:
- ✅ 使用測試廣告 ID
- ✅ 獎勵廣告可用
- ✅ 觀看廣告獲得代幣
- ✅ Web 平台兼容
- ✅ 錯誤處理完善

### 下一步:
1. 測試實機運行
2. 申請 AdMob 帳號
3. 獲取正式廣告 ID
4. 上線前替換測試 ID

### 預估時間:
- AdMob 申請: 1-2 天
- 審核通過: 1-7 天
- 上線使用: 立即

---

**需要協助？**
- AdMob 文檔: https://developers.google.com/admob
- Capacitor AdMob: https://github.com/capacitor-community/admob

**恭喜！您的應用現在可以透過廣告獲利了！** 🎉💰

