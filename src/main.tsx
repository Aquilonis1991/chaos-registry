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
    // 1. 設置錯誤處理器
    try {
      const { setupGlobalErrorHandlers } = await import("./lib/errorLogger");
      setupGlobalErrorHandlers();
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
    
    // 3. 初始化 App 生命週期
    try {
      const { initializeAppLifecycle } = await import("./lib/app-lifecycle");
      initializeAppLifecycle();
      console.log('App lifecycle ready');
    } catch (error) {
      console.error('App lifecycle initialization failed:', error);
    }
    
    // 4. 初始化推送通知
    try {
      const { initializePushNotifications } = await import("./lib/push-notifications");
      await initializePushNotifications();
      console.log('Push notifications ready');
    } catch (error) {
      console.error('Push notifications initialization failed:', error);
    }
    
    // 注意：AdMob 初始化已在步驟 2.1 處理
    
  } catch (error) {
    console.error('Service initialization error:', error);
  }
}, 500);
