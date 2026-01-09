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
        
        // 檢查是否為 X (Twitter) Provider 的回調
        // X Developer Portal 強制使用標準回調 URL，但 Supabase 不支援 X Provider
        // 所以需要轉發到 Edge Function
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        // 檢查 URL 參數或 hash 參數中是否有 OAuth code 和 state（X Provider 的標記）
        const code = urlParams.get('code') || hashParams.get('code');
        const state = urlParams.get('state') || hashParams.get('state');
        const error = urlParams.get('error') || hashParams.get('error');
        const provider = urlParams.get('provider') || hashParams.get('provider');
        
        // 如果檢測到 OAuth code 和 state，且沒有 Supabase 的 access_token，可能是 X Provider
        // 或者如果 URL 中包含 provider=twitter 或 error 參數，也可能是 X Provider
        if ((code && state && !hashParams.get('access_token')) || provider === 'twitter' || (error && code && state)) {
          console.log('[OAuthCallbackPage] Detected X (Twitter) OAuth callback, forwarding to Edge Function');
          
          // 轉發到 Edge Function
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          if (!supabaseUrl) {
            toast.error('登入失敗', {
              description: '缺少 VITE_SUPABASE_URL'
            });
            navigate('/auth', { replace: true });
            return;
          }
          
          // 構建 Edge Function 回調 URL
          const edgeFunctionUrl = new URL(`${supabaseUrl}/functions/v1/twitter-auth/callback`);
          if (code) edgeFunctionUrl.searchParams.set('code', code);
          if (state) edgeFunctionUrl.searchParams.set('state', state);
          if (error) edgeFunctionUrl.searchParams.set('error', error);
          
          console.log('[OAuthCallbackPage] Forwarding to Edge Function:', edgeFunctionUrl.toString());
          
          // 轉發到 Edge Function
          window.location.href = edgeFunctionUrl.toString();
          return;
        }
        
        // Supabase 會自動處理 hash fragment 中的 access_token
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





