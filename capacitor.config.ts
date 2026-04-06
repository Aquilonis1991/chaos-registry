import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.votechaos.app',
  appName: 'ChaosRegistry',
  webDir: 'dist',
  plugins: {
    AdMob: {
      appIdAndroid: 'ca-app-pub-9731699243657023~2885273855',
      appIdIos: 'ca-app-pub-9731699243657023~6272597284',
    },
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: "#1a2332",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#1a2332'
    }
  }
};

export default config;

