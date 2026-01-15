# 測試前準備腳本 (PowerShell)
# 自動執行重新構建和清理應用數據

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "測試前準備腳本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 檢查是否在正確的目錄
if (-not (Test-Path "package.json")) {
    Write-Host "錯誤: 請在專案根目錄執行此腳本" -ForegroundColor Red
    exit 1
}

# 步驟 1: 重新構建應用
Write-Host "[1/4] 重新構建應用..." -ForegroundColor Yellow
Write-Host "  - 構建前端..." -ForegroundColor Gray
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] 前端構建失敗" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] 前端構建完成" -ForegroundColor Green

Write-Host "  - 同步 Capacitor..." -ForegroundColor Gray
npm run cap:sync:android
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Capacitor 同步失敗" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Capacitor 同步完成" -ForegroundColor Green

Write-Host "  - 構建並安裝 Android 應用..." -ForegroundColor Gray
cd android
.\gradlew.bat assembleDebug installDebug
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Android 構建或安裝失敗" -ForegroundColor Red
    cd ..
    exit 1
}
Write-Host "  [OK] Android 應用構建並安裝完成" -ForegroundColor Green
cd ..

Write-Host "[OK] 應用重新構建完成" -ForegroundColor Green
Write-Host ""

# 步驟 2: 清理應用數據
Write-Host "[2/4] 清理應用數據..." -ForegroundColor Yellow
$devices = adb devices | Select-String "device$"
if ($devices) {
    adb shell pm clear com.votechaos.app.debug
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] 應用數據已清理" -ForegroundColor Green
    } else {
        Write-Host "[WARN] 清理應用數據時出現錯誤（可能應用未安裝）" -ForegroundColor Yellow
    }
} else {
    Write-Host "[WARN] 警告: 未檢測到已連接的設備/模擬器" -ForegroundColor Yellow
    Write-Host "  請確保模擬器已啟動，然後手動執行: adb shell pm clear com.votechaos.app.debug" -ForegroundColor Yellow
}

Write-Host ""

# 步驟 3: 完成
Write-Host "[3/4] 準備完成！" -ForegroundColor Green
Write-Host ""

# 步驟 4: 提示下一步
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "準備完成，可以開始測試" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步操作:" -ForegroundColor White
Write-Host "1. 啟動應用進行測試" -ForegroundColor Gray
Write-Host "2. 查看 Logcat: adb logcat -s VoteChaos" -ForegroundColor Gray
Write-Host ""
