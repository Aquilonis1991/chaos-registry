import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 立即渲染 React App（最高優先級）
console.log('Starting ChaosRegistry App...');
createRoot(document.getElementById("root")!).render(<App />);
console.log('React rendered');

// 盡早註冊 Deep Link 監聽器（原生時），避免 LINE 回調因 500ms 延遲而遺失；app-lifecycle 內會判斷 isNative 並 no-op 於網頁
import("./lib/app-lifecycle").then(({ initializeAppLifecycle }) => {
  initializeAppLifecycle();
  console.log('App lifecycle ready (early) - Deep Link listener registered');
}).catch((e) => {
  console.error('App lifecycle early init failed:', e);
});

// 延遲初始化其他服務（完全非阻塞）
setTimeout(async () => {
  console.log('Starting service initialization...');

  try {
    // 1. 設置錯誤處理器（改進：保存清理函數）
    let cleanupErrorHandlers: (() => void) | undefined;
    try {
      const { setupGlobalErrorHandlers } = await import("./lib/errorLogger");
      cleanupErrorHandlers = setupGlobalErrorHandlers();
      console.log('Error handlers ready');
    } catch (error) {
      console.error('Error handler setup failed:', error);
    }

    // 2. 初始化 Capacitor
    try {
      const { initializeCapacitor } = await import("./lib/capacitor");
      await initializeCapacitor();
      console.log('Capacitor ready');

      // 2.1 在原生平台初始化 AdMob
      const { isNative: isNativePlatform } = await import("./lib/capacitor");
      if (isNativePlatform()) {
        try {
          const { AdMobService } = await import("./lib/admob");
          await AdMobService.initialize();
          console.log('AdMob initialized');
        } catch (admobError) {
          console.error('AdMob initialization failed:', admobError);
        }

        // 2.2 初始化購買服務（Google Play / App Store）
        try {
          const { purchaseService } = await import("./lib/purchase");
          await purchaseService.initialize();
          console.log('Purchase service initialized');
        } catch (purchaseError) {
          console.error('Purchase service initialization failed:', purchaseError);
        }
      } else {
        console.log('AdMob initialization skipped (web platform)');
        console.log('Purchase service initialization skipped (web platform)');
      }
    } catch (error) {
      console.error('Capacitor initialization failed:', error);
    }

  } catch (error) {
    console.error('Service initialization error:', error);
  }
}, 500);
