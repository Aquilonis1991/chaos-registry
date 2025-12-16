import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * OAuthCallbackPage - 處理 Web URL OAuth 回調
 * Supabase 會在回調 URL 的 hash fragment 中包含 access_token 等資訊
 * 這個頁面會讓 Supabase 自動處理這些資訊
 */
export const OAuthCallbackPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[OAuthCallbackPage] Processing OAuth callback');
        console.log('[OAuthCallbackPage] Current URL:', window.location.href);
        
        // Supabase 會自動處理 hash fragment 中的 access_token
        // 我們只需要等待 session 建立
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[OAuthCallbackPage] Error getting session:', error);
          toast.error('登入失敗', {
            description: error.message
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



