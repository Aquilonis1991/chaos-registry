// 獨立的 LINE 回調處理 Edge Function
// 用於處理 LINE OAuth 回調的 GET 請求
// 此函數專為處理沒有 Authorization header 的回調請求而設計

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0'
import { getCorsHeaders, handleCorsPreFlight } from '../_shared/cors.ts'

const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://chaos-registry.vercel.app'
const FRONTEND_DEEP_LINK = Deno.env.get('FRONTEND_DEEP_LINK') || 'votechaos://auth/callback'

Deno.serve(async (req) => {
  // 處理 CORS 預檢請求
  const corsResponse = handleCorsPreFlight(req)
  if (corsResponse) {
    return corsResponse
  }

  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // 只處理 GET 請求（LINE 回調）
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  console.log('[line-auth-callback] GET callback received:', {
    hasCode: !!code,
    hasState: !!state,
    hasError: !!error,
    url: url.toString()
  })

  // 決定重定向目標
  // LINE 登入目前只支援 APP，所以必須使用 Deep Link，避免網頁與 App 混淆
  // 根據 LINE登入修復完整報告.md 的建議：完全使用 Deep Link，避免 Context 丟失
  const redirectBase = FRONTEND_DEEP_LINK

  // 構建回調 URL
  const targetUrl = new URL(redirectBase)
  if (code) targetUrl.searchParams.set('code', code)
  if (state) targetUrl.searchParams.set('state', state)
  if (error) targetUrl.searchParams.set('error', error)
  targetUrl.searchParams.set('provider', 'line')

  // 保留其他參數（如 platform）
  const platform = url.searchParams.get('platform')
  if (platform) targetUrl.searchParams.set('platform', platform)

  console.log('[line-auth-callback] Redirecting to:', targetUrl.toString())

  // 重定向到目標 URL
  return Response.redirect(targetUrl.toString(), 302)
})
