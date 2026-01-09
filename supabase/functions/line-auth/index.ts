// 使用 Deno.serve 而不是 serve，以避免 Supabase 路由層級的 JWT 檢查
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0'
import { getCorsHeaders, handleCorsPreFlight, validateOrigin } from '../_shared/cors.ts'

// LINE OAuth 配置
const LINE_CHANNEL_ID = Deno.env.get('LINE_CHANNEL_ID')
const LINE_CHANNEL_SECRET = Deno.env.get('LINE_CHANNEL_SECRET')

// 驗證必要的環境變數
if (!LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET) {
  throw new Error('LINE_CHANNEL_ID and LINE_CHANNEL_SECRET must be set as environment variables')
}
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
// 注意：環境變數名稱不能以 SUPABASE_ 開頭，所以使用 SERVICE_ROLE_KEY
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY')!

// 根據環境決定回調 URL
// 優先使用環境變數 LINE_REDIRECT_URI（如果設置）
// 否則使用默認的 Edge Function URL（舊的回調方式，可能導致 401 錯誤）
const LINE_REDIRECT_URI = Deno.env.get('LINE_REDIRECT_URI') || 'https://epyykzxxglkjombvozhr.supabase.co/functions/v1/line-auth/callback'

const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://chaos-registry.vercel.app'
const FRONTEND_DEEP_LINK = Deno.env.get('FRONTEND_DEEP_LINK') || 'votechaos://auth/callback'

// State 簽名密鑰（用於 CSRF 保護）
// 使用 SERVICE_ROLE_KEY 的一部分作為簽名密鑰（Edge Functions 是無狀態的，不能使用內存存儲）
const STATE_SECRET = SERVICE_ROLE_KEY.substring(0, 32) // 使用前 32 個字符作為密鑰
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

  // 對於回調請求，跳過來源驗證（因為來自 LINE 服務器）
  const url = new URL(req.url)
  const path = url.pathname
  const isCallback = path.endsWith('/callback') || path.endsWith('/callback/')
  
  // 獲取 origin 並設置 CORS headers（必須在所有響應中包含）
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  
  // 如果是回調請求且是 GET 請求且沒有授權 header，立即重定向到前端
  // 這必須在驗證來源之前執行，因為這是來自 LINE 服務器的直接重定向
  if (isCallback && req.method === 'GET' && !req.headers.get('authorization')) {
    console.log('[CRITICAL] GET callback without authorization header detected, redirecting to frontend immediately')
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')
    
    // 構建前端應用的回調 URL
    const frontendCallbackUrl = new URL(`${FRONTEND_URL}/auth/callback`)
    if (code) frontendCallbackUrl.searchParams.set('code', code)
    if (state) frontendCallbackUrl.searchParams.set('state', state)
    if (error) frontendCallbackUrl.searchParams.set('error', error)
    frontendCallbackUrl.searchParams.set('provider', 'line')
    
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
    // 處理 LINE 授權請求
    // 支持 GET /auth 和 POST /（supabase.functions.invoke 使用 POST）
    const isAuthRequest = path.endsWith('/auth') || path.endsWith('/auth/') || 
                         (req.method === 'POST' && (path === '/' || path.endsWith('/line-auth')))
    
    if (isAuthRequest) {
      console.log('Handling auth request', { method: req.method, path })
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
  // 生成 nonce 用於 OpenID Connect（防止重放攻擊）
  const nonce = crypto.randomUUID()
  
  // 檢查是否為 App 登入
  // 支持從 query 參數（GET）或 body（POST）中讀取 platform
  const url = new URL(req.url)
  let platform = url.searchParams.get('platform') || 'auto'
  
  // 如果是 POST 請求，嘗試從 body 中讀取 platform
  if (req.method === 'POST') {
    try {
      const body = await req.json().catch(() => null)
      if (body && body.platform) {
        platform = body.platform
      }
      if (body && body.action === 'auth' && body.platform) {
        platform = body.platform
      }
    } catch (e) {
      // 如果解析 body 失敗，使用 query 參數或默認值
      console.warn('Failed to parse POST body, using query params or default')
    }
  }
  
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
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

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

    // 步驟 4：為用戶生成 magic link（用於自動登入）
    // userEmail 已在上面定義，不需要重複宣告
    
    // 決定重定向 URL（根據 platform 參數或自動判斷）
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
      
      const fallbackUrl = (platform === 'app' && FRONTEND_DEEP_LINK)
        ? `${FRONTEND_DEEP_LINK}?${redirectParams.toString()}`
        : `${FRONTEND_URL}/auth?${redirectParams.toString()}`
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

    // 步驟 6：重定向到 magic link（Supabase 會自動驗證並生成 session token）
    // Magic link 格式：https://...supabase.co/auth/v1/verify?token=...&redirect_to=...
    // 當用戶訪問 magic link 時，Supabase 會驗證 token 並重定向到 redirect_to，並在 URL hash 中包含 access_token 和 refresh_token
    const magicLink = linkData.properties.action_link
    console.log('Magic link generated, redirecting to:', magicLink)

    // 對於 POST 請求（來自前端 fetch），返回 JSON 響應而不是重定向
    // 這樣可以避免 CORS 問題
    if (req.method === 'POST') {
      return new Response(
        JSON.stringify({ redirectUrl: magicLink }),
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
    
    const errorUrl = (platform === 'app' && FRONTEND_DEEP_LINK)
      ? `${FRONTEND_DEEP_LINK}?${errorParams.toString()}`
      : `${FRONTEND_URL}/auth?${errorParams.toString()}`
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

