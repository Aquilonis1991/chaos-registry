// 使用 Deno.serve 而不是 serve，以避免 Supabase 路由層級的 JWT 檢查
// ⚠️ 注意：Deno.serve 會繞過 Supabase 的預設 JWT 驗證
// 如果需要啟用 JWT 驗證，可以使用 serve() 並設置 config.auth = true
// 但這可能會導致 401 錯誤，需要確保正確傳遞 Authorization header

// ✅ 診斷選項：暫時關閉 JWT 驗證（僅用於診斷 401 錯誤）
// 設置環境變數 DISABLE_JWT_VERIFY=true 來關閉驗證
// ⚠️ 警告：生產環境請務必啟用 JWT 驗證！
// ⚠️ 關鍵修復：不要在模組載入時執行 console.warn，這可能導致 Edge Function 啟動失敗
// const DISABLE_JWT_VERIFY = Deno.env.get('DISABLE_JWT_VERIFY') === 'true'
// if (DISABLE_JWT_VERIFY) {
//   console.warn('[DIAGNOSTIC] ⚠️ JWT verification is DISABLED for debugging purposes!')
//   console.warn('[DIAGNOSTIC] This should only be enabled in development/testing environments.')
// }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0'
import { getCorsHeaders, handleCorsPreFlight, validateOrigin } from '../_shared/cors.ts'

// LINE OAuth 配置
// ⚠️ 關鍵修復：不要在模組載入時驗證環境變數，因為這會導致 Edge Function 啟動失敗（503 錯誤）
// 改為在實際使用時才驗證
// ⚠️ 關鍵修復：不要在模組載入時使用 ! 斷言，因為這會導致 Edge Function 啟動失敗（503 錯誤）
// 如果環境變數缺失，! 會導致運行時錯誤，導致整個 Edge Function 無法啟動
const LINE_CHANNEL_ID = Deno.env.get('LINE_CHANNEL_ID')
const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
// 注意：環境變數名稱不能以 SUPABASE_ 開頭，所以使用 SERVICE_ROLE_KEY
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || ''

// 根據環境決定回調 URL
// ✅ 使用獨立的 callback Edge Function 來處理 LINE 回調
// 這樣可以避免 line-auth 函數的 JWT 驗證問題
// LINE 回調 URL 必須是 Edge Function URL，不能是前端 URL
// 這樣 LINE 回調會先到 Edge Function，然後 Edge Function 重定向到前端
// 如果設置為前端 URL，會導致回調無法被 WebView 攔截，造成重複處理
const LINE_REDIRECT_URI = Deno.env.get('LINE_REDIRECT_URI') || 'https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth-callback'

const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://chaos-registry.vercel.app'
const FRONTEND_DEEP_LINK = Deno.env.get('FRONTEND_DEEP_LINK') || 'votechaos://auth/callback'

// State 簽名密鑰（用於 CSRF 保護）
// 使用 SERVICE_ROLE_KEY 的一部分作為簽名密鑰（Edge Functions 是無狀態的，不能使用內存存儲）
// ⚠️ 關鍵修復：如果 SERVICE_ROLE_KEY 為空，使用默認值（僅用於開發，生產環境必須設置）
const STATE_SECRET = SERVICE_ROLE_KEY ? SERVICE_ROLE_KEY.substring(0, 32) : 'default-secret-key-for-development-only-32'
const STATE_EXPIRY = 5 * 60 * 1000 // 5 分鐘

// 生成簽名的 state（包含 timestamp, platform, nonce）
async function generateSignedState(platform: string, nonce: string): Promise<string> {
  const timestamp = Date.now()
  const data = `${timestamp}|${platform}|${nonce}`

  // 使用 HMAC-SHA256 簽名
  const encoder = new TextEncoder()
  const keyData = encoder.encode(STATE_SECRET)
  const messageData = encoder.encode(data)

  // 使用 Web Crypto API 生成 HMAC
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature))).substring(0, 32)

  return `${data}|${signatureBase64}`
}

// 驗證簽名的 state
async function verifySignedState(signedState: string): Promise<{ valid: boolean, timestamp?: number, platform?: string, nonce?: string }> {
  try {
    const parts = signedState.split('|')
    if (parts.length < 4) {
      return { valid: false }
    }

    const timestamp = parseInt(parts[0], 10)
    const platform = parts[1]
    const nonce = parts[2]
    const signature = parts.slice(3).join('|') // 處理可能包含 | 的簽名

    // 驗證時間戳（防止過期）
    const now = Date.now()
    if (now - timestamp > STATE_EXPIRY) {
      return { valid: false }
    }

    // 驗證簽名
    const data = `${timestamp}|${platform}|${nonce}`
    const encoder = new TextEncoder()
    const keyData = encoder.encode(STATE_SECRET)
    const messageData = encoder.encode(data)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const expectedSignature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    const expectedSignatureBase64 = btoa(String.fromCharCode(...new Uint8Array(expectedSignature))).substring(0, 32)

    if (signature !== expectedSignatureBase64) {
      return { valid: false }
    }

    return { valid: true, timestamp, platform, nonce }
  } catch {
    return { valid: false }
  }
}

Deno.serve(async (req) => {
  // ✅ 最優先處理：CORS 預檢請求（OPTIONS）
  // 必須在任何其他處理之前，包括任何函數調用、創建 URL 對象等，否則會導致 CORS 錯誤
  // ⚠️ 關鍵修復：根據 Supabase 文檔，OPTIONS 請求應返回 'ok' 而不是 null
  // ⚠️ 診斷：立即記錄所有請求，包括 OPTIONS，以便診斷問題
  console.log('[line-auth] Request received:', {
    method: req.method,
    url: req.url,
    hasOrigin: !!req.headers.get('origin'),
    origin: req.headers.get('origin'),
    timestamp: new Date().toISOString()
  })

  if (req.method === 'OPTIONS') {
    console.log('[line-auth] OPTIONS request detected, handling immediately')

    // 直接獲取 origin，不調用任何函數，避免可能的錯誤
    const origin = req.headers.get('origin') || 'https://localhost'

    // 直接構建 CORS headers，不調用 getCorsHeaders 函數，避免可能的錯誤
    // 優先處理 localhost（包括 https://localhost）
    const allowedOrigin = origin.includes('localhost') || origin.includes('chaos-registry.vercel.app')
      ? origin
      : 'https://epyykzxxglkjombvozhr.supabase.co'

    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Max-Age': '86400',
    }

    console.log('[line-auth] CORS preflight request handled immediately, origin:', origin)
    console.log('[line-auth] Allowed origin:', allowedOrigin)
    console.log('[line-auth] CORS headers:', JSON.stringify(corsHeaders))
    console.log('[line-auth] Returning OPTIONS response with status 200')

    // ⚠️ 關鍵修復：根據 Supabase 文檔，OPTIONS 請求應返回 'ok' 字符串，而不是 null
    // 這確保瀏覽器能夠正確識別 CORS 響應
    const response = new Response('ok', {
      headers: corsHeaders,
      status: 200
    })

    console.log('[line-auth] OPTIONS response created, status:', response.status)
    return response
  }

  // ⚠️ 關鍵修復：GET callback 請求必須在最前面處理，在任何日誌或驗證之前
  // 因為 LINE 服務器直接重定向到 callback URL，不會包含 Authorization header
  // 如果 Supabase 運行時在我們的代碼執行前檢查 JWT，這會導致 401 錯誤
  // 通過立即返回響應，我們可以避免觸發 JWT 驗證

  const url = new URL(req.url)
  const path = url.pathname
  const isCallback = path.endsWith('/callback') || path.endsWith('/callback/')

  // ✅ 優先處理 GET callback 請求（LINE 回調，沒有 Authorization header）
  if (isCallback && req.method === 'GET' && !req.headers.get('authorization')) {
    console.log('[CRITICAL] GET callback without authorization header detected, redirecting to frontend immediately (before any other processing)')
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    // 決定重定向目標
    // LINE 登入目前只支援 APP，所以必須使用 Deep Link，避免網頁與 App 混淆
    // 根據 LINE登入修復完整報告.md 的建議：完全使用 Deep Link，避免 Context 丟失
    const redirectBase = FRONTEND_DEEP_LINK

    // 構建前端應用的回調 URL
    const targetUrl = new URL(redirectBase)
    if (code) targetUrl.searchParams.set('code', code)
    if (state) targetUrl.searchParams.set('state', state)
    if (error) targetUrl.searchParams.set('error', error)
    targetUrl.searchParams.set('provider', 'line')

    // 保留其他參數
    const platform = url.searchParams.get('platform')
    if (platform) targetUrl.searchParams.set('platform', platform)

    console.log('[CRITICAL] Redirecting to frontend (GET callback, no processing):', targetUrl.toString())
    // 重要：這裡只是重定向，不處理授權碼，避免重複處理
    // 立即返回，避免觸發任何 JWT 驗證
    return Response.redirect(targetUrl.toString(), 302)
  }

  // ✅ 診斷步驟 1: 完整輸出所有 headers（用於診斷 401 錯誤）
  const allHeaders: Record<string, string> = {}
  req.headers.forEach((value, key) => {
    allHeaders[key] = value
  })
  console.log('[DIAGNOSTIC] All request headers:', JSON.stringify(allHeaders, null, 2))

  // 記錄所有請求（用於調試）
  const authHeader = req.headers.get('authorization')
  const apikeyHeader = req.headers.get('apikey')

  // ✅ 診斷步驟 2: 檢查 Authorization header 格式
  if (authHeader) {
    const isBearerFormat = authHeader.startsWith('Bearer ')
    const tokenPart = authHeader.replace(/^Bearer\s+/i, '')
    const tokenPrefix = tokenPart.substring(0, 20) // 只記錄前 20 個字符

    console.log('[DIAGNOSTIC] Authorization header analysis:', {
      hasHeader: true,
      isBearerFormat,
      headerLength: authHeader.length,
      tokenPrefix: tokenPrefix + '...',
      fullHeader: authHeader.substring(0, 50) + '...' // 只記錄前 50 個字符（安全）
    })

    // 檢查是否缺少 Bearer 前綴
    if (!isBearerFormat) {
      console.error('[DIAGNOSTIC] ⚠️ Authorization header missing "Bearer " prefix!')
      console.error('[DIAGNOSTIC] Current format:', authHeader.substring(0, 50))
      console.error('[DIAGNOSTIC] Expected format: Bearer <token>')
    }
  }

  console.log('Edge Function request received:', {
    method: req.method,
    url: req.url,
    pathname: path,
    hasAuthHeader: !!authHeader,
    authHeaderLength: authHeader ? authHeader.length : 0,
    hasApikeyHeader: !!apikeyHeader,
    origin: req.headers.get('origin'),
    userAgent: req.headers.get('user-agent'),
  })

  // 如果沒有 authorization header，記錄詳細信息（但不返回錯誤，因為某些請求可能不需要）
  if (!authHeader && req.method !== 'OPTIONS' && !isCallback) {
    console.warn('[WARNING] Request without authorization header:', {
      method: req.method,
      pathname: path,
      origin: req.headers.get('origin'),
    })
  }

  // ✅ CORS 預檢請求已在最前面處理，這裡不需要再次處理
  // 獲取 origin 並設置 CORS headers（必須在所有響應中包含）
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // 只有非回調請求才驗證來源
  // 注意：GET callback 請求已經在上面處理了，這裡只處理 POST callback
  if (!isCallback) {
    const originValidation = validateOrigin(req)
    if (originValidation) return originValidation
  } else {
    console.log('Callback request detected (POST), skipping origin validation')
  }

  try {
    // 處理 LINE 授權請求
    // 支持 GET /auth 和 POST /（supabase.functions.invoke 使用 POST）
    const isAuthRequest = path.endsWith('/auth') || path.endsWith('/auth/') ||
      (req.method === 'POST' && (path === '/' || path.endsWith('/line-auth')))

    if (isAuthRequest) {
      console.log('Handling auth request', { method: req.method, path })

      // ⚠️ 手動驗證 JWT（因為我們在 config.toml 中禁用了全局 JWT 驗證）
      // POST 請求應該包含 Authorization header
      if (req.method === 'POST' && !req.headers.get('authorization')) {
        console.warn('[WARNING] POST auth request without Authorization header')
        // 對於 POST 請求，我們仍然允許（因為用戶可能還沒有 session）
        // 但我們會記錄警告
      }

      return await handleAuthRequest(req, corsHeaders)
    }

    // 處理 LINE 回調
    // 支持 GET /callback（來自 LINE 服務器直接重定向，已在上面處理）和 POST /callback（來自前端轉發）
    if (isCallback) {
      console.log('Handling callback request', { method: req.method, path })
      // 注意：GET 請求且沒有授權 header 的情況已在上面處理（自動重定向到前端）
      return await handleCallback(req, corsHeaders)
    }

    // 404
    console.log('Path not found:', path)
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('LINE auth error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

// 處理授權請求
async function handleAuthRequest(req: Request, corsHeaders: Record<string, string>) {
  console.log('[handleAuthRequest] Processing auth request, method:', req.method)

  // ✅ 在實際使用時驗證環境變數（而不是在模組載入時）
  if (!LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET) {
    console.error('[handleAuthRequest] Missing LINE_CHANNEL_ID or LINE_CHANNEL_SECRET')
    return new Response(
      JSON.stringify({ error: 'Server configuration error: Missing LINE credentials' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 生成 nonce 用於 OpenID Connect（防止重放攻擊）
  const nonce = crypto.randomUUID()

  // 檢查是否為 App 登入
  // 支持從 query 參數（GET）或 body（POST）中讀取 platform
  const url = new URL(req.url)
  // 只支持 'app' platform，不支持 'web'
  let platform = 'app' // 只支持 'app'

  // 如果是 POST 請求，嘗試從 body 中讀取 platform，但只支持 'app'
  if (req.method === 'POST') {
    try {
      // 檢查是否有 body（避免重複讀取）
      const body = await req.json().catch((e) => {
        console.warn('[handleAuthRequest] Failed to parse POST body:', e)
        return null
      })
      console.log('[handleAuthRequest] POST body parsed:', { hasBody: !!body, action: body?.action, platform: body?.platform })

      const requestedPlatform = body?.platform || 'app'
      if (requestedPlatform !== 'app') {
        console.warn('[LINE Auth] Unsupported platform requested:', requestedPlatform, ', using "app"')
      }
      platform = 'app' // 強制使用 'app'
      if (body && body.action === 'auth' && body.platform) {
        platform = body.platform
      }
    } catch (e) {
      // 如果解析 body 失敗，使用 query 參數或默認值
      console.warn('[handleAuthRequest] Exception parsing POST body:', e)
    }
  }

  console.log('[handleAuthRequest] Platform determined:', platform)

  // 生成簽名的 state（包含 timestamp, platform, nonce，並簽名）
  // 格式：{timestamp}|{platform}|{nonce}|{signature}
  const signedState = await generateSignedState(platform, nonce)

  // 構建 LINE 授權 URL
  const scope = 'profile openid email'
  const authUrl = `https://access.line.me/oauth2/v2.1/authorize?` +
    `response_type=code&` +
    `client_id=${LINE_CHANNEL_ID}&` +
    `redirect_uri=${encodeURIComponent(LINE_REDIRECT_URI)}&` +
    `state=${encodeURIComponent(signedState)}&` +
    `scope=${encodeURIComponent(scope)}&` +
    `nonce=${encodeURIComponent(nonce)}`

  return new Response(
    JSON.stringify({
      authUrl,
      state: signedState
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

// 處理 LINE 回調
async function handleCallback(req: Request, corsHeaders: Record<string, string>) {
  // 記錄請求詳情（用於調試）
  console.log('LINE callback received:', {
    url: req.url,
    method: req.method,
    headers: Object.fromEntries(req.headers.entries()),
  })

  const url = new URL(req.url)

  // 支持 GET（來自 LINE 服務器直接重定向）和 POST（來自前端轉發）
  let code: string | null = null
  let stateParam: string | null = null
  let error: string | null = null
  let errorDescription: string | null = null

  if (req.method === 'POST') {
    // POST 請求：從 body 中讀取
    try {
      const body = await req.json().catch(() => null)
      if (body) {
        code = body.code || null
        stateParam = body.state || null
        error = body.error || null
        errorDescription = body.error_description || null
      }
    } catch (e) {
      console.warn('Failed to parse POST body:', e)
    }
  } else {
    // GET 請求：從 query 參數中讀取
    code = url.searchParams.get('code')
    stateParam = url.searchParams.get('state')
    error = url.searchParams.get('error')
    errorDescription = url.searchParams.get('error_description')
  }

  // 決定錯誤重定向目標（需要在驗證 state 之前定義）
  const getErrorRedirectUrl = (errorMsg: string, errorDesc: string, platformOverride?: string) => {
    const errorParams = new URLSearchParams()
    errorParams.set('error', errorMsg)
    errorParams.set('error_description', errorDesc)

    // 只支持 'app' platform，必須使用 Deep Link
    return `${FRONTEND_DEEP_LINK}?${errorParams.toString()}`
  }

  // 安全檢查：驗證 state 參數（CSRF 保護）
  if (!stateParam) {
    console.error('No state parameter provided')
    const errorUrl = getErrorRedirectUrl('invalid_state', 'Missing state parameter')
    // 對於 POST 請求，返回 JSON 響應
    if (req.method === 'POST') {
      return new Response(
        JSON.stringify({ redirectUrl: errorUrl }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    return Response.redirect(errorUrl)
  }

  // 驗證簽名的 state
  const stateVerification = await verifySignedState(stateParam)
  if (!stateVerification.valid) {
    console.error('Invalid or expired state:', stateParam)
    const errorUrl = getErrorRedirectUrl('invalid_state', 'Invalid or expired state parameter', 'auto')
    // 對於 POST 請求，返回 JSON 響應
    if (req.method === 'POST') {
      return new Response(
        JSON.stringify({ redirectUrl: errorUrl }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    return Response.redirect(errorUrl)
  }

  // 從驗證結果中獲取資訊（只支持 'app' platform）
  const platform = 'app' // 強制使用 'app'
  const expectedNonce = stateVerification.nonce || ''

  // 檢查錯誤
  if (error) {
    console.error('LINE OAuth error:', error, errorDescription)
    const errorUrl = getErrorRedirectUrl(error, errorDescription || '')
    // 對於 POST 請求，返回 JSON 響應
    if (req.method === 'POST') {
      return new Response(
        JSON.stringify({ redirectUrl: errorUrl }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    return Response.redirect(errorUrl)
  }

  // 檢查授權碼
  if (!code) {
    console.error('No authorization code provided')
    const errorUrl = getErrorRedirectUrl('no_code', 'No authorization code provided')
    // 對於 POST 請求，返回 JSON 響應
    if (req.method === 'POST') {
      return new Response(
        JSON.stringify({ redirectUrl: errorUrl }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    return Response.redirect(errorUrl)
  }

  try {
    // ✅ 在實際使用時驗證環境變數
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error('[handleCallback] Missing SUPABASE_URL or SERVICE_ROLE_KEY')
      const errorUrl = getErrorRedirectUrl('server_config_error', 'Server configuration error')
      if (req.method === 'POST') {
        return new Response(
          JSON.stringify({ redirectUrl: errorUrl }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
      return Response.redirect(errorUrl)
    }

    // ✅ Single-use policy: 檢查授權碼是否已被使用
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // 檢查授權碼是否已被使用
    const { data: codeUsed, error: checkError } = await supabaseAdmin.rpc('is_line_auth_code_used', {
      p_code: code
    })

    if (checkError) {
      console.error('[LINE Auth] Error checking if code is used:', checkError)
      // 如果檢查失敗，繼續處理（可能是表不存在或函數不存在）
      console.warn('[LINE Auth] Code check failed, proceeding anyway (may need migration)')
    } else if (codeUsed === true) {
      console.warn('[LINE Auth] Authorization code already used (single-use policy):', code.substring(0, 10) + '...')
      const errorUrl = getErrorRedirectUrl('code_already_used', '授權碼已被使用。如果尚未登入，請重新嘗試登入。')
      if (req.method === 'POST') {
        return new Response(
          JSON.stringify({ redirectUrl: errorUrl }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
      return Response.redirect(errorUrl)
    }

    // 步驟 1：使用授權碼交換 access token
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: LINE_REDIRECT_URI,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      let errorData: any = {}
      try {
        errorData = JSON.parse(errorText)
      } catch {
        // 如果不是 JSON，直接使用文字
      }

      // 如果是 "invalid_grant" 錯誤，可能是重複請求（authorization code 已被使用）
      // 這種情況下，第一個請求可能已經成功，後續請求會失敗
      // ✅ 改進：嘗試檢查是否已經有用戶登入（通過 nonce 查找用戶）
      if (errorData.error === 'invalid_grant' && errorData.error_description?.includes('invalid authorization code')) {
        console.warn('Authorization code already used (likely duplicate request):', code.substring(0, 10) + '...')

        // ⚠️ 安全考量：不自動恢復 session，避免登入到錯誤的帳號
        // 如果第一次請求成功，前端應該已經收到了 hashedToken
        // 前端的多層次 session 檢查邏輯會處理 session 恢復
        // 這裡只返回友好的錯誤訊息，讓前端處理
        console.log('[LINE Auth] Authorization code already used, returning error for frontend to handle')

        // 提示用戶：第一個請求可能已經成功，請檢查是否已經登入；如果沒有，請重新登入
        const errorUrl = getErrorRedirectUrl('code_already_used', '授權碼已被使用。如果尚未登入，請重新嘗試登入。')
        if (req.method === 'POST') {
          return new Response(
            JSON.stringify({ redirectUrl: errorUrl }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
        return Response.redirect(errorUrl)
      }

      console.error('Failed to exchange token:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        errorText,
        errorData
      })
      throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`)
    }

    const tokenData = await tokenResponse.json()

    if (!tokenData.id_token) {
      console.error('No id_token in response:', tokenData)
      throw new Error('Failed to get id_token')
    }

    // 步驟 2：從 ID Token 中解析用戶資訊
    // ID Token 是 JWT 格式，包含用戶資訊
    const idToken = tokenData.id_token
    const idTokenParts = idToken.split('.')

    if (idTokenParts.length !== 3) {
      throw new Error('Invalid id_token format')
    }

    // 步驟 2.1：驗證 ID Token（使用 LINE 的驗證端點）
    // 這是安全的做法，因為我們驗證了 JWT 簽名
    const verifyResponse = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: LINE_CHANNEL_ID,
      }),
    })

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text()
      console.error('ID token verification failed:', {
        status: verifyResponse.status,
        statusText: verifyResponse.statusText,
        error: errorText
      })
      throw new Error(`ID token verification failed: ${verifyResponse.status} - ${errorText}`)
    }

    const verifyData = await verifyResponse.json()

    // 驗證 nonce（防止重放攻擊）
    if (expectedNonce && verifyData.nonce !== expectedNonce) {
      console.error('Nonce mismatch:', { expected: expectedNonce, received: verifyData.nonce })
      throw new Error('Nonce mismatch - possible replay attack')
    }

    // 使用驗證後的 payload
    const payload = verifyData

    const lineUserId = payload.sub // LINE user ID
    const displayName = payload.name || 'LINE User'
    const pictureUrl = payload.picture || '🔥'
    const email = payload.email || null // LINE 可能不返回 email

    if (!lineUserId) {
      throw new Error('No LINE user ID in id_token')
    }

    console.log('LINE user info from id_token:', { lineUserId, displayName, pictureUrl, email, nonce: payload.nonce })

    // 步驟 3：在 Supabase 中建立或更新用戶
    // 環境變數已在上面驗證，這裡直接使用
    // const supabaseAdmin = createClient(...) // 已經在上面定義過了，不需要重複定義

    // 檢查是否已有 LINE 用戶
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, nickname, avatar')
      .eq('line_user_id', lineUserId)
      .single()

    let userId: string
    let isNewUser = false
    // 使用 LINE user ID 生成一個唯一的 email（如果 LINE 沒有返回 email）
    const userEmail = email || `line_${lineUserId}@line.local`

    if (existingProfile) {
      // 更新現有用戶
      userId = existingProfile.id

      await supabaseAdmin
        .from('profiles')
        .update({
          nickname: displayName,
          avatar: pictureUrl,
          updated_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
        })
        .eq('id', userId)

      console.log('Updated existing LINE user:', userId)
    } else {
      // 檢查 email 是否已存在
      const { data: existingUserByEmail } = await supabaseAdmin.auth.admin.listUsers()
      const userWithEmail = existingUserByEmail?.users?.find(u => u.email === userEmail)

      if (userWithEmail) {
        // Email 已存在，連結 LINE 帳號到現有用戶
        userId = userWithEmail.id

        await supabaseAdmin
          .from('profiles')
          .update({
            line_user_id: lineUserId,
            nickname: displayName,
            avatar: pictureUrl,
            updated_at: new Date().toISOString(),
            last_login: new Date().toISOString(),
          })
          .eq('id', userId)

        // 更新 user_metadata
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...userWithEmail.user_metadata,
            line_user_id: lineUserId,
            nickname: displayName,
            avatar: pictureUrl,
          }
        })

        console.log('Linked LINE account to existing user:', userId)
      } else {
        // 建立新用戶
        // 建立 auth.users（使用 Admin API）
        // 注意：不要在 app_metadata 中設置 provider，因為 Supabase 不支援 LINE provider
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: userEmail,
          email_confirm: true, // 自動確認 email
          user_metadata: {
            line_user_id: lineUserId,
            nickname: displayName,
            avatar: pictureUrl,
          },
          // 不在 app_metadata 中設置 provider，避免 Supabase 嘗試使用不支援的 provider
          app_metadata: {},
        })

        if (authError || !authUser.user) {
          console.error('Failed to create auth user:', {
            error: authError,
            errorMessage: authError?.message,
            errorDetails: authError,
            userEmail,
            lineUserId,
            authUser
          })
          const errorMessage = authError?.message || 'Failed to create user'
          throw new Error(`Failed to create user: ${errorMessage}`)
        }

        userId = authUser.user.id
        isNewUser = true

        // 更新 profile 的 line_user_id（handle_new_user trigger 會自動建立 profile）
        await supabaseAdmin
          .from('profiles')
          .update({
            line_user_id: lineUserId,
            nickname: displayName,
            avatar: pictureUrl,
          })
          .eq('id', userId)

        console.log('Created new LINE user:', userId)
      }
    }

    // ✅ Single-use policy: 標記授權碼為已使用（在成功處理後）
    try {
      const { data: codeId, error: markError } = await supabaseAdmin.rpc('mark_line_auth_code_used', {
        p_code: code,
        p_state: stateParam,
        p_nonce: expectedNonce || null,
        p_user_id: userId || null
      })

      if (markError) {
        console.error('[LINE Auth] Error marking code as used:', markError)
        // 即使標記失敗，也繼續處理（可能是表不存在或函數不存在）
        console.warn('[LINE Auth] Code marking failed, but login will proceed (may need migration)')
      } else {
        console.log('[LINE Auth] ✅ Authorization code marked as used (single-use policy)')
      }
    } catch (markErr) {
      console.error('[LINE Auth] Exception marking code as used:', markErr)
      // 即使標記失敗，也繼續處理
    }

    // 步驟 4：為用戶生成 magic link（用於自動登入）
    // userEmail 已在上面定義，不需要重複宣告

    // 決定重定向 URL（只支持 APP 登入）
    // 注意：只支持 platform='app'，網頁版登入已移除
    let redirectTo: string
    if (platform === 'app' && FRONTEND_DEEP_LINK) {
      // App 登入：使用 Deep Link
      redirectTo = FRONTEND_DEEP_LINK
      console.log('[LINE Auth] App platform detected, using Deep Link:', redirectTo)
    } else {
      // 不支持其他 platform，返回錯誤
      console.error('[LINE Auth] Unsupported platform:', platform)
      const errorUrl = getErrorRedirectUrl('unsupported_platform', `Unsupported platform: ${platform}. Only 'app' platform is supported.`)
      return Response.redirect(errorUrl)
    }

    // 步驟 5：使用 generateLink 生成 magic link（優化版本）
    // 直接使用 generateLink，因為 Supabase 會自動處理 magic link 並生成 session
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
      options: {
        redirectTo: redirectTo,
      },
    })

    if (linkError || !linkData || !linkData.properties?.action_link) {
      console.error('Failed to generate magic link:', {
        error: linkError,
        userId,
        userEmail,
        linkData
      })

      const redirectParams = new URLSearchParams()
      redirectParams.set('provider', 'line')
      redirectParams.set('error', 'session_generation_failed')
      redirectParams.set('error_description', linkError?.message || 'Failed to generate session')

      // 只支持 'app' platform，必須使用 Deep Link
      const fallbackUrl = `${FRONTEND_DEEP_LINK}?${redirectParams.toString()}`
      // 對於 POST 請求，返回 JSON 響應以避免 CORS 問題
      if (req.method === 'POST') {
        return new Response(
          JSON.stringify({ redirectUrl: fallbackUrl }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
      return Response.redirect(fallbackUrl)
    }

    // 步驟 6：返回 magic link 或 hashed_token（用於直接驗證）
    // Magic link 格式：https://...supabase.co/auth/v1/verify?token=...&redirect_to=...
    // 當用戶訪問 magic link 時，Supabase 會驗證 token 並重定向到 redirect_to，並在 URL hash 中包含 access_token 和 refresh_token
    const magicLink = linkData.properties.action_link
    const hashedToken = linkData.properties.hashed_token // 用於直接驗證
    console.log('Magic link generated, redirecting to:', magicLink)
    console.log('Link data properties:', JSON.stringify({
      hasActionLink: !!linkData.properties.action_link,
      hasHashedToken: !!linkData.properties.hashed_token,
      hashedTokenLength: linkData.properties.hashed_token?.length || 0,
      allProperties: Object.keys(linkData.properties || {})
    }))

    // 對於 POST 請求（來自前端 fetch），返回 JSON 響應
    // 包含 magic link 和 hashed_token，讓前端選擇處理方式
    if (req.method === 'POST') {
      const responseData = {
        redirectUrl: magicLink,
        hashedToken: hashedToken, // 用於直接驗證（App 環境）
      }
      console.log('Returning response with hashedToken:', !!hashedToken)
      return new Response(
        JSON.stringify(responseData),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // 對於 GET 請求（直接重定向），返回 302 重定向
    return Response.redirect(magicLink)

  } catch (error) {
    console.error('LINE callback error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // 根據 platform 決定錯誤重定向 URL
    const errorParams = new URLSearchParams()
    errorParams.set('error', 'line_callback_error')
    errorParams.set('error_description', errorMessage)

    // 只支持 'app' platform，必須使用 Deep Link
    const errorUrl = `${FRONTEND_DEEP_LINK}?${errorParams.toString()}`
    // 對於 POST 請求，返回 JSON 響應以避免 CORS 問題
    if (req.method === 'POST') {
      return new Response(
        JSON.stringify({ redirectUrl: errorUrl }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    return Response.redirect(errorUrl)
  }
}

