# VoteChaos APK Build Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VoteChaos APK Builder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
Write-Host "[Check] Node.js..." -ForegroundColor Yellow
$nodeExists = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeExists) {
    Write-Host "ERROR: Node.js not installed" -ForegroundColor Red
    Write-Host "Install from: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}
$nodeVersion = node --version
Write-Host "OK: Node.js $nodeVersion" -ForegroundColor Green
Write-Host ""

# Step 1: Install dependencies
Write-Host "[1/5] Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: npm install failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "OK: Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 2: Build web app
Write-Host "[2/5] Building web app..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "OK: Web app built" -ForegroundColor Green
Write-Host ""

# Step 3: Add Android platform if needed
if (-Not (Test-Path "android")) {
    Write-Host "[3/5] Adding Android platform..." -ForegroundColor Yellow
    npx cap add android
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to add Android" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "OK: Android platform added" -ForegroundColor Green
} else {
    Write-Host "[3/5] Android platform exists" -ForegroundColor Green
}
Write-Host ""

# Step 4: Sync to Android
Write-Host "[4/5] Syncing to Android..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Sync failed" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "OK: Synced successfully" -ForegroundColor Green
Write-Host ""

# Step 5: Build APK
Write-Host "[5/5] Building APK (this may take several minutes)..." -ForegroundColor Yellow
Write-Host "Note: First build may take 5-10 minutes to download dependencies" -ForegroundColor Cyan

Push-Location android
if (Test-Path "gradlew.bat") {
    .\gradlew.bat assembleDebug
    $buildResult = $LASTEXITCODE
} else {
    Write-Host "ERROR: gradlew.bat not found" -ForegroundColor Red
    Pop-Location
    Read-Host "Press Enter to exit"
    exit 1
}
Pop-Location

if ($buildResult -ne 0) {
    Write-Host "ERROR: APK build failed" -ForegroundColor Red
    Write-Host "Common causes:" -ForegroundColor Yellow
    Write-Host "1. Android Studio not installed" -ForegroundColor White
    Write-Host "2. Android SDK not configured" -ForegroundColor White
    Write-Host "3. JDK not installed" -ForegroundColor White
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "OK: APK built successfully" -ForegroundColor Green
Write-Host ""

# Copy APK to root directory
$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apkPath) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $outputApk = "VoteChaos-debug-$timestamp.apk"
    Copy-Item $apkPath $outputApk
    
    $sizeMB = [math]::Round((Get-Item $outputApk).Length / 1MB, 2)
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  BUILD SUCCESS!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "APK File: $outputApk" -ForegroundColor White
    Write-Host "Size: $sizeMB MB" -ForegroundColor White
    Write-Host ""
    Write-Host "Install command:" -ForegroundColor Cyan
    Write-Host "  adb install $outputApk" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or copy APK to phone and install manually" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "ERROR: APK not found at $apkPath" -ForegroundColor Red
}

Write-Host "Done!" -ForegroundColor Green
Read-Host "Press Enter to exit"


