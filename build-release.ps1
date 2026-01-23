# VoteChaos Release Builder
# Builds an Android App Bundle (AAB) for Google Play Store upload

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VoteChaos Release Builder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set JAVA_HOME and PATH (Same as standard build script)
Write-Host "[Setup] Setting up Java environment..." -ForegroundColor Yellow
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "C:\Program Files\Android\Android Studio\jbr\bin;" + $env:Path

# Verify Java
$javaVersion = & java -version 2>&1 | Select-Object -First 1
Write-Host "Java: $javaVersion" -ForegroundColor Green
Write-Host ""

# Update Frontend first
Write-Host "[Frontend] Building web assets..." -ForegroundColor Yellow
Start-Process -FilePath "npm" -ArgumentList "run build" -Wait -NoNewWindow
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed!" -ForegroundColor Red
    exit 1
}

# Sync Capacitor
Write-Host "[Capacitor] Syncing with Android..." -ForegroundColor Yellow
Start-Process -FilePath "npx" -ArgumentList "cap sync android" -Wait -NoNewWindow
if ($LASTEXITCODE -ne 0) {
    Write-Host "Capacitor sync failed!" -ForegroundColor Red
    exit 1
}

# Build AAB (App Bundle) - Recommended for Play Store
Write-Host "[Build] Building Release Bundle (AAB)..." -ForegroundColor Yellow
Write-Host "This process effectively signs the app for release..." -ForegroundColor Cyan

Push-Location android

# We use bundleRelease for Play Store, or assembleRelease for direct APK
.\gradlew.bat bundleRelease

$buildResult = $LASTEXITCODE

Pop-Location

if ($buildResult -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  BUILD SUCCESS!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    # Path to AAB
    $aabPath = "android\app\build\outputs\bundle\release\app-release.aab"
    
    # Check if signed AAB exists (it might be app-release.aab or app-release-unsigned.aab depending on signing config)
    # Since we might not have keystore configured in gradle yet, it might produce unsigned
    
    if (Test-Path $aabPath) {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $outputAab = "VoteChaos-release-$timestamp.aab"
        Copy-Item $aabPath $outputAab
        
        $sizeMB = [math]::Round((Get-Item $outputAab).Length / 1MB, 2)
        
        Write-Host "Release Bundle: $outputAab" -ForegroundColor White
        Write-Host "Size: $sizeMB MB" -ForegroundColor White
        Write-Host "Use this file to upload to Google Play Console." -ForegroundColor Yellow
    } else {
        # Fallback to check for unsigned if signing isn't set up
        $unsignedPath = "android\app\build\outputs\bundle\release\app-release-unsigned.aab"
        if (Test-Path $unsignedPath) {
             Write-Host "WARNING: Created Unsigned Bundle." -ForegroundColor Yellow
             Write-Host "You must sign this bundle before uploading to Google Play." -ForegroundColor Yellow
             Write-Host "Location: $unsignedPath" -ForegroundColor White
        } else {
             Write-Host "Error: Could not find output file." -ForegroundColor Red
        }
    }
} else {
    Write-Host "Build Failed." -ForegroundColor Red
}

Write-Host "Done!" -ForegroundColor Green
