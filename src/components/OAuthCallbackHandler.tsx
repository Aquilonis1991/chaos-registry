import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isNative } from "@/lib/capacitor";
import { toast } from "sonner";

/**
 * OAuthCallbackHandler - 處理 OAuth 回調（Deep Link）
 * 當 App 透過 Deep Link 返回時，確保 Supabase 正確處理認證狀態
 */
export const OAuthCallbackHandler = () => {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isNative()) return;

    const handleOAuthCallback = async (event: CustomEvent<{ url: string; params?: Record<string, string> }>) => {
      if (isProcessing) {
        console.log('[OAuthCallbackHandler] Already processing OAuth callback, ignoring duplicate');
        return;
      }

      setIsProcessing(true);
      const callbackUrl = event.detail.url;
      const params = event.detail.params || {};
      
      console.log('[OAuthCallbackHandler] Processing OAuth callback:', callbackUrl);
      console.log('[OAuthCallbackHandler] Callback parameters:', params);

      try {
        // 如果有錯誤參數，顯示錯誤訊息
        if (params.error) {
          console.error('[OAuthCallbackHandler] OAuth error:', params.error, params.error_description);
          toast.error('登入失敗', {
            description: params.error_description || params.error
          });
          setIsProcessing(false);
          navigate('/auth', { replace: true });
          return;
        }

        // 手動設置 Supabase session（因為 Deep Link 使用 hash fragment，Supabase 不會自動處理）
        if (params.access_token && params.refresh_token) {
          console.log('[OAuthCallbackHandler] Setting session from OAuth callback tokens');
          
          try {
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: params.access_token,
              refresh_token: params.refresh_token
            });

            if (sessionError) {
              console.error('[OAuthCallbackHandler] Error setting session:', sessionError);
              toast.error('認證處理失敗', {
                description: sessionError.message
              });
              setIsProcessing(false);
              navigate('/auth', { replace: true });
              return;
            }

            if (sessionData.session && sessionData.session.user) {
              console.log('[OAuthCallbackHandler] Session set successfully, user authenticated:', sessionData.session.user.email || sessionData.session.user.id);
              toast.success('登入成功！');
              
              // 認證成功，導航到首頁
              setTimeout(() => {
                navigate('/home', { replace: true });
                setIsProcessing(false);
              }, 300);
              return;
            }
          } catch (setSessionError) {
            console.error('[OAuthCallbackHandler] Exception setting session:', setSessionError);
            toast.error('處理認證時發生錯誤');
            setIsProcessing(false);
            navigate('/auth', { replace: true });
            return;
          }
        } else {
          // 如果沒有 token，嘗試檢查現有 session（後備方案）
          console.log('[OAuthCallbackHandler] No tokens in callback, checking existing session...');
          
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('[OAuthCallbackHandler] Error getting session:', error);
            toast.error('認證處理失敗，請重試');
            setIsProcessing(false);
            navigate('/auth', { replace: true });
            return;
          }

          if (session && session.user) {
            console.log('[OAuthCallbackHandler] Existing session found, user authenticated:', session.user.email || session.user.id);
            toast.success('登入成功！');
            
            setTimeout(() => {
              navigate('/home', { replace: true });
              setIsProcessing(false);
            }, 300);
            return;
          }

          // 如果沒有 session 也沒有 token，顯示錯誤
          console.warn('[OAuthCallbackHandler] No tokens and no existing session');
          toast.error('認證處理失敗，請重試');
          setIsProcessing(false);
          navigate('/auth', { replace: true });
        }
      } catch (error) {
        console.error('[OAuthCallbackHandler] Error handling OAuth callback:', error);
        toast.error('處理登入回調時發生錯誤');
        setIsProcessing(false);
        navigate('/auth', { replace: true });
      }
    };

    const handleOAuthError = (event: CustomEvent<{ error: string; error_description?: string }>) => {
      console.error('[OAuthCallbackHandler] OAuth error event:', event.detail);
      toast.error('登入失敗', {
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

