import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import { toast } from 'sonner';
import { isNative, getPlatform } from '@/lib/capacitor';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUIText } from './useUIText';
import { purchaseService, PRODUCT_ID_MAP } from '@/lib/purchase';

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
      // 確保購買服務已初始化（內建重試，因 Cordova 插件可能較晚注入）
      if (!purchaseService.isInitialized()) {
        console.log('[Purchase] Service not initialized, initializing now...');
        const initialized = await purchaseService.initialize();
        if (!initialized) {
          throw new Error('無法初始化購買服務。請稍後再試或重新開啟 App 後再點選購買。');
        }
      }

      const store = purchaseService.getStore();
      if (!store) {
        throw new Error('購買服務未初始化');
      }

      // 獲取產品
      const product = store.get(productId);
      if (!product) {
        throw new Error(`產品不存在: ${productId}。請確認產品已在 Google Play Console / App Store Connect 中創建。`);
      }

      // 檢查產品是否可購買
      if (!product.canPurchase) {
        console.warn('[Purchase] Product cannot be purchased:', {
          productId,
          state: product.state,
          valid: product.valid,
        });
        throw new Error('產品目前無法購買，請稍後再試');
      }

      // 設置事件監聽（cordova-plugin-purchase v13：when() 無 .product()，用 approved/error 並在回調內過濾 productId）
      const approvedCallback = async (transaction: any) => {
        const txProductId = transaction.products?.[0]?.id;
        if (txProductId !== productId) return;
        store.off(approvedCallback);
        try {
          // Google Play (v13)：purchaseToken 在 transaction.parentReceipt.purchaseToken，不在 transaction 上
          const purchaseToken =
            transaction.parentReceipt?.purchaseToken ??
            transaction.purchaseToken ??
            transaction.receipt ??
            '';
          const transactionId =
            transaction.transactionId ??
            transaction.parentReceipt?.orderId ??
            '';

          console.log('[Purchase] Transaction approved:', {
            productId,
            transactionId,
            purchaseToken: purchaseToken ? `${purchaseToken.slice(0, 20)}...` : '(empty)',
          });

          if (!purchaseToken) {
            console.error('[Purchase] No purchaseToken in transaction:', transaction);
            throw new Error('購買資料不完整，無法驗證');
          }

          const verifyFunction = platform === 'android'
            ? 'verify-google-play-purchase'
            : 'verify-app-store-purchase';

          console.log(`[Purchase] Verifying purchase on ${platform} via ${verifyFunction}...`);

          const { data, error } = await supabase.functions.invoke(verifyFunction, {
            body: {
              purchaseToken,
              transactionId: transactionId || undefined,
              productId,
              packageName: 'com.votechaos.app',
              platform,
            },
          });

          if (error) {
            console.error('[Purchase] Verification error:', error);
            throw error;
          }

          if (!data?.success) {
            throw new Error(data?.error || '驗證失敗');
          }

          await transaction.finish();
          console.log('[Purchase] Transaction finished');

          // 顯示數量以後端回傳的 data.tokens 為準（與 recharge_amounts 一致）
          const totalTokens =
            data?.tokens != null
              ? Number(data.tokens).toLocaleString()
              : (PRODUCT_ID_MAP[packageId].tokens + PRODUCT_ID_MAP[packageId].bonus).toLocaleString();

          toast.success(
            getText('recharge.toast.success.title', '購買成功！'),
            {
              description: getText('recharge.toast.success.desc', '已獲得 {{amount}} 失序值')
                .replace('{{amount}}', totalTokens),
            }
          );

          await refreshProfile();
        } catch (err: any) {
          console.error('[Purchase] Verification failed:', err);
          toast.error(
            getText('recharge.toast.verificationFailed', '驗證失敗: {{error}}')
              .replace('{{error}}', err.message || 'Unknown error')
          );
        }
      };
      store.when().approved(approvedCallback);

      const errorCallback = (error: any) => {
        if (error?.productId != null && error.productId !== productId) return;
        store.off(errorCallback);
        console.error('[Purchase] Purchase error:', error);
        toast.error(
          getText('recharge.toast.purchaseError', '購買失敗: {{error}}')
            .replace('{{error}}', error?.message || 'Unknown error')
        );
      };
      store.error(errorCallback);

      // 刷新產品信息
      await purchaseService.refreshProducts();

      // 發起購買
      console.log('[Purchase] Ordering product:', productId);
      await product.getOffer().order();
      console.log('[Purchase] Purchase order initiated');

    } catch (error: any) {
      console.error('[Purchase] Native purchase error:', error);
      
      // 詳細錯誤處理
      let errorMessage = error.message || getText('recharge.toast.failure.desc', '購買失敗，請稍後再試');
      
      // 處理常見的購買錯誤
      if (error.code === 6777001 || error.code === 'USER_CANCELLED' || error.message?.includes('cancelled')) {
        errorMessage = getText('recharge.toast.userCancelled', '使用者取消了購買');
        // 用戶取消不需要顯示錯誤提示
        return;
      } else if (error.code === 'ITEM_ALREADY_OWNED' || error.message?.includes('already owned')) {
        errorMessage = getText('recharge.toast.alreadyOwned', '您已經擁有此產品');
      } else if (error.code === 'ITEM_UNAVAILABLE' || error.message?.includes('unavailable')) {
        errorMessage = getText('recharge.toast.unavailable', '產品目前無法購買');
      } else if (error.message?.includes('not found') || error.message?.includes('Product not found')) {
        errorMessage = getText('recharge.toast.productNotFound', '產品不存在，請確認產品已在商店中創建');
      } else if (error.message?.includes('not initialized') || error.message?.includes('Store not initialized')) {
        errorMessage = getText('recharge.toast.storeNotReady', '購買服務未就緒，請稍後再試');
      }
      
      toast.error(errorMessage);
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
        description: getText('recharge.toast.success.desc', '已獲得 {{amount}} 失序值')
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

