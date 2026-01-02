import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import { toast } from 'sonner';
import { isNative, getPlatform } from '@/lib/capacitor';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUIText } from './useUIText';

// 產品 ID 映射（對應 Google Play / App Store 的產品 ID）
const PRODUCT_ID_MAP: Record<number, {
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

export const usePurchase = () => {
  const { user } = useAuth();
  const { refreshProfile } = useProfile();
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const [isProcessing, setIsProcessing] = useState(false);

  const purchaseTokenPack = async (packageId: number) => {
    if (!user) {
      toast.error(getText('recharge.toast.loginRequired', '請先登入'));
      return;
    }

    const productInfo = PRODUCT_ID_MAP[packageId];
    if (!productInfo) {
      toast.error(getText('recharge.toast.invalidPackage', '無效的儲值方案'));
      return;
    }

    setIsProcessing(true);

    try {
      // 檢查用戶是否被限制儲值
      const { checkUserRestriction } = await import('@/lib/userRestrictions');
      const restriction = await checkUserRestriction(user.id, 'recharge');
      if (restriction.restricted) {
        toast.error(restriction.reason || getText('recharge.toast.restricted', '儲值功能已被暫停'));
        setIsProcessing(false);
        return;
      }

      const platform = getPlatform();
      const productId = platform === 'ios' ? productInfo.ios : productInfo.android;

      if (isNative()) {
        // 原生 App：使用內購
        await handleNativePurchase(packageId, productId, platform);
      } else {
        // Web 版：使用模擬購買（或未來整合 Stripe）
        await handleWebPurchase(packageId, productInfo);
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      toast.error(
        error.message || getText('recharge.toast.failure.desc', '購買失敗，請稍後再試')
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // 處理原生 App 內購
  const handleNativePurchase = async (
    packageId: number,
    productId: string,
    platform: string
  ) => {
    try {
      // 動態導入 CdvPurchase
      const { Store, ProductType, Platform } = window.CdvPurchase || {};

      if (!Store) {
        throw new Error('Store plugin not found. Please ensure cordova-plugin-purchase is installed.');
      }

      const store = Store;

      // 1. 決定商店類型
      const storePlatform = platform === 'ios' ? Platform.APPLE_APPSTORE : Platform.GOOGLE_PLAY;

      // 2. 初始化商店
      // 注意：實際應用中，最好在 App 啟動時進行初始化，這裡為了簡化放在購買流程中
      if (!store.get(productId)) {
        store.register({
          id: productId,
          type: ProductType.CONSUMABLE,
          platform: storePlatform,
        });
      }

      // 3. 設置事件監聽
      // 監聽購買已批准 (User has purchased the product)
      const approvedListener = store.when()
        .product(productId)
        .approved(async (transaction: any) => {
          try {
            // 4. 驗證購買 (呼叫後端 Supabase Edge Function)
            const verifyFunction = platform === 'android'
              ? 'verify-google-play-purchase'
              : 'verify-app-store-purchase';

            console.log(`Verifying purchase on ${platform} via ${verifyFunction}...`);

            const { data, error } = await supabase.functions.invoke(verifyFunction, {
              body: {
                purchaseToken: transaction.purchaseToken || transaction.receipt,
                // iOS 的 receipt 通常比較長，或是需要 transactionId
                transactionId: transaction.transactionId,
                productId: productId,
                packageName: 'com.votechaos.app',
                platform: platform // 傳遞平台資訊給後端
              },
            });

            if (error) throw error;

            // 5. 完成交易
            await transaction.finish();

            // 6. 顯示成功與刷新
            const productInfo = PRODUCT_ID_MAP[packageId];
            const totalTokens = (productInfo.tokens + productInfo.bonus).toLocaleString();

            toast.success(
              getText('recharge.toast.success.title', '購買成功！'),
              {
                description: getText('recharge.toast.success.desc', '已獲得 {{amount}} 代幣')
                  .replace('{{amount}}', totalTokens),
              }
            );

            await refreshProfile();

            // 移除監聽器
            approvedListener.remove();

          } catch (err: any) {
            console.error('Verification failed:', err);
            toast.error('驗證失敗: ' + (err.message || 'Unknown error'));
          }
        });

      // 7. 刷新商店以獲取最新產品資訊
      await store.initialize([storePlatform]);
      await store.update();

      // 4. 發起購買
      const product = store.get(productId);
      if (!product) {
        throw new Error('Product not found: ' + productId);
      }

      if (!product.canPurchase) {
        throw new Error('Product cannot be purchased currently.');
      }

      await product.getOffer().order();

    } catch (error: any) {
      console.error('Native purchase error:', error);
      // 詳細錯誤處理
      if (error.code === 6777001) { // 示例錯誤碼
        toast.error('使用者取消了購買');
      } else {
        toast.error(error.message || '購買流程發生錯誤');
      }
      throw error;
    }
  };

  // 處理 Web 版購買（暫時使用模擬，未來可整合 Stripe）
  const handleWebPurchase = async (
    packageId: number,
    productInfo: { tokens: number; bonus: number }
  ) => {
    // Web 版暫時使用模擬購買
    // 未來可以整合 Stripe 或其他支付服務
    toast.info(
      getText('recharge.web.notImplemented', 'Web 版內購功能開發中，請使用 App 版進行購買')
    );

    // 暫時：直接發放代幣（僅用於測試）
    // 生產環境應該移除這段，改為整合真實支付
    const totalTokens = productInfo.tokens + productInfo.bonus;
    const { error } = await supabase.rpc('add_tokens', {
      user_id: user!.id,
      token_amount: totalTokens,
    });

    if (error) throw error;

    // 記錄交易
    await supabase.from('token_transactions').insert({
      user_id: user!.id,
      amount: totalTokens,
      transaction_type: 'deposit',
      description: `Web 測試購買 - 方案 ${packageId}`,
    });

    toast.success(
      getText('recharge.toast.success.title', '購買成功！'),
      {
        description: getText('recharge.toast.success.desc', '已獲得 {{amount}} 代幣')
          .replace('{{amount}}', totalTokens.toLocaleString()),
      }
    );

    await refreshProfile();
  };

  return {
    purchaseTokenPack,
    isProcessing,
  };
};

