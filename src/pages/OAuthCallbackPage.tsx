import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { isNative } from '@/lib/capacitor';

/**
 * OAuthCallbackPage - 處理 Web URL OAuth 回調
 * Supabase 會在回調 URL 的 hash fragment 中包含 access_token 等資訊
 * 這個頁面會讓 Supabase 自動處理這些資訊
 */
export const OAuthCallbackPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // 0. Initial Log
    console.log('[OAuthCallbackPage] Mounted');

    const handleCallback = async () => {
      // 處理 Supabase Session
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        navigate('/home', { replace: true });
      } else {
        // 如果沒有 Session，可能是登入失敗或還需要時間，這裡簡單處理
        // 在沒有 Bridge 的情況下，我們只能依賴 Supabase 的自動處理
        const { error } = await supabase.auth.getSession();
        if (error) {
          console.error('Auth Session Error:', error);
        }
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
};

export default OAuthCallbackPage;
