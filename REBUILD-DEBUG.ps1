# ========================================
# VoteChaos 除錯版本建置腳本
# 完全移除 AdMob 以診斷啟動問題
# ========================================

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "VoteChaos 除錯版本建置" -ForegroundColor Cyan
Write-Host "（AdMob 功能已暫時停用）" -ForegroundColor Yellow
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 設定 JDK 路徑
$jdkPath = "C:\Program Files\Android\Android Studio\jbr"
Write-Host "[1/7] 設定 Java 環境..." -ForegroundColor Yellow
$env:JAVA_HOME = $jdkPath
$env:Path = "$jdkPath\bin;$env:Path"

# 驗證 Java
Write-Host "[2/7] 驗證 Java 安裝..." -ForegroundColor Yellow
try {
    $javaVersion = & java -version 2>&1 | Select-Object -First 1
    Write-Host "  ✓ Java 版本: $javaVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ 錯誤: 找不到 Java" -ForegroundColor Red
    exit 1
}

# 清理建置
Write-Host "[3/7] 清理舊建置..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Path "dist" -Recurse -Force
    Write-Host "  ✓ 已刪除 dist/" -ForegroundColor Green
}
if (Test-Path "android/app/build") {
    Remove-Item -Path "android/app/build" -Recurse -Force
    Write-Host "  ✓ 已刪除 android/app/build/" -ForegroundColor Green
}

# 建置前端
Write-Host "[4/7] 建置前端..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ 前端建置失敗" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ 前端建置完成" -ForegroundColor Green

# 同步到 Capacitor
Write-Host "[5/7] 同步到 Android..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Capacitor 同步失敗" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Capacitor 同步完成" -ForegroundColor Green

# 建置 APK
Write-Host "[6/7] 建置 APK..." -ForegroundColor Yellow
Write-Host "  (這可能需要幾分鐘...)" -ForegroundColor Gray

Set-Location android
try {
    .\gradlew.bat assembleDebug
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
Write-Host "✓ 除錯版本建置完成！" -ForegroundColor Green
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
    $outputName = "votechaos-debug-$timestamp.apk"
    Copy-Item $apkPath $outputName
    Write-Host "✓ 已複製到: $outputName" -ForegroundColor Green
} else {
    Write-Host "✗ 找不到 APK 檔案" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "除錯版本特性:" -ForegroundColor Yellow
Write-Host "  1. ✓ 完全移除 AdMob 初始化" -ForegroundColor White
Write-Host "  2. ✓ 簡化啟動流程，立即顯示 UI" -ForegroundColor White
Write-Host "  3. ✓ 每個服務獨立錯誤處理" -ForegroundColor White
Write-Host "  4. ✓ 增加詳細的 console.log" -ForegroundColor White
Write-Host ""
Write-Host "測試方法:" -ForegroundColor Yellow
Write-Host "  1. 安裝 APK 到手機" -ForegroundColor White
Write-Host "  2. 如果能開啟 → AdMob 是問題源頭" -ForegroundColor White
Write-Host "  3. 如果仍無法開啟 → 需要查看 logcat 日誌" -ForegroundColor White
Write-Host ""



