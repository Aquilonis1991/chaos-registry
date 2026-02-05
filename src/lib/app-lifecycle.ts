import { App, AppState } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

// Buffer to store callback if received before React component is ready
let pendingOAuthCallback: { url: string; params: Record<string, string> } | null = null;

export const getPendingOAuthCallback = () => pendingOAuthCallback;
export const clearPendingOAuthCallback = () => { pendingOAuthCallback = null; };

// App 生命週期事件處理
export const initializeAppLifecycle = () => {
  if (!Capacitor.isNativePlatform()) return;

  // 監聽 App 狀態變化
  App.addListener('appStateChange', (state: AppState) => {
    // ... existing ...
  });

  // 監聽深層連結
  App.addListener('appUrlOpen', (data) => {
    console.log('[app-lifecycle] Deep Link:', data.url);
    toast.info(`Deep Link: ${data.url.substring(0, 50)}...`, { duration: 5000 });

    try {
      const opened = new URL(data.url);
      const scheme = opened.protocol.replace(':', '');

      if (scheme !== 'votechaos') return;

      const host = opened.hostname;
      const path = opened.pathname || '';

      if (host === 'auth' && path.startsWith('/callback')) {
        const params: Record<string, string> = {};

        // Parse Query Params (Preferred for Deep Links)
        opened.searchParams.forEach((v, k) => params[k] = v);

        // Parse Hash Params (Fallback, often stripped by Android)
        const hash = opened.hash?.startsWith('#') ? opened.hash.slice(1) : '';
        if (hash) {
          new URLSearchParams(hash).forEach((v, k) => params[k] = v);
        }

        if (params.access_token) {
          console.log('[app-lifecycle] Tokens detected in Deep Link params');
        }

        const paramKeys = Object.keys(params).join(',');
        toast.success(`Params Found: ${paramKeys}`, { duration: 5000 });
        console.log('[app-lifecycle] Params:', params);

        // BUFFER logic
        pendingOAuthCallback = { url: data.url, params };

        // Dispatch
        const dispatched = window.dispatchEvent(new CustomEvent('oauth-callback', { detail: { url: data.url, params } }));
        if (dispatched) {
          toast.success('Event Dispatched to UI', { duration: 3000 });
        } else {
          toast.warning('Event Dispatch Failed (No Listeners?)', { duration: 3000 });
        }
        return;
      }

      // ... Route handling ...
    } catch (e: any) {
      toast.error(`Deep Link Error: ${e.message}`);
      console.error(e);
    }
  });
  // ... rest of file ...

  // 監聽返回按鈕（Android）
  App.addListener('backButton', ({ canGoBack }) => {
    console.log('Back button pressed, canGoBack:', canGoBack);

    if (!canGoBack) {
      // 如果已經在首頁，詢問是否退出
      if (window.location.pathname === '/home' || window.location.pathname === '/') {
        if (confirm('確定要退出應用嗎？')) {
          App.exitApp();
        }
      }
    } else {
      // 返回上一頁
      window.history.back();
    }
  });
};

// App 恢復到前景時執行
const handleAppResume = () => {
  // 刷新資料
  console.log('[app-lifecycle] App resumed - refreshing data');
  console.log('[app-lifecycle] Current URL:', window.location.href);
  console.log('[app-lifecycle] Current pathname:', window.location.pathname);
  console.log('[app-lifecycle] Current search:', window.location.search);
  console.log('[app-lifecycle] Current hash:', window.location.hash);

  // 檢查是否有 OAuth 回調參數（如果 Twitter 重定向到 WebView 而不是 Deep Link）
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const code = urlParams.get('code') || hashParams.get('code');
  const state = urlParams.get('state') || hashParams.get('state');
  const error = urlParams.get('error') || hashParams.get('error');

  if (code || state || error) {
    console.log('[app-lifecycle] OAuth callback parameters detected in URL after resume:', {
      code: code ? 'present' : 'missing',
      state: state ? 'present' : 'missing',
      error: error || 'none',
      pathname: window.location.pathname
    });

    // 如果是在 /auth/callback 路徑，讓 OAuthCallbackPage 處理
    if (window.location.pathname.includes('/auth/callback')) {
      console.log('[app-lifecycle] Already on /auth/callback, OAuthCallbackPage should handle it');
    } else {
      console.log('[app-lifecycle] Not on /auth/callback, redirecting...');
      window.location.href = `/auth/callback${window.location.search}${window.location.hash}`;
    }
  }

  // 觸發自定義事件，讓各組件知道 App 恢復了
  window.dispatchEvent(new CustomEvent('app-resume'));

  // 可以在這裡刷新重要資料
  // 例如：重新獲取用戶資料、檢查新通知等
};

// App 進入背景時執行
const handleAppPause = () => {
  // 保存狀態
  console.log('App paused - saving state');

  // 觸發自定義事件
  window.dispatchEvent(new CustomEvent('app-pause'));

  // 可以在這裡保存重要資料到 localStorage
};

// 獲取 App 資訊
export const getAppInfo = async () => {
  if (!Capacitor.isNativePlatform()) {
    return {
      name: 'VoteChaos',
      version: '1.0.0',
      build: '1',
      platform: 'web'
    };
  }

  try {
    const info = await App.getInfo();
    return {
      name: info.name,
      version: info.version,
      build: info.build,
      platform: Capacitor.getPlatform()
    };
  } catch (error) {
    console.error('Error getting app info:', error);
    return null;
  }
};

// 退出 App
export const exitApp = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await App.exitApp();
  } catch (error) {
    console.error('Error exiting app:', error);
  }
};

// 檢查 App 狀態
export const getAppState = async () => {
  if (!Capacitor.isNativePlatform()) {
    return { isActive: true };
  }

  try {
    const state = await App.getState();
    return state;
  } catch (error) {
    console.error('Error getting app state:', error);
    return { isActive: true };
  }
};

