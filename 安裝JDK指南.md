# ☕ 安裝 Java JDK 指南

---

## 📋 當前狀況

✅ Node.js v22.20.0 - **已安裝**  
✅ 依賴安裝 - **完成**  
✅ Web 建置 - **完成**  
✅ Android 平台 - **已添加**  
❌ Java JDK - **缺少**  

**錯誤訊息**：
```
ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH.
```

---

## 🎯 解決方案：安裝 JDK

### 方法 1：透過 Android Studio 安裝（推薦）

#### 步驟 1: 下載 Android Studio
1. 訪問：https://developer.android.com/studio
2. 點擊「Download Android Studio」
3. 下載大小：約 1.2 GB
4. 執行安裝程式

#### 步驟 2: 安裝設定
1. 選擇「Standard」安裝類型
2. 同意授權協議
3. 等待下載完成（約 3-5 GB，包含 SDK 和 JDK）

**安裝時間**：30-60 分鐘（視網速而定）

#### 步驟 3: 安裝完成後
Android Studio 會自動安裝：
- ✅ Java JDK（通常是 JDK 17）
- ✅ Android SDK
- ✅ Gradle 建置工具

---

### 方法 2：只安裝 JDK（較快）

如果您不想安裝完整的 Android Studio：

#### 選項 A: 下載 JDK 17（推薦）
1. 訪問：https://adoptium.net/
2. 選擇：
   - **版本**：17 (LTS)
   - **作業系統**：Windows
   - **架構**：x64
3. 下載 `.msi` 安裝程式
4. 執行安裝
5. ✅ **勾選**「Add to PATH」
6. ✅ **勾選**「Set JAVA_HOME」

#### 選項 B: Oracle JDK
1. 訪問：https://www.oracle.com/java/technologies/downloads/#java17
2. 下載 Windows x64 Installer
3. 執行安裝

**安裝時間**：5-10 分鐘

---

### 方法 3：使用 Chocolatey（進階）

如果您有 Chocolatey 套件管理器：

```powershell
# 以管理員權限執行 PowerShell
choco install openjdk17
```

---

## ⚙️ 安裝 JDK 後的設定

### 1. 確認 JDK 已安裝

**重新開啟 PowerShell**，執行：

```powershell
java -version
```

應該看到類似：
```
openjdk version "17.0.x" ...
```

### 2. 檢查 JAVA_HOME

```powershell
echo $env:JAVA_HOME
```

應該顯示 JDK 安裝路徑，例如：
```
C:\Program Files\Java\jdk-17
```

### 3. 如果沒有設定 JAVA_HOME

手動設定環境變數：

```powershell
# 找到 JDK 安裝路徑（例如）
$jdkPath = "C:\Program Files\Java\jdk-17"

# 設定使用者環境變數
[Environment]::SetEnvironmentVariable("JAVA_HOME", $jdkPath, "User")

# 重新載入
$env:JAVA_HOME = $jdkPath
```

---

## 🚀 完成 JDK 安裝後

### 繼續建置 APK

```powershell
# 回到專案目錄
cd "C:\Users\USER\Documents\工作用\votechaos-main"

# 執行建置腳本
.\build-apk-en.ps1
```

或手動執行最後一步：

```powershell
cd android
.\gradlew.bat assembleDebug
```

---

## 🎊 預期結果

建置成功後會看到：

```
BUILD SUCCESSFUL in Xm Ys
...
APK File: VoteChaos-debug-YYYYMMDD-HHMMSS.apk
Size: XX.XX MB
```

APK 位置：
- **原始**：`android\app\build\outputs\apk\debug\app-debug.apk`
- **複製**：`VoteChaos-debug-YYYYMMDD-HHMMSS.apk`（專案根目錄）

---

## 📌 快速決策指南

### 🤔 我該選哪個？

**如果您計劃長期開發 Android App**：
→ 選擇 **方法 1：安裝 Android Studio**
  - 功能完整
  - 包含除錯工具
  - 圖形化介面
  - 時間：1 小時

**如果只需要建置這個 APK**：
→ 選擇 **方法 2：只安裝 JDK**
  - 快速安裝
  - 佔用空間小
  - 時間：10 分鐘

**⚠️ 注意**：即使只安裝 JDK，Gradle 在首次建置時仍會下載 Android SDK 相關工具（約 1-2 GB）。

---

## 💡 推薦方案

### 給您的建議：**安裝 Android Studio**

**理由**：
1. ✅ 一次性解決所有問題（JDK + SDK + 工具）
2. ✅ 未來可能需要調整 Android 專案設定
3. ✅ 可以使用圖形化介面管理 SDK
4. ✅ 包含 Android 模擬器（測試用）

**下載連結**：
🔗 https://developer.android.com/studio

---

## ❓ 常見問題

### Q: 建置需要多久？
- **首次建置**：10-18 分鐘（下載 Gradle 依賴）
- **後續建置**：2-5 分鐘

### Q: 需要多少磁碟空間？
- **只安裝 JDK**：~500 MB
- **Android Studio 完整**：~8-10 GB
- **Gradle 快取**：~2-3 GB

### Q: 可以在沒有 Android Studio 的情況下建置嗎？
- 可以，但需要手動設定 Android SDK 路徑，較複雜。

### Q: 我的 JDK 版本需要是多少？
- **推薦**：JDK 17（LTS）
- **支援**：JDK 11、17、21
- **不支援**：JDK 8、JDK 22+

---

## 📞 下一步行動

### 立即行動：

1. **下載並安裝**：
   - Android Studio：https://developer.android.com/studio
   - 或 JDK 17：https://adoptium.net/

2. **安裝完成後**：
   ```powershell
   # 重新開啟 PowerShell
   cd "C:\Users\USER\Documents\工作用\votechaos-main"
   .\build-apk-en.ps1
   ```

3. **等待 10-18 分鐘**

4. **獲得 APK！** 🎉

---

**準備好後，告訴我您選擇了哪個方法！** 😊

