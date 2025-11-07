# Complete Rebuild with All Environment Setup

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VoteChaos Complete Rebuild v2" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set JAVA_HOME
Write-Host "[Setup] Configuring Java..." -ForegroundColor Yellow
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path
Write-Host "Java configured" -ForegroundColor Green
Write-Host ""

# Just build Android directly (skip web rebuild since dist already exists)
Write-Host "[Build] Building Android APK..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Cyan
Write-Host ""

Push-Location android

# Copy updated files first
Write-Host "Copying updated AndroidManifest.xml..." -ForegroundColor Cyan
# The manifest is already updated

.\gradlew.bat clean assembleDebug

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
        $outputApk = "VoteChaos-v2-FINAL-$timestamp.apk"
        Copy-Item $apkPath $outputApk -Force
        
        $sizeMB = [math]::Round((Get-Item $outputApk).Length / 1MB, 2)
        
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "APK File: $outputApk" -ForegroundColor White
        Write-Host "Size: $sizeMB MB" -ForegroundColor White
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Install:" -ForegroundColor Yellow
        Write-Host "  adb install -r $outputApk" -ForegroundColor White
        Write-Host "  (Use -r to replace existing app)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "=== CRITICAL FIXES IN THIS VERSION ===" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Problem Identified:" -ForegroundColor Yellow
        Write-Host "  - APP crashed during startup" -ForegroundColor White
        Write-Host "  - AdMob initialization was blocking" -ForegroundColor White
        Write-Host "  - React didn't render if Capacitor failed" -ForegroundColor White
        Write-Host ""
        Write-Host "Fixes Applied:" -ForegroundColor Green
        Write-Host "  1. React App renders BEFORE Capacitor init" -ForegroundColor White
        Write-Host "  2. AdMob init is non-blocking with error catch" -ForegroundColor White
        Write-Host "  3. All service failures are caught gracefully" -ForegroundColor White
        Write-Host "  4. AdMob APPLICATION_ID added to manifest" -ForegroundColor White
        Write-Host ""
        Write-Host "Result:" -ForegroundColor Green
        Write-Host "  APP will start even if services fail to initialize" -ForegroundColor White
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

Write-Host "Ready to install!" -ForegroundColor Green

