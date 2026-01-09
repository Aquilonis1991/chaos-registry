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
// 注意：X Developer Portal 強制要求使用標準 Supabase 回調 URL
const isProduction = Deno.env.get('ENVIRONMENT') === 'production'
const TWITTER_REDIRECT_URI = isProduction
  ? 'https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback'
  : Deno.env.get('TWITTER_REDIRECT_URI') || 'https://epyykzxxglkjombvozhr.supabase.co/auth/v1/callback'

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
  
  // 生成 JWT token（Supabase 期望 state 是 JWT 格式）
  const payload = {
    timestamp,
    platform,
    codeVerifier,
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
  // 記錄所有請求（用於調試）
  console.log('Edge Function request received:', {
    method: req.method,
    url: req.url,
    pathname: new URL(req.url).pathname,
    hasAuthHeader: !!req.headers.get('authorization'),
    origin: req.headers.get('origin'),
    userAgent: req.headers.get('user-agent'),
  })

  // 處理 CORS 預檢請求
  const corsResponse = handleCorsPreFlight(req)
  if (corsResponse) {
    console.log('CORS preflight request handled')
    return corsResponse
  }

  // 對於回調請求，跳過來源驗證（因為來自 X 服務器）
  const url = new URL(req.url)
  const path = url.pathname
  const isCallback = path.endsWith('/callback') || path.endsWith('/callback/')
  
  // 只有非回調請求才驗證來源
  if (!isCallback) {
    const originValidation = validateOrigin(req)
    if (originValidation) return originValidation
  } else {
    console.log('Callback request detected, skipping origin validation')
  }

  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

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

  // 檢查是否為 App 登入（支持 GET query 參數和 POST body）
  let platform = 'auto' // 'app', 'web', 'auto'
  
  if (req.method === 'POST') {
    // POST 請求：從 body 中讀取
    try {
      const body = await req.json().catch(() => ({}))
      platform = body.platform || body.action === 'auth' ? (body.platform || 'auto') : 'auto'
    } catch (e) {
      console.warn('Failed to parse POST body, using default platform')
    }
  } else {
    // GET 請求：從 query 參數中讀取
    const url = new URL(req.url)
    platform = url.searchParams.get('platform') || 'auto'
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
  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  const errorDescription = url.searchParams.get('error_description')

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
    return Response.redirect(errorUrl)
  }

  // 驗證簽名的 state
  const stateVerification = await verifySignedState(stateParam)
  if (!stateVerification.valid) {
    console.error('Invalid or expired state:', stateParam)
    const errorUrl = getErrorRedirectUrl('invalid_state', 'Invalid or expired state parameter', 'auto')
    return Response.redirect(errorUrl)
  }

  // 從驗證結果中獲取資訊
  const platform = stateVerification.platform || 'auto'
  const codeVerifier = stateVerification.codeVerifier

  if (!codeVerifier) {
    console.error('No code verifier found in state')
    const errorUrl = getErrorRedirectUrl('no_code_verifier', 'No code verifier found')
    return Response.redirect(errorUrl)
  }

  // 檢查錯誤
  if (error) {
    console.error('Twitter OAuth error:', error, errorDescription)
    const errorUrl = getErrorRedirectUrl(error, errorDescription || '')
    return Response.redirect(errorUrl)
  }

  // 檢查授權碼
  if (!code) {
    console.error('No authorization code provided')
    const errorUrl = getErrorRedirectUrl('no_code', 'No authorization code provided')
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

    // 步驟 4：決定重定向 URL（根據 platform 參數或自動判斷）
    let redirectTo: string
    if (platform === 'app' && FRONTEND_DEEP_LINK) {
      // App 登入：使用 Deep Link
      redirectTo = FRONTEND_DEEP_LINK
    } else if (platform === 'web' && FRONTEND_URL) {
      // Web 登入：使用 Web URL
      redirectTo = `${FRONTEND_URL}/home`
    } else {
      // 自動判斷：根據 user-agent
      const userAgent = req.headers.get('user-agent') || ''
      const isMobile = userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')
      redirectTo = isMobile && FRONTEND_DEEP_LINK
        ? FRONTEND_DEEP_LINK
        : `${FRONTEND_URL}/home`
    }

    // 步驟 5：使用 generateLink 生成 magic link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userEmail,
      options: {
        redirectTo: redirectTo,
      },
    })

    if (linkError || !linkData) {
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

    // 步驟 6：重定向到 magic link（Supabase 會自動驗證並生成 session token）
    // Magic link 格式：https://...supabase.co/auth/v1/verify?token=...&redirect_to=...
    // 當用戶訪問 magic link 時，Supabase 會驗證 token 並重定向到 redirect_to，並在 URL hash 中包含 access_token 和 refresh_token
    const magicLink = linkData.properties.action_link
    console.log('Magic link generated, redirecting to:', magicLink)
    
    // 直接重定向到 magic link，讓 Supabase 處理驗證和 token 生成
    return Response.redirect(magicLink)

  } catch (error) {
    console.error('Twitter callback error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorUrl = getErrorRedirectUrl('twitter_callback_error', errorMessage)
    return Response.redirect(errorUrl)
  }
}

