# VoteChaos APK 自動建置腳本
# 用途：自動執行所有建置步驟並產出 APK

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   VoteChaos APK 建置工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 檢查 Node.js
Write-Host "[檢查] Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js 版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js 未安裝" -ForegroundColor Red
    Write-Host "請先安裝 Node.js: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# 步驟 1: 安裝依賴
Write-Host "[1/5] 安裝 Node.js 依賴..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { 
    Write-Host "❌ 依賴安裝失敗" -ForegroundColor Red
    exit 1 
}
Write-Host "✅ 依賴安裝完成" -ForegroundColor Green
Write-Host ""

# 步驟 2: 建置 Web 應用
Write-Host "[2/5] 建置 React 應用..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { 
    Write-Host "❌ Web 應用建置失敗" -ForegroundColor Red
    exit 1 
}
Write-Host "✅ Web 應用建置完成" -ForegroundColor Green
Write-Host ""

# 步驟 3: 檢查是否需要添加 Android 平台
if (-Not (Test-Path "android")) {
    Write-Host "[3/5] 添加 Android 平台..." -ForegroundColor Yellow
    npx cap add android
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "❌ 添加 Android 平台失敗" -ForegroundColor Red
        exit 1 
    }
    Write-Host "✅ Android 平台已添加" -ForegroundColor Green
} else {
    Write-Host "[3/5] Android 平台已存在" -ForegroundColor Green
}
Write-Host ""

# 步驟 4: 同步到 Android
Write-Host "[4/5] 同步代碼到 Android..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) { 
    Write-Host "❌ 同步失敗" -ForegroundColor Red
    exit 1 
}
Write-Host "✅ 同步完成" -ForegroundColor Green
Write-Host ""

# 步驟 5: 建置 APK
Write-Host "[5/5] 建置 Debug APK（這需要幾分鐘）..." -ForegroundColor Yellow
Write-Host "提示：首次建置需要下載 Gradle 依賴，可能需要 5-10 分鐘" -ForegroundColor Cyan

Set-Location android

# 檢查 gradlew 是否存在
if (-Not (Test-Path "gradlew.bat")) {
    Write-Host "❌ gradlew.bat 未找到" -ForegroundColor Red
    Write-Host "請先執行: npx cap add android" -ForegroundColor Yellow
    Set-Location ..
    exit 1
}

# 執行 Gradle 建置
.\gradlew.bat assembleDebug

if ($LASTEXITCODE -ne 0) { 
    Write-Host "❌ APK 建置失敗" -ForegroundColor Red
    Write-Host "常見原因：" -ForegroundColor Yellow
    Write-Host "1. Android Studio 未安裝" -ForegroundColor White
    Write-Host "2. Android SDK 未配置" -ForegroundColor White
    Write-Host "3. JDK 未安裝" -ForegroundColor White
    Set-Location ..
    exit 1 
}

Set-Location ..

Write-Host "✅ APK 建置完成！" -ForegroundColor Green
Write-Host ""

# 檢查 APK 是否存在
$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkPath) {
    # 產生帶時間戳的檔名
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $outputApk = "VoteChaos-debug-$timestamp.apk"
    
    # 複製到根目錄
    Copy-Item $apkPath $outputApk
    
    $fileSize = (Get-Item $outputApk).Length / 1MB
    $fileSizeMB = [math]::Round($fileSize, 2)
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   建置成功！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📱 APK 檔案位置：" -ForegroundColor Cyan
    Write-Host "   $outputApk" -ForegroundColor White
    Write-Host ""
    Write-Host "📊 檔案大小：$fileSizeMB MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📋 安裝方式：" -ForegroundColor Cyan
    Write-Host "   1. 連接 Android 手機" -ForegroundColor White
    Write-Host "   2. 啟用 USB 偵錯" -ForegroundColor White
    Write-Host "   3. 執行: adb install $outputApk" -ForegroundColor White
    Write-Host ""
    Write-Host "   或直接複製 APK 到手機安裝" -ForegroundColor White
    Write-Host ""
    Write-Host "✅ 所有步驟完成！" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "❌ APK 檔案未找到" -ForegroundColor Red
    Write-Host "預期位置: $apkPath" -ForegroundColor Yellow
}