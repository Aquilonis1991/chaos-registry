/**
 * 503 錯誤修復驗證腳本
 * 用於驗證修復是否正確應用，無需部署到 Supabase
 */

// 讀取 index.ts 文件
const indexContent = await Deno.readTextFile('./index.ts')

console.log('🔍 開始驗證 503 錯誤修復...\n')

// 驗證項目
const checks = {
  '移除模組頂層 console.warn': false,
  '環境變數使用 || 而非 !': false,
  'STATE_SECRET 有條件檢查': false,
  'OPTIONS 請求處理在最前面': false,
  'OPTIONS 返回 200 狀態碼': false,
}

// 檢查 1: 模組頂層的 console.warn 是否已註釋
const moduleTopLevelWarnPattern = /^\/\/.*console\.warn.*DISABLE_JWT_VERIFY/m
if (moduleTopLevelWarnPattern.test(indexContent)) {
  checks['移除模組頂層 console.warn'] = true
  console.log('✅ 檢查 1: 模組頂層的 console.warn 已註釋')
} else {
  // 檢查是否完全移除了
  const hasWarn = /^[^\/]*console\.warn.*DISABLE_JWT_VERIFY/m.test(indexContent)
  if (!hasWarn) {
    checks['移除模組頂層 console.warn'] = true
    console.log('✅ 檢查 1: 模組頂層的 console.warn 已移除')
  } else {
    console.log('❌ 檢查 1: 模組頂層仍有未註釋的 console.warn')
  }
}

// 檢查 2: 環境變數使用 || 而非 !
const envVarPattern = /const\s+(LINE_CHANNEL_ID|LINE_CHANNEL_SECRET|SUPABASE_URL|SUPABASE_ANON_KEY|SERVICE_ROLE_KEY)\s*=\s*Deno\.env\.get\([^)]+\)\s*\|\|/g
const envVarWithAssertion = /const\s+(LINE_CHANNEL_ID|LINE_CHANNEL_SECRET|SUPABASE_URL|SUPABASE_ANON_KEY|SERVICE_ROLE_KEY)\s*=\s*Deno\.env\.get\([^)]+\)\s*!/g

const hasCorrectEnvVars = envVarPattern.test(indexContent)
const hasAssertionEnvVars = envVarWithAssertion.test(indexContent)

if (hasCorrectEnvVars && !hasAssertionEnvVars) {
  checks['環境變數使用 || 而非 !'] = true
  console.log('✅ 檢查 2: 環境變數使用 || 提供默認值（而非 ! 斷言）')
} else if (hasAssertionEnvVars) {
  console.log('❌ 檢查 2: 仍有環境變數使用 ! 斷言')
} else {
  console.log('⚠️  檢查 2: 無法確認環境變數格式')
}

// 檢查 3: STATE_SECRET 有條件檢查
const stateSecretPattern = /const\s+STATE_SECRET\s*=\s*SERVICE_ROLE_KEY\s*\?\s*SERVICE_ROLE_KEY\.substring/
if (stateSecretPattern.test(indexContent)) {
  checks['STATE_SECRET 有條件檢查'] = true
  console.log('✅ 檢查 3: STATE_SECRET 有條件檢查（避免 undefined 錯誤）')
} else {
  console.log('❌ 檢查 3: STATE_SECRET 缺少條件檢查')
}

// 檢查 4: OPTIONS 請求處理在最前面（在 Deno.serve 回調中，在創建 URL 之前）
const optionsEarlyPattern = /Deno\.serve\(async\s*\(req\)\s*=>\s*\{[^}]*if\s*\(req\.method\s*===\s*['"]OPTIONS['"]\)/s
if (optionsEarlyPattern.test(indexContent)) {
  checks['OPTIONS 請求處理在最前面'] = true
  console.log('✅ 檢查 4: OPTIONS 請求處理在 Deno.serve 回調的最前面')
} else {
  console.log('⚠️  檢查 4: 無法確認 OPTIONS 請求處理位置')
}

// 檢查 5: OPTIONS 返回 200 狀態碼
const optionsStatus200Pattern = /if\s*\(req\.method\s*===\s*['"]OPTIONS['"]\)[^}]*status:\s*200/s
if (optionsStatus200Pattern.test(indexContent)) {
  checks['OPTIONS 返回 200 狀態碼'] = true
  console.log('✅ 檢查 5: OPTIONS 請求返回 200 狀態碼')
} else {
  // 檢查是否返回 'ok'
  const optionsOkPattern = /if\s*\(req\.method\s*===\s*['"]OPTIONS['"]\)[^}]*new\s+Response\(['"]ok['"]/s
  if (optionsOkPattern.test(indexContent)) {
    checks['OPTIONS 返回 200 狀態碼'] = true
    console.log('✅ 檢查 5: OPTIONS 請求返回 "ok" 字符串（狀態碼應為 200）')
  } else {
    console.log('⚠️  檢查 5: 無法確認 OPTIONS 響應格式')
  }
}

// 總結
console.log('\n📊 驗證結果總結:')
console.log('─'.repeat(50))

const allPassed = Object.values(checks).every(v => v === true)
const passedCount = Object.values(checks).filter(v => v === true).length
const totalCount = Object.keys(checks).length

Object.entries(checks).forEach(([check, passed]) => {
  const icon = passed ? '✅' : '❌'
  console.log(`${icon} ${check}`)
})

console.log('─'.repeat(50))
console.log(`通過: ${passedCount}/${totalCount}`)

if (allPassed) {
  console.log('\n🎉 所有檢查通過！修復已正確應用。')
  console.log('💡 建議：可以進行本地 Deno 測試或部署到 Supabase 進行實際測試。')
  Deno.exit(0)
} else {
  console.log('\n⚠️  部分檢查未通過，請檢查上述問題。')
  Deno.exit(1)
}
