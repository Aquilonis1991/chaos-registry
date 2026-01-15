# Android Clean Project 正確步驟

## 在 Android Studio 中執行 Clean Project

### 步驟 1：Clean Project（必須）

1. **打開 Build 選單**
   - 在 Android Studio 頂部工具列
   - 點擊 `Build` 選單

2. **選擇 Clean Project**
   - 在 Build 選單中找到 `Clean Project`
   - 點擊 `Clean Project`

3. **等待清理完成**
   - 底部 `Build` 標籤會顯示 "Clean finished successfully"
   - 這通常只需要幾秒鐘

### 步驟 2：構建並安裝 APP（推薦方式）

**方式 A：直接 Run（推薦，最簡單）**

1. **選擇運行目標**
   - 點擊頂部工具列的設備下拉選單
   - 選擇已啟動的模擬器或已連接的實體設備

2. **點擊 Run 按鈕**
   - 點擊頂部工具列的綠色 ▶️ 按鈕（通常顯示 "Run 'app'"）
   - 或使用快捷鍵 `Shift + F10`

3. **等待構建和安裝**
   - 底部 `Build` 標籤會顯示構建進度
   - 構建完成後，`Run` 標籤會顯示安裝和啟動進度
   - APP 會自動安裝並啟動在模擬器或設備上

**方式 B：構建 APK 然後安裝**

1. **構建 APK**
   - 點擊 `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
   - 等待構建完成

2. **安裝 APK**
   - 構建完成後，點擊通知中的 "locate" 或 "analyze APK"
   - 或手動安裝 APK

## 完整流程（推薦）

```
1. Clean Project（Build → Clean Project）
   ↓
2. 直接 Run（點擊 ▶️ 按鈕）
   - 會自動重新構建
   - 會自動安裝到設備
   - 會自動啟動 APP
   ↓
3. 測試 X (Twitter) 登入
```

## 注意事項

- ✅ Clean Project 後，直接點擊 Run 按鈕即可
- ✅ Run 按鈕會自動重新構建（不需要單獨的 Rebuild Project）
- ✅ 不需要單獨執行 "Rebuild Project"（該選項可能不存在）
- ✅ Run 按鈕會執行完整的構建→安裝→啟動流程

## 為什麼不需要 Rebuild Project

- Run 按鈕會自動執行構建
- 如果代碼有變更，Run 會自動重新編譯
- Clean Project 已經清理了舊的構建結果
- Run 會確保使用最新的代碼構建
