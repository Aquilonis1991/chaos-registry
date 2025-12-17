import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.votechaos.app',
  appName: 'VoteChaos',
  webDir: 'dist',
  server: {
    // 使用 Capacitor 內建本機 WebView 來源。先前使用 https://localhost 會在部分環境觸發
    // Supabase Auth CORS/網路錯誤（常見表現：No 'Access-Control-Allow-Origin' + Failed to fetch）。
    // 改為 http://localhost 可避免這類問題，且僅用於本機 WebView，不影響與外部 API 的 TLS 安全性。
    androidScheme: 'http',
    iosScheme: 'http'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#FFFFFF",
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#FFFFFF'
    }
  }
};

export default config;

