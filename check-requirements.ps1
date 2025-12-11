# VoteChaos 專案軟體需求檢查腳本
# 執行方式：在 PowerShell 中執行 .\check-requirements.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VoteChaos 專案軟體需求檢查" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true

# 1. 檢查 Node.js
Write-Host "1. 檢查 Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host "   ✓ Node.js 已安裝: $nodeVersion" -ForegroundColor Green
        $nodeMajor = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
        if ($nodeMajor -lt 18) {
            Write-Host "   ⚠ 警告: Node.js 版本建議 18 或更高 (目前: $nodeVersion)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ✗ Node.js 未安裝" -ForegroundColor Red
        Write-Host "     請前往 https://nodejs.org/ 下載安裝" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "   ✗ Node.js 未安裝或不在 PATH 中" -ForegroundColor Red
    Write-Host "     請前往 https://nodejs.org/ 下載安裝" -ForegroundColor Red
    $allPassed = $false
}
Write-Host ""

# 2. 檢查 npm
Write-Host "2. 檢查 npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version 2>$null
    if ($npmVersion) {
        Write-Host "   ✓ npm 已安裝: v$npmVersion" -ForegroundColor Green
    } else {
        Write-Host "   ✗ npm 未安裝" -ForegroundColor Red
        Write-Host "     npm 通常會隨 Node.js 一起安裝" -ForegroundColor Red
        $allPassed = $false
    }
} catch {
    Write-Host "   ✗ npm 未安裝或不在 PATH 中" -ForegroundColor Red
    $allPassed = $false
}
Write-Host ""

# 3. 檢查 Git
Write-Host "3. 檢查 Git..." -ForegroundColor Yellow
try {
    $gitVersion = git --version 2>$null
    if ($gitVersion) {
        Write-Host "   ✓ Git 已安裝: $gitVersion" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ Git 未安裝 (可選，但建議安裝)" -ForegroundColor Yellow
        Write-Host "     請前往 https://git-scm.com/ 下載安裝" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠ Git 未安裝 (可選，但建議安裝)" -ForegroundColor Yellow
}
Write-Host ""

# 4. 檢查 Capacitor CLI
Write-Host "4. 檢查 Capacitor CLI..." -ForegroundColor Yellow
try {
    $capVersion = npx cap --version 2>$null
    if ($capVersion) {
        Write-Host "   ✓ Capacitor CLI 可用: v$capVersion" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ Capacitor CLI 未全域安裝 (將使用 npx)" -ForegroundColor Yellow
        Write-Host "     這是正常的，專案會使用 npx 來執行 Capacitor 命令" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠ Capacitor CLI 未全域安裝 (將使用 npx)" -ForegroundColor Yellow
}
Write-Host ""

# 5. 檢查專案依賴
Write-Host "5. 檢查專案依賴..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "   ✓ node_modules 資料夾存在" -ForegroundColor Green
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    Write-Host "   ℹ 專案名稱: $($packageJson.name)" -ForegroundColor Cyan
    Write-Host "   ℹ 專案版本: $($packageJson.version)" -ForegroundColor Cyan
} else {
    Write-Host "   ⚠ node_modules 不存在，需要執行 npm install" -ForegroundColor Yellow
    Write-Host "     請執行: npm install" -ForegroundColor Yellow
}
Write-Host ""

# 6. 檢查環境變數檔案
Write-Host "6. 檢查環境變數設定..." -ForegroundColor Yellow
if (Test-Path ".env.local") {
    Write-Host "   ✓ .env.local 檔案存在" -ForegroundColor Green
    $envContent = Get-Content ".env.local" -Raw
    if ($envContent -match "VITE_SUPABASE_URL") {
        Write-Host "   ✓ VITE_SUPABASE_URL 已設定" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ VITE_SUPABASE_URL 未設定" -ForegroundColor Yellow
    }
    if ($envContent -match "VITE_SUPABASE_PUBLISHABLE_KEY") {
        Write-Host "   ✓ VITE_SUPABASE_PUBLISHABLE_KEY 已設定" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ VITE_SUPABASE_PUBLISHABLE_KEY 未設定" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠ .env.local 檔案不存在" -ForegroundColor Yellow
    Write-Host "     請參考 env.example.txt 建立 .env.local 檔案" -ForegroundColor Yellow
}
Write-Host ""

# 7. 檢查 Android 開發環境
Write-Host "7. 檢查 Android 開發環境..." -ForegroundColor Yellow
if (Test-Path "android") {
    Write-Host "   ✓ Android 專案資料夾存在" -ForegroundColor Green
    
    # 檢查 Java/JDK
    try {
        $javaVersion = java -version 2>&1 | Select-Object -First 1
        if ($javaVersion -match "version") {
            Write-Host "   ✓ Java 已安裝" -ForegroundColor Green
            Write-Host "      $javaVersion" -ForegroundColor Gray
        } else {
            Write-Host "   ⚠ Java 未安裝或版本無法識別" -ForegroundColor Yellow
            Write-Host "      Android 開發需要 Java JDK 17 或更高版本" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ⚠ Java 未安裝" -ForegroundColor Yellow
        Write-Host "     請安裝 Java JDK 17 或更高版本" -ForegroundColor Yellow
        Write-Host "     下載: https://adoptium.net/" -ForegroundColor Yellow
    }
    
    # 檢查 Android SDK
    $androidHome = $env:ANDROID_HOME
    if ($androidHome -and (Test-Path $androidHome)) {
        Write-Host "   ✓ ANDROID_HOME 已設定: $androidHome" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ ANDROID_HOME 未設定" -ForegroundColor Yellow
        Write-Host "     通常會由 Android Studio 自動設定" -ForegroundColor Yellow
    }
    
    # 檢查 Android Studio
    $androidStudioPaths = @(
        "$env:LOCALAPPDATA\Programs\Android\Android Studio\bin\studio64.exe",
        "$env:ProgramFiles\Android\Android Studio\bin\studio64.exe",
        "$env:ProgramFiles(x86)\Android\Android Studio\bin\studio64.exe"
    )
    $androidStudioFound = $false
    foreach ($path in $androidStudioPaths) {
        if (Test-Path $path) {
            Write-Host "   ✓ Android Studio 已安裝" -ForegroundColor Green
            $androidStudioFound = $true
            break
        }
    }
    if (-not $androidStudioFound) {
        Write-Host "   ⚠ Android Studio 未安裝 (僅 Android 開發需要)" -ForegroundColor Yellow
        Write-Host "     下載: https://developer.android.com/studio" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ℹ Android 專案資料夾不存在 (僅 Web 開發時不需要)" -ForegroundColor Cyan
}
Write-Host ""

# 8. 檢查 iOS 開發環境
Write-Host "8. 檢查 iOS 開發環境..." -ForegroundColor Yellow
if (Test-Path "ios") {
    Write-Host "   ✓ iOS 專案資料夾存在" -ForegroundColor Green
    Write-Host "   ℹ iOS 開發需要 macOS 和 Xcode" -ForegroundColor Cyan
    Write-Host "   ℹ 在 Windows 上無法進行 iOS 開發" -ForegroundColor Cyan
} else {
    Write-Host "   ℹ iOS 專案資料夾不存在 (僅 Web/Android 開發時不需要)" -ForegroundColor Cyan
}
Write-Host ""

# 9. 檢查 Supabase CLI (可選)
Write-Host "9. 檢查 Supabase CLI (可選)..." -ForegroundColor Yellow
try {
    $supabaseVersion = supabase --version 2>$null
    if ($supabaseVersion) {
        Write-Host "   ✓ Supabase CLI 已安裝: $supabaseVersion" -ForegroundColor Green
    } else {
        Write-Host "   ℹ Supabase CLI 未安裝 (可選工具)" -ForegroundColor Cyan
        Write-Host "     用於本地開發和 Edge Functions 部署" -ForegroundColor Cyan
        Write-Host "     安裝: npm install -g supabase" -ForegroundColor Cyan
    }
} catch {
    Write-Host "   ℹ Supabase CLI 未安裝 (可選工具)" -ForegroundColor Cyan
}
Write-Host ""

# 總結
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "檢查完成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($allPassed) {
    Write-Host "✓ 基本需求已滿足，可以開始開發！" -ForegroundColor Green
    Write-Host ""
    Write-Host "下一步：" -ForegroundColor Yellow
    Write-Host "1. 如果 node_modules 不存在，執行: npm install" -ForegroundColor White
    Write-Host "2. 如果 .env.local 不存在，請建立並設定 Supabase 連線資訊" -ForegroundColor White
    Write-Host "3. 啟動開發伺服器: npm run dev" -ForegroundColor White
} else {
    Write-Host "⚠ 部分需求未滿足，請先安裝缺少的軟體" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "必要軟體：" -ForegroundColor Yellow
    Write-Host "- Node.js 18+ (包含 npm)" -ForegroundColor White
    Write-Host ""
    Write-Host "可選軟體（依開發需求）：" -ForegroundColor Yellow
    Write-Host "- Git (版本控制)" -ForegroundColor White
    Write-Host "- Android Studio (Android 開發)" -ForegroundColor White
    Write-Host "- Java JDK 17+ (Android 開發)" -ForegroundColor White
    Write-Host "- Xcode (iOS 開發，僅 macOS)" -ForegroundColor White
    Write-Host "- Supabase CLI (Edge Functions 部署)" -ForegroundColor White
}

Write-Host ""


