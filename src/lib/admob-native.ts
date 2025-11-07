import { Capacitor } from '@capacitor/core';

// AdMob 配置（將來整合時使用）
export const AdMobConfig = {
  android: {
    appId: 'ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY', // 替換為您的 Android AdMob App ID
    bannerAdUnitId: 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ',
    interstitialAdUnitId: 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ',
    rewardedAdUnitId: 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ',
  },
  ios: {
    appId: 'ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY', // 替換為您的 iOS AdMob App ID
    bannerAdUnitId: 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ',
    interstitialAdUnitId: 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ',
    rewardedAdUnitId: 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ',
  },
};

// AdMob 測試 ID（開發時使用）
export const AdMobTestIds = {
  android: {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
  ios: {
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
  },
};

// 獲取當前平台的測試廣告 ID
export const getTestAdUnitId = (adType: 'banner' | 'interstitial' | 'rewarded') => {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') {
    return AdMobTestIds.android[adType];
  } else if (platform === 'ios') {
    return AdMobTestIds.ios[adType];
  }
  return null;
};

// 檢查是否在原生平台
export const isNativePlatform = () => {
  return Capacitor.isNativePlatform();
};

// 未來整合 AdMob Plugin 時使用
// import { AdMob } from '@capacitor-community/admob';
// 
// export const initializeAdMob = async () => {
//   if (!isNativePlatform()) return;
//   
//   const platform = Capacitor.getPlatform();
//   const appId = platform === 'android' ? AdMobConfig.android.appId : AdMobConfig.ios.appId;
//   
//   await AdMob.initialize({ 
//     requestTrackingAuthorization: true,
//     initializeForTesting: true, // 開發時設為 true
//   });
// };

