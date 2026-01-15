import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 立即渲染 React App（最高優先級）
console.log('Starting ChaosRegistry App...');
createRoot(document.getElementById("root")!).render(<App />);
console.log('React rendered');

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
    
    // 在應用卸載時清理（雖然這在 SPA 中不常見，但為了完整性）
    // 注意：實際清理會在頁面卸載時自動發生

    // 2. 初始化 Capacitor
    try {
      const { initializeCapacitor } = await import("./lib/capacitor");
      await initializeCapacitor();
      console.log('Capacitor ready');

      // 2.1 在原生平台初始化 AdMob
      const { isNative } = await import("./lib/capacitor");
      if (isNative()) {
        try {
          const { AdMobService } = await import("./lib/admob");
          await AdMobService.initialize();
          console.log('AdMob initialized');
        } catch (admobError) {
          console.error('AdMob initialization failed:', admobError);
        }
      } else {
        console.log('AdMob initialization skipped (web platform)');
      }
    } catch (error) {
      console.error('Capacitor initialization failed:', error);
    }

    // 3. 初始化 App 生命週期（優先級最高，確保 Deep Link 監聽器盡早設置）
    try {
      const { initializeAppLifecycle } = await import("./lib/app-lifecycle");
      initializeAppLifecycle();
      console.log('App lifecycle ready - Deep Link listener registered');
    } catch (error) {
      console.error('App lifecycle initialization failed:', error);
    }



    // 注意：AdMob 初始化已在步驟 2.1 處理

  } catch (error) {
    console.error('Service initialization error:', error);
  }
}, 500);
