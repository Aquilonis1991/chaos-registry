import { useEffect, useRef, useState } from 'react';
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
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const iosRecoveryStartedRef = useRef(false);

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
      // 只有在錯誤時才立即設置 isProcessing = false
      // 成功時，isProcessing 會在 approvedCallback 的 finally 中設置
      setIsProcessing(false);
    } finally {
      // 僅 Web 在此關閉遮罩；原生內購由 approvedCallback / errorCallback 在餘額更新後關閉
      if (!isNative()) setIsProcessing(false);
    }
    // 注意：成功時，isProcessing 會在 approvedCallback 的 finally 中設置
    // 這裡不設置，讓 approvedCallback 負責管理 isProcessing 的生命週期
  };

  // 處理原生 App 內購
  const handleNativePurchase = async (
    packageId: number,
    productId: string,
    platform: string
  ) => {
    try {
      // iOS：cordova-plugin-purchase 的 Transaction 物件在部分環境不會帶 receipt，需要從 Bundle 讀取
      // 但我們無法直接從 JS 讀取 Bundle，所以改用：交易完成後調用 refreshReceipts() 並從 store.adapter 取得
      if (platform === 'ios') {
        // 確保購買服務已初始化
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
          throw new Error(`產品不存在: ${productId}。請確認產品已在 App Store Connect 中創建。`);
        }

        // 檢查產品是否可購買
        if (!product.canPurchase) {
          console.warn('[Purchase] Product cannot be purchased:', {
            productId,
            state: product.state,
            valid: product.valid,
          });
          
          // iOS：如果產品狀態是 "owned" 或 "approved"，可能是因為有 pending transaction
          // 嘗試 finish 所有該產品的 pending transactions，然後再試一次
          if (platform === 'ios' && (product.state === 'owned' || product.state === 'approved')) {
            console.log('[Purchase] Product in owned/approved state, attempting to finish pending transactions...');
            try {
              // 使用 store.when().approved() 來處理所有 pending approved transactions
              let pendingTxFound = false;
              const pendingTxHandler = (tx: any) => {
                const txProductId = tx.products?.[0]?.id;
                if (txProductId === productId) {
                  pendingTxFound = true;
                  console.log('[Purchase] Found pending transaction, finishing:', tx.transactionId);
                  tx.finish().catch((e: any) => {
                    console.warn('[Purchase] Failed to finish pending transaction:', e);
                  });
                }
              };
              
              // 設置臨時監聽器來處理 pending transactions
              store.when().approved(pendingTxHandler);
              
              // 更新產品狀態以觸發 pending transaction 事件
              await store.update();
              await new Promise(r => setTimeout(r, 500));
              
              // 移除臨時監聽器
              store.off(pendingTxHandler);
              
              // 再次更新產品狀態
              await store.update();
              await new Promise(r => setTimeout(r, 300));
              
              // 重新檢查產品是否可購買
              const updatedProduct = store.get(productId);
              if (updatedProduct?.canPurchase) {
                console.log('[Purchase] Product is now purchasable after finishing pending transactions');
              } else {
                throw new Error('產品目前無法購買，請稍後再試');
              }
            } catch (e) {
              console.error('[Purchase] Error handling pending transactions:', e);
              throw new Error('產品目前無法購買，請稍後再試');
            }
          } else {
            throw new Error('產品目前無法購買，請稍後再試');
          }
        }

        // 設置事件監聽
        const approvedCallback = async (transaction: any) => {
          const txProductId = transaction.products?.[0]?.id;
          if (txProductId !== productId) {
            // 如果是其他產品的 pending transaction，直接 finish（避免卡住）
            const purchaseDate = transaction.purchaseDate ? new Date(transaction.purchaseDate) : null;
            if (purchaseDate) {
              const ageMinutes = (Date.now() - purchaseDate.getTime()) / (1000 * 60);
              if (ageMinutes > 1) {
                console.log('[Purchase] Finishing other product\'s old pending transaction:', txProductId);
                transaction.finish().catch(() => {});
              }
            }
            return;
          }
          store.off(approvedCallback);
          
          // 確保 isProcessing 保持為 true，直到 refreshProfile 完成
          // 這樣遮罩會持續顯示
          
          try {
            // iOS：交易完成後，嘗試刷新 receipt 並從多個來源取得
            let receiptOrToken = '';
            
            // 方法 1：先嘗試從 transaction 物件取得（雖然通常為空）
            const extractFromTransaction = (tx: any): string => {
              const toStringSafe = (v: any): string => {
                if (typeof v === 'string') return v;
                if (!v) return '';
                if (typeof v === 'object') {
                  const nested = v.appStoreReceipt ?? v.receiptData ?? v.receipt ?? v.data ?? v.base64 ?? '';
                  if (typeof nested === 'string') return nested;
                }
                return '';
              };
              
              return (
                toStringSafe(tx.parentReceipt?.appStoreReceipt) ||
                toStringSafe(tx.appStoreReceipt) ||
                toStringSafe(tx.parentReceipt?.receiptData) ||
                toStringSafe(tx.receiptData) ||
                toStringSafe(tx.parentReceipt?.receipt) ||
                toStringSafe(tx.receipt) ||
                ''
              );
            };
            
            receiptOrToken = extractFromTransaction(transaction);
            
            // 方法 2：如果 transaction 沒有，嘗試從 store/adapter 取得全域 receipt
            if (!receiptOrToken) {
              const w = window as any;
              const CdvPurchase = w?.CdvPurchase;
              const storeInstance = CdvPurchase?.store ?? store;
              const adapter = storeInstance?.adapter ?? storeInstance?._adapter;
              const apple = CdvPurchase?.AppleAppStore ?? CdvPurchase?.AppleAppStoreAdapter ?? null;
              
              const pick = (v: any): string => (typeof v === 'string' ? v : '');
              receiptOrToken =
                pick(storeInstance?.appStoreReceipt) ||
                pick(storeInstance?.receipt) ||
                pick(adapter?.appStoreReceipt) ||
                pick(adapter?.receipt) ||
                pick(apple?.appStoreReceipt) ||
                pick(apple?.receipt) ||
                '';
            }
            
            // 方法 3：如果還是沒有，強制調用 refreshReceipts() 並等待更長時間
            if (!receiptOrToken) {
              console.log('[Purchase] Receipt not found, attempting to refresh receipts...');
              try {
                // 先更新 store 狀態
                await store.update();
                await new Promise(r => setTimeout(r, 300));
                
                // 嘗試調用 refreshReceipts（如果存在）
                if (typeof store.refreshReceipts === 'function') {
                  await store.refreshReceipts();
                }
                
                // 等待 receipt 更新（最多 5 秒，每 200ms 檢查一次）
                for (let i = 0; i < 25; i++) {
                  await new Promise(r => setTimeout(r, 200));
                  
                  // 重新檢查所有可能的 receipt 來源
                  const w = window as any;
                  const CdvPurchase = w?.CdvPurchase;
                  const storeInstance = CdvPurchase?.store ?? store;
                  const adapter = storeInstance?.adapter ?? storeInstance?._adapter;
                  const apple = CdvPurchase?.AppleAppStore ?? CdvPurchase?.AppleAppStoreAdapter ?? null;
                  
                  const pick = (v: any): string => (typeof v === 'string' ? v : '');
                  receiptOrToken =
                    pick(storeInstance?.appStoreReceipt) ||
                    pick(storeInstance?.receipt) ||
                    pick(adapter?.appStoreReceipt) ||
                    pick(adapter?.receipt) ||
                    pick(apple?.appStoreReceipt) ||
                    pick(apple?.receipt) ||
                    '';
                  
                  if (receiptOrToken) {
                    console.log('[Purchase] Receipt found after refresh, length:', receiptOrToken.length);
                    break;
                  }
                }
              } catch (e) {
                console.warn('[Purchase] refreshReceipts() failed:', e);
              }
            }

            // 方法 4（iOS 最可靠）：透過原生插件直接讀取 Bundle receipt（appStoreReceiptURL）
            if (!receiptOrToken) {
              try {
                const { ReceiptReader } = await import('@/plugins/ReceiptReader');
                const rr = await ReceiptReader.getReceipt();
                if (rr?.receiptData) {
                  receiptOrToken = rr.receiptData;
                  console.log('[Purchase] Receipt found via ReceiptReader plugin, length:', receiptOrToken.length);
                }
              } catch (e) {
                console.warn('[Purchase] ReceiptReader.getReceipt() failed:', e);
              }
            }
            
            const transactionId = transaction.transactionId ?? transaction.parentReceipt?.orderId ?? '';
            
            console.log('[Purchase] Transaction approved:', {
              productId,
              transactionId,
              receiptOrToken: receiptOrToken ? `${String(receiptOrToken).slice(0, 20)}...` : '(empty)',
            });
            
            // 根本解決方案：如果 receipt 為空，改用 transactionId 驗證（Apple 推薦的新方法）
            // 根據 cordova-plugin-purchase GitHub issue #1495，Apple 已棄用舊的 VerifyReceipt 端點
            // 新做法是使用 transactionID 透過 App Store Server API 驗證
            if (!receiptOrToken) {
              console.warn('[Purchase] Receipt not found, falling back to transactionId-only verification');
              
              // 如果沒有 receipt 但有 transactionId，仍然可以驗證（後端會使用 App Store Server API）
              if (!transactionId) {
                console.error('[Purchase] No receipt and no transactionId. Transaction:', transaction);
                throw new Error('購買資料不完整，無法驗證。請稍後再試或重新開啟 App。');
              }
              
              // 使用 transactionId 驗證（後端會透過 App Store Server API 驗證）
              const { data, error } = await supabase.functions.invoke('verify-app-store-purchase', {
                body: {
                  transactionId: transactionId,
                  productId,
                  packageName: 'com.votechaos.app',
                  platform,
                  // 不傳 receiptData，讓後端使用 App Store Server API
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
              console.log('[Purchase] Transaction finished (transactionId-only verification)');
              
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
              
              // 在代幣刷新前顯示遮罩
              // 確保 isProcessing 保持為 true，直到 refreshProfile 完成
              setIsRefreshingProfile(true);
              try {
                await refreshProfile();
              } finally {
                setIsRefreshingProfile(false);
                // 在 refreshProfile 完成後才設置 isProcessing = false
                setIsProcessing(false);
              }
              return;
            }
            
            // 如果有 receipt，使用傳統的 receipt 驗證
            const { data, error } = await supabase.functions.invoke('verify-app-store-purchase', {
              body: {
                receiptData: receiptOrToken,
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
            
            // 在代幣刷新前顯示遮罩
            // 確保 isProcessing 保持為 true，直到 refreshProfile 完成
            setIsRefreshingProfile(true);
            try {
              await refreshProfile();
            } finally {
              setIsRefreshingProfile(false);
              // 在 refreshProfile 完成後才設置 isProcessing = false
              setIsProcessing(false);
            }
          } catch (err: any) {
            console.error('[Purchase] Verification failed:', err);
            toast.error(
              getText('recharge.toast.verificationFailed', '驗證失敗: {{error}}')
                .replace('{{error}}', err.message || 'Unknown error')
            );
            // 驗證失敗時也要關閉遮罩
            setIsRefreshingProfile(false);
            setIsProcessing(false);
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
        
        return;
      }

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

      const extractReceiptString = (tx: any, osPlatform: string): string => {
        const toStringSafe = (v: any): string => {
          if (typeof v === 'string') return v;
          if (!v) return '';
          if (typeof v === 'object') {
            const nested =
              v.appStoreReceipt ??
              v.receiptData ??
              v.receipt ??
              v.data ??
              v.base64 ??
              '';
            if (typeof nested === 'string') return nested;
          }
          return '';
        };

        if (osPlatform === 'ios') {
          return (
            toStringSafe(tx.parentReceipt?.appStoreReceipt) ||
            toStringSafe(tx.appStoreReceipt) ||
            toStringSafe(tx.parentReceipt?.receiptData) ||
            toStringSafe(tx.receiptData) ||
            toStringSafe(tx.parentReceipt?.receipt) ||
            toStringSafe(tx.receipt) ||
            ''
          );
        }

        return (
          toStringSafe(tx.parentReceipt?.purchaseToken) ||
          toStringSafe(tx.purchaseToken) ||
          toStringSafe(tx.receipt) ||
          ''
        );
      };

      const verifyAndFinalizeTransaction = async (transaction: any) => {
        let receiptOrToken = extractReceiptString(transaction, platform);

        if (!receiptOrToken && platform === 'ios') {
          const w = window as any;
          const CdvPurchase = w?.CdvPurchase;
          const storeInstance = CdvPurchase?.store ?? store;
          const adapter = storeInstance?.adapter ?? storeInstance?._adapter;
          const apple = CdvPurchase?.AppleAppStore ?? CdvPurchase?.AppleAppStoreAdapter ?? null;

          const pick = (v: any): string => (typeof v === 'string' ? v : '');
          receiptOrToken =
            pick(storeInstance?.appStoreReceipt) ||
            pick(storeInstance?.receipt) ||
            pick(adapter?.appStoreReceipt) ||
            pick(adapter?.receipt) ||
            pick(apple?.appStoreReceipt) ||
            pick(apple?.receipt) ||
            '';
        }

        const transactionId =
          transaction.transactionId ??
          transaction.parentReceipt?.orderId ??
          '';

        if (!receiptOrToken) {
          throw new Error('購買資料不完整，無法驗證');
        }

        const verifyFunction = platform === 'android'
          ? 'verify-google-play-purchase'
          : 'verify-app-store-purchase';
        const { data, error } = await supabase.functions.invoke(verifyFunction, {
          body: {
            ...(platform === 'ios'
              ? { receiptData: receiptOrToken }
              : { purchaseToken: receiptOrToken }),
            transactionId: transactionId || undefined,
            productId,
            packageName: 'com.votechaos.app',
            platform,
          },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || '驗證失敗');

        await transaction.finish();
        if (data?.alreadyProcessed) {
          const adminReceiptTitle = getText(
            'recharge.toast.adminReceipt.title',
            '[行政回執] 延遲入帳完成'
          );
          const amountText = Number(data?.tokens || 0).toLocaleString();
          const adminReceiptDesc = getText(
            'recharge.toast.adminReceipt.descWithAmount',
            '[行政回執] 偵測到一筆未結案的資源撥付。{{amount}} 代幣 已存入您的錢包。'
          ).replace('{{amount}}', amountText);
          toast.info(
            adminReceiptTitle,
            {
              description:
                (typeof data?.administrativeReceipt?.content === 'string' &&
                data.administrativeReceipt.content.trim()
                  ? data.administrativeReceipt.content
                  : adminReceiptDesc),
            }
          );
        }
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

        setIsRefreshingProfile(true);
        try {
          await refreshProfile();
        } finally {
          setIsRefreshingProfile(false);
          setIsProcessing(false);
        }
      };

      const recoverOwnedPurchaseIfAny = async () => {
        if (platform !== 'android') return false;
        return await new Promise<boolean>(async (resolve) => {
          let settled = false;
          const settle = (value: boolean) => {
            if (settled) return;
            settled = true;
            resolve(value);
          };
          const timer = setTimeout(() => {
            store.off(recoverApprovedCallback);
            settle(false);
          }, 5000);

          const recoverApprovedCallback = async (transaction: any) => {
            const txProductId = transaction.products?.[0]?.id;
            if (txProductId !== productId) return;
            clearTimeout(timer);
            store.off(recoverApprovedCallback);
            try {
              await verifyAndFinalizeTransaction(transaction);
              settle(true);
            } catch (e) {
              console.error('[Purchase] Recover owned purchase failed:', e);
              settle(false);
            }
          };

          store.when().approved(recoverApprovedCallback);
          try {
            await store.update();
          } catch (e) {
            console.error('[Purchase] store.update() failed during owned recovery:', e);
            clearTimeout(timer);
            store.off(recoverApprovedCallback);
            settle(false);
          }
        });
      };

      // 檢查產品是否可購買
      if (!product.canPurchase) {
        console.warn('[Purchase] Product cannot be purchased:', {
          productId,
          state: product.state,
          valid: product.valid,
        });
        if (platform === 'android' && (product.state === 'owned' || product.state === 'approved')) {
          toast.info(getText('recharge.toast.recoveringPending', '偵測到未完成交易，正在補發代幣...'));
          const recovered = await recoverOwnedPurchaseIfAny();
          if (recovered) return;
          throw new Error('偵測到既有交易，但補發失敗，請稍後再試');
        }
        throw new Error('產品目前無法購買，請稍後再試');
      }

      // 設置事件監聽（cordova-plugin-purchase v13：when() 無 .product()，用 approved/error 並在回調內過濾 productId）
      const approvedCallback = async (transaction: any) => {
        const txProductId = transaction.products?.[0]?.id;
        if (txProductId !== productId) return;
        store.off(approvedCallback);
        try {
          // iOS：有些情況 receipt 不會立即附在 transaction 上，先更新一次商店狀態再取值
          try {
            if (platform === 'ios' && typeof store.update === 'function') {
              await store.update();
              await new Promise((r) => setTimeout(r, 150));
            }
          } catch (e) {
            console.warn('[Purchase] store.update() before receipt extraction failed:', e);
          }
          let receiptOrToken = extractReceiptString(transaction, platform);

          // iOS：若 transaction 上仍拿不到，嘗試從 store/adapter 取得全域 App Store receipt
          if (!receiptOrToken && platform === 'ios') {
            const w = window as any;
            const CdvPurchase = w?.CdvPurchase;
            const storeInstance = CdvPurchase?.store ?? store;
            const adapter = storeInstance?.adapter ?? storeInstance?._adapter;
            const apple = CdvPurchase?.AppleAppStore ?? CdvPurchase?.AppleAppStoreAdapter ?? null;

            const pick = (v: any): string => (typeof v === 'string' ? v : '');
            receiptOrToken =
              pick(storeInstance?.appStoreReceipt) ||
              pick(storeInstance?.receipt) ||
              pick(adapter?.appStoreReceipt) ||
              pick(adapter?.receipt) ||
              pick(apple?.appStoreReceipt) ||
              pick(apple?.receipt) ||
              '';

            // 一次性診斷：協助確認插件實際提供哪些欄位（避免噪音）
            try {
              (w.__purchaseReceiptDiagOnce ??= false);
              if (w.__purchaseReceiptDiagOnce === false) {
                w.__purchaseReceiptDiagOnce = true;
                console.log('[Purchase][diag] iOS receipt missing on transaction. Inspecting available fields:', {
                  transactionOwnProps: Object.getOwnPropertyNames(transaction ?? {}),
                  storeOwnProps: Object.getOwnPropertyNames(storeInstance ?? {}),
                  adapterOwnProps: Object.getOwnPropertyNames(adapter ?? {}),
                  appleOwnProps: Object.getOwnPropertyNames(apple ?? {}),
                });
              }
            } catch {
              // ignore
            }
          }
          const transactionId =
            transaction.transactionId ??
            transaction.parentReceipt?.orderId ??
            '';

          console.log('[Purchase] Transaction approved:', {
            productId,
            transactionId,
            receiptOrToken: receiptOrToken ? `${String(receiptOrToken).slice(0, 20)}...` : '(empty)',
          });
          await verifyAndFinalizeTransaction(transaction);
        } catch (err: any) {
          console.error('[Purchase] Verification failed:', err);
          toast.error(
            getText('recharge.toast.verificationFailed', '驗證失敗: {{error}}')
              .replace('{{error}}', err.message || 'Unknown error')
          );
        } finally {
          setIsProcessing(false);
        }
      };
      store.when().approved(approvedCallback);

      const errorCallback = (error: any) => {
        if (error?.productId != null && error.productId !== productId) return;
        store.off(errorCallback);
        setIsProcessing(false);
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
        setIsProcessing(false);
        return;
      } else if (error.code === 'ITEM_ALREADY_OWNED' || error.message?.includes('already owned')) {
        const recovered = await recoverOwnedPurchaseIfAny();
        if (recovered) return;
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

    // 在代幣刷新前顯示遮罩
    // 確保 isProcessing 保持為 true，直到 refreshProfile 完成
    setIsRefreshingProfile(true);
    try {
      await refreshProfile();
    } finally {
      setIsRefreshingProfile(false);
      // 在 refreshProfile 完成後才設置 isProcessing = false
      setIsProcessing(false);
    }
  };

  // iOS 登入後補單（0s/5s/20s）
  useEffect(() => {
    if (!user?.id) return;
    if (!isNative() || getPlatform() !== 'ios') return;
    if (iosRecoveryStartedRef.current) return;
    iosRecoveryStartedRef.current = true;

    const runRecovery = async (delayMs: number) => {
      await new Promise((r) => setTimeout(r, delayMs));
      try {
        if (!purchaseService.isInitialized()) {
          await purchaseService.initialize();
        }
        const store = purchaseService.getStore();
        if (!store) return;

        try {
          await store.update();
        } catch {
          // ignore
        }

        // 盡量兼容不同插件版本可取得 pending approved transactions 的位置
        const receipts = Array.isArray(store.localReceipts) ? store.localReceipts : [];
        const candidates: any[] = [];
        for (const r of receipts) {
          const txs = Array.isArray(r?.transactions) ? r.transactions : [];
          for (const tx of txs) candidates.push(tx);
        }

        for (const tx of candidates) {
          const state = String(tx?.state ?? '').toLowerCase();
          const isApproved = state.includes('approved');
          const transactionId = tx?.transactionId ?? tx?.id ?? '';
          const productId = tx?.products?.[0]?.id ?? tx?.productId ?? '';
          if (!isApproved || !transactionId || !productId) continue;

          const { data, error } = await supabase.functions.invoke('verify-app-store-purchase', {
            body: {
              transactionId,
              productId,
              packageName: 'com.votechaos.app',
              platform: 'ios',
            },
          });
          if (error) continue;

          if (data?.success && (data?.applied || data?.alreadyProcessed)) {
            try {
              if (typeof tx.finish === 'function') {
                await tx.finish();
              }
            } catch {
              // ignore
            }

            if (data?.applied) {
              toast.success(
                getText('recharge.toast.adminReceipt.title', '系統已補發儲值'),
                {
                  description: getText('recharge.toast.adminReceipt.desc', '延遲入帳已完成，請查收失序值'),
                }
              );
              await refreshProfile();
            }
          }
        }
      } catch (e) {
        console.warn('[PurchaseRecovery] iOS recovery failed:', e);
      }
    };

    runRecovery(0);
    runRecovery(5000);
    runRecovery(20000);
  }, [user?.id, getText, refreshProfile]);

  return {
    purchaseTokenPack,
    isProcessing,
    isRefreshingProfile,
  };
};

