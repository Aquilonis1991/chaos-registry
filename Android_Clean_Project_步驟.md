# Android Clean Project 步驟

## 何時需要 Clean Project

- ✅ 修改了 Java/Kotlin 代碼（如 MainActivity.java）
- ✅ 修改了 AndroidManifest.xml
- ✅ 修改了 Gradle 配置文件
- ✅ 遇到奇怪的構建錯誤
- ✅ 依賴項更新後

## 在 Android Studio 中執行 Clean Project

### 方法 1：使用選單（推薦）

1. **打開 Build 選單**
   - 在 Android Studio 頂部工具列
   - 點擊 `Build` 選單

2. **選擇 Clean Project**
   - 在 Build 選單中找到 `Clean Project`
   - 點擊 `Clean Project`

3. **等待清理完成**
   - 底部 `Build` 標籤會顯示 "Clean finished successfully"
   - 這通常只需要幾秒鐘

4. **然後執行 Rebuild Project（可選，但推薦）**
   - 在 Build 選單中找到 `Rebuild Project`
   - 點擊 `Rebuild Project`
   - 或者直接點擊 ▶️ Run 按鈕（會自動重新構建）

### 方法 2：使用 Gradle 任務

1. **打開 Gradle 面板**
   - 在 Android Studio 右側找到 `Gradle` 標籤
   - 如果沒有看到，點擊 `View` → `Tool Windows` → `Gradle`

2. **展開任務**
   - 展開 `votechaos-main > Tasks > build`
   - 找到 `clean` 任務

3. **執行 clean 任務**
   - 雙擊 `clean` 任務
   - 或右鍵點擊 → `Run 'clean'`

4. **等待清理完成**
   - 底部 `Build` 標籤會顯示進度
   - 完成後，執行 `assembleDebug` 或直接點擊 ▶️ Run

## 完整步驟（推薦）

### 步驟 1：Clean Project
1. 點擊 `Build` → `Clean Project`
2. 等待清理完成

### 步驟 2：Rebuild Project（可選）
1. 點擊 `Build` → `Rebuild Project`
2. 等待重建完成

### 步驟 3：安裝 APP
1. 點擊頂部工具列的綠色 ▶️ 按鈕（Run）
2. 或使用快捷鍵 `Shift + F10`
3. 等待構建和安裝完成

## 命令列方式（可選）

如果您熟悉命令行，也可以在終端中執行：

```bash
cd C:\Users\USER\Documents\Mywork\votechaos-main\android
.\gradlew clean
.\gradlew assembleDebug
.\gradlew installDebug
```

## 注意事項

- ⚠️ Clean Project 會刪除所有編譯結果（.class 文件、APK 等），但不會刪除源代碼
- ⚠️ Clean Project 後需要重新構建，這可能需要幾分鐘
- ✅ Clean Project 可以解決很多奇怪的構建錯誤
- ✅ 在修改 Java/Kotlin 代碼後，建議先 Clean Project 再構建

## 當前情況

**建議執行 Clean Project**，因為：
- ✅ 已修改 `MainActivity.java`（Java 代碼）
- ✅ 需要確保新代碼被正確編譯
- ✅ 可以避免舊代碼殘留的問題
