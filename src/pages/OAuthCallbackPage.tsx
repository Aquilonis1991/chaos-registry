import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isNative } from '@/lib/capacitor';

/**
 * OAuthCallbackPage - 處理 Web URL OAuth 回調
 * Supabase 會在回調 URL 的 hash fragment 中包含 access_token 等資訊
 * 這個頁面會讓 Supabase 自動處理這些資訊
 * 
 * 特殊處理：LINE Provider 使用 Edge Function，需要轉發回調
 */
export const OAuthCallbackPage = () => {
  const navigate = useNavigate();

  // 處理重定向 URL（magic link 或 Deep Link）
  const handleRedirectUrl = (redirectUrl: string) => {
    console.log('[OAuthCallbackPage] handleRedirectUrl called with:', redirectUrl);

    // 檢查是否為 Deep Link
    if (redirectUrl.startsWith('votechaos://')) {
      // 直接是 Deep Link，使用 window.location.href 觸發 appUrlOpen 事件
      console.log('[OAuthCallbackPage] Deep Link detected, using window.location.href');
      window.location.href = redirectUrl;
      return;
    }

    // 檢查是否為 magic link（包含 redirect_to=votechaos://）
    if (redirectUrl.startsWith('http://') || redirectUrl.startsWith('https://')) {
      try {
        const urlObj = new URL(redirectUrl);
        const redirectTo = urlObj.searchParams.get('redirect_to');

        console.log('[OAuthCallbackPage] Parsed redirectTo from magic link:', redirectTo);

        if (redirectTo && redirectTo.startsWith('votechaos://') && isNative()) {
          // Magic link 中包含 Deep Link，在 App 環境中需要特殊處理
          // 直接訪問 magic link URL，讓 Supabase 驗證 token 並重定向到 Deep Link
          console.log('[OAuthCallbackPage] Magic link with Deep Link redirect_to detected, opening magic link for verification');

          // 提取 token 參數
          const token = urlObj.searchParams.get('token');
          const type = urlObj.searchParams.get('type');

          if (token && type === 'magiclink') {
            // 在 App 環境中，直接訪問 magic link URL
            // Supabase 會驗證 token 並重定向到 Deep Link，Deep Link 會觸發 appUrlOpen 事件
            // 然後 OAuthCallbackHandler 會處理 Deep Link 中的 tokens
            console.log('[OAuthCallbackPage] Opening magic link, Supabase will verify token and redirect to Deep Link');
            console.log('[OAuthCallbackPage] Magic link URL:', redirectUrl);

            // 使用 window.location.href 打開 magic link
            // Supabase 會驗證 token 並重定向到 votechaos://auth/callback#access_token=...&refresh_token=...
            window.location.href = redirectUrl;
          } else {
            // 沒有 token 或 type 不正確，直接打開 magic link
            console.log('[OAuthCallbackPage] No token or invalid type, opening magic link');
            window.location.href = redirectUrl;
          }
        } else {
          // 普通的 HTTP/HTTPS URL 或 magic link 不包含 Deep Link
          console.log('[OAuthCallbackPage] Opening URL (no Deep Link):', redirectUrl);
          window.location.href = redirectUrl;
        }
      } catch (e) {
        console.error('[OAuthCallbackPage] Failed to parse redirect URL:', e);
        window.location.href = redirectUrl;
      }
    } else {
      // 其他情況，直接使用 window.location.href
      console.log('[OAuthCallbackPage] Opening URL (other format):', redirectUrl);
      window.location.href = redirectUrl;
    }
  };

  // 使用 ref 來追蹤是否已經處理過這個回調，避免重複處理
  const processedRef = useRef<string | null>(null);

  // State for Bridge UI
  const [bridgeLink, setBridgeLink] = useState<string | null>(null);

  // ... (keep existing imports/refs) ...

  useEffect(() => {
    // 0. Initial Log
    console.log('[OAuthCallbackPage] (v1.0.35) Mounted');
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token') || urlParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token') || urlParams.get('refresh_token');
    const platform = urlParams.get('platform') || hashParams.get('platform');

    // 1. BRIDGE MODE CHECK (For Native App Login via Web Callback)
    // Trigger if:
    // A. Explicit 'platform=app' param
    // B. OR: Tokens found in Hash/URL, AND we are NOT in Native environment (Web Browser)
    //    (This catches the X/Twitter case where we removed ?platform=app)
    const hasTokens = !!(accessToken && refreshToken);

    if (!isNative() && (platform === 'app' || hasTokens)) {
      console.log('[OAuthCallbackPage] Bridge Mode Detected');
      console.log('Reason:', platform === 'app' ? 'Explicit Platform Param' : 'Tokens Found in Browser');

      // Construct Deep Link with Query Params (more reliable than Hash on Android)
      const newSearchParams = new URLSearchParams();
      newSearchParams.set('platform', 'app');
      if (accessToken) newSearchParams.set('access_token', accessToken);
      if (refreshToken) newSearchParams.set('refresh_token', refreshToken);

      // Preserve other params
      urlParams.forEach((v, k) => {
        if (k !== 'platform' && k !== 'access_token' && k !== 'refresh_token') {
          newSearchParams.set(k, v);
        }
      });

      const deepLink = `votechaos://auth/callback?${newSearchParams.toString()}`;

      console.log('[OAuthCallbackPage] Constructed Deep Link:', deepLink);
      setBridgeLink(deepLink);

      // Auto-jump attempt - DISABLED for v1.0.38 Debugging
      // We want the user to MANUALLY click the button to confirm they see the "Green Token" status.
      // This isolates whether the issue is "No Tokens on Web" or "App Intent Failure".
      /*
      setTimeout(() => {
        console.log('[OAuthCallbackPage] Auto-redirecting to:', deepLink);
        window.location.href = deepLink;
      }, 500);
      */

      // STOP further processing to let the UI render the manual button
      return;
    }

    // ... (rest of existing logic) ...
  }, [navigate]);

  // UI Render
  if (bridgeLink) {
    const hasTokens = bridgeLink.includes('access_token');
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white p-6">
        <h1 className="text-2xl font-bold mb-4">登入完成</h1>

        {hasTokens ? (
          <div className="mb-4 px-3 py-1 bg-green-900/50 text-green-400 rounded text-sm border border-green-800">
            ✓ 取得 Access Token
          </div>
        ) : (
          <div className="mb-4 px-3 py-1 bg-red-900/50 text-red-400 rounded text-sm border border-red-800">
            ⚠ 未偵測到 Token (登入可能失敗)
          </div>
        )}

        <p className="text-zinc-400 mb-8 max-w-xs text-center">
          請點擊下方按鈕返回應用程式
        </p>

        <a
          href={bridgeLink}
          className="w-full max-w-xs bg-primary text-primary-foreground h-14 flex items-center justify-center rounded-lg text-lg font-bold animate-pulse shadow-xl"
          style={{ textDecoration: 'none' }}
        >
          進入 App (v1.0.36)
        </a>

        <div className="mt-8 p-4 bg-zinc-900 rounded w-full max-w-xs overflow-hidden">
          <p className="text-xs text-zinc-500 font-mono break-all">
            {bridgeLink}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {/* ... existing loader ... */}
    </div>
  );
};

export default OAuthCallbackPage;





