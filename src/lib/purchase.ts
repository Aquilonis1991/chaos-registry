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
  2: { android: 'token_pack_medium', ios: 'token_pack_medium', tokens: 500, bonus: 50 },
  3: { android: 'token_pack_large', ios: 'token_pack_large', tokens: 1000, bonus: 150 },
  4: { android: 'token_pack_xlarge', ios: 'token_pack_xlarge', tokens: 3000, bonus: 500 },
};

// 購買服務單例
class PurchaseService {
  private initialized = false;
  private store: any = null;

  /**
   * 初始化購買服務
   */
  async initialize(): Promise<boolean> {
    if (!isNative()) {
      console.log('[Purchase] Not a native platform, skipping initialization');
      return false;
    }

    if (this.initialized) {
      console.log('[Purchase] Already initialized');
      return true;
    }

    try {
      // 檢查 cordova-plugin-purchase 是否可用
      if (typeof window === 'undefined' || !(window as any).CdvPurchase) {
        console.warn('[Purchase] cordova-plugin-purchase not found');
        return false;
      }

      const { Store, ProductType, Platform } = (window as any).CdvPurchase;
      if (!Store) {
        console.warn('[Purchase] Store not available');
        return false;
      }

      this.store = Store;
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
      await this.store.initialize([storePlatform]);
      console.log('[Purchase] Store initialized');

      // 更新產品信息
      await this.store.update();
      console.log('[Purchase] Products updated');

      // 設置全局錯誤處理
      this.store.error((error: any) => {
        console.error('[Purchase] Store error:', error);
      });

      this.initialized = true;
      console.log('[Purchase] Purchase service initialized successfully');
      return true;
    } catch (error) {
      console.error('[Purchase] Initialization failed:', error);
      return false;
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
