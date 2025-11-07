# VoteChaos APK 簡易建置腳本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VoteChaos APK 建置工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 步驟 1: 檢查 Node.js
Write-Host "[檢查] Node.js..." -ForegroundColor Yellow
$nodeExists = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeExists) {
    Write-Host "❌ Node.js 未安裝" -ForegroundColor Red
    Write-Host "請先安裝: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "按 Enter 結束"
    exit 1
}
$nodeVersion = node --version
Write-Host "✅ Node.js $nodeVersion" -ForegroundColor Green
Write-Host ""

# 步驟 2: 安裝依賴
Write-Host "[1/5] 安裝依賴..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 安裝失敗" -ForegroundColor Red
    Read-Host "按 Enter 結束"
    exit 1
}
Write-Host "✅ 完成" -ForegroundColor Green
Write-Host ""

# 步驟 3: 建置 Web
Write-Host "[2/5] 建置 Web 應用..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 建置失敗" -ForegroundColor Red
    Read-Host "按 Enter 結束"
    exit 1
}
Write-Host "✅ 完成" -ForegroundColor Green
Write-Host ""

# 步驟 4: 添加 Android（如需要）
if (-Not (Test-Path "android")) {
    Write-Host "[3/5] 添加 Android 平台..." -ForegroundColor Yellow
    npx cap add android
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 失敗" -ForegroundColor Red
        Read-Host "按 Enter 結束"
        exit 1
    }
    Write-Host "✅ 完成" -ForegroundColor Green
} else {
    Write-Host "[3/5] Android 平台已存在" -ForegroundColor Green
}
Write-Host ""

# 步驟 5: 同步
Write-Host "[4/5] 同步到 Android..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 同步失敗" -ForegroundColor Red
    Read-Host "按 Enter 結束"
    exit 1
}
Write-Host "✅ 完成" -ForegroundColor Green
Write-Host ""

# 步驟 6: 建置 APK
Write-Host "[5/5] 建置 APK（需要幾分鐘）..." -ForegroundColor Yellow
Push-Location android
if (Test-Path "gradlew.bat") {
    .\gradlew.bat assembleDebug
    $buildResult = $LASTEXITCODE
} else {
    Write-Host "❌ gradlew.bat 未找到" -ForegroundColor Red
    Pop-Location
    Read-Host "按 Enter 結束"
    exit 1
}
Pop-Location

if ($buildResult -ne 0) {
    Write-Host "❌ APK 建置失敗" -ForegroundColor Red
    Write-Host "請檢查 Android Studio 是否已安裝" -ForegroundColor Yellow
    Read-Host "按 Enter 結束"
    exit 1
}
Write-Host "✅ 完成" -ForegroundColor Green
Write-Host ""

# 複製 APK
$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkPath) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $outputApk = "VoteChaos-debug-$timestamp.apk"
    Copy-Item $apkPath $outputApk
    
    $sizeMB = [math]::Round((Get-Item $outputApk).Length / 1MB, 2)
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  建置成功！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "APK: $outputApk" -ForegroundColor White
    Write-Host "大小: $sizeMB MB" -ForegroundColor White
    Write-Host ""
    Write-Host "安裝: adb install $outputApk" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "❌ APK 未找到: $apkPath" -ForegroundColor Red
}

Read-Host "按 Enter 結束"


