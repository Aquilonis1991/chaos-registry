# Rebuild APK with fixes

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Rebuild APK (Fixed Version)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set environment variables
Write-Host "[1/4] Setting up environment..." -ForegroundColor Yellow
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path
Write-Host "Java configured" -ForegroundColor Green
Write-Host ""

# Clean previous build
Write-Host "[2/4] Cleaning previous build..." -ForegroundColor Yellow
if (Test-Path "android\app\build") {
    Remove-Item "android\app\build" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Cleaned build directory" -ForegroundColor Green
} else {
    Write-Host "No previous build found" -ForegroundColor Green
}
Write-Host ""

# Rebuild
Write-Host "[3/4] Building APK..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Cyan
Write-Host ""

Push-Location android

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
    Write-Host "[4/4] Copying APK..." -ForegroundColor Yellow
    $apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkPath) {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $outputApk = "VoteChaos-debug-FIXED-$timestamp.apk"
        Copy-Item $apkPath $outputApk -Force
        
        $sizeMB = [math]::Round((Get-Item $outputApk).Length / 1MB, 2)
        
        Write-Host "APK File: $outputApk" -ForegroundColor White
        Write-Host "Size: $sizeMB MB" -ForegroundColor White
        Write-Host ""
        Write-Host "Install command:" -ForegroundColor Cyan
        Write-Host "  adb install $outputApk" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "=== CHANGES IN THIS VERSION ===" -ForegroundColor Cyan
        Write-Host "1. Added AdMob APPLICATION_ID to AndroidManifest.xml" -ForegroundColor White
        Write-Host "2. Fixed APP crash on startup" -ForegroundColor White
        Write-Host "3. Clean rebuild to ensure all changes applied" -ForegroundColor White
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

