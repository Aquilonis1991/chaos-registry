import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isNative } from "@/lib/capacitor";
import { devLog } from "@/lib/devLog";
import { toast } from "sonner";
import { useUIText } from "@/hooks/useUIText";
import { waitForSessionAfterCodeAlreadyUsed } from "@/lib/auth/sessionRetryLadder";
import { exchangeLineCodeForSession, verifyLineHashedToken } from "@/lib/auth/lineEdgeAuth";

/**
 * OAuthCallbackHandler - 處理 OAuth 回調（Deep Link）
 * 當 App 透過 Deep Link 返回時，確保 Supabase 正確處理認證狀態
 */
export const OAuthCallbackHandler = () => {
  const navigate = useNavigate();
  const { getText } = useUIText();
  const [isProcessing, setIsProcessing] = useState(false);
  // 使用 ref 來追蹤已處理的回調，避免重複處理
  const processedCallbacksRef = useRef<Set<string>>(new Set());

  const toastLoginSuccess = () => toast.success(getText('auth.oauthCallback.loginSuccess', '登入成功'));
  const toastLoginFailedRetry = () =>
    toast.error(getText('auth.oauthCallback.loginFailed', '登入失敗'), {
      description: getText('auth.oauthCallback.retry', '請重新嘗試。')
    });
  const toastLoginFailedSessionCreate = () =>
    toast.error(getText('auth.oauthCallback.loginFailed', '登入失敗'), {
      description: getText('auth.oauthCallback.sessionCreateFailed', '無法建立登入狀態。請重新嘗試。')
    });
  const toastLoginFailedProcessing = () =>
    toast.error(getText('auth.oauthCallback.loginFailed', '登入失敗'), {
      description: getText('auth.oauthCallback.processingFailed', '處理登入時發生錯誤。請重新嘗試。')
    });
  const toastLoginFailedCodeAlreadyUsed = () =>
    toast.error(getText('auth.oauthCallback.loginFailed', '登入失敗'), {
      description: getText('auth.oauthCallback.codeAlreadyUsed', '授權碼已被使用。請重新嘗試登入。')
    });

  const navigateAfterAuth = (callbackUrl: string, params: Record<string, string>) => {
    const type = params.type || "";
    const isRecovery = type === "recovery" || callbackUrl.includes("type=recovery");
    if (isRecovery) {
      navigate("/auth/reset-password", { replace: true });
      return;
    }
    navigate("/home", { replace: true });
  };

  useEffect(() => {
    if (!isNative()) return;

    const handleOAuthCallback = async (event: CustomEvent<{ url: string; params?: Record<string, string> }>) => {
      devLog('[OAuthCallbackHandler] handleOAuthCallback called, isProcessing:', isProcessing);
      devLog('[OAuthCallbackHandler] Event detail:', JSON.stringify(event.detail));
      
      if (isProcessing) {
        console.log('[OAuthCallbackHandler] Already processing OAuth callback, ignoring duplicate');
        return;
      }

      setIsProcessing(true);
      const callbackUrl = event.detail.url;
      const params = event.detail.params || {};
      
      // ✅ 改進：生成回調唯一標識（優先使用 access_token，因為它是最終的登入結果）
      const callbackId = params.access_token 
        ? `token-${params.access_token.substring(0, 30)}-${params.refresh_token?.substring(0, 10) || 'none'}`
        : params.code && params.state 
          ? `code-${params.code.substring(0, 10)}-${params.state.substring(0, 10)}`
          : params.error 
            ? `error-${params.error}`
            : `url-${event.detail.url.substring(0, 50)}`;
      
      devLog('[OAuthCallbackHandler] Generated callbackId:', callbackId.substring(0, 50));
      
      // ✅ 關鍵修復：檢查是否已經處理過這個回調
      // 特殊情況：如果有 access_token，即使已處理過，也要檢查 session
      // 如果沒有 session，嘗試建立 session（可能是第一次處理失敗了）
      // ⚠️ 重要：即使使用舊的 callbackId（url- 開頭），只要有 access_token，也要檢查並建立 session
      if (processedCallbacksRef.current.has(callbackId)) {
        console.log('[OAuthCallbackHandler] Callback already processed, checking session status:', callbackId.substring(0, 50));
        
        // ✅ 關鍵修復：如果有 access_token，無論 callbackId 是什麼，都要檢查並嘗試建立 session
        // 這樣即使使用舊的 URL-based callbackId，也能正常處理
        if (params.access_token && params.refresh_token) {
          devLog('[OAuthCallbackHandler] Duplicate callback with tokens, checking if session exists');
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log('[OAuthCallbackHandler] ✅ Session exists, login was successful');
            toastLoginSuccess();
            setIsProcessing(false);
            navigateAfterAuth(callbackUrl, params);
            return;
          } else {
            console.log('[OAuthCallbackHandler] ⚠️ No session found, attempting to set session from duplicate callback');
            // 嘗試建立 session（可能是第一次處理時出錯）
            try {
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: params.access_token,
                refresh_token: params.refresh_token
              });
              
              if (sessionError) {
                console.error('[OAuthCallbackHandler] Failed to set session from duplicate callback:', sessionError);
                toastLoginFailedSessionCreate();
                setIsProcessing(false);
                navigate('/auth', { replace: true });
                return;
              } else if (sessionData.session) {
                console.log('[OAuthCallbackHandler] ✅ Session established from duplicate callback');
                toastLoginSuccess();
                setIsProcessing(false);
                navigateAfterAuth(callbackUrl, params);
                return;
              } else {
                console.error('[OAuthCallbackHandler] ⚠️ setSession returned but no session data');
                toastLoginFailedSessionCreate();
                setIsProcessing(false);
                navigate('/auth', { replace: true });
                return;
              }
            } catch (err) {
              console.error('[OAuthCallbackHandler] Exception setting session from duplicate callback:', err);
              toastLoginFailedProcessing();
              setIsProcessing(false);
              navigate('/auth', { replace: true });
              return;
            }
          }
        }
        
        // ✅ 關鍵修復：如果是 code_already_used 錯誤，積極處理
        // code_already_used 通常意味著第一次請求已經成功，但可能由於處理中斷導致 session 未保存
        // 我們需要更積極地檢查和重試
        if (params.error === 'code_already_used') {
          console.log('[OAuthCallbackHandler] code_already_used error detected on duplicate callback, checking if user is already logged in');

          const recoveredSession = await waitForSessionAfterCodeAlreadyUsed();
          if (recoveredSession) {
            console.log('[OAuthCallbackHandler] ✅ Session recovered, login was successful despite duplicate callback');
            toastLoginSuccess();
            setIsProcessing(false);
            navigateAfterAuth(callbackUrl, params);
            return;
          }

          // ✅ 關鍵修復：code_already_used 通常意味著授權碼已經被使用
          // 但這可能是因為：
          // 1. 第一次請求已經成功，但 session 沒有被保存（可能是因為應用重啟）
          // 2. 或者授權碼確實被重複使用了
          // 在這種情況下，我們應該清除已處理標記，允許用戶重新嘗試登入
          console.log('[OAuthCallbackHandler] ⚠️ All recovery attempts failed, clearing processed flag to allow retry');
          processedCallbacksRef.current.delete(callbackId);
          console.log('[OAuthCallbackHandler] Processed flag cleared, user can retry login');

          // ✅ 顯示友好的錯誤訊息，並允許用戶重試
          toastLoginFailedCodeAlreadyUsed();
          setIsProcessing(false);
          // 不導航到 /auth，讓用戶可以立即重試
          return;
        }
        
        // ⚠️ 重要：即使沒有 access_token，也要檢查是否有 URL 中包含 access_token（舊版邏輯）
        // 檢查 URL 的 hash fragment 是否包含 access_token
        if (callbackUrl.includes('#access_token=')) {
          devLog('[OAuthCallbackHandler] ⚠️ Old callbackId format detected, but URL contains access_token');
          // 即使 callbackId 是舊格式，只要 URL 中有 access_token，就應該處理
          // 但由於已經被標記為已處理，我們需要檢查 session
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            console.log('[OAuthCallbackHandler] ⚠️ No session found for old callbackId format, attempting recovery');
            // 嘗試從 URL 解析 access_token 並建立 session
            try {
              const hashMatch = callbackUrl.match(/#access_token=([^&]+)/);
              const refreshMatch = callbackUrl.match(/refresh_token=([^&]+)/);
              if (hashMatch && refreshMatch) {
                const accessToken = decodeURIComponent(hashMatch[1]);
                const refreshToken = decodeURIComponent(refreshMatch[1]);
                const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken
                });
                if (sessionData.session) {
                  console.log('[OAuthCallbackHandler] ✅ Session established from old callbackId format');
                  toastLoginSuccess();
                  setIsProcessing(false);
                  navigateAfterAuth(callbackUrl, params);
                  return;
                }
              }
            } catch (err) {
              console.error('[OAuthCallbackHandler] Exception recovering from old callbackId:', err);
            }
          } else {
            console.log('[OAuthCallbackHandler] ✅ Session exists for old callbackId format');
            toastLoginSuccess();
            setIsProcessing(false);
            navigateAfterAuth(callbackUrl, params);
            return;
          }
        }
        
        // 其他情況，直接返回
        console.log('[OAuthCallbackHandler] Duplicate callback without tokens or error, ignoring');
        setIsProcessing(false);
        return;
      }
      
      // 標記為已處理
      processedCallbacksRef.current.add(callbackId);
      console.log('[OAuthCallbackHandler] Marking callback as processed:', callbackId);
      
      devLog('[OAuthCallbackHandler] Processing OAuth callback:', callbackUrl);
      devLog('[OAuthCallbackHandler] Callback parameters:', JSON.stringify(params));
      devLog('[OAuthCallbackHandler] Has access_token:', !!params.access_token);
      devLog('[OAuthCallbackHandler] Has refresh_token:', !!params.refresh_token);
      devLog('[OAuthCallbackHandler] Has error:', !!params.error);

      try {
        // 如果有錯誤參數，顯示錯誤訊息
        if (params.error) {
          console.error('[OAuthCallbackHandler] OAuth error:', params.error, params.error_description);
          
          // ✅ 特殊處理：如果是 code_already_used，可能是重複請求
          // 在這種情況下，第一個請求可能已經成功，檢查是否已經登入
          if (params.error === 'code_already_used') {
            console.log('[OAuthCallbackHandler] code_already_used error detected, checking if user is already logged in');

            const recoveredSession = await waitForSessionAfterCodeAlreadyUsed();
            if (recoveredSession) {
              console.log('[OAuthCallbackHandler] ✅ Session recovered, login was successful despite error');
              toastLoginSuccess();
              setIsProcessing(false);
              navigateAfterAuth(callbackUrl, params);
              return;
            }

            // ✅ 所有恢復嘗試都失敗，顯示錯誤訊息
            console.log('[OAuthCallbackHandler] ⚠️ No session found after all attempts');

            // ✅ 清除已處理的 callback，允許用戶重新嘗試
            processedCallbacksRef.current.delete(callbackId);
            console.log('[OAuthCallbackHandler] Cleared callback from processed list to allow retry:', callbackId.substring(0, 50));

            toastLoginFailedCodeAlreadyUsed();
          } else {
            toast.error(getText('auth.oauthCallback.loginFailed', '登入失敗'), {
              description: params.error_description || params.error
            });
          }
          
          setIsProcessing(false);
          // ✅ 修復：即使對於 code_already_used，也導航回 /auth
          // 這樣可以確保 WebView 從 LINE 授權頁面返回到應用的登入頁面
          // 用戶可以在應用內看到錯誤訊息並重新嘗試
          console.log('[OAuthCallbackHandler] Navigating back to /auth to show error message');
          navigate('/auth', { replace: true });
          return;
        }

        // 修復：處理 Edge Function 回調（code 和 state 參數，需要調用 Edge Function 獲取 tokens）
        // 如果只有 code 和 state，沒有 access_token，需要先調用 Edge Function
        // 注意：Twitter 現在使用 Supabase 內建 Provider，不需要 Edge Function
        const code = params.code;
        const state = params.state;
        const provider = params.provider || 'line';
        
        // 只對 LINE 使用 Edge Function，Twitter 使用 Supabase 內建流程
        if (code && state && !params.access_token && !params.refresh_token && provider === 'line') {
          devLog('[OAuthCallbackHandler] Code and state found for LINE, calling Edge Function to exchange tokens');

          const exchangeResult = await exchangeLineCodeForSession({ code, state, error: params.error });

          if (exchangeResult.kind === 'error') {
            console.error('[OAuthCallbackHandler] LINE exchange error:', exchangeResult.message);
            toast.error(getText('auth.oauthCallback.loginFailed', '登入失敗'), {
              description: exchangeResult.message
            });
            setIsProcessing(false);
            navigate('/auth', { replace: true });
            return;
          }

          if (exchangeResult.kind === 'redirect') {
            // OAuthCallbackHandler 原本不處理 3xx redirect 分支，維持與過去相同的
            // 通用錯誤處理（等同於當年 !response.ok 落到的 else 分支）
            console.error('[OAuthCallbackHandler] Edge Function returned redirect (unhandled here):', exchangeResult.status, exchangeResult.location);
            const edgeErrorTemplate = getText('auth.oauthCallback.edgeErrorTemplate', 'Edge Function 錯誤：{{status}}');
            toast.error(getText('auth.oauthCallback.loginFailed', '登入失敗'), {
              description: edgeErrorTemplate.replace('{{status}}', String(exchangeResult.status))
            });
            setIsProcessing(false);
            navigate('/auth', { replace: true });
            return;
          }

          const { redirectUrl, hashedToken } = exchangeResult;
          devLog('[OAuthCallbackHandler] Edge Function returned redirectUrl:', redirectUrl.substring(0, 100) + '...');
          devLog('[OAuthCallbackHandler] Edge Function returned hashedToken:', !!hashedToken, hashedToken ? `length: ${hashedToken.length}` : 'missing');

          // Edge Function 返回 magic link 或 Deep Link
          // 如果是 Deep Link，直接觸發 appUrlOpen 事件
          if (redirectUrl.startsWith('votechaos://')) {
            console.log('[OAuthCallbackHandler] Edge Function returned Deep Link, triggering appUrlOpen event');
            // 解析 Deep Link 參數
            const deepLinkUrl = new URL(redirectUrl);
            const deepLinkParams: Record<string, string> = {};
            deepLinkUrl.searchParams.forEach((v, k) => {
              deepLinkParams[k] = v;
            });

            // 如果有 hash fragment，也解析
            const hash = deepLinkUrl.hash?.startsWith('#') ? deepLinkUrl.hash.slice(1) : '';
            if (hash) {
              const hashParams = new URLSearchParams(hash);
              hashParams.forEach((v, k) => {
                deepLinkParams[k] = v;
              });
            }

            // 派發 oauth-callback 事件（遞迴處理，這次會有 tokens）
            window.dispatchEvent(new CustomEvent('oauth-callback', {
              detail: { url: redirectUrl, params: deepLinkParams }
            }));
            return;
          }

          // 如果是 magic link，在 App 環境中可以直接使用 hashed_token 驗證
          console.log('[OAuthCallbackHandler] Edge Function returned magic link');
          console.log('[OAuthCallbackHandler] Response data:', {
            hasRedirectUrl: !!redirectUrl,
            hasHashedToken: !!hashedToken,
            isNative: isNative(),
            redirectUrl: redirectUrl.substring(0, 100) + '...'
          });

          if (isNative() && hashedToken) {
            // 在 App 環境中，使用 hashed_token 直接驗證並創建 session
            devLog('[OAuthCallbackHandler] Native app detected, verifying token directly with hashed_token');
            devLog('[OAuthCallbackHandler] Hashed token length:', hashedToken.length);

            const verifyResult = await verifyLineHashedToken(hashedToken);
            if ('error' in verifyResult) {
              console.error('[OAuthCallbackHandler] Failed to verify token:', verifyResult.error);
              // 如果驗證失敗（或驗證成功但沒有 session），嘗試打開 magic link（讓 Supabase 處理）
              devLog('[OAuthCallbackHandler] Token verification failed, falling back to opening magic link');
              window.location.href = redirectUrl;
              return;
            }

            devLog('[OAuthCallbackHandler] ✅ Token verified, session created');
            console.log('[OAuthCallbackHandler] ✅ Confirmed: Supabase session is active');
            // Session 已設置，依流程導向（recovery 則進重設密碼）
            setIsProcessing(false);
            navigateAfterAuth(callbackUrl, params);
            return;
          } else {
            // 沒有 hashed_token 或不是 App 環境，使用 magic link
            if (isNative()) {
              console.log('[OAuthCallbackHandler] Native app detected but no hashedToken, opening magic link for verification');
              console.log('[OAuthCallbackHandler] Missing hashedToken reason:', {
                isNative: isNative(),
                hasHashedToken: !!hashedToken
              });
              window.location.href = redirectUrl;
            } else {
              console.log('[OAuthCallbackHandler] Web environment, navigating to OAuthCallbackPage');
              navigate('/auth/callback', { state: { redirectUrl } });
            }
            return;
          }
        }
        
        // 手動設置 Supabase session（因為 Deep Link 使用 hash fragment，Supabase 不會自動處理）
        if (params.access_token && params.refresh_token) {
          devLog('[OAuthCallbackHandler] Setting session from OAuth callback tokens');
          
          try {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: params.access_token,
              refresh_token: params.refresh_token
            });

            if (sessionError) {
              console.error('[OAuthCallbackHandler] Error setting session:', sessionError);
              toast.error(getText('auth.oauthCallback.authProcessFailed', '認證處理失敗'), {
                description: sessionError.message
              });
              setIsProcessing(false);
              navigate('/auth', { replace: true });
              return;
            }

            if (sessionData.session && sessionData.session.user) {
              console.log('[OAuthCallbackHandler] Session set successfully, user authenticated:', sessionData.session.user.email || sessionData.session.user.id);
              toast.success(getText('auth.oauthCallback.loginSuccessExclamation', '登入成功！'));
              
              // 認證成功，依流程導向（recovery 則進重設密碼）
              setTimeout(() => {
                navigateAfterAuth(callbackUrl, params);
                setIsProcessing(false);
              }, 300);
              return;
            }
          } catch (setSessionError) {
            console.error('[OAuthCallbackHandler] Exception setting session:', setSessionError);
            toast.error(getText('auth.oauthCallback.authProcessError', '處理認證時發生錯誤'));
            setIsProcessing(false);
            navigate('/auth', { replace: true });
            return;
          }
        } else if (!code || !state) {
          // 如果沒有 token 也沒有 code/state，嘗試檢查現有 session（後備方案）
          console.log('[OAuthCallbackHandler] No tokens and no code/state, checking existing session...');
          
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('[OAuthCallbackHandler] Error getting session:', error);
            toast.error(getText('auth.oauthCallback.authProcessFailedRetry', '認證處理失敗，請重試'));
            setIsProcessing(false);
            navigate('/auth', { replace: true });
            return;
          }

          if (session && session.user) {
            console.log('[OAuthCallbackHandler] Existing session found, user authenticated:', session.user.email || session.user.id);
            toast.success(getText('auth.oauthCallback.loginSuccessExclamation', '登入成功！'));
            
            setTimeout(() => {
              navigateAfterAuth(callbackUrl, params);
              setIsProcessing(false);
            }, 300);
            return;
          }

          // 如果沒有 session 也沒有 token，顯示錯誤
          console.warn('[OAuthCallbackHandler] No tokens and no existing session');
          toast.error(getText('auth.oauthCallback.authProcessFailedRetry', '認證處理失敗，請重試'));
          setIsProcessing(false);
          navigate('/auth', { replace: true });
        }
      } catch (error) {
        console.error('[OAuthCallbackHandler] Error handling OAuth callback:', error);
        toast.error(getText('auth.oauthCallback.handleCallbackError', '處理登入回調時發生錯誤'));
        setIsProcessing(false);
        navigate('/auth', { replace: true });
      }
    };

    const handleOAuthError = (event: CustomEvent<{ error: string; error_description?: string }>) => {
      console.error('[OAuthCallbackHandler] OAuth error event:', event.detail);
      toast.error(getText('auth.oauthCallback.loginFailed', '登入失敗'), {
        description: event.detail.error_description || event.detail.error
      });
      setIsProcessing(false);
      navigate('/auth', { replace: true });
    };

    // 監聽自定義 OAuth 回調事件
    window.addEventListener('oauth-callback', handleOAuthCallback as EventListener);
    window.addEventListener('oauth-error', handleOAuthError as EventListener);

    return () => {
      window.removeEventListener('oauth-callback', handleOAuthCallback as EventListener);
      window.removeEventListener('oauth-error', handleOAuthError as EventListener);
    };
  }, [navigate, isProcessing]);

  // 這個組件不渲染任何內容
  return null;
};

