import { App, AppState } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { devLog } from '@/lib/devLog';

// App 生命週期事件處理
export const initializeAppLifecycle = () => {
  if (!Capacitor.isNativePlatform()) return;

  // 監聽 App 狀態變化
  App.addListener('appStateChange', (state: AppState) => {
    console.log('App state changed. Is active:', state.isActive);
    
    if (state.isActive) {
      // App 進入前景
      handleAppResume();
    } else {
      // App 進入背景
      handleAppPause();
    }
  });

  // 監聽深層連結
  App.addListener('appUrlOpen', (data) => {
    devLog('[app-lifecycle] ========== DEEP LINK RECEIVED ==========');
    devLog('[app-lifecycle] App opened with URL:', data.url);
    devLog('[app-lifecycle] Full URL data:', JSON.stringify(data));
    devLog('[app-lifecycle] Timestamp:', new Date().toISOString());

    try {
      const opened = new URL(data.url);
      // 例：votechaos://auth/callback#access_token=...&refresh_token=...
      const scheme = opened.protocol.replace(':', '');
      devLog('[app-lifecycle] URL scheme:', scheme);
      devLog('[app-lifecycle] URL hostname:', opened.hostname);
      devLog('[app-lifecycle] URL pathname:', opened.pathname);
      devLog('[app-lifecycle] URL search:', opened.search);
      devLog('[app-lifecycle] URL hash:', opened.hash);

      // 只處理我們的 Deep Link scheme
      if (scheme !== 'votechaos') {
        devLog('[app-lifecycle] Ignoring non-votechaos deep link:', scheme);
        return;
      }

      const host = opened.hostname; // 例如 auth / vote / home ...
      const path = opened.pathname || '';
      devLog('[app-lifecycle] Processing deep link - host:', host, 'path:', path);

      // OAuth callback：派發事件給 OAuthCallbackHandler 處理（setSession + 導向 /home）
      if (host === 'auth' && path.startsWith('/callback')) {
        devLog('[app-lifecycle] OAuth callback detected, extracting parameters...');
        const params: Record<string, string> = {};

        // query params（Deep Link 使用 query 參數，例如：votechaos://auth/callback?code=...&state=...）
        opened.searchParams.forEach((v, k) => {
          params[k] = v;
          devLog('[app-lifecycle] Query param:', k, '=', v);
        });

        // hash params（Supabase magic link / OAuth 回調常用，例如：votechaos://auth/callback#access_token=...）
        const hash = opened.hash?.startsWith('#') ? opened.hash.slice(1) : '';
        if (hash) {
          devLog('[app-lifecycle] Hash fragment found:', hash);
          const hashParams = new URLSearchParams(hash);
          hashParams.forEach((v, k) => {
            params[k] = v;
            devLog('[app-lifecycle] Hash param:', k, '=', v);
          });
        }

        devLog('[app-lifecycle] All extracted params:', JSON.stringify(params));
        devLog('[app-lifecycle] Has code:', !!params.code);
        devLog('[app-lifecycle] Has state:', !!params.state);
        devLog('[app-lifecycle] Has access_token:', !!params.access_token);
        devLog('[app-lifecycle] Has refresh_token:', !!params.refresh_token);
        devLog('[app-lifecycle] Dispatching oauth-callback event...');
        window.dispatchEvent(new CustomEvent('oauth-callback', { detail: { url: data.url, params } }));
        devLog('[app-lifecycle] oauth-callback event dispatched');
        return;
      }

      // 其他 deep link：轉成 app 內路由（例如 votechaos://vote/123 → /vote/123）
      devLog('[app-lifecycle] Non-OAuth deep link, converting to route...');
      const slug = `/${host}${path}${opened.search}`;
      devLog('[app-lifecycle] Redirecting to:', slug);
      window.location.href = slug;
    } catch (e) {
      console.error('[app-lifecycle] Failed to parse deep link URL:', e);
      console.error('[app-lifecycle] Error details:', e instanceof Error ? e.message : String(e));
    }
  });

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
  devLog('[app-lifecycle] App resumed - refreshing data');
  devLog('[app-lifecycle] Current URL:', window.location.href);
  devLog('[app-lifecycle] Current pathname:', window.location.pathname);
  devLog('[app-lifecycle] Current search:', window.location.search);
  devLog('[app-lifecycle] Current hash:', window.location.hash);
  
  // 檢查是否有 OAuth 回調參數（如果 Twitter 重定向到 WebView 而不是 Deep Link）
  const urlParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const code = urlParams.get('code') || hashParams.get('code');
  const state = urlParams.get('state') || hashParams.get('state');
  const error = urlParams.get('error') || hashParams.get('error');
  
  if (code || state || error) {
    devLog('[app-lifecycle] OAuth callback parameters detected in URL after resume:', {
      code: code ? 'present' : 'missing',
      state: state ? 'present' : 'missing',
      error: error || 'none',
      pathname: window.location.pathname
    });
    
    // 如果是在 /auth/callback 路徑，讓 OAuthCallbackPage 處理
    if (window.location.pathname.includes('/auth/callback')) {
      devLog('[app-lifecycle] Already on /auth/callback, OAuthCallbackPage should handle it');
    } else {
      devLog('[app-lifecycle] Not on /auth/callback, redirecting...');
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
      version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.38',
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

