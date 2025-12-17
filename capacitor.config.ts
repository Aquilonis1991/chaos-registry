import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.votechaos.app',
  appName: 'VoteChaos',
  webDir: 'dist',
  server: {
    // 回歸原本設定：使用 https://localhost 作為 WebView origin（先前已測試可用的第三方登入設定）
    androidScheme: 'https',
    iosScheme: 'https'
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

