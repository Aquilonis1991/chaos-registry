# VoteChaos APK Quick Build
# Skip all checks, build directly

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VoteChaos APK Quick Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Build APK directly (assuming android folder exists)
if (Test-Path "android") {
    Write-Host "[Building APK]" -ForegroundColor Yellow
    Write-Host "This will take 10-15 minutes on first build..." -ForegroundColor Cyan
    Write-Host ""
    
    Push-Location android
    
    if (Test-Path "gradlew.bat") {
        .\gradlew.bat assembleDebug
        $buildResult = $LASTEXITCODE
    } else {
        Write-Host "ERROR: gradlew.bat not found" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    
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
            $outputApk = "VoteChaos-debug-$timestamp.apk"
            Copy-Item $apkPath $outputApk
            
            $sizeMB = [math]::Round((Get-Item $outputApk).Length / 1MB, 2)
            
            Write-Host "APK: $outputApk" -ForegroundColor White
            Write-Host "Size: $sizeMB MB" -ForegroundColor White
            Write-Host ""
            Write-Host "Install: adb install $outputApk" -ForegroundColor Yellow
            Write-Host ""
        }
    } else {
        Write-Host ""
        Write-Host "ERROR: Build failed" -ForegroundColor Red
        Write-Host ""
        Write-Host "Common causes:" -ForegroundColor Yellow
        Write-Host "1. Java JDK not installed" -ForegroundColor White
        Write-Host "2. JAVA_HOME not set" -ForegroundColor White
        Write-Host ""
        Write-Host "To install JDK:" -ForegroundColor Cyan
        Write-Host "- Download Android Studio: https://developer.android.com/studio" -ForegroundColor White
        Write-Host "- Or download JDK 17: https://adoptium.net/" -ForegroundColor White
        Write-Host ""
        exit 1
    }
} else {
    Write-Host "ERROR: Android folder not found" -ForegroundColor Red
    Write-Host "Run the full build script first: .\build-apk-en.ps1" -ForegroundColor Yellow
    exit 1
}

