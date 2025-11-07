# VoteChaos APK Builder with Environment Setup

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VoteChaos APK Builder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set JAVA_HOME and PATH
Write-Host "[Setup] Setting up Java environment..." -ForegroundColor Yellow
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "C:\Program Files\Android\Android Studio\jbr\bin;" + $env:Path

# Verify Java
Write-Host "[Check] Verifying Java..." -ForegroundColor Yellow
$javaVersion = & java -version 2>&1 | Select-Object -First 1
Write-Host "Java: $javaVersion" -ForegroundColor Green
Write-Host ""

# Build APK
Write-Host "[Build] Building APK..." -ForegroundColor Yellow
Write-Host "This will take 10-15 minutes on first build..." -ForegroundColor Cyan
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
    
    $apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkPath) {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $outputApk = "VoteChaos-debug-$timestamp.apk"
        Copy-Item $apkPath $outputApk
        
        $sizeMB = [math]::Round((Get-Item $outputApk).Length / 1MB, 2)
        
        Write-Host "APK File: $outputApk" -ForegroundColor White
        Write-Host "Size: $sizeMB MB" -ForegroundColor White
        Write-Host ""
        Write-Host "Install command:" -ForegroundColor Cyan
        Write-Host "  adb install $outputApk" -ForegroundColor Yellow
        Write-Host ""
    }
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  BUILD FAILED" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check the error messages above." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Done!" -ForegroundColor Green

