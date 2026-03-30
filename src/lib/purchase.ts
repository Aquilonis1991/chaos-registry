// 購買服務 - 初始化和管理內購
import { isNative, getPlatform } from './capacitor';

// 產品 ID 映射
export const PRODUCT_ID_MAP: Record<number, {
  android: string;
  ios: string;
  tokens: number;
  bonus: number;
}> = {
  1: { android: 'token_pack_small', ios: 'token_pack_30', tokens: 100, bonus: 0 },
  2: { android: 'token_pack_medium', ios: 'token_pack_150', tokens: 600, bonus: 0 },
  3: { android: 'token_pack_large', ios: 'token_pack_290', tokens: 1300, bonus: 0 },
  4: { android: 'token_pack_xlarge', ios: 'token_pack_790', tokens: 4000, bonus: 0 },
};

// 購買服務單例
class PurchaseService {
  private initialized = false;
  private store: any = null;

  /**
   * 取得 Cordova 內購插件（cordova-plugin-purchase 會掛在 CdvPurchase 與 window.store）
   * 插件 API：應使用 CdvPurchase.store（小寫，單例實例），不是 CdvPurchase.Store（類別）
   */
  private getCdvPurchase(): any {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return w.CdvPurchase ?? null;
  }

  /**
   * 初始化購買服務
   * 根本原因：cordova-plugin-purchase v13 暴露的是 CdvPurchase.store（單例實例），
   * 插件在 Cordova 下用 setTimeout(initCDVPurchase, 0) 建立該實例，故需使用 store 而非 Store 類別。
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
      const CdvPurchase = this.getCdvPurchase();
      if (!CdvPurchase) {
        console.warn('[Purchase] cordova-plugin-purchase (CdvPurchase) not found');
        return false;
      }

      // 插件 API：使用單例實例 CdvPurchase.store（小寫），不是類別 CdvPurchase.Store
      // store 在插件內由 initCDVPurchase() 以 setTimeout(0) 建立，若尚未存在則等一檔
      let storeInstance = CdvPurchase.store;
      if (!storeInstance && typeof Promise !== 'undefined') {
        await new Promise<void>((r) => setTimeout(r, 0));
        storeInstance = CdvPurchase.store;
      }
      if (!storeInstance) {
        console.warn('[Purchase] CdvPurchase.store (instance) not ready');
        return false;
      }

      const { ProductType, Platform } = CdvPurchase;
      if (!ProductType || !Platform) {
        console.warn('[Purchase] ProductType or Platform not available');
        return false;
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
      await this.store.initialize([storePlatform]);
      console.log('[Purchase] Store initialized');

      // 更新產品信息
      await this.store.update();
      console.log('[Purchase] Products updated');

      // 處理 pending transactions（iOS：避免已購買的產品不會再彈出 Apple Pay）
      if (platform === 'ios') {
        try {
          // 監聽所有 approved transactions（包括之前未完成的）
          this.store.when().approved((transaction: any) => {
            const txProductId = transaction.products?.[0]?.id;
            console.log('[Purchase] Found pending approved transaction:', {
              productId: txProductId,
              transactionId: transaction.transactionId,
            });
            
            // 對於 pending transactions，如果已經超過 5 分鐘，直接 finish（避免卡住）
            // 注意：這裡不進行驗證，因為可能是舊的、已經驗證過的交易
            // 真正的驗證應該在用戶主動購買時進行
            const purchaseDate = transaction.purchaseDate ? new Date(transaction.purchaseDate) : null;
            if (purchaseDate) {
              const ageMinutes = (Date.now() - purchaseDate.getTime()) / (1000 * 60);
              if (ageMinutes > 5) {
                console.log('[Purchase] Finishing old pending transaction (older than 5 minutes):', txProductId);
                transaction.finish().catch((e: any) => {
                  console.warn('[Purchase] Failed to finish old transaction:', e);
                });
                return;
              }
            }
            
            // 對於較新的 pending transactions，記錄但不自動處理
            // 讓用戶主動購買時再處理（會觸發新的 approved 事件）
            console.log('[Purchase] Pending transaction found, will be handled on next purchase attempt');
          });
        } catch (e) {
          console.warn('[Purchase] Failed to set up pending transaction handler:', e);
        }
      }

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
