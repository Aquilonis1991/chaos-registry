# ⚡ APK 建置快速指南

---

## 🎯 一鍵建置（自動化）

```powershell
.\build-apk.ps1
```

**預計時間**: 10-18 分鐘（首次）/ 2-3 分鐘（後續）

---

## 📋 手動建置（5 步驟）

```powershell
# 1. 安裝依賴
npm install

# 2. 建置 Web
npm run build

# 3. 添加 Android（僅首次）
npx cap add android

# 4. 同步代碼
npx cap sync android

# 5. 建置 APK
cd android
.\gradlew.bat assembleDebug
cd ..
```

**APK 位置**: `android\app\build\outputs\apk\debug\app-debug.apk`

---

## 📱 安裝到手機

```powershell
# 方法 1: ADB
adb install VoteChaos-debug.apk

# 方法 2: 複製到手機手動安裝
```

---

## ⚠️ 前置需求

必須先安裝：
- Node.js (v18+): https://nodejs.org/
- Android Studio: https://developer.android.com/studio

---

## 🐛 常見錯誤

### npm 找不到？
→ 安裝 Node.js 並重啟終端機

### gradlew 找不到？
→ 執行 `npx cap add android`

### JDK 錯誤？
→ Android Studio → Settings → SDK Location

---

## 📞 需要幫助？

詳細指南：`BUILD_APK_GUIDE.md`

---

**預祝建置順利！** 🚀


