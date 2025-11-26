# Android Studio 專案刷新流程

## 完整刷新步驟

### 方法一：使用命令（推薦）

在專案根目錄執行以下命令：

```bash
# 1. 進入專案目錄
cd C:\Users\USER\Documents\Mywork\votechaos-main

# 2. 構建前端代碼
npm run build

# 3. 同步到 Android 專案
npx cap sync android

# 4. 打開 Android Studio
npx cap open android
```

### 方法二：手動步驟

1. **構建前端代碼**
   - 在終端執行：`npm run build`
   - 等待構建完成（約 4-5 秒）

2. **同步到 Android**
   - 在終端執行：`npx cap sync android`
   - 這會將 `dist/` 目錄的內容複製到 `android/app/src/main/assets/public/`

3. **在 Android Studio 中刷新**
   - 打開 Android Studio
   - 點擊 `File` → `Sync Project with Gradle Files`（或點擊工具欄的同步圖標）
   - 等待同步完成

4. **重新運行應用**
   - 如果應用正在運行，先停止它（點擊紅色方塊按鈕或按 `Shift + F2`）
   - 點擊 `Run` 按鈕（綠色三角形）或按 `Shift + F10` 重新運行
   - 或使用 `Run` → `Run 'app'` 菜單選項

## 快速刷新腳本

可以創建一個批處理文件來快速執行所有步驟：

**`refresh-android.bat`** (Windows):
```batch
@echo off
cd C:\Users\USER\Documents\Mywork\votechaos-main
echo 正在構建前端代碼...
call npm run build
echo 正在同步到 Android...
call npx cap sync android
echo 完成！請在 Android Studio 中重新運行應用。
pause
```

## 重要提示

1. **每次修改代碼後都必須執行**：
   - `npm run build` - 構建最新代碼
   - `npx cap sync android` - 同步到 Android 專案

2. **Android Studio 中的操作**：
   - 如果應用正在運行，先停止它
   - 點擊 `Run` 重新運行
   - 或使用 `Run` → `Run 'app'` 菜單

3. **檢查是否同步成功**：
   - 查看終端輸出，應該看到 "Sync finished"
   - 在 Android Studio 中檢查 `android/app/src/main/assets/public/` 目錄是否有最新文件

4. **如果修改無效**：
   - 確認 `npm run build` 成功完成
   - 確認 `npx cap sync android` 成功完成
   - 在 Android Studio 中執行以下步驟（按順序）：
     1. 停止當前運行的應用（紅色方塊按鈕）
     2. `Build` → `Clean Project`（清理舊的構建文件）
     3. `Build` → `Rebuild Project`（重新構建整個專案）
     4. 等待構建完成（查看底部狀態欄）
     5. 點擊 `Run` 按鈕重新運行應用
   - 如果仍然無效，可以嘗試：
     - `File` → `Invalidate Caches / Restart...` → `Invalidate and Restart`（清除緩存並重啟 Android Studio）

## 常見問題

### Q: 修改後沒有生效？
A: 確保執行了 `npm run build` 和 `npx cap sync android`，然後在 Android Studio 中重新運行應用。

### Q: 構建失敗？
A: 檢查終端錯誤訊息，通常是語法錯誤或缺少依賴。執行 `npm install` 確保所有依賴已安裝。

### Q: 同步失敗？
A: 確保 Android 專案目錄存在且可寫入。檢查 `android/` 目錄權限。

### Q: Android Studio 顯示舊代碼？
A: 執行以下步驟：
   1. 停止當前運行的應用
   2. `Build` → `Clean Project`
   3. 等待清理完成
   4. `Build` → `Make Project`（或直接點擊 `Run`，Android Studio 會自動構建）
   5. 重新運行應用
   6. 如果仍然無效，嘗試 `File` → `Invalidate Caches / Restart...` → `Invalidate and Restart`

### Q: Build 選單中沒有 "Rebuild Project" 選項？
A: 不同版本的 Android Studio 選單可能不同。如果沒有 "Rebuild Project"，請使用：
   - `Build` → `Clean Project`（清理）
   - 然後 `Build` → `Make Project`（構建）
   - 或直接點擊 `Run` 按鈕，Android Studio 會自動構建並運行

### Q: Build 選單中有 "Restart" 選項嗎？
A: Build 選單中沒有 "Restart" 選項。如果需要重啟，請使用：
   - `File` → `Invalidate Caches / Restart...` → `Invalidate and Restart`（重啟 Android Studio）
   - 或手動停止並重新運行應用（`Run` → `Run 'app'`）

