// 使用 Deno.serve 而不是 serve，以避免 Supabase 路由層級的 JWT 檢查
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0'
import { getCorsHeaders, handleCorsPreFlight, validateOrigin } from '../_shared/cors.ts'
import { create, verify } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

// X (Twitter) OAuth 配置
const TWITTER_CLIENT_ID = Deno.env.get('TWITTER_CLIENT_ID')
const TWITTER_CLIENT_SECRET = Deno.env.get('TWITTER_CLIENT_SECRET')

// 驗證必要的環境變數
if (!TWITTER_CLIENT_ID || !TWITTER_CLIENT_SECRET) {
  throw new Error('TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET must be set as environment variables')
}
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
// 注意：環境變數名稱不能以 SUPABASE_ 開頭，所以使用 SERVICE_ROLE_KEY
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!

// 根據環境決定回調 URL
// 使用 Edge Function 路徑作為 Callback URI，直接路由到 Edge Function
// 這樣可以避免 Supabase 內建認證系統的攔截
const isProduction = Deno.env.get('ENVIRONMENT') === 'production'
const TWITTER_REDIRECT_URI = isProduction
  ? 'https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback'
  : Deno.env.get('TWITTER_REDIRECT_URI') || 'https://epyykzxxglkjombvozhr.supabase.co/functions/v1/twitter-auth/callback'

const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://chaos-registry.vercel.app'
const FRONTEND_DEEP_LINK = Deno.env.get('FRONTEND_DEEP_LINK') || 'votechaos://auth/callback'

// State 簽名密鑰（用於 CSRF 保護）
// 使用 Supabase 的 JWT Secret，這樣 Supabase 的內建處理邏輯就能驗證簽名
// 如果沒有設定 JWT_SECRET 環境變數，回退到使用 SERVICE_ROLE_KEY
const JWT_SECRET = Deno.env.get('JWT_SECRET') || Deno.env.get('SUPABASE_JWT_SECRET')
const STATE_SECRET = JWT_SECRET || SERVICE_ROLE_KEY.substring(0, 32) // 優先使用 JWT_SECRET，否則使用前 32 個字符
const STATE_EXPIRY = 5 * 60 * 1000 // 5 分鐘

// 生成簽名的 state（JWT 格式，以便 Supabase 不會報錯）
async function generateSignedState(platform: string, codeVerifier: string): Promise<string> {
  const timestamp = Date.now()
  const expiresIn = 600 // 10 分鐘

  // 生成 JWT token（Supabase 期望 state 是 JWT 格式，且包含 provider 欄位）
  const payload = {
    timestamp,
    platform,
    codeVerifier,
    provider: 'twitter', // Supabase 期望 state 中包含 provider 資訊
    exp: Math.floor(Date.now() / 1000) + expiresIn, // JWT 標準的過期時間
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(STATE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  // 使用 djwt 生成 JWT token
  const token = await create(
    { alg: 'HS256', typ: 'JWT' },
    payload,
    key
  )

  return token
}

// 驗證簽名的 state（JWT 格式）
async function verifySignedState(signedState: string): Promise<{ valid: boolean, timestamp?: number, platform?: string, codeVerifier?: string }> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(STATE_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    // 使用 djwt 驗證 JWT token
    const payload = await verify(signedState, key)

    // 檢查過期時間（JWT 標準）
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.error('State token expired (JWT exp)')
      return { valid: false }
    }

    // 檢查時間戳（額外的時效性檢查）
    const timestamp = payload.timestamp as number
    if (!timestamp) {
      console.error('State token missing timestamp')
      return { valid: false }
    }

    const maxAge = STATE_EXPIRY // 5 分鐘
    if (Date.now() - timestamp > maxAge) {
      console.error('State token expired (timestamp)')
      return { valid: false }
    }

    const platform = payload.platform as string
    const codeVerifier = payload.codeVerifier as string

    if (!platform || !codeVerifier) {
      console.error('State token missing required fields')
      return { valid: false }
    }

    return { valid: true, timestamp, platform, codeVerifier }
  } catch (error) {
    console.error('State verification failed:', error)
    return { valid: false }
  }
}

Deno.serve(async (req) => {
  // 首先檢查是否為回調請求，如果是則立即處理（避免被 Supabase 路由層攔截）
  const url = new URL(req.url)
  const path = url.pathname
  const isCallback = path.endsWith('/callback') || path.endsWith('/callback/') || path.includes('/callback')
  
  // 如果是回調請求，立即處理（在日誌記錄之前）
  // 這確保回調請求在到達任何驗證邏輯之前就被處理
  if (isCallback && req.method === 'GET') {
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    
    console.log('[CRITICAL] Callback request detected immediately:', {
      method: req.method,
      url: req.url,
      pathname: path,
      hasCode: !!code,
      hasState: !!state,
    })
    
    // 獲取 origin 並設置 CORS headers
    const origin = req.headers.get('origin')
    const corsHeaders = getCorsHeaders(origin)

    // 如果有 code 和 state，說明這是來自 Twitter 的合法回調
    // 修復：檢測是否為 App 登入，如果是則重定向到 Deep Link
    if (code && state) {
      console.log('[CRITICAL] GET callback from Supabase standard callback URL')

      // 驗證 state 以獲取 platform 資訊
      let platform = 'auto'
      try {
        const stateVerification = await verifySignedState(state)
        if (stateVerification.valid && stateVerification.platform) {
          platform = stateVerification.platform
          console.log('[CRITICAL] Detected platform from state:', platform)
        }
      } catch (e) {
        console.warn('[CRITICAL] Failed to verify state, using default platform detection')
      }

      // 如果是 App 登入，重定向到 Deep Link（修復：直接重定向到 Deep Link，而不是網頁 URL）
      if (platform === 'app' && FRONTEND_DEEP_LINK) {
        console.log('[CRITICAL] App platform detected, redirecting to Deep Link')

        // 構建 Deep Link URL，包含 code 和 state 參數
        // 注意：Deep Link 使用 query 參數，而不是 hash fragment
        const deepLinkUrl = `${FRONTEND_DEEP_LINK}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}&provider=twitter&platform=app`

        // 如果有錯誤參數，也添加到 Deep Link
        const error = url.searchParams.get('error')
        if (error) {
          const errorParams = new URLSearchParams()
          errorParams.set('error', error)
          const errorDescription = url.searchParams.get('error_description')
          if (errorDescription) {
            errorParams.set('error_description', errorDescription)
          }
          errorParams.set('provider', 'twitter')
          return Response.redirect(`${FRONTEND_DEEP_LINK}?${errorParams.toString()}`)
        }

        console.log('[CRITICAL] Redirecting to Deep Link:', deepLinkUrl)

        // 返回 HTML 頁面，自動重定向到 Deep Link
        // 使用多種方法確保 Deep Link 被觸發
        // 轉義 deepLinkUrl 以避免 XSS 攻擊
        const escapedDeepLinkUrl = deepLinkUrl
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
        
        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>正在處理登入...</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column; gap: 1rem; margin: 0; padding: 20px; text-align: center; background-color: #f8f9fa; }
    .loader { border: 4px solid #f3f3f3; border-top: 4px solid #3b82f6; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 20px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .btn { background-color: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); transition: background-color 0.2s; border: none; cursor: pointer; display: inline-block; }
    .btn:hover { background-color: #2563eb; }
    .text-sm { font-size: 0.875rem; color: #6b7280; }
  </style>
  <script>
    (function() {
      var deepLinkUrl = '${escapedDeepLinkUrl}';
      console.log('[Twitter Callback Redirect] Redirecting to Deep Link:', deepLinkUrl);
      
      function redirect() {
        // 方法 1：使用 window.location.href（標準方法）
        try {
          window.location.href = deepLinkUrl;
        } catch (e) {
          console.error('[Twitter Callback Redirect] Method 1 failed:', e);
          
          // 方法 2：使用 window.location.replace（備用方法）
          try {
            window.location.replace(deepLinkUrl);
          } catch (e2) {
            console.error('[Twitter Callback Redirect] Method 2 failed:', e2);
            
            // 方法 3：使用 window.open（最後備用方法）
            try {
              window.open(deepLinkUrl, '_self');
            } catch (e3) {
              console.error('[Twitter Callback Redirect] Method 3 failed:', e3);
            }
          }
        }
      }

      // 頁面加載後立即嘗試重定向
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', redirect);
      } else {
        redirect();
      }
      
      // 如果 2 秒後還沒有重定向，顯示手動按鈕
      setTimeout(function() {
        var manualAction = document.getElementById('manual-action');
        var statusText = document.getElementById('status-text');
        if (manualAction && statusText) {
          manualAction.style.display = 'block';
          statusText.innerText = '如果應用沒有自動打開，請點擊下方按鈕';
        }
      }, 2000);
    })();
  </script>
</head>
<body>
  <div class="loader"></div>
  <div id="status-text" style="font-size: 1.125rem; font-weight: 600; color: #111827; margin-bottom: 8px;">正在返回應用...</div>
  <div class="text-sm">請稍候，正在驗證您的身分</div>
  
  <div id="manual-action" style="display: none; margin-top: 24px;">
    <a href="${deepLinkUrl.replace(/"/g, '&quot;')}" class="btn">開啟 VoteChaos</a>
  </div>
</body>
</html>`

        return new Response(html, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
        })
      }

      // 如果不是 App 登入，重定向到前端應用的 callback URL（網頁版）
      console.log('[CRITICAL] Web platform detected, redirecting to frontend callback URL')

      // 構建前端應用的回調 URL，包含所有必要的參數
      const frontendCallbackUrl = new URL(`${FRONTEND_URL}/auth/callback`)
      frontendCallbackUrl.searchParams.set('code', code)
      frontendCallbackUrl.searchParams.set('state', state)
      frontendCallbackUrl.searchParams.set('provider', 'twitter')
      frontendCallbackUrl.searchParams.set('platform', platform)

      // 如果有錯誤參數，也傳遞過去
      const error = url.searchParams.get('error')
      if (error) {
        frontendCallbackUrl.searchParams.set('error', error)
        const errorDescription = url.searchParams.get('error_description')
        if (errorDescription) {
          frontendCallbackUrl.searchParams.set('error_description', errorDescription)
        }
      }

      console.log('[CRITICAL] Redirecting to frontend callback URL:', frontendCallbackUrl.toString())

      // 返回 HTML 頁面，自動重定向到前端應用的 callback URL
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>正在處理登入...</title>
  <script>
    console.log('[Twitter Callback Redirect] Redirecting to frontend callback URL:', '${frontendCallbackUrl.toString()}');
    window.location.href = '${frontendCallbackUrl.toString()}';
  </script>
</head>
<body>
  <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column; gap: 1rem;">
    <div>正在處理登入...</div>
    <div style="font-size: 0.875rem; color: #666;">正在重定向到應用...</div>
  </div>
</body>
</html>`

      return new Response(html, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // 如果沒有 code 和 state，重定向到前端（可能是用戶直接訪問）
    console.log('[CRITICAL] GET callback without authorization header and no code/state, redirecting to frontend')
    const error = url.searchParams.get('error')

    // 構建前端應用的回調 URL
    const frontendCallbackUrl = new URL(`${FRONTEND_URL}/auth/callback`)
    if (error) frontendCallbackUrl.searchParams.set('error', error)
    frontendCallbackUrl.searchParams.set('provider', 'twitter')

    console.log('[CRITICAL] Redirecting to frontend:', frontendCallbackUrl.toString())
    return Response.redirect(frontendCallbackUrl.toString(), 302)
  }

  // 只有非回調請求才驗證來源
  if (!isCallback) {
    const originValidation = validateOrigin(req)
    if (originValidation) return originValidation
  } else {
    console.log('Callback request detected, skipping origin validation')
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname

    // 處理 X 授權請求
    // 支持 GET /auth 和 POST /（supabase.functions.invoke 使用 POST）
    const isAuthRequest = path.endsWith('/auth') || path.endsWith('/auth/') ||
      (req.method === 'POST' && (path === '/' || path.endsWith('/twitter-auth')))

    if (isAuthRequest) {
      console.log('Handling auth request', { method: req.method, path })
      return await handleAuthRequest(req, corsHeaders)
    }

    // 處理 X 回調
    if (isCallback) {
      console.log('Handling callback request')
      return await handleCallback(req, corsHeaders)
    }

    // 404
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Twitter auth error:', error)
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
  // 生成 PKCE code verifier (43-128 characters)
  const codeVerifier = crypto.randomUUID() + crypto.randomUUID()

  // 生成 code challenge (SHA256 hash of code verifier, then base64url encode)
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashBase64 = btoa(String.fromCharCode(...hashArray))
  const codeChallenge = hashBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  // 檢查是否為 App 登入（只支持 'app'，不支持 'web'）
  let platform = 'app' // 只支持 'app'

  if (req.method === 'POST') {
    // POST 請求：從 body 中讀取，但只支持 'app'
    try {
      const body = await req.json().catch(() => ({}))
      const requestedPlatform = body.platform || 'app'
      if (requestedPlatform !== 'app') {
        console.warn('[Twitter Auth] Unsupported platform requested:', requestedPlatform, ', using "app"')
      }
      platform = 'app' // 強制使用 'app'
    } catch (e) {
      console.warn('Failed to parse POST body, using default platform: app')
      platform = 'app'
    }
  } else {
    // GET 請求：從 query 參數中讀取，但只支持 'app'
    const url = new URL(req.url)
    const requestedPlatform = url.searchParams.get('platform') || 'app'
    if (requestedPlatform !== 'app') {
      console.warn('[Twitter Auth] Unsupported platform requested:', requestedPlatform, ', using "app"')
    }
    platform = 'app' // 強制使用 'app'
  }

  // 生成簽名的 state（包含 timestamp, platform, codeVerifier，並簽名）
  // 格式：{timestamp}|{platform}|{codeVerifier}|{signature}
  const signedState = await generateSignedState(platform, codeVerifier)

  // 構建 X (Twitter) 授權 URL
  // X 使用 OAuth 2.0 with PKCE (S256 method)
  // 2025 更新：移除 tweet.read，僅保留必要的 users.read 和 offline.access
  const scope = 'users.read offline.access'
  const authUrl = `https://twitter.com/i/oauth2/authorize?` +
    `response_type=code&` +
    `client_id=${TWITTER_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(TWITTER_REDIRECT_URI)}&` +
    `scope=${encodeURIComponent(scope)}&` +
    `state=${encodeURIComponent(signedState)}&` +
    `code_challenge=${codeChallenge}&` +
    `code_challenge_method=S256`

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

// 處理 X 回調
async function handleCallback(req: Request, corsHeaders: Record<string, string>) {
  // 記錄請求詳情（用於調試）
  console.log('Twitter callback received:', {
    url: req.url,
    method: req.method,
    headers: Object.fromEntries(req.headers.entries()),
  })

  const url = new URL(req.url)
  let code: string | null = null
  let stateParam: string | null = null
  let error: string | null = null
  let errorDescription: string | null = null

  // 支持 GET（來自 X 服務器直接重定向）和 POST（來自前端轉發）
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
    errorParams.set('provider', 'twitter')

    const targetPlatform = platformOverride || 'auto'
    // 如果是 App 登入，使用 Deep Link；否則使用 Web URL
    if (targetPlatform === 'app' && FRONTEND_DEEP_LINK) {
      return `${FRONTEND_DEEP_LINK}?${errorParams.toString()}`
    } else {
      return `${FRONTEND_URL}/auth?${errorParams.toString()}`
    }
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

  // 從驗證結果中獲取資訊
  const platform = stateVerification.platform || 'auto'
  const codeVerifier = stateVerification.codeVerifier

  if (!codeVerifier) {
    console.error('No code verifier found in state')
    const errorUrl = getErrorRedirectUrl('no_code_verifier', 'No code verifier found')
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

  // 檢查錯誤
  if (error) {
    console.error('Twitter OAuth error:', error, errorDescription)
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
    // 步驟 1：使用授權碼交換 access token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: TWITTER_CLIENT_ID,
        redirect_uri: TWITTER_REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Failed to exchange token:', tokenResponse.status, errorText)
      const errorUrl = getErrorRedirectUrl('token_exchange_failed', `Failed to exchange token: ${tokenResponse.status} - ${errorText}`)
      return Response.redirect(errorUrl)
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      console.error('Missing access_token in response:', tokenData)
      const errorUrl = getErrorRedirectUrl('missing_token', 'Missing access_token from Twitter')
      return Response.redirect(errorUrl)
    }

    // 步驟 2：使用 access token 獲取用戶資訊
    const userResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,username,name', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!userResponse.ok) {
      const errorText = await userResponse.text()
      console.error('Failed to get user info:', userResponse.status, errorText)
      const errorUrl = getErrorRedirectUrl('user_info_failed', `Failed to get user info: ${userResponse.status} - ${errorText}`)
      return Response.redirect(errorUrl)
    }

    const userData = await userResponse.json()
    const twitterUserId = userData.data?.id
    const username = userData.data?.username || 'twitter_user'
    const displayName = userData.data?.name || username
    const pictureUrl = userData.data?.profile_image_url || '🔥'
    const email = null // X API v2 不返回 email，除非申請特殊權限

    if (!twitterUserId) {
      console.error('No Twitter user ID in response:', userData)
      const errorUrl = getErrorRedirectUrl('missing_twitter_user_id', 'No Twitter user ID in response')
      return Response.redirect(errorUrl)
    }

    // 步驟 3：在 Supabase 中建立或更新用戶
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    let userId: string
    let isNewUser = false
    // 使用 Twitter user ID 生成一個唯一的 email（X 不返回 email）
    const userEmail = `twitter_${twitterUserId}@twitter.local`

    // 檢查是否已有 Twitter 用戶（需要先添加 twitter_user_id 欄位到 profiles 表）
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, nickname, avatar')
      .eq('twitter_user_id', twitterUserId)
      .single()

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

      console.log('Updated existing Twitter user:', userId)
    } else {
      // 檢查 email 是否已存在
      const { data: existingUserByEmail } = await supabaseAdmin.auth.admin.listUsers()
      const userWithEmail = existingUserByEmail?.users?.find(u => u.email === userEmail)

      if (userWithEmail) {
        // Email 已存在，連結 Twitter 帳號到現有用戶
        userId = userWithEmail.id

        await supabaseAdmin
          .from('profiles')
          .update({
            twitter_user_id: twitterUserId,
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
            twitter_user_id: twitterUserId,
            twitter_username: username,
            nickname: displayName,
            avatar: pictureUrl,
          }
        })

        console.log('Linked Twitter account to existing user:', userId)
      } else {
        // 建立新用戶
        // 建立 auth.users（使用 Admin API）
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: userEmail,
          email_confirm: true, // 自動確認 email
          user_metadata: {
            twitter_user_id: twitterUserId,
            twitter_username: username,
            nickname: displayName,
            avatar: pictureUrl,
          },
          app_metadata: {},
        })

        if (authError || !authUser.user) {
          console.error('Failed to create auth user:', {
            error: authError,
            errorMessage: authError?.message,
            errorDetails: authError,
            userEmail,
            twitterUserId,
            authUser
          })
          const errorUrl = getErrorRedirectUrl('user_creation_failed', `Failed to create user: ${authError?.message || 'Unknown error'}`)
          return Response.redirect(errorUrl)
        }

        userId = authUser.user.id
        isNewUser = true

        // 更新 profile 的 twitter_user_id（handle_new_user trigger 會自動建立 profile）
        await supabaseAdmin
          .from('profiles')
          .update({
            twitter_user_id: twitterUserId,
            nickname: displayName,
            avatar: pictureUrl,
          })
          .eq('id', userId)

        console.log('Created new Twitter user:', userId)
      }
    }

    // 步驟 4：直接使用 Supabase Admin API 生成 session tokens 並返回 Deep Link（只支持 APP 登入）
    // 注意：只支持 platform='app'，網頁版登入已移除
    // 使用 generateLink 生成 magic link，然後使用 Supabase Admin API 驗證並獲取 session tokens
    // 最後直接返回包含 tokens 的 Deep Link，完全跳過中間步驟
    if (platform !== 'app') {
      console.error('[Twitter Auth] Unsupported platform:', platform)
      const errorUrl = getErrorRedirectUrl('unsupported_platform', `Unsupported platform: ${platform}. Only 'app' platform is supported.`)
      return Response.redirect(errorUrl)
    }

    // 步驟 5：使用 generateLink 生成 magic link
    // 注意：我們使用一個臨時的 redirectTo，然後在 Edge Function 內部驗證 magic link
    const tempRedirectTo = `${FRONTEND_URL}/auth/callback`
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
      options: {
        redirectTo: tempRedirectTo,
      },
    })

    if (linkError || !linkData || !linkData.properties?.action_link) {
      console.error('Failed to generate magic link:', {
        error: linkError,
        userId,
        userEmail,
        linkData
      })

      const errorUrl = getErrorRedirectUrl('session_generation_failed', linkError?.message || 'Failed to generate session')
      return Response.redirect(errorUrl)
    }

    console.log('Magic link generated successfully:', {
      userId,
      userEmail,
      hasActionLink: !!linkData.properties?.action_link
    })

    // 步驟 6：使用 Supabase Admin API 直接生成 session tokens
    // 注意：我們可以使用 supabaseAdmin.auth.admin.generateLink 返回的 hashed_token
    // 但更好的方法是使用 Supabase Admin API 的 signInWithPassword 或其他方法
    // 實際上，我們可以直接使用 generateLink 返回的 token，然後構建包含 tokens 的 Deep Link
    // 但這需要我們能夠從 token 中提取 tokens，這可能不可行

    // 方案：使用中間重定向頁面，但確保它能夠正確處理
    // 實際上，問題可能是中間重定向頁面在外部瀏覽器中打開，Deep Link 無法觸發
    // 讓我們使用一個更直接的方法：返回 HTML 頁面，該頁面會自動重定向到 Deep Link
    const magicLink = linkData.properties.action_link
    console.log('[Twitter Auth] Magic link generated:', magicLink)

    // 解析 magic link，提取 token
    try {
      const magicLinkUrl = new URL(magicLink)
      const magicLinkToken = magicLinkUrl.searchParams.get('token')

      if (magicLinkToken) {
        // 構建一個 HTML 頁面，該頁面會自動訪問 magic link，獲取 tokens，然後重定向到 Deep Link
        // 注意：這需要在瀏覽器中執行，所以我們使用 JavaScript 來處理
        const redirectTo = `${FRONTEND_URL}/auth/deep-link-redirect`
        const verifyUrl = `${SUPABASE_URL}/auth/v1/verify?token=${encodeURIComponent(magicLinkToken)}&redirect_to=${encodeURIComponent(redirectTo)}&type=magiclink`

        console.log('[Twitter Auth] Using magic link verification URL:', verifyUrl)

        // 對於 POST 請求，返回 JSON 響應（包含 redirectUrl）
        if (req.method === 'POST') {
          return new Response(
            JSON.stringify({ redirectUrl: verifyUrl }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }

        // 對於 GET 請求，直接重定向到 magic link 驗證 URL
        // Supabase 會驗證 magic link 並重定向到 /auth/deep-link-redirect
        // 然後中間重定向頁面會立即重定向到 Deep Link
        return Response.redirect(verifyUrl)
      }
    } catch (parseError) {
      console.error('[Twitter Auth] Failed to parse magic link:', parseError)
    }

    // 如果解析失敗，使用原始 magic link
    console.log('[Twitter Auth] Using original magic link')

    // 對於 POST 請求，返回 JSON 響應（包含 redirectUrl）
    if (req.method === 'POST') {
      return new Response(
        JSON.stringify({ redirectUrl: magicLink }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // 對於 GET 請求，直接重定向到 magic link
    return Response.redirect(magicLink)

  } catch (error) {
    console.error('Twitter callback error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorUrl = getErrorRedirectUrl('twitter_callback_error', errorMessage)
    return Response.redirect(errorUrl)
  }
}

