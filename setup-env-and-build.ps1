# Setup Environment and Build APK
# This script sets up JAVA_HOME permanently and builds the APK

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Environment Setup & APK Builder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Set JAVA_HOME permanently for user
Write-Host "[1/4] Setting JAVA_HOME permanently..." -ForegroundColor Yellow
$javaHome = "C:\Program Files\Android\Android Studio\jbr"

try {
    [Environment]::SetEnvironmentVariable("JAVA_HOME", $javaHome, "User")
    Write-Host "JAVA_HOME set to: $javaHome" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "Warning: Could not set permanently, will use for this session only" -ForegroundColor Yellow
    Write-Host ""
}

# Step 2: Set for current session
Write-Host "[2/4] Configuring current session..." -ForegroundColor Yellow
$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;" + $env:Path

# Verify
$javaVersion = & java -version 2>&1 | Select-Object -First 1
Write-Host "Java: $javaVersion" -ForegroundColor Green
Write-Host "JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Green
Write-Host ""

# Step 3: Create gradle.properties with org.gradle.java.home
Write-Host "[3/4] Configuring Gradle..." -ForegroundColor Yellow
$gradleProps = Get-Content "android\gradle.properties" -Raw
if ($gradleProps -notmatch "org.gradle.java.home") {
    $javaHomeEscaped = $javaHome -replace '\\', '\\\\'
    Add-Content "android\gradle.properties" "`norg.gradle.java.home=$javaHomeEscaped"
    Write-Host "Added org.gradle.java.home to gradle.properties" -ForegroundColor Green
} else {
    Write-Host "org.gradle.java.home already configured" -ForegroundColor Green
}
Write-Host ""

# Step 4: Build APK
Write-Host "[4/4] Building APK..." -ForegroundColor Yellow
Write-Host "This will take 10-15 minutes on first build..." -ForegroundColor Cyan
Write-Host "Please wait..." -ForegroundColor Cyan
Write-Host ""

Push-Location android

.\gradlew.bat assembleDebug

$buildResult = $LASTEXITCODE

Pop-Location

Write-Host ""
if ($buildResult -eq 0) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  BUILD SUCCESS!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    
    $apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
    if (Test-Path $apkPath) {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $outputApk = "VoteChaos-debug-$timestamp.apk"
        Copy-Item $apkPath $outputApk -Force
        
        $sizeMB = [math]::Round((Get-Item $outputApk).Length / 1MB, 2)
        
        Write-Host "APK File: $outputApk" -ForegroundColor White
        Write-Host "Size: $sizeMB MB" -ForegroundColor White
        Write-Host "Location: $(Get-Location)\$outputApk" -ForegroundColor White
        Write-Host ""
        Write-Host "Install to Android device:" -ForegroundColor Cyan
        Write-Host "  adb install $outputApk" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Or copy the APK file to your phone and install manually." -ForegroundColor White
        Write-Host ""
    }
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  BUILD FAILED" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check the error messages above." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "Note: JAVA_HOME has been set permanently." -ForegroundColor Cyan
Write-Host "Future builds can use: cd android; .\gradlew.bat assembleDebug" -ForegroundColor Cyan
Write-Host ""

