# PowerShell 腳本：創建 .env.local 檔案
# 使用方法：在 PowerShell 中執行 .\create-env.ps1

Write-Host "正在創建 .env.local 檔案..." -ForegroundColor Green

$envContent = @"
VITE_SUPABASE_URL=https://epyykzxxglkjombvozhr.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVweXlrenh4Z2xram9tYnZvemhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MDg1MTEsImV4cCI6MjA3NTk4NDUxMX0.A2QBfDwW1TlG5GiKaHN3_JzT3Tk3U0hJfTZm0hRq1tg
"@

try {
    $envContent | Out-File -FilePath ".env.local" -Encoding utf8 -NoNewline
    Write-Host "✓ .env.local 檔案創建成功！" -ForegroundColor Green
    Write-Host ""
    Write-Host "檔案內容：" -ForegroundColor Yellow
    Write-Host "----------------------------------------"
    Get-Content ".env.local"
    Write-Host "----------------------------------------"
    Write-Host ""
    Write-Host "下一步：執行 'npm run dev' 啟動應用" -ForegroundColor Cyan
} catch {
    Write-Host "✗ 創建檔案時發生錯誤：$($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "請手動創建 .env.local 檔案，內容如下：" -ForegroundColor Yellow
    Write-Host $envContent
}

