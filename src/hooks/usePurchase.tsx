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
      // 確保購買服務已初始化
      if (!purchaseService.isInitialized()) {
        console.log('[Purchase] Service not initialized, initializing now...');
        const initResult = await purchaseService.initialize();
        if (!initResult.success) {
          throw new Error(initResult.error || '無法初始化購買服務，請確認已安裝內購插件');
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

      // 設置事件監聽
      // 監聽購買已批准 (User has purchased the product)
      const approvedListener = store.when().approved(async (transaction: any) => {
        // 檢查此交易是否包含目標產品
        const hasProduct = transaction.products && transaction.products.some((p: any) => p.id === productId);
        if (!hasProduct) {
          return;
        }

        try {
          console.log('[Purchase] Transaction approved:', {
            productId,
            transactionId: transaction.transactionId,
            purchaseToken: transaction.purchaseToken || transaction.receipt,
          });


          console.log('[Purchase] Transaction object:', JSON.stringify(transaction));

          // Verify purchase token existence
          // Check multiple possible locations for the token
          const token =
            transaction.purchaseToken ||
            transaction.receipt ||
            (transaction as any).nativePurchase?.token ||
            (transaction as any).nativePurchase?.purchaseToken ||
            (transaction as any).products?.[0]?.token;

          if (!token) {
            console.error('[Purchase] FATAL: No purchaseToken found in transaction');

            // Detailed Debugging for nativePurchase
            const nativeObj = (transaction as any).nativePurchase;
            let nativeDebug = 'undefined';
            if (nativeObj) {
              try {
                nativeDebug = `Keys: [${Object.keys(nativeObj).join(', ')}]`;
              } catch (e) { nativeDebug = 'Access Error'; }
            }

            const keys = Object.keys(transaction || {}).join(', ');
            throw new Error(`No Token. TxKeys:[${keys}] Native:[${nativeDebug}]`);
          }

          // 驗證購買 (呼叫後端 Supabase Edge Function)
          const verifyFunction = platform === 'android'
            ? 'verify-google-play-purchase'
            : 'verify-app-store-purchase';

          const payload = {
            purchaseToken: token,
            transactionId: transaction.transactionId,
            productId: productId,
            packageName: 'com.votechaos.app',
            platform: platform,
          };

          console.log(`[Purchase] Verifying purchase on ${platform} via ${verifyFunction}...`);
          console.log('[Purchase] Payload:', JSON.stringify(payload));

          const { data, error } = await supabase.functions.invoke(verifyFunction, {
            body: payload,
          });

          if (error) {
            console.error('[Purchase] Verification error:', error);

            // 嘗試從錯誤中提取詳細訊息
            let detailedMessage = error.message;

            // Supabase FunctionsClient 拋出的錯誤通常包含 context
            if (error && typeof error === 'object' && 'context' in error) {
              try {
                // 嘗試解析 Response JSON
                const context = (error as any).context;
                if (context && typeof context.json === 'function') {
                  const body = await context.json();
                  console.log('[Purchase] Error body:', body);
                  if (body.message) detailedMessage = body.message;
                  if (body.error) detailedMessage = `${body.error}: ${detailedMessage}`;
                }
              } catch (e) {
                console.warn('[Purchase] Failed to parse error context:', e);
              }
            }

            throw new Error(detailedMessage);
          }

          if (!data?.success) {
            throw new Error(data?.error || '驗證失敗');
          }

          // 完成交易
          await transaction.finish();
          console.log('[Purchase] Transaction finished');

          // 顯示成功與刷新
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
          // Double check after 1 second to ensure DB consistency
          setTimeout(() => refreshProfile(), 1000);

          // 移除監聽器 (Safe check)
          if (approvedListener && typeof (approvedListener as any).remove === 'function') {
            (approvedListener as any).remove();
          }

        } catch (err: any) {
          console.error('[Purchase] Verification failed:', err);
          toast.error(
            getText('recharge.toast.verificationFailed', '驗證失敗: {{error}}')
              .replace('{{error}}', err.message || 'Unknown error')
          );
          // 不完成交易，讓用戶可以重試
        }
      });

      // 監聽購買錯誤 - 在 v13 中通常依靠 order() 的 catch 或全局 error 監聽
      // 因為 store.when().product().error() 已棄用
      // 我們主要依賴下方的 order() try-catch

      /*
      const errorListener = store.when().error((error: any) => {
          console.error('[Purchase] Global Store Error:', error);
          // 這裡可能會捕捉到不相關的錯誤，所以謹慎顯示
      });
      */

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
        description: getText('recharge.toast.success.desc', '已獲得 {{amount}} 代幣')
          .replace('{{amount}}', totalTokens.toLocaleString()),
      }
    );

    await refreshProfile();
    // Double check after 1 second to ensure DB consistency
    setTimeout(() => refreshProfile(), 1000);
  };

  return {
    purchaseTokenPack,
    isProcessing,
  };
};

