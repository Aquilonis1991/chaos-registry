import { AdMob, BannerAdOptions, BannerAdSize, BannerAdPosition, AdMobRewardItem, RewardAdOptions, InterstitialAdOptions, AdLoadInfo } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

const NPA_REQUEST_OPTIONS = { npa: true as const };
let lastRewardPrepareErrorMessage = '';

/**
 * AdMob 測試廣告 ID
 * 開發期間使用 Google 官方測試 ID
 */
export const TEST_AD_IDS = {
  android: {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
    native: 'ca-app-pub-3940256099942544/2247696110',
  },
  ios: {
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
    native: 'ca-app-pub-3940256099942544/3986624511',
  }
};

/**
 * 獲取當前平台的廣告 ID
 * 如果提供了配置值，優先使用配置值；否則使用測試 ID
 * 支持兩種配置格式：
 * 1. 字符串：單一 ID（兩個平台共用）
 * 2. JSON 對象：{ "android": "...", "ios": "..." }（分別配置）
 */
const getAdId = (type: 'banner' | 'interstitial' | 'rewarded', configValue?: string | any): string => {
  const platform = Capacitor.getPlatform();
  
  // 如果提供了配置值，優先使用
  if (configValue) {
    // 如果是字符串，直接使用（兼容舊配置）
    if (typeof configValue === 'string' && configValue.trim()) {
      return configValue.trim();
    }
    
    // 如果是對象，根據平台選擇對應的 ID
    if (typeof configValue === 'object' && configValue !== null) {
      if (platform === 'ios' && configValue.ios) {
        return String(configValue.ios).trim();
      } else if (platform === 'android' && configValue.android) {
        return String(configValue.android).trim();
      }
      // 如果對象中沒有對應平台的 ID，回退到測試 ID
    }
  }
  
  // 否則使用測試 ID
  if (platform === 'ios') {
    return TEST_AD_IDS.ios[type];
  } else if (platform === 'android') {
    return TEST_AD_IDS.android[type];
  }
  
  // Web 平台返回 Android ID（不會實際使用）
  return TEST_AD_IDS.android[type];
};

/**
 * 取得當前平台的原生廣告單元 ID
 * 配置格式與 getAdId 相同：
 * 1. 字串：單一 ID（兩平台共用）
 * 2. 物件：{ "android": "...", "ios": "..." }（依平台區分）
 */
export const getNativeAdUnitId = (configValue?: string | { android?: string; ios?: string } | null): string => {
  const platform = Capacitor.getPlatform();

  if (configValue) {
    if (typeof configValue === 'string' && configValue.trim()) {
      return configValue.trim();
    }
    if (typeof configValue === 'object' && configValue !== null) {
      if (platform === 'ios' && configValue.ios) {
        return String(configValue.ios).trim();
      }
      if ((platform === 'android' || platform === 'web') && configValue.android) {
        return String(configValue.android).trim();
      }
    }
  }

  if (platform === 'ios') {
    return TEST_AD_IDS.ios.native;
  }
  return TEST_AD_IDS.android.native;
};

/**
 * 檢查是否為原生平台
 */
export const isNativePlatform = (): boolean => {
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android';
};

/**
 * 初始化 AdMob
 */
export const initializeAdMob = async (): Promise<boolean> => {
  if (!isNativePlatform()) {
    console.log('AdMob: Not a native platform, skipping initialization');
    return false;
  }

  try {
    console.log('AdMob: Starting initialization...');
    
    await AdMob.initialize({
      testingDevices: [],
      initializeForTesting: false,
      requestTrackingAuthorization: false,
    });
    
    console.log('AdMob initialized successfully');
    return true;
  } catch (error) {
    console.error('AdMob initialization error:', error);
    // 初始化失敗不應阻止 APP 運行
    // 返回 false 但不拋出錯誤
    return false;
  }
};

/**
 * 顯示 Banner 廣告
 */
export const showBannerAd = async (): Promise<boolean> => {
  if (!isNativePlatform()) {
    console.log('AdMob: Cannot show banner on web platform');
    return false;
  }

  try {
    const options: BannerAdOptions = {
      adId: getAdId('banner', undefined),
      adSize: BannerAdSize.BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      ...NPA_REQUEST_OPTIONS,
    };

    await AdMob.showBanner(options);
    console.log('Banner ad shown');
    return true;
  } catch (error) {
    console.error('Error showing banner ad:', error);
    return false;
  }
};

/**
 * 隱藏 Banner 廣告
 */
export const hideBannerAd = async (): Promise<void> => {
  if (!isNativePlatform()) return;

  try {
    await AdMob.hideBanner();
    console.log('Banner ad hidden');
  } catch (error) {
    console.error('Error hiding banner ad:', error);
  }
};

/**
 * 移除 Banner 廣告
 */
export const removeBannerAd = async (): Promise<void> => {
  if (!isNativePlatform()) return;

  try {
    await AdMob.removeBanner();
    console.log('Banner ad removed');
  } catch (error) {
    console.error('Error removing banner ad:', error);
  }
};

/**
 * 準備插頁廣告
 */
export const prepareInterstitialAd = async (): Promise<boolean> => {
  if (!isNativePlatform()) {
    console.log('AdMob: Cannot prepare interstitial on web platform');
    return false;
  }

  try {
    const options: InterstitialAdOptions = {
      adId: getAdId('interstitial', undefined),
      ...NPA_REQUEST_OPTIONS,
    };

    await AdMob.prepareInterstitial(options);
    console.log('Interstitial ad prepared');
    return true;
  } catch (error) {
    console.error('Error preparing interstitial ad:', error);
    return false;
  }
};

/**
 * 顯示插頁廣告
 */
export const showInterstitialAd = async (): Promise<boolean> => {
  if (!isNativePlatform()) {
    console.log('AdMob: Cannot show interstitial on web platform');
    return false;
  }

  try {
    await AdMob.showInterstitial();
    console.log('Interstitial ad shown');
    return true;
  } catch (error) {
    console.error('Error showing interstitial ad:', error);
    return false;
  }
};

/**
 * 準備獎勵廣告
 * @param adUnitId - 廣告單元 ID，可以是字符串（單一 ID）或對象 {android: "...", ios: "..."}
 */
export const prepareRewardAd = async (adUnitId?: string | any): Promise<boolean> => {
  if (!isNativePlatform()) {
    console.log('AdMob: Cannot prepare reward ad on web platform');
    return false;
  }

  try {
    lastRewardPrepareErrorMessage = '';
    const options: RewardAdOptions = {
      adId: getAdId('rewarded', adUnitId),
      ...NPA_REQUEST_OPTIONS,
    };

    await AdMob.prepareRewardVideoAd(options);
    console.log('Reward ad prepared with adUnitId:', options.adId);
    return true;
  } catch (error) {
    const raw = (error as any)?.errorMessage || (error as any)?.message || String(error);
    lastRewardPrepareErrorMessage = String(raw);
    console.error('Error preparing reward ad:', raw);
    return false;
  }
};

/**
 * 顯示獎勵廣告並處理獎勵
 * @param onReward - 獲得獎勵時的回調函數
 * @param onDismiss - 廣告關閉時的回調函數
 */
export const showRewardAd = async (
  onReward?: (reward: AdMobRewardItem) => void,
  onDismiss?: () => void,
  onOpened?: () => void,
  onShowFailed?: (errorMessage?: string) => void
): Promise<boolean> => {
  if (!isNativePlatform()) {
    console.log('AdMob: Cannot show reward ad on web platform');
    // 在 Web 平台模擬獎勵
    if (onReward) {
      setTimeout(() => {
        onReward({ type: 'test_reward', amount: 1 });
      }, 1000);
    }
    return false;
  }

  try {
    console.log('[showRewardAd] 設置事件監聽器...');

    const listeners: Array<{ remove: () => void }> = [];
    const cleanup = () => {
      listeners.forEach((l) => l.remove());
      listeners.length = 0;
      console.log('[showRewardAd] 事件監聽器已移除');
    };

    // 不同插件版本可能使用不同事件名，這裡同時監聽以避免「已看完但判定未完成」。
    const rewardEventNames = ['onRewardedVideoAdReward', 'onRewardedVideoAdRewarded'];
    for (const rewardEventName of rewardEventNames) {
      console.log(`[showRewardAd] 準備監聽獎勵事件: ${rewardEventName}`);
      const rewardListener = await AdMob.addListener(rewardEventName as any, (reward: AdMobRewardItem) => {
        console.log('[showRewardAd] ✅ 用戶獲得獎勵:', reward, 'event=', rewardEventName);
        if (onReward) {
          onReward(reward);
        }
      });
      listeners.push(rewardListener);
    }

    const openedEventNames = ['onRewardedVideoAdShowed', 'onRewardedVideoAdOpened'];
    for (const openedEventName of openedEventNames) {
      console.log(`[showRewardAd] 準備監聽開啟事件: ${openedEventName}`);
      const openedListener = await AdMob.addListener(openedEventName as any, () => {
        console.log('[showRewardAd] 廣告已開啟 event=', openedEventName);
        if (onOpened) {
          onOpened();
        }
      });
      listeners.push(openedListener);
    }

    const dismissEventNames = ['onRewardedVideoAdDismissed', 'onRewardedVideoAdClosed'];
    for (const dismissEventName of dismissEventNames) {
      console.log(`[showRewardAd] 準備監聽關閉事件: ${dismissEventName}`);
      const dismissListener = await AdMob.addListener(dismissEventName as any, () => {
        console.log('[showRewardAd] 廣告已關閉 event=', dismissEventName);
        if (onDismiss) {
          onDismiss();
        }
        cleanup();
      });
      listeners.push(dismissListener);
    }

    const failedEventNames = ['onRewardedVideoAdFailedToShow', 'onRewardedVideoAdFailedToLoad'];
    for (const failedEventName of failedEventNames) {
      console.log(`[showRewardAd] 準備監聽失敗事件: ${failedEventName}`);
      const failedListener = await AdMob.addListener(failedEventName as any, (payload: any) => {
        const errorMessage = payload?.errorMessage || payload?.message || '廣告暫時無法顯示';
        console.warn('[showRewardAd] 廣告顯示失敗 event=', failedEventName, 'message=', errorMessage);
        if (onShowFailed) {
          onShowFailed(errorMessage);
        }
        cleanup();
      });
      listeners.push(failedListener);
    }

    // 顯示廣告
    console.log('[showRewardAd] 顯示獎勵廣告...');
    await AdMob.showRewardVideoAd();
    console.log('[showRewardAd] ✅ 廣告顯示命令已發送');
    return true;
  } catch (error) {
    console.error('[showRewardAd] ❌ 錯誤:', error);
    return false;
  }
};

/**
 * Web 平台顯示測試廣告模擬器
 */
const showWebAdSimulator = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // 創建全屏遮罩層
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.95);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // 創建廣告容器
    const adContainer = document.createElement('div');
    adContainer.style.cssText = `
      width: 90%;
      max-width: 400px;
      background: #1a1a1a;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `;

    // 創建廣告標題欄
    const header = document.createElement('div');
    header.style.cssText = `
      background: #2d2d2d;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #3d3d3d;
    `;
    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 20px; height: 20px; background: #4285f4; border-radius: 4px;"></div>
        <span style="color: #fff; font-size: 14px; font-weight: 500;">AdMob 測試廣告</span>
      </div>
      <div id="ad-close-btn" style="color: #999; font-size: 20px; cursor: pointer; display: none; padding: 4px;">✕</div>
    `;

    // 創建廣告內容區域（模擬 AdMob 測試廣告）
    const adContent = document.createElement('div');
    adContent.style.cssText = `
      position: relative;
      width: 100%;
      padding-top: 56.25%; /* 16:9 比例 */
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    
    // 創建模擬廣告內容
    const adDisplay = document.createElement('div');
    adDisplay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      color: white;
      gap: 20px;
      padding: 20px;
      box-sizing: border-box;
    `;
    adDisplay.innerHTML = `
      <div style="font-size: 64px; animation: pulse 2s infinite;">📺</div>
      <div style="font-size: 28px; font-weight: bold; text-align: center;">AdMob 測試廣告</div>
      <div style="font-size: 16px; opacity: 0.9; text-align: center; max-width: 300px;">
        這是 Google AdMob 官方測試廣告<br/>
        觀看完整廣告後可獲得獎勵
      </div>
      <div style="display: flex; gap: 12px; margin-top: 12px;">
        <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🎮</div>
        <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🛍️</div>
        <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px;">🚀</div>
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      </style>
    `;
    
    adContent.appendChild(adDisplay);

    // 創建倒計時和關閉按鈕區域
    const footer = document.createElement('div');
    footer.style.cssText = `
      background: #2d2d2d;
      padding: 16px;
      text-align: center;
      border-top: 1px solid #3d3d3d;
    `;
    
    let remainingSeconds = 30;
    const countdownText = document.createElement('div');
    countdownText.style.cssText = `
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 12px;
    `;
    countdownText.textContent = `請觀看 ${remainingSeconds} 秒後可獲得獎勵`;

    const closeButton = document.createElement('button');
    closeButton.id = 'ad-close-button';
    closeButton.disabled = true;
    closeButton.style.cssText = `
      background: #4285f4;
      color: white;
      border: none;
      padding: 12px 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: not-allowed;
      opacity: 0.5;
      width: 100%;
      transition: all 0.3s;
    `;
    closeButton.textContent = `獲得獎勵 (${remainingSeconds}s)`;

    footer.appendChild(countdownText);
    footer.appendChild(closeButton);

    // 倒計時邏輯
    const countdownInterval = setInterval(() => {
      remainingSeconds--;
      countdownText.textContent = remainingSeconds > 0 
        ? `請觀看 ${remainingSeconds} 秒後可獲得獎勵`
        : '✓ 廣告觀看完畢！';
      
      closeButton.textContent = remainingSeconds > 0 
        ? `獲得獎勵 (${remainingSeconds}s)`
        : '✓ 獲得獎勵';

      if (remainingSeconds <= 0) {
        clearInterval(countdownInterval);
        closeButton.disabled = false;
        closeButton.style.cssText = `
          background: #34a853;
          color: white;
          border: none;
          padding: 12px 32px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          opacity: 1;
          width: 100%;
          transition: all 0.3s;
        `;
        // 顯示關閉按鈕
        const closeBtn = header.querySelector('#ad-close-btn') as HTMLElement;
        if (closeBtn) {
          closeBtn.style.display = 'block';
        }
      }
    }, 1000);

    // 清理函數
    const cleanup = () => {
      document.body.style.overflow = '';
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };

    // 關閉按鈕事件
    const handleClose = () => {
      if (remainingSeconds <= 0) {
        cleanup();
        if (overlay.parentNode) {
          document.body.removeChild(overlay);
        }
        resolve();
      }
    };

    closeButton.addEventListener('click', handleClose);
    const headerCloseBtn = header.querySelector('#ad-close-btn');
    if (headerCloseBtn) {
      headerCloseBtn.addEventListener('click', handleClose);
    }

    // ESC 鍵關閉（僅在倒計時結束後）
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && remainingSeconds <= 0) {
        handleClose();
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // 組裝廣告
    adContainer.appendChild(header);
    adContainer.appendChild(adContent);
    adContainer.appendChild(footer);
    overlay.appendChild(adContainer);
    document.body.appendChild(overlay);

    // 防止背景滾動
    document.body.style.overflow = 'hidden';
    overlay.addEventListener('click', (e) => {
      // 只允許在倒計時結束後點擊外部關閉
      if (remainingSeconds <= 0 && e.target === overlay) {
        handleClose();
      }
    });
  });
};

/**
 * 完整的觀看獎勵廣告流程
 * @param onSuccess - 成功獲得獎勵的回調
 * @param onError - 錯誤回調
 */
export const watchRewardedAd = async (
  onSuccess: () => void,
  onError?: (error: string) => void,
  adUnitId?: string | any
): Promise<void> => {
  // Web 平台顯示測試廣告模擬器
  if (!isNativePlatform()) {
    console.log('AdMob: Web platform, showing test ad simulator');
    try {
      await showWebAdSimulator();
      onSuccess();
    } catch (error) {
      console.error('Error showing web ad simulator:', error);
      if (onError) {
        onError(error instanceof Error ? error.message : '廣告顯示失敗');
      }
    }
    return;
  }

  try {
    // 1. 準備廣告（使用提供的 adUnitId 或默認測試 ID）
    const prepared = await prepareRewardAd(adUnitId);
    if (!prepared) {
      const msg = lastRewardPrepareErrorMessage.toLowerCase();
      if (msg.includes('no ad to show') || msg.includes('loading failed')) {
        throw new Error('目前暫無可投放獎勵廣告（No Fill），請稍後再試');
      }
      throw new Error(lastRewardPrepareErrorMessage || '獎勵廣告載入失敗');
    }

    // 2. 等待廣告準備好（可選，根據需要調整）
    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. 顯示廣告並處理獎勵
    let rewardEarned = false;
    let adOpened = false;
    let settled = false;

    await showRewardAd(
      (reward) => {
        // 獲得獎勵
        console.log('Reward earned:', reward);
        rewardEarned = true;
      },
      () => {
        // 廣告關閉
        if (settled) return;
        settled = true;
        if (rewardEarned) {
          onSuccess();
        } else if (!adOpened) {
          if (onError) {
            onError('廣告暫時無法顯示，請稍後再試');
          }
        } else {
          if (onError) {
            onError('廣告未完整觀看');
          }
        }
      },
      () => {
        adOpened = true;
      },
      (errorMessage) => {
        if (settled) return;
        settled = true;
        if (onError) {
          onError(errorMessage || '廣告暫時無法顯示，請稍後再試');
        }
      }
    );
  } catch (error) {
    console.error('Error in watchRewardedAd:', error);
    if (onError) {
      onError(error instanceof Error ? error.message : '廣告載入失敗');
    }
  }
};

/**
 * AdMob 工具類
 */
export const AdMobService = {
  initialize: initializeAdMob,
  isNative: isNativePlatform,
  
  // Banner 廣告
  showBanner: showBannerAd,
  hideBanner: hideBannerAd,
  removeBanner: removeBannerAd,
  
  // 插頁廣告
  prepareInterstitial: prepareInterstitialAd,
  showInterstitial: showInterstitialAd,
  
  // 獎勵廣告
  prepareReward: prepareRewardAd,
  showReward: showRewardAd,
  watchRewardedAd: watchRewardedAd,
};

export default AdMobService;
