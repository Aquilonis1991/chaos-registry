# ========================================
# VoteChaos APK 完全清除重建腳本
# ========================================

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "VoteChaos APK 完全清除重建" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 設定 JDK 路徑
$jdkPath = "C:\Program Files\Android\Android Studio\jbr"
Write-Host "[1/8] 設定 Java 環境..." -ForegroundColor Yellow
$env:JAVA_HOME = $jdkPath
$env:Path = "$jdkPath\bin;$env:Path"

# 驗證 Java
Write-Host "[2/8] 驗證 Java 安裝..." -ForegroundColor Yellow
try {
    $javaVersion = & java -version 2>&1 | Select-Object -First 1
    Write-Host "  ✓ Java 版本: $javaVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ 錯誤: 找不到 Java" -ForegroundColor Red
    exit 1
}

# 清理前端建置
Write-Host "[3/8] 清理前端建置..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Path "dist" -Recurse -Force
    Write-Host "  ✓ 已刪除 dist/" -ForegroundColor Green
}
if (Test-Path "node_modules/.vite") {
    Remove-Item -Path "node_modules/.vite" -Recurse -Force
    Write-Host "  ✓ 已清除 Vite 快取" -ForegroundColor Green
}

# 清理 Android 建置
Write-Host "[4/8] 清理 Android 建置..." -ForegroundColor Yellow
if (Test-Path "android/app/build") {
    Remove-Item -Path "android/app/build" -Recurse -Force
    Write-Host "  ✓ 已刪除 android/app/build/" -ForegroundColor Green
}
if (Test-Path "android/build") {
    Remove-Item -Path "android/build" -Recurse -Force
    Write-Host "  ✓ 已刪除 android/build/" -ForegroundColor Green
}
if (Test-Path "android/.gradle") {
    Remove-Item -Path "android/.gradle" -Recurse -Force
    Write-Host "  ✓ 已清除 Gradle 快取" -ForegroundColor Green
}

# 重新安裝依賴
Write-Host "[5/8] 重新安裝 npm 依賴..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ npm install 失敗" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ npm 依賴安裝完成" -ForegroundColor Green

# 建置前端
Write-Host "[6/8] 建置前端..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ 前端建置失敗" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ 前端建置完成" -ForegroundColor Green

# 同步到 Capacitor
Write-Host "[7/8] 同步到 Android..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Capacitor 同步失敗" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Capacitor 同步完成" -ForegroundColor Green

# 建置 APK
Write-Host "[8/8] 建置 APK..." -ForegroundColor Yellow
Write-Host "  (這可能需要幾分鐘...)" -ForegroundColor Gray

Set-Location android
try {
    .\gradlew.bat clean assembleDebug
    $exitCode = $LASTEXITCODE
} finally {
    Set-Location ..
}

if ($exitCode -ne 0) {
    Write-Host "  ✗ APK 建置失敗" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Green
Write-Host "✓ 建置完成！" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host ""

# 檢查 APK
$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkPath) {
    $apk = Get-Item $apkPath
    $sizeMB = [math]::Round($apk.Length/1MB, 2)
    
    Write-Host "APK 資訊:" -ForegroundColor Cyan
    Write-Host "  位置: $apkPath" -ForegroundColor White
    Write-Host "  大小: $sizeMB MB" -ForegroundColor White
    Write-Host "  時間: $($apk.LastWriteTime)" -ForegroundColor White
    Write-Host ""
    
    # 複製到根目錄
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $outputName = "votechaos-clean-$timestamp.apk"
    Copy-Item $apkPath $outputName
    Write-Host "✓ 已複製到: $outputName" -ForegroundColor Green
} else {
    Write-Host "✗ 找不到 APK 檔案" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "關鍵修復:" -ForegroundColor Yellow
Write-Host "  1. ✓ 新增 Google Play Services AdMob 依賴" -ForegroundColor White
Write-Host "  2. ✓ 延遲載入所有服務（動態 import）" -ForegroundColor White
Write-Host "  3. ✓ AdMob 初始化延遲 5 秒" -ForegroundColor White
Write-Host "  4. ✓ 完整清除並重建" -ForegroundColor White
Write-Host ""


