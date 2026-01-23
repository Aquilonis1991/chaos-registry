// 購買服務 - 初始化和管理內購
import { isNative, getPlatform } from './capacitor';

// 產品 ID 映射
export const PRODUCT_ID_MAP: Record<number, {
  android: string;
  ios: string;
  tokens: number;
  bonus: number;
}> = {
  1: { android: 'token_pack_small', ios: 'token_pack_small', tokens: 100, bonus: 0 },
  2: { android: 'token_pack_medium', ios: 'token_pack_medium', tokens: 500, bonus: 75 },
  3: { android: 'token_pack_large', ios: 'token_pack_large', tokens: 1000, bonus: 150 },
  4: { android: 'token_pack_xlarge', ios: 'token_pack_xlarge', tokens: 3000, bonus: 600 },
};

// 購買服務單例
class PurchaseService {
  private initialized = false;
  private store: any = null;

  /**
   * 初始化購買服務
   */
  async initialize(): Promise<{ success: boolean; error?: string }> {
    if (!isNative()) {
      console.log('[Purchase] Not a native platform, skipping initialization');
      return { success: false, error: 'Not a native platform' };
    }

    if (this.initialized) {
      console.log('[Purchase] Already initialized');
      return { success: true };
    }

    console.log('[Purchase] Starting initialization...');

    try {
      // 檢查 cordova-plugin-purchase 是否可用
      // 如果 CdvPurchase 未定義，嘗試等待 deviceready 事件
      if (typeof window === 'undefined') return { success: false, error: 'Window not defined' };

      if (!(window as any).CdvPurchase) {
        console.log('[Purchase] CdvPurchase not found immediately, waiting for deviceready...');
        await new Promise<void>((resolve) => {
          document.addEventListener('deviceready', () => {
            console.log('[Purchase] deviceready fired');
            resolve();
          }, { once: true });

          // 添加超時，5秒
          setTimeout(() => {
            console.warn('[Purchase] deviceready timeout reached (5000ms)');
            resolve();
          }, 5000);
        });
      }

      if (!(window as any).CdvPurchase) {
        console.warn('[Purchase] cordova-plugin-purchase (CdvPurchase) not found after wait');
        // 嘗試檢查舊版 store 對象，雖然 v13 應該用 CdvPurchase
        if ((window as any).store) {
          console.log('[Purchase] Found legacy window.store, attempting updates...');
          // 但主要邏輯依賴 CdvPurchase，這是一個嚴重的錯誤
          return { success: false, error: 'Plugin not loaded correctly (CdvPurchase missing)' };
        }
        return { success: false, error: '內購插件未載入 (Timeout)' };
      }

      const { ProductType, Platform } = (window as any).CdvPurchase;
      const storeInstance = (window as any).CdvPurchase.store;

      if (!storeInstance) {
        console.warn('[Purchase] CdvPurchase.store not found');
        return { success: false, error: 'Store instance missing' };
      }

      this.store = storeInstance;
      const platform = getPlatform();
      const storePlatform = platform === 'ios' ? Platform.APPLE_APPSTORE : Platform.GOOGLE_PLAY;

      console.log('[Purchase] Initializing store for platform:', storePlatform);

      // 註冊所有產品
      const productIds = Object.values(PRODUCT_ID_MAP).map(p =>
        platform === 'ios' ? p.ios : p.android
      );

      productIds.forEach(productId => {
        if (!this.store.get(productId)) {
          this.store.register({
            id: productId,
            type: ProductType.CONSUMABLE,
            platform: storePlatform,
          });
          console.log('[Purchase] Registered product:', productId);
        }
      });

      // 初始化商店
      try {
        console.log('[Purchase] Calling store.initialize...');
        if (platform === 'ios') {
          await this.store.initialize([Platform.APPLE_APPSTORE]);
        } else {
          await this.store.initialize([Platform.GOOGLE_PLAY]);
        }
        console.log('[Purchase] Store initialized successfully');
      } catch (initError: any) {
        console.error('[Purchase] Store initialization failed:', initError);
        // Log detailed error properties
        if (typeof initError === 'object') {
          console.error('[Purchase] Error details:', JSON.stringify(initError, Object.getOwnPropertyNames(initError)));
        }
        return { success: false, error: `Initialization failed: ${initError.message || initError}` };
      }

      // 更新產品信息
      try {
        await this.store.update();
        console.log('[Purchase] Products updated');
      } catch (updateError) {
        console.warn('[Purchase] Product update failed (non-fatal):', updateError);
      }

      // 設置全局錯誤處理
      this.store.error((error: any) => {
        console.error('[Purchase] Store error:', error);
        // Log detailed error properties
        if (typeof error === 'object') {
          console.error('[Purchase] Store Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
      });

      this.initialized = true;
      return { success: true };

    } catch (error: any) {
      console.error('[Purchase] Initialization panic:', error);
      return { success: false, error: `Panic: ${error.message || error}` };
    }
  }

  /**
   * 獲取商店實例
   */
  getStore(): any {
    if (!this.initialized) {
      console.warn('[Purchase] Store not initialized, call initialize() first');
    }
    return this.store;
  }

  /**
   * 檢查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 獲取產品信息
   */
  getProduct(productId: string): any {
    if (!this.store) {
      return null;
    }
    return this.store.get(productId);
  }

  /**
   * 刷新產品信息
   */
  async refreshProducts(): Promise<void> {
    if (!this.store) {
      throw new Error('Store not initialized');
    }
    await this.store.update();
  }
}

// 導出單例
export const purchaseService = new PurchaseService();
