# Rebuild APK with Critical Fixes (v2)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Rebuild APK v2 (Critical Fixes)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set environment variables
Write-Host "[1/5] Setting up environment..." -ForegroundColor Yellow
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path
Write-Host "Java configured" -ForegroundColor Green
Write-Host ""

# Rebuild web
Write-Host "[2/5] Building web app..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Web build failed" -ForegroundColor Red
    exit 1
}
Write-Host "Web app built" -ForegroundColor Green
Write-Host ""

# Sync to Android
Write-Host "[3/5] Syncing to Android..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Sync failed" -ForegroundColor Red
    exit 1
}
Write-Host "Synced successfully" -ForegroundColor Green
Write-Host ""

# Clean previous build
Write-Host "[4/5] Cleaning previous build..." -ForegroundColor Yellow
if (Test-Path "android\app\build") {
    Remove-Item "android\app\build" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Cleaned build directory" -ForegroundColor Green
} else {
    Write-Host "No previous build found" -ForegroundColor Green
}
Write-Host ""

# Build APK
Write-Host "[5/5] Building APK..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Cyan
Write-Host ""

Push-Location android

.\gradlew.bat assembleDebug

$buildResult = $LASTEXITCODE

Pop-Location

if ($buildResult -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  BUILD SUCCESS!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    # Copy APK
    $apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkPath) {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $outputApk = "VoteChaos-debug-v2-$timestamp.apk"
        Copy-Item $apkPath $outputApk -Force
        
        $sizeMB = [math]::Round((Get-Item $outputApk).Length / 1MB, 2)
        
        Write-Host "APK File: $outputApk" -ForegroundColor White
        Write-Host "Size: $sizeMB MB" -ForegroundColor White
        Write-Host ""
        Write-Host "Install command:" -ForegroundColor Cyan
        Write-Host "  adb install $outputApk" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "=== CRITICAL FIXES IN v2 ===" -ForegroundColor Cyan
        Write-Host "1. React App now renders BEFORE Capacitor initialization" -ForegroundColor White
        Write-Host "2. AdMob initialization is non-blocking" -ForegroundColor White
        Write-Host "3. All service initialization failures are caught" -ForegroundColor White
        Write-Host "4. APP will start even if AdMob fails to initialize" -ForegroundColor White
        Write-Host ""
        Write-Host "This should fix the startup crash issue!" -ForegroundColor Green
        Write-Host ""
    }
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  BUILD FAILED" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host "Done!" -ForegroundColor Green

