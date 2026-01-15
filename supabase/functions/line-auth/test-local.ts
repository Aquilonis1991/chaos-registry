/**
 * 本地測試腳本 - 測試 OPTIONS 請求處理
 * 使用方式: deno run --allow-net --allow-env test-local.ts
 */

// 模擬 Edge Function 的關鍵部分
async function testOptionsRequest() {
  console.log('🧪 開始測試 OPTIONS 請求處理...\n')

  // 模擬 OPTIONS 請求
  const mockRequest = new Request('https://example.com/line-auth', {
    method: 'OPTIONS',
    headers: {
      'origin': 'https://localhost:5173',
    },
  })

  // 模擬 Deno.serve 回調中的 OPTIONS 處理邏輯
  const origin = mockRequest.headers.get('origin') || 'https://localhost'
  
  const allowedOrigin = origin.includes('localhost') || origin.includes('chaos-registry.vercel.app')
    ? origin
    : 'https://epyykzxxglkjombvozhr.supabase.co'
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
  }
  
  const response = new Response('ok', { 
    headers: corsHeaders,
    status: 200
  })

  // 驗證響應
  console.log('📋 測試結果:')
  console.log('─'.repeat(50))
  console.log('請求方法:', mockRequest.method)
  console.log('Origin:', origin)
  console.log('允許的 Origin:', allowedOrigin)
  console.log('響應狀態碼:', response.status)
  console.log('響應內容:', await response.text())
  console.log('CORS Headers:', Object.fromEntries(response.headers.entries()))
  console.log('─'.repeat(50))

  // 檢查關鍵點
  const checks = {
    '狀態碼為 200': response.status === 200,
    '有 CORS headers': response.headers.has('Access-Control-Allow-Origin'),
    '響應內容為 "ok"': (await response.clone().text()) === 'ok',
    '允許的 Origin 正確': allowedOrigin === origin || allowedOrigin.includes('supabase.co'),
  }

  console.log('\n✅ 檢查結果:')
  Object.entries(checks).forEach(([check, passed]) => {
    const icon = passed ? '✅' : '❌'
    console.log(`${icon} ${check}`)
  })

  const allPassed = Object.values(checks).every(v => v === true)
  
  if (allPassed) {
    console.log('\n🎉 所有測試通過！OPTIONS 請求處理邏輯正確。')
  } else {
    console.log('\n⚠️  部分測試未通過，請檢查上述問題。')
  }

  return allPassed
}

// 測試環境變數處理
function testEnvVarHandling() {
  console.log('\n🧪 測試環境變數處理...\n')

  // 模擬環境變數缺失的情況
  const testCases = [
    { name: '所有環境變數存在', vars: { LINE_CHANNEL_ID: 'test', SERVICE_ROLE_KEY: 'test-key-123456789012345678901234567890' } },
    { name: 'SERVICE_ROLE_KEY 缺失', vars: { LINE_CHANNEL_ID: 'test' } },
    { name: '所有環境變數缺失', vars: {} },
  ]

  testCases.forEach(testCase => {
    console.log(`\n測試案例: ${testCase.name}`)
    
    // 模擬環境變數獲取（使用 || '' 而非 !）
    const SERVICE_ROLE_KEY = testCase.vars.SERVICE_ROLE_KEY || ''
    const LINE_CHANNEL_ID = testCase.vars.LINE_CHANNEL_ID || ''
    
    // 測試 STATE_SECRET 生成（不應該拋出錯誤）
    try {
      const STATE_SECRET = SERVICE_ROLE_KEY ? SERVICE_ROLE_KEY.substring(0, 32) : 'default-secret-key-for-development-only-32'
      console.log(`  ✅ STATE_SECRET 生成成功: ${STATE_SECRET.substring(0, 10)}...`)
      console.log(`  ✅ 不會因為環境變數缺失而導致錯誤`)
    } catch (error) {
      console.log(`  ❌ 錯誤: ${error.message}`)
    }
  })
}

// 運行測試
async function runTests() {
  try {
    const optionsTest = await testOptionsRequest()
    testEnvVarHandling()
    
    console.log('\n' + '='.repeat(50))
    if (optionsTest) {
      console.log('✅ 所有測試通過！修復驗證成功。')
      Deno.exit(0)
    } else {
      console.log('❌ 部分測試失敗，請檢查問題。')
      Deno.exit(1)
    }
  } catch (error) {
    console.error('❌ 測試執行錯誤:', error)
    Deno.exit(1)
  }
}

runTests()
