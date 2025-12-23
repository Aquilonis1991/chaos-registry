import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// 檢查是否在原生環境
export const isNative = () => Capacitor.isNativePlatform();
export const getPlatform = () => Capacitor.getPlatform();

// 初始化 Capacitor
export const initializeCapacitor = async () => {
  if (!isNative()) {
    console.log('Running in browser mode');
    return;
  }

  console.log('Running in native mode:', getPlatform());

  try {
    // 配置狀態欄
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#000000' });

    // 隱藏啟動畫面
    await SplashScreen.hide();

    // 鍵盤配置
    if (getPlatform() === 'ios') {
      Keyboard.setAccessoryBarVisible({ isVisible: true });
    }

    // 監聽 App 返回事件
    App.addListener('backButton', ({ canGoBack }) => {
      if (!canGoBack) {
        App.exitApp();
      } else {
        window.history.back();
      }
    });

    console.log('Capacitor initialized successfully');
  } catch (error) {
    console.error('Error initializing Capacitor:', error);
  }
};

// 觸覺反饋
export const hapticImpact = async (style: ImpactStyle = ImpactStyle.Medium) => {
  if (!isNative()) return;

  try {
    await Haptics.impact({ style });
  } catch (error) {
    console.error('Haptic feedback error:', error);
  }
};

// 輕觸反饋（用於按鈕點擊）
export const hapticLight = () => hapticImpact(ImpactStyle.Light);

// 中等反饋（用於一般操作）
export const hapticMedium = () => hapticImpact(ImpactStyle.Medium);

// 重擊反饋（用於重要操作）
export const hapticHeavy = () => hapticImpact(ImpactStyle.Heavy);

// 獲取 App 資訊
export const getAppInfo = async () => {
  if (!isNative()) return null;

  try {
    const info = await App.getInfo();
    return info;
  } catch (error) {
    console.error('Error getting app info:', error);
    return null;
  }
};

// 退出 App
export const exitApp = async () => {
  if (!isNative()) return;

  try {
    await App.exitApp();
  } catch (error) {
    console.error('Error exiting app:', error);
  }
};

// 鍵盤控制
export const hideKeyboard = async () => {
  if (!isNative()) return;

  try {
    await Keyboard.hide();
  } catch (error) {
    console.error('Error hiding keyboard:', error);
  }
};

