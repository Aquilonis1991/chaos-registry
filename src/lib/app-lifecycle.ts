import { App, AppState } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { devLog } from '@/lib/devLog';

/** 避免 cold start 同時觸發 getLaunchUrl + appUrlOpen 時重複導頁 */
let lastHandledDeepLinkUrl = '';
let lastHandledDeepLinkAt = 0;

function handleDeepLinkUrl(rawUrl: string, source: 'appUrlOpen' | 'getLaunchUrl') {
  const url = (rawUrl || '').trim();
  if (!url) return;

  const now = Date.now();
  if (url === lastHandledDeepLinkUrl && now - lastHandledDeepLinkAt < 2500) {
    devLog('[app-lifecycle] Skipping duplicate deep link from', source, url);
    return;
  }
  lastHandledDeepLinkUrl = url;
  lastHandledDeepLinkAt = now;

  devLog('[app-lifecycle] ========== DEEP LINK RECEIVED ==========');
  devLog('[app-lifecycle] Source:', source);
  devLog('[app-lifecycle] App opened with URL:', url);
  devLog('[app-lifecycle] Timestamp:', new Date().toISOString());

  try {
    const opened = new URL(url);
    // 例：votechaos://auth/callback#access_token=...&refresh_token=...
    const scheme = opened.protocol.replace(':', '');
    devLog('[app-lifecycle] URL scheme:', scheme);
    devLog('[app-lifecycle] URL hostname:', opened.hostname);
    devLog('[app-lifecycle] URL pathname:', opened.pathname);
    devLog('[app-lifecycle] URL search:', opened.search);
    devLog('[app-lifecycle] URL hash:', opened.hash);

    // Android App Links / iOS Universal Links：真正的 https://(www.)chaosregistry.com/... 網址
    // （例如分享連結 /vote/{topicId}），跟自訂的 votechaos:// scheme 是兩種不同機制。
    // 這種網址的路徑本來就跟 App 內路由一致，直接導過去，不用像 votechaos:// 那樣把
    // hostname 當成路由的第一段。
    if (scheme === 'https' || scheme === 'http') {
      const host = opened.hostname.toLowerCase();
      if (host !== 'chaosregistry.com' && host !== 'www.chaosregistry.com') {
        devLog('[app-lifecycle] Ignoring universal link for unknown host:', opened.hostname);
        return;
      }
      const slug = `${opened.pathname}${opened.search}`;
      // 冷啟動時 WebView 可能已在相同路徑，仍強制導一次以確保 React Router 吃到
      if (window.location.pathname + window.location.search === slug) {
        devLog('[app-lifecycle] Universal link already on target route:', slug);
        return;
      }
      devLog('[app-lifecycle] Universal link, redirecting to:', slug);
      window.location.href = slug;
      return;
    }

    // 只處理我們自訂的 Deep Link scheme
    if (scheme !== 'votechaos') {
      devLog('[app-lifecycle] Ignoring unrecognized deep link scheme:', scheme);
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

      void (async () => {
        // OAuth 在 Browser.open（iOS SFSafariViewController / Android Custom Tabs）內完成，回調時關閉再處理 session
        try {
          const { Browser } = await import('@capacitor/browser');
          await Browser.close();
        } catch {
          /* 未開啟 Browser 或已關閉 */
        }
        devLog('[app-lifecycle] Dispatching oauth-callback event...');
        window.dispatchEvent(new CustomEvent('oauth-callback', { detail: { url, params } }));
        devLog('[app-lifecycle] oauth-callback event dispatched');
      })();
      return;
    }

    // 其他 deep link：轉成 app 內路由（例如 votechaos://vote/123 → /vote/123）
    devLog('[app-lifecycle] Non-OAuth deep link, converting to route...');
    const slug = `/${host}${path}${opened.search}`;
    if (window.location.pathname + window.location.search === slug) {
      devLog('[app-lifecycle] Already on target route:', slug);
      return;
    }
    devLog('[app-lifecycle] Redirecting to:', slug);
    window.location.href = slug;
  } catch (e) {
    console.error('[app-lifecycle] Failed to parse deep link URL:', e);
    console.error('[app-lifecycle] Error details:', e instanceof Error ? e.message : String(e));
  }
}

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

  // 熱啟動／背景喚醒：Universal Link / custom scheme 走這裡
  App.addListener('appUrlOpen', (data) => {
    handleDeepLinkUrl(data.url, 'appUrlOpen');
  });

  // 冷啟動：App 被連結從頭開啟時，事件可能早於 listener；補讀 launch URL
  void (async () => {
    try {
      const launch = await App.getLaunchUrl();
      if (launch?.url) {
        devLog('[app-lifecycle] Cold start launch URL:', launch.url);
        handleDeepLinkUrl(launch.url, 'getLaunchUrl');
      } else {
        devLog('[app-lifecycle] No cold-start launch URL');
      }
    } catch (e) {
      console.warn('[app-lifecycle] getLaunchUrl failed:', e);
    }
  })();

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
      version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.92',
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

