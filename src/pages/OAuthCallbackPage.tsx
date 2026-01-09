import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * OAuthCallbackPage - 處理 Web URL OAuth 回調
 * Supabase 會在回調 URL 的 hash fragment 中包含 access_token 等資訊
 * 這個頁面會讓 Supabase 自動處理這些資訊
 * 
 * 特殊處理：LINE Provider 使用 Edge Function，需要轉發回調
 */
export const OAuthCallbackPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // 同步檢查並立即轉發（在 Supabase 處理之前）
    // 這必須在 React 渲染之前就執行，所以放在 useEffect 的最開始
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const code = urlParams.get('code') || hashParams.get('code');
    const state = urlParams.get('state') || hashParams.get('state');
    const error = urlParams.get('error') || hashParams.get('error');
    const provider = urlParams.get('provider') || hashParams.get('provider');
    
    // 如果有 code 和 state，且沒有 Supabase 的 access_token，立即轉發到 Edge Function
    // 這必須在 Supabase 處理之前就執行，所以使用同步方式
    if (code && state && !hashParams.get('access_token') && !urlParams.get('access_token')) {
      // 判斷是 LINE 還是 X (Twitter)
      // 如果 state 是 JWT 格式（X/Twitter），或者沒有明確的 provider 標記，優先判斷為 X (Twitter)
      const isTwitter = provider === 'twitter' || (!provider && state.includes('.'));
      const functionName = isTwitter ? 'twitter-auth' : 'line-auth';
      
      // 對於 LINE，使用 fetch 調用 Edge Function（因為直接重定向會被 Supabase 路由層級攔截）
      if (functionName === 'line-auth') {
        console.log('[OAuthCallbackPage] LINE callback detected, calling Edge Function via fetch');
        
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://epyykzxxglkjombvozhr.supabase.co';
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        
        // 使用 POST 請求調用 Edge Function 的回調處理邏輯
        // 構建 Edge Function URL（使用 POST 到根路徑，避免 GET 被攔截）
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/${functionName}/callback`;
        
        // 使用 fetch 調用 Edge Function
        fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey || '',
            'Authorization': `Bearer ${supabaseAnonKey || ''}`,
          },
          body: JSON.stringify({
            code,
            state,
            error: error || null,
          }),
        })
        .then(async (response) => {
          if (response.status >= 300 && response.status < 400) {
            // 重定向響應（Edge Function 返回 magic link）
            const redirectUrl = response.headers.get('location');
            if (redirectUrl) {
              console.log('[OAuthCallbackPage] Edge Function returned redirect:', redirectUrl);
              window.location.href = redirectUrl;
              return;
            }
          } else if (response.ok) {
            const data = await response.json().catch(() => null);
            if (data?.redirectUrl) {
              window.location.href = data.redirectUrl;
              return;
            }
          }
          throw new Error(`Edge Function error: ${response.status}`);
        })
        .catch((err) => {
          console.error('[OAuthCallbackPage] Error calling Edge Function:', err);
          toast.error('登入失敗', {
            description: '無法處理登入回調'
          });
          navigate('/auth', { replace: true });
        });
        
        return;
      } else {
        // 對於 X (Twitter)，使用 fetch POST 請求調用 Edge Function（避免 401 錯誤）
        console.log('[OAuthCallbackPage] X (Twitter) callback detected, calling Edge Function via fetch');
        
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://epyykzxxglkjombvozhr.supabase.co';
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        
        // 使用 POST 請求調用 Edge Function 的回調處理邏輯
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/${functionName}/callback`;
        
        // 使用 fetch 調用 Edge Function
        fetch(edgeFunctionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey || '',
            'Authorization': `Bearer ${supabaseAnonKey || ''}`,
          },
          body: JSON.stringify({
            code,
            state,
            error: error || null,
          }),
        })
        .then(async (response) => {
          if (response.status >= 300 && response.status < 400) {
            // 重定向響應（Edge Function 返回 magic link）
            const redirectUrl = response.headers.get('location');
            if (redirectUrl) {
              console.log('[OAuthCallbackPage] Edge Function returned redirect:', redirectUrl);
              window.location.href = redirectUrl;
              return;
            }
          } else if (response.ok) {
            const data = await response.json().catch(() => null);
            if (data?.redirectUrl) {
              window.location.href = data.redirectUrl;
              return;
            }
          }
          throw new Error(`Edge Function error: ${response.status}`);
        })
        .catch((err) => {
          console.error('[OAuthCallbackPage] Error calling Edge Function:', err);
          toast.error('登入失敗', {
            description: '無法處理登入回調'
          });
          navigate('/auth', { replace: true });
        });
        
        return;
      }
    }
    
    const handleCallback = async () => {
      try {
        console.log('[OAuthCallbackPage] Processing OAuth callback');
        console.log('[OAuthCallbackPage] Current URL:', window.location.href);
        
        
        // Supabase 會自動處理 hash fragment 中的 access_token（適用於 Google、Apple、Discord 等內建 Provider）
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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">正在處理登入...</p>
      </div>
    </div>
  );
};

export default OAuthCallbackPage;





