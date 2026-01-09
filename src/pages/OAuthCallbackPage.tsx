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
 * 特殊處理：X (Twitter) Provider 使用 Edge Function，需要轉發回調
 */
export const OAuthCallbackPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[OAuthCallbackPage] Processing OAuth callback');
        console.log('[OAuthCallbackPage] Current URL:', window.location.href);
        
        // 檢查是否為 LINE 或 X (Twitter) Provider 的回調（兩者都使用 Edge Function）
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        // 檢查 URL 參數或 hash 參數中是否有 OAuth code 和 state（Edge Function Provider 的標記）
        const code = urlParams.get('code') || hashParams.get('code');
        const state = urlParams.get('state') || hashParams.get('state');
        const error = urlParams.get('error') || hashParams.get('error');
        const provider = urlParams.get('provider') || hashParams.get('provider');
        
        // 如果檢測到 OAuth code 和 state，且沒有 Supabase 的 access_token，可能是 Edge Function Provider
        // 或者如果 URL 中包含 provider=line 或 provider=twitter 或 error 參數，也可能是 Edge Function Provider
        if ((code && state && !hashParams.get('access_token')) || provider === 'line' || provider === 'twitter' || (error && code && state)) {
          // 判斷是 LINE 還是 X (Twitter)
          const isTwitter = provider === 'twitter' || (code && state && !hashParams.get('access_token') && !provider);
          const functionName = isTwitter ? 'twitter-auth' : 'line-auth';
          const providerName = isTwitter ? 'X (Twitter)' : 'LINE';
          
          console.log(`[OAuthCallbackPage] Detected ${providerName} OAuth callback, calling Edge Function`);
          
          // 使用 fetch 調用 Edge Function，避免 Supabase 路由層級的授權檢查
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          if (!supabaseUrl) {
            toast.error('登入失敗', {
              description: '缺少 VITE_SUPABASE_URL'
            });
            navigate('/auth', { replace: true });
            return;
          }
          
          // 構建 Edge Function 回調 URL
          const edgeFunctionUrl = new URL(`${supabaseUrl}/functions/v1/${functionName}/callback`);
          if (code) edgeFunctionUrl.searchParams.set('code', code);
          if (state) edgeFunctionUrl.searchParams.set('state', state);
          if (error) edgeFunctionUrl.searchParams.set('error', error);
          
          console.log('[OAuthCallbackPage] Calling Edge Function:', edgeFunctionUrl.toString());
          
          try {
            // 使用 fetch 調用 Edge Function
            // 添加 Supabase anon key 作為 apikey 和 Authorization header，以通過 Supabase 路由層級的檢查
            const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
            
            // Edge Function 使用 Deno.serve，應該可以處理無授權的請求
            // 注意：Edge Function 會返回重定向響應（magic link），我們需要讓瀏覽器跟隨重定向
            const response = await fetch(edgeFunctionUrl.toString(), {
              method: 'GET',
              headers: {
                'apikey': supabaseAnonKey || '',
                'Authorization': `Bearer ${supabaseAnonKey || ''}`,
                'Content-Type': 'application/json',
              },
              redirect: 'manual', // 手動處理重定向，因為我們需要瀏覽器實際訪問 magic link
            });
            
            // 檢查響應狀態
            if (response.status >= 300 && response.status < 400) {
              // 重定向響應（Edge Function 返回 magic link）
              const redirectUrl = response.headers.get('location');
              if (redirectUrl) {
                console.log('[OAuthCallbackPage] Edge Function returned redirect:', redirectUrl);
                // 讓瀏覽器訪問 magic link，Supabase 會驗證 token 並重定向到前端
                window.location.href = redirectUrl;
                return;
              }
            } else if (response.ok) {
              // 如果返回成功，檢查是否有重定向 URL
              const data = await response.json().catch(() => null);
              if (data?.redirectUrl) {
                window.location.href = data.redirectUrl;
                return;
              }
            } else {
              // 錯誤響應
              const errorText = await response.text().catch(() => 'Unknown error');
              console.error('[OAuthCallbackPage] Edge Function returned error:', response.status, errorText);
              throw new Error(`Edge Function error: ${response.status} ${errorText}`);
            }
          } catch (fetchError) {
            console.error('[OAuthCallbackPage] Error calling Edge Function:', fetchError);
            // 如果 fetch 失敗（可能是 CORS 或網絡問題），嘗試直接重定向（備用方案）
            // 這會讓瀏覽器直接訪問 Edge Function，Edge Function 會處理重定向
            console.log('[OAuthCallbackPage] Fallback: redirecting directly to Edge Function');
            window.location.href = edgeFunctionUrl.toString();
            return;
          }
          
          // 如果所有方法都失敗
          toast.error('登入失敗', {
            description: '無法處理登入回調'
          });
          navigate('/auth', { replace: true });
          return;
        }
        
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





