# 🔍 Android 廣告卡片調試步驟

## 📋 當前狀況

- 總共有 20 個主題
- 三個標籤頁都看不到廣告卡片
- AdMob 已成功初始化

---

## 🔍 調試步驟

### 步驟 1：查看 Logcat 日誌

在 Android Studio 的 **Logcat** 中過濾以下關鍵字：

```
[HomePage]
[insertAdsIntoList]
[NativeAdCard]
廣告配置
```

### 步驟 2：應該看到的日誌

#### 1. 廣告配置日誌
```
[HomePage] 廣告配置: {
  enabled: true/false,
  interval: 10,
  skipFirst: 3,
  adUnitId: "ca-app-pub-...",
  hotTopicsCount: 20,
  latestTopicsCount: 20,
  joinedTopicsCount: 20
}
```

#### 2. 插入邏輯日誌
```
[insertAdsIntoList] 配置: {
  enabled: true/false,
  interval: 10,
  skipFirst: 3,
  adUnitId: "ca-app-pub-...",
  itemsCount: 20
}
```

#### 3. 插入位置日誌
```
[insertAdsIntoList] ✅ 插入廣告在位置 13 (index 12), positionAfterSkip: 10
```

#### 4. 如果沒有插入，會看到：
```
[insertAdsIntoList] ❌ 位置 X 不插入廣告: { ... 詳細條件 ... }
```

---

## 🎯 預期插入位置

### 配置
- `skipFirst = 3`（首屏跳過 3 個）
- `interval = 10`（每 10 個插入 1 個）

### 計算
- 第 1-3 個主題：跳過（不插入）
- 第 4-13 個主題：正常顯示
- **第 13 個主題之後**：應該插入廣告
  - `positionAfterSkip = 13 - 3 = 10`
  - `10 % 10 === 0` ✅ 符合條件

---

## 🔧 如果仍然看不到

### 檢查 1：確認系統配置已載入

查看 Logcat 是否有：
```
Error fetching system config: ...
```

如果有錯誤，可能是 `get-system-config` Edge Function 未正確部署。

### 檢查 2：確認廣告功能已啟用

在 Logcat 中查看：
```
[HomePage] 廣告配置: { enabled: true, ... }
```

如果 `enabled: false`，需要：
1. 在 Supabase Dashboard 執行：
```sql
UPDATE system_config 
SET value = to_jsonb(true::boolean) 
WHERE key = 'ad_insertion_enabled';
```

### 檢查 3：確認 adUnitId 存在

在 Logcat 中查看：
```
[HomePage] 廣告配置: { adUnitId: "ca-app-pub-...", ... }
```

如果顯示 `adUnitId: "MISSING"`，需要：
1. 在 Supabase Dashboard 執行：
```sql
SELECT key, value 
FROM system_config 
WHERE key = 'admob_native_ad_unit_id';
```

### 檢查 4：確認主題數量足夠

廣告只會在：
- 主題數量 > `skipFirst + interval`（預設 13）
- 你的情況：20 > 13 ✅ 應該能看到

---

## 🛠️ 臨時測試方案

如果仍然看不到，可以暫時強制顯示廣告：

修改 `HomePage.tsx`：
```typescript
const adConfig = {
  interval: 5,      // 改為 5
  skipFirst: 2,     // 改為 2
  adUnitId: 'ca-app-pub-3940256099942544/2247696110', // 直接指定
  enabled: true,    // 強制啟用
};
```

這樣廣告會在第 7 個主題之後出現，更容易看到。

---

## 📋 調試檢查清單

- [ ] 查看 Logcat 中的 `[HomePage] 廣告配置` 日誌
- [ ] 查看 Logcat 中的 `[insertAdsIntoList] 配置` 日誌
- [ ] 查看是否有 `插入廣告在位置` 日誌
- [ ] 確認 `enabled: true`
- [ ] 確認 `adUnitId` 不是 "MISSING"
- [ ] 確認主題數量 > 13
- [ ] 向下滾動到第 13 個主題之後
- [ ] 檢查是否有粉紅色邊框的卡片

---

## 💡 下一步

1. **重新運行 APP**
2. **打開首頁**
3. **查看 Logcat**（過濾 `[HomePage]` 和 `[insertAdsIntoList]`）
4. **向下滾動**到第 13 個主題之後
5. **告訴我 Logcat 中的日誌內容**

這樣我就能準確找出問題所在！

