#!/bin/bash
# 測試 Edge Function OPTIONS 請求

echo "測試 OPTIONS 請求..."
curl -X OPTIONS \
  -H "Origin: https://localhost" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -v \
  https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth

echo ""
echo ""
echo "測試 POST 請求..."
curl -X POST \
  -H "Origin: https://localhost" \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{"action":"auth","platform":"app"}' \
  -v \
  https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth
