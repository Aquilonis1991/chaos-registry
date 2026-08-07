import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { isNative } from '@/lib/capacitor';
import { devLog } from '@/lib/devLog';
import { exchangeLineCodeForSession, verifyLineHashedToken } from '@/lib/auth/lineEdgeAuth';

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
    devLog('[OAuthCallbackPage] handleRedirectUrl called with:', redirectUrl);
    
    // 檢查是否為 Deep Link
    if (redirectUrl.startsWith('votechaos://')) {
      devLog('[OAuthCallbackPage] Deep Link detected, using window.location.href');
      window.location.href = redirectUrl;
      return;
    }
    
    // 檢查是否為 magic link（包含 redirect_to=votechaos://）
    if (redirectUrl.startsWith('http://') || redirectUrl.startsWith('https://')) {
      try {
        const urlObj = new URL(redirectUrl);
        const redirectTo = urlObj.searchParams.get('redirect_to');
        
        devLog('[OAuthCallbackPage] Parsed redirectTo from magic link:', redirectTo);
        
        if (redirectTo && redirectTo.startsWith('votechaos://') && isNative()) {
          devLog('[OAuthCallbackPage] Magic link with Deep Link redirect_to detected, opening magic link for verification');
          
          const token = urlObj.searchParams.get('token');
          const type = urlObj.searchParams.get('type');
          
          if (token && type === 'magiclink') {
            devLog('[OAuthCallbackPage] Opening magic link, Supabase will verify token and redirect to Deep Link');
            devLog('[OAuthCallbackPage] Magic link URL:', redirectUrl);
            window.location.href = redirectUrl;
          } else {
            devLog('[OAuthCallbackPage] No token or invalid type, opening magic link');
            window.location.href = redirectUrl;
          }
        } else {
          devLog('[OAuthCallbackPage] Opening URL (no Deep Link):', redirectUrl);
          window.location.href = redirectUrl;
        }
      } catch (e) {
        console.error('[OAuthCallbackPage] Failed to parse redirect URL:', e);
        window.location.href = redirectUrl;
      }
    } else {
      devLog('[OAuthCallbackPage] Opening URL (other format):', redirectUrl);
      window.location.href = redirectUrl;
    }
  };

  // 使用 ref 來追蹤是否已經處理過這個回調，避免重複處理
  const processedRef = useRef<string | null>(null);
  
  useEffect(() => {
    // 同步檢查並立即轉發（在 Supabase 處理之前）
    // 這必須在 React 渲染之前就執行，所以放在 useEffect 的最開始
    devLog('[OAuthCallbackPage] useEffect triggered');
    devLog('[OAuthCallbackPage] Current URL:', window.location.href);
    devLog('[OAuthCallbackPage] Current pathname:', window.location.pathname);
    devLog('[OAuthCallbackPage] Current search:', window.location.search);
    devLog('[OAuthCallbackPage] Current hash:', window.location.hash);
    
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const code = urlParams.get('code') || hashParams.get('code');
    const state = urlParams.get('state') || hashParams.get('state');
    const error = urlParams.get('error') || hashParams.get('error');
    const provider = urlParams.get('provider') || hashParams.get('provider');
    const platform = urlParams.get('platform') || hashParams.get('platform'); // 檢查 platform 參數
    
    devLog('[OAuthCallbackPage] Extracted parameters:', {
      code: code ? 'present' : 'missing',
      state: state ? 'present' : 'missing',
      error: error || 'none',
      provider: provider || 'none',
      platform: platform || 'none',
      hasAccessToken: !!(hashParams.get('access_token') || urlParams.get('access_token'))
    });
    
    // 防止重複處理：使用 code+state 作為唯一標識
    const callbackId = code && state ? `${code.substring(0, 10)}-${state.substring(0, 10)}` : null;
    if (callbackId && processedRef.current === callbackId) {
      console.log('[OAuthCallbackPage] Callback already processed, skipping duplicate request');
      return;
    }
    
    // 如果有 code 和 state，且沒有 Supabase 的 access_token，立即轉發到 Edge Function
    // 這必須在 Supabase 處理之前就執行，所以使用同步方式
    // 注意：Twitter 現在使用 Supabase 內建 Provider，不需要 Edge Function
    if (code && state && !hashParams.get('access_token') && !urlParams.get('access_token') && provider === 'line') {
      // 標記為已處理
      if (callbackId) {
        processedRef.current = callbackId;
      }
      devLog('[OAuthCallbackPage] Code and state found for LINE, no access_token - forwarding to Edge Function');
      // 只對 LINE 使用 Edge Function，Twitter 使用 Supabase 內建流程
      console.log('[OAuthCallbackPage] LINE callback detected, calling Edge Function via fetch');

      (async () => {
        const exchangeResult = await exchangeLineCodeForSession({ code, state, error });

        if (exchangeResult.kind === 'redirect') {
          // 重定向響應（Edge Function 返回 magic link）
          console.log('[OAuthCallbackPage] Edge Function returned redirect:', exchangeResult.location);
          window.location.href = exchangeResult.location;
          return;
        }

        if (exchangeResult.kind === 'error') {
          console.error('[OAuthCallbackPage] Error calling Edge Function (LINE):', exchangeResult.message);
          toast.error('登入失敗', {
            description: exchangeResult.message
          });
          navigate('/auth', { replace: true });
          return;
        }

        const { redirectUrl, hashedToken } = exchangeResult;
        devLog('[OAuthCallbackPage] Edge Function returned redirect URL (LINE):', redirectUrl.substring(0, 100) + '...');
        devLog('[OAuthCallbackPage] Edge Function returned hashedToken:', !!hashedToken, hashedToken ? `length: ${hashedToken.length}` : 'missing');

        // 在 App 環境中，如果有 hashedToken，直接驗證並創建 session
        if (isNative() && hashedToken) {
          devLog('[OAuthCallbackPage] Native app detected, verifying token directly with hashed_token');
          devLog('[OAuthCallbackPage] Hashed token length:', hashedToken.length);

          const verifyResult = await verifyLineHashedToken(hashedToken);
          if ('error' in verifyResult) {
            console.error('[OAuthCallbackPage] Failed to verify token:', verifyResult.error);
            // 如果驗證失敗（或驗證成功但沒有 session），嘗試打開 magic link（讓 Supabase 處理）
            devLog('[OAuthCallbackPage] Token verification failed, falling back to opening magic link');
            handleRedirectUrl(redirectUrl);
            return;
          }

          devLog('[OAuthCallbackPage] ✅ Token verified, session created');
          console.log('[OAuthCallbackPage] ✅ Confirmed: Supabase session is active');
          // Session 已設置，導航到首頁
          toast.success('登入成功');
          navigate('/home', { replace: true });
          return;
        } else {
          // 沒有 hashedToken 或不是 App 環境，使用 magic link
          console.log('[OAuthCallbackPage] No hashedToken or not native, using magic link');
          handleRedirectUrl(redirectUrl);
          return;
        }
      })();

      return;
    }
    
    const handleCallback = async () => {
      try {
        devLog('[OAuthCallbackPage] Processing OAuth callback');
        devLog('[OAuthCallbackPage] Current URL:', window.location.href);
        
        // 檢查是否為 magic link 驗證後的回調（URL hash 中包含 access_token 和 refresh_token）
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        const platform = urlParams.get('platform') || hashParams.get('platform'); // 從 URL 參數或 hash 中提取 platform
        const deepLink = urlParams.get('deep_link'); // 從 URL 參數中提取 deep_link（Edge Function 傳遞的）
        
        devLog('[OAuthCallbackPage] Hash parameters:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          type: type || 'none',
          platform: platform || 'none',
          deepLink: deepLink || 'none'
        });
        
        // 優先處理：如果有 deep_link 參數且是 magic link 回調，立即重定向到 Deep Link
        // 這確保了在外部瀏覽器中也能正確返回 APP
        if (deepLink && type === 'magiclink' && accessToken && refreshToken) {
          console.log('[OAuthCallbackPage] Deep link parameter detected, redirecting to Deep Link immediately');
          const deepLinkUrl = `${deepLink}#access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&type=magiclink`;
          devLog('[OAuthCallbackPage] Redirecting to Deep Link:', deepLinkUrl);
          window.location.href = deepLinkUrl;
          return;
        }
        
        // 如果是 magic link 驗證後的回調（type === 'magiclink'），手動設置 session
        if (type === 'magiclink' && accessToken && refreshToken) {
          console.log('[OAuthCallbackPage] Magic link callback detected, setting session manually');
          console.log('[OAuthCallbackPage] Is native:', isNative());
          console.log('[OAuthCallbackPage] Platform parameter:', platform);
          
          // 如果是外部瀏覽器，嘗試重定向到 Deep Link（因為 Supabase 重定向時可能丟失 platform 參數）
          // 這是一個合理的假設：如果用戶在外部瀏覽器中授權後重定向回前端，很可能是從 APP 發起的登入
          if (!isNative()) {
            // 檢查 user-agent 是否為移動設備
            const userAgent = navigator.userAgent || '';
            const isMobile = userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone');
            
            // 如果有 platform=app 參數，或者是移動設備，重定向到 Deep Link
            if (platform === 'app' || isMobile) {
              console.log('[OAuthCallbackPage] External browser (platform=app or mobile device) detected, redirecting to Deep Link');
              const deepLinkUrl = `votechaos://auth/callback#access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&type=magiclink`;
              devLog('[OAuthCallbackPage] Redirecting to Deep Link:', deepLinkUrl);
              
              // 嘗試重定向到 Deep Link
              // 如果應用已安裝，Android 系統會打開應用；否則，會顯示錯誤或忽略
              window.location.href = deepLinkUrl;
              return;
            }
          }
          
          // 如果是應用內訪問（isNative() 為 true），直接設置 session
          // 或者如果 platform 參數為 'app'（表示這是應用內登入的回調），也需要處理
          if (isNative() || platform === 'app') {
            console.log('[OAuthCallbackPage] App context detected (native or platform=app), setting session');
            
            // 如果是應用內訪問，直接設置 session
            console.log('[OAuthCallbackPage] Native app detected, setting session directly');
            try {
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              
              if (sessionError) {
                console.error('[OAuthCallbackPage] Error setting session:', sessionError);
                toast.error('登入失敗', {
                  description: sessionError.message
                });
                navigate('/auth', { replace: true });
                return;
              }
              
              if (sessionData.session && sessionData.session.user) {
                console.log('[OAuthCallbackPage] Session set successfully from magic link, user authenticated:', sessionData.session.user.email || sessionData.session.user.id);
                toast.success('登入成功！');
                
                // 清除 URL 中的 hash fragment
                window.history.replaceState({}, document.title, '/auth/callback');
                
                // 導航到首頁
                setTimeout(() => {
                  navigate('/home', { replace: true });
                }, 500);
                return;
              }
            } catch (setSessionError) {
              console.error('[OAuthCallbackPage] Exception setting session:', setSessionError);
              toast.error('處理登入時發生錯誤');
              navigate('/auth', { replace: true });
              return;
            }
          } else {
            // 如果是 Web 登入，直接設置 session
            console.log('[OAuthCallbackPage] Web context detected, setting session');
            try {
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              
              if (sessionError) {
                console.error('[OAuthCallbackPage] Error setting session:', sessionError);
                toast.error('登入失敗', {
                  description: sessionError.message
                });
                navigate('/auth', { replace: true });
                return;
              }
              
              if (sessionData.session && sessionData.session.user) {
                console.log('[OAuthCallbackPage] Session set successfully from magic link, user authenticated:', sessionData.session.user.email || sessionData.session.user.id);
                toast.success('登入成功！');
                
                // 清除 URL 中的 hash fragment
                window.history.replaceState({}, document.title, '/auth/callback');
                
                // 導航到首頁
                setTimeout(() => {
                  navigate('/home', { replace: true });
                }, 500);
                return;
              }
            } catch (setSessionError) {
              console.error('[OAuthCallbackPage] Exception setting session:', setSessionError);
              toast.error('處理登入時發生錯誤');
              navigate('/auth', { replace: true });
              return;
            }
          }
        }
        
        // 如果不是 magic link，Supabase 會自動處理 hash fragment 中的 access_token（適用於 Google、Apple、Discord 等內建 Provider）
        // 我們只需要等待 session 建立
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('[OAuthCallbackPage] Error getting session:', sessionError);
          toast.error('登入失敗', {
            description: sessionError.message
          });
          navigate('/auth', { replace: true });
          return;
        }

        if (session && session.user) {
          console.log('[OAuthCallbackPage] Session established, user authenticated:', session.user.email || session.user.id);
          toast.success('登入成功！');
          
          // 清除 URL 中的 hash fragment
          window.history.replaceState({}, document.title, '/auth/callback');
          
          // 導航到首頁
          setTimeout(() => {
            navigate('/home', { replace: true });
          }, 500);
        } else {
          console.warn('[OAuthCallbackPage] No session found after callback');
          toast.error('登入失敗，請重試');
          navigate('/auth', { replace: true });
        }
      } catch (error) {
        console.error('[OAuthCallbackPage] Error handling callback:', error);
        toast.error('處理登入回調時發生錯誤');
        navigate('/auth', { replace: true });
      }
    };

    // 延遲執行，確保 Supabase 有時間處理 hash fragment
    const timer = setTimeout(handleCallback, 100);
    
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background pt-[env(safe-area-inset-top,0px)]">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">正在處理登入...</p>
      </div>
    </div>
  );
};

export default OAuthCallbackPage;





