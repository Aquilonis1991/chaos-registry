# 🔍 Android 廣告卡片調試指南

## ❌ 問題描述

在 Android Studio 中測試時，廣告卡片顯示不出來。

---

## ✅ 已修復的問題

1. **簡化了 NativeAdCard 組件**
   - 移除了不支援的 AdMob API 調用
   - 確保卡片能正常顯示佔位符
   - 添加了調試日誌

2. **修復了 ref 重複使用問題**
   - 移除了重複的 `adContainerRef` 使用

---

## 🔍 調試步驟

### 步驟 1：檢查廣告卡片是否被插入

在 Android Studio 的 Logcat 中查看：

```bash
# 過濾關鍵字
NativeAdCard
insertAdsIntoList
廣告配置
```

**應該看到的日誌**：
```
[NativeAdCard] 環境檢查: { isCapacitor: true, platform: 'android', adUnitId: '...', hasContainer: false }
insertAdsIntoList 配置: { enabled: true, interval: 10, skipFirst: 10, adUnitId: '...', itemsCount: 20 }
插入廣告在位置 13 (index 12), positionAfterSkip: 10
```

### 步驟 2：檢查廣告插入配置

在首頁載入時，應該看到：
```
廣告配置: { enabled: true, interval: 10, skipFirst: 10, adUnitId: '...', ... }
```

### 步驟 3：檢查卡片是否渲染

1. **在 Android Studio 中運行 APP**
2. **打開首頁**
3. **向下滾動**（廣告應該在第 13 個主題之後出現）
4. **查看是否有粉紅色邊框的卡片**

---

## 🎯 廣告卡片應該顯示的位置

### 熱門標籤頁
- 如果所有主題都是推廣主題 → 不會顯示廣告
- 如果有一般主題 → 在第 `skipFirst + interval` 個一般主題之後顯示

### 最新標籤頁
- 在第 `skipFirst + interval` 個主題之後顯示
- 預設：第 13 個主題之後（skipFirst=10, interval=10）

### 參與過標籤頁
- 在第 `skipFirst + interval` 個主題之後顯示
- 預設：第 13 個主題之後

---

## 🔧 如果仍然看不到廣告卡片

### 檢查 1：確認廣告功能已啟用

在 Supabase Dashboard 執行：
```sql
SELECT key, value 
FROM system_config 
WHERE key = 'ad_insertion_enabled';
```

應該返回：`true`

### 檢查 2：確認有足夠的主題

廣告卡片只會在：
- 主題數量 > `skipFirst`（預設 10）
- 且在第 `skipFirst + interval` 個主題之後插入

**測試方法**：
- 確保有至少 20 個主題
- 或暫時降低 `skipFirst` 值（在 `HomePage.tsx` 中）

### 檢查 3：查看瀏覽器 Console（如果使用 WebView）

在 Android Studio 中：
1. 打開 **Logcat**
2. 過濾：`chromium` 或 `WebView`
3. 查看是否有錯誤訊息

### 檢查 4：確認卡片樣式

廣告卡片應該有：
- 粉紅色邊框（`border-pink-500/70`）
- 紅色標籤（"測試用廣告卡片"）
- 粉紅色背景漸變

如果看不到，可能是 CSS 沒有正確載入。

---

## 🛠️ 臨時測試方案

如果仍然看不到，可以暫時修改 `HomePage.tsx`：

```typescript
// 暫時降低 skipFirst 以便測試
const adConfig = {
  enabled: adInsertionEnabled,
  interval: adInsertionInterval,
  skipFirst: 3, // 改為 3，讓廣告更早出現
  adUnitId: adUnitIdConfig,
  adIndex: 0,
};
```

這樣廣告會在第 4 個主題之後出現，更容易看到。

---

## 📋 檢查清單

- [ ] 確認 `ad_insertion_enabled` = `true`
- [ ] 確認有足夠的主題（> skipFirst + interval）
- [ ] 查看 Logcat 是否有 `NativeAdCard` 相關日誌
- [ ] 查看 Logcat 是否有 `insertAdsIntoList` 相關日誌
- [ ] 確認向下滾動到足夠的位置
- [ ] 檢查是否有 CSS 載入問題

---

## 💡 預期行為

### 目前狀態（修復後）

廣告卡片應該：
- ✅ **正常顯示**（即使只是佔位符）
- ✅ **有明顯的視覺標記**（粉紅色邊框、紅色標籤）
- ✅ **顯示調試信息**（"測試用廣告卡片"、"Demo Only"）
- ✅ **在正確的位置出現**（第 13 個主題之後）

### 未來改進

- 整合 AdMob Native Ads SDK
- 顯示真實的原生廣告
- 優化廣告載入性能

---

## 🚀 下一步

1. **重新建置並同步**：
   ```bash
   npm run build
   npx cap sync android
   ```

2. **在 Android Studio 中運行**
3. **查看 Logcat 日誌**
4. **向下滾動查看廣告卡片**

如果仍然看不到，請告訴我：
- Logcat 中的相關日誌
- 主題數量
- 當前標籤頁（熱門/最新/參與過）

