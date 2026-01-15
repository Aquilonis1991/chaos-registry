# 測試 LINE Auth Edge Function 的 OPTIONS 請求

Write-Host "測試 OPTIONS 請求..." -ForegroundColor Cyan

$url = "https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth"

# 測試 OPTIONS 請求
Write-Host "`n發送 OPTIONS 請求..." -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri $url -Method OPTIONS -Headers @{
    "Origin" = "https://localhost"
    "Access-Control-Request-Method" = "POST"
    "Access-Control-Request-Headers" = "authorization,content-type"
} -ErrorAction SilentlyContinue

Write-Host "狀態碼: $($response.StatusCode)" -ForegroundColor $(if ($response.StatusCode -eq 200) { "Green" } else { "Red" })
Write-Host "Headers:" -ForegroundColor Cyan
$response.Headers | Format-Table

# 檢查 CORS headers
if ($response.Headers.'Access-Control-Allow-Origin') {
    Write-Host "`n✅ Access-Control-Allow-Origin: $($response.Headers.'Access-Control-Allow-Origin')" -ForegroundColor Green
} else {
    Write-Host "`n❌ 缺少 Access-Control-Allow-Origin header" -ForegroundColor Red
}

if ($response.Headers.'Access-Control-Allow-Methods') {
    Write-Host "✅ Access-Control-Allow-Methods: $($response.Headers.'Access-Control-Allow-Methods')" -ForegroundColor Green
} else {
    Write-Host "❌ 缺少 Access-Control-Allow-Methods header" -ForegroundColor Red
}
