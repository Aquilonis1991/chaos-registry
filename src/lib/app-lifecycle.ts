import { App, AppState } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

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
    console.log('App opened with URL:', data.url);
    
    // 處理深層連結（例如：votechaos://vote/123）
    const slug = data.url.split('.app').pop();
    if (slug) {
      window.location.href = slug;
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
  console.log('App resumed - refreshing data');
  
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

