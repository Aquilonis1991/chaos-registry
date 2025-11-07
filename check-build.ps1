# Check APK Build Status

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  APK Build Status Checker" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if APK exists
$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"

if (Test-Path $apkPath) {
    Write-Host "SUCCESS! APK has been built!" -ForegroundColor Green
    Write-Host ""
    
    $apk = Get-Item $apkPath
    $sizeMB = [math]::Round($apk.Length / 1MB, 2)
    
    Write-Host "Location: $($apk.FullName)" -ForegroundColor White
    Write-Host "Size: $sizeMB MB" -ForegroundColor White
    Write-Host "Created: $($apk.CreationTime)" -ForegroundColor White
    Write-Host ""
    
    # Copy to root with timestamp
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $outputApk = "VoteChaos-debug-$timestamp.apk"
    Copy-Item $apkPath $outputApk -Force
    
    Write-Host "Copied to: $outputApk" -ForegroundColor Green
    Write-Host ""
    Write-Host "Install command:" -ForegroundColor Cyan
    Write-Host "  adb install $outputApk" -ForegroundColor Yellow
    Write-Host ""
    
} else {
    Write-Host "APK not found yet." -ForegroundColor Yellow
    Write-Host ""
    
    # Check if build is still running
    $javaProcess = Get-Process | Where-Object { $_.ProcessName -like "*java*" }
    
    if ($javaProcess) {
        Write-Host "Build is still running..." -ForegroundColor Cyan
        Write-Host ""
        $javaProcess | Select-Object ProcessName, Id, @{Name="CPU%";Expression={$_.CPU}} | Format-Table -AutoSize
        Write-Host "Please wait and run this script again in a few minutes." -ForegroundColor White
    } else {
        Write-Host "Build process not running." -ForegroundColor Red
        Write-Host ""
        Write-Host "You may need to restart the build:" -ForegroundColor Yellow
        Write-Host "  cd android" -ForegroundColor White
        Write-Host "  .\gradlew.bat assembleDebug" -ForegroundColor White
    }
}

Write-Host ""

