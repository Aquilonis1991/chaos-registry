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
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://epyykzxxglkjombvozhr.supabase.co';
      const edgeFunctionUrl = new URL(`${supabaseUrl}/functions/v1/${functionName}/callback`);
      edgeFunctionUrl.searchParams.set('code', code);
      edgeFunctionUrl.searchParams.set('state', state);
      if (error) edgeFunctionUrl.searchParams.set('error', error);
      
      console.log('[OAuthCallbackPage] Immediate redirect to Edge Function:', edgeFunctionUrl.toString());
      
      // 立即重定向，避免 Supabase 處理
      window.location.replace(edgeFunctionUrl.toString());
      return;
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





