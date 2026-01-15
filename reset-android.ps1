# Android 模擬器重置腳本 (PowerShell)
# 用於重置模擬器並確保所有修改都應用到應用

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Android 模擬器重置腳本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 檢查是否在正確的目錄
if (-not (Test-Path "package.json")) {
    Write-Host "錯誤: 請在專案根目錄執行此腳本" -ForegroundColor Red
    exit 1
}

# 步驟 1: 清理應用數據
Write-Host "[1/7] 清理應用數據..." -ForegroundColor Yellow
$devices = adb devices | Select-String "device$"
if ($devices) {
    adb shell pm clear com.votechaos.app.debug
    Write-Host "[OK] 應用數據已清理" -ForegroundColor Green
} else {
    Write-Host "[WARN] 警告: 未檢測到已連接的設備/模擬器" -ForegroundColor Yellow
    Write-Host "  請確保模擬器已啟動" -ForegroundColor Yellow
}

Write-Host ""

# 步驟 2: 清理前端構建
Write-Host "[2/7] 清理前端構建..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
    Write-Host "[OK] dist 目錄已清理" -ForegroundColor Green
}
npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] 前端構建完成" -ForegroundColor Green
} else {
    Write-Host "[ERROR] 前端構建失敗" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 步驟 3: 同步 Capacitor
Write-Host "[3/7] 同步 Capacitor..." -ForegroundColor Yellow
npm run cap:sync:android
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Capacitor 同步完成" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Capacitor 同步失敗" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 步驟 4: 清理 Android 構建
Write-Host "[4/7] 清理 Android 構建..." -ForegroundColor Yellow
cd android
if (Test-Path "app\build") {
    Remove-Item -Recurse -Force app\build -ErrorAction SilentlyContinue
    Write-Host "[OK] app\build 已清理" -ForegroundColor Green
}
if (Test-Path "build") {
    Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue
    Write-Host "[OK] build 已清理" -ForegroundColor Green
}
.\gradlew.bat clean
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Gradle clean 完成" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Gradle clean 失敗" -ForegroundColor Red
    cd ..
    exit 1
}

Write-Host ""

# 步驟 5: 重新構建
Write-Host "[5/7] 重新構建 Android 專案..." -ForegroundColor Yellow
.\gradlew.bat assembleDebug
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Android 專案構建完成" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Android 專案構建失敗" -ForegroundColor Red
    cd ..
    exit 1
}

Write-Host ""

# 步驟 6: 安裝到模擬器
Write-Host "[6/7] 安裝應用到模擬器..." -ForegroundColor Yellow
$devices = adb devices | Select-String "device$"
if ($devices) {
    .\gradlew.bat installDebug
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] 應用已安裝" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] 應用安裝失敗" -ForegroundColor Red
        cd ..
        exit 1
    }
} else {
    Write-Host "[WARN] 警告: 未檢測到已連接的設備/模擬器" -ForegroundColor Yellow
    Write-Host "  請確保模擬器已啟動，然後手動執行: .\gradlew.bat installDebug" -ForegroundColor Yellow
}

Write-Host ""

# 步驟 7: 完成
Write-Host "[7/7] 重置完成！" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "下一步操作:" -ForegroundColor Cyan
Write-Host "1. 打開 Logcat: adb logcat -s VoteChaos" -ForegroundColor White
Write-Host "2. 啟動應用進行測試" -ForegroundColor White
Write-Host "3. 按照測試流程進行測試" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan

cd ..
