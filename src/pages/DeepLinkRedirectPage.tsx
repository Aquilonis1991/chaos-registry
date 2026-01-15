import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isNative } from '@/lib/capacitor';

/**
 * DeepLinkRedirectPage - 中間重定向頁面
 * 當 Supabase 驗證 magic link 後重定向到這個頁面時，立即重定向到 Deep Link
 * 這樣可以確保 Deep Link 被正確觸發，APP 會被打開
 */
export const DeepLinkRedirectPage = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // 從 URL hash 中提取 access_token 和 refresh_token
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    const type = hashParams.get('type');

    console.log('[DeepLinkRedirectPage] Processing redirect to Deep Link');
    console.log('[DeepLinkRedirectPage] Hash:', hash);
    console.log('[DeepLinkRedirectPage] Has access_token:', !!accessToken);
    console.log('[DeepLinkRedirectPage] Has refresh_token:', !!refreshToken);
    console.log('[DeepLinkRedirectPage] Type:', type);

    // 如果是 magic link 回調，構建 Deep Link URL
    if (type === 'magiclink' && accessToken && refreshToken) {
      const deepLinkUrl = `votechaos://auth/callback#access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&type=magiclink`;
      console.log('[DeepLinkRedirectPage] Redirecting to Deep Link:', deepLinkUrl);
      console.log('[DeepLinkRedirectPage] User agent:', navigator.userAgent);
      console.log('[DeepLinkRedirectPage] Is native:', isNative());

      // 立即重定向到 Deep Link
      // 使用多種方法確保 Deep Link 被觸發
      try {
        // 方法 1：使用 window.location.href（標準方法）
        console.log('[DeepLinkRedirectPage] Attempting redirect via window.location.href');
        window.location.href = deepLinkUrl;

        // 方法 2：如果方法 1 失敗，使用 window.location.replace（備用方法）
        setTimeout(() => {
          console.log('[DeepLinkRedirectPage] Fallback: Using window.location.replace');
          window.location.replace(deepLinkUrl);
        }, 100);

        // 方法 3：如果方法 2 也失敗，使用 window.open（最後備用方法）
        setTimeout(() => {
          console.log('[DeepLinkRedirectPage] Fallback: Using window.open');
          window.open(deepLinkUrl, '_self');
        }, 200);
      } catch (error) {
        console.error('[DeepLinkRedirectPage] Error redirecting to Deep Link:', error);
        // 如果所有方法都失敗，顯示錯誤訊息
        alert('無法打開應用，請手動打開應用');
      }
    } else {
      // 如果沒有 tokens，重定向到登入頁面
      console.warn('[DeepLinkRedirectPage] No tokens found, redirecting to auth page');
      console.warn('[DeepLinkRedirectPage] Hash:', hash);
      console.warn('[DeepLinkRedirectPage] Type:', type);
      window.location.href = '/auth';
    }
  }, [searchParams]);

  // 顯示載入中訊息
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column',
      gap: '1.5rem',
      padding: '20px',
      textAlign: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #3b82f6',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }}></div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>

      <div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 8px 0' }}>正在處理登入...</h2>
        <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>如果應用沒有自動打開，請點擊下方按鈕</p>
      </div>

      <button
        onClick={() => {
          const hash = window.location.hash.substring(1);
          const hashParams = new URLSearchParams(hash);
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken && refreshToken) {
            const url = `votechaos://auth/callback#access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}&type=magiclink`;
            window.location.href = url;
          } else {
            window.location.href = '/auth';
          }
        }}
        style={{
          backgroundColor: '#3b82f6',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          border: 'none',
          fontSize: '16px',
          fontWeight: 500,
          cursor: 'pointer',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}
      >
        開啟 VoteChaos
      </button>
    </div>
  );
};
