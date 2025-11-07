# Final Build Script with Startup Fix
# This script builds a working APK that won't crash on startup

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  VoteChaos - Final Fixed Build" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Environment setup
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path

Write-Host "Environment configured" -ForegroundColor Green
Write-Host ""

# Manual build steps (since we can't rely on npm in this shell)
Write-Host "================================================" -ForegroundColor Yellow
Write-Host "  MANUAL STEPS REQUIRED" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Yellow
Write-Host ""

Write-Host "Please follow these steps in a NEW PowerShell window:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open a NEW PowerShell window" -ForegroundColor White
Write-Host ""
Write-Host "2. Navigate to project:" -ForegroundColor White
Write-Host '   cd "C:\Users\USER\Documents\工作用\votechaos-main"' -ForegroundColor Gray
Write-Host ""
Write-Host "3. Build web app:" -ForegroundColor White
Write-Host "   npm run build" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Sync to Android:" -ForegroundColor White
Write-Host "   npx cap sync android" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Come back here and press Enter to continue..." -ForegroundColor White
Write-Host ""

Read-Host "Press Enter after completing steps 1-4"

Write-Host ""
Write-Host "Continuing with Android build..." -ForegroundColor Yellow
Write-Host ""

# Build Android
Push-Location android

.\gradlew.bat clean assembleDebug

$buildResult = $LASTEXITCODE

Pop-Location

if ($buildResult -eq 0) {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "  SUCCESS!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    
    $apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkPath) {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $outputApk = "VoteChaos-WORKING-$timestamp.apk"
        Copy-Item $apkPath $outputApk -Force
        
        $sizeMB = [math]::Round((Get-Item $outputApk).Length / 1MB, 2)
        
        Write-Host "APK: $outputApk" -ForegroundColor White
        Write-Host "Size: $sizeMB MB" -ForegroundColor White
        Write-Host ""
        Write-Host "Install: adb install -r $outputApk" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "KEY FIXES:" -ForegroundColor Cyan
        Write-Host "- React renders before Capacitor" -ForegroundColor White
        Write-Host "- Non-blocking AdMob initialization" -ForegroundColor White
        Write-Host "- All errors caught gracefully" -ForegroundColor White
        Write-Host "- AdMob APP ID added to manifest" -ForegroundColor White
        Write-Host ""
    }
} else {
    Write-Host "Build failed" -ForegroundColor Red
    exit 1
}

