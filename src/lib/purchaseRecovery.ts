import { isNative, getPlatform } from "@/lib/capacitor";
import { supabase } from "@/integrations/supabase/client";
import { purchaseService, PRODUCT_ID_MAP } from "@/lib/purchase";

const ANDROID_PRODUCT_IDS = new Set(Object.values(PRODUCT_ID_MAP).map((p) => p.android));

type PendingTx = {
  productId: string;
  purchaseToken: string;
  transactionId: string;
  finish: () => Promise<unknown>;
};

export async function recoverAndroidPendingPurchasesOnLogin(): Promise<number> {
  if (!isNative() || getPlatform() !== "android") return 0;

  try {
    if (!purchaseService.isInitialized()) {
      const ok = await purchaseService.initialize();
      if (!ok) return 0;
    }

    const store = purchaseService.getStore();
    if (!store) return 0;

    const seen = new Set<string>();
    const pending: PendingTx[] = [];

    await new Promise<void>((resolve) => {
      let done = false;
      const finishCollect = () => {
        if (done) return;
        done = true;
        try {
          store.off(collectApproved);
        } catch {
          // ignore listener cleanup error
        }
        resolve();
      };

      const timer = setTimeout(() => finishCollect(), 4000);
      const collectApproved = (tx: any) => {
        const productId = String(tx?.products?.[0]?.id || "");
        if (!productId || !ANDROID_PRODUCT_IDS.has(productId)) return;

        const purchaseToken = String(tx?.parentReceipt?.purchaseToken || tx?.purchaseToken || tx?.receipt || "");
        if (!purchaseToken) return;

        const transactionId = String(tx?.transactionId || tx?.parentReceipt?.orderId || "");
        const uniqKey = `${productId}:${purchaseToken}`;
        if (seen.has(uniqKey)) return;
        seen.add(uniqKey);

        pending.push({
          productId,
          purchaseToken,
          transactionId,
          finish: () => tx.finish(),
        });
      };

      store.when().approved(collectApproved);
      Promise.resolve(store.update())
        .catch(() => undefined)
        .finally(() => {
          setTimeout(() => {
            clearTimeout(timer);
            finishCollect();
          }, 800);
        });
    });

    let recoveredCount = 0;
    let recoveredTokens = 0;

    for (const tx of pending) {
      const { data, error } = await supabase.functions.invoke("verify-google-play-purchase", {
        body: {
          purchaseToken: tx.purchaseToken,
          transactionId: tx.transactionId || undefined,
          productId: tx.productId,
          packageName: "com.votechaos.app",
          platform: "android",
        },
      });
      if (error || !data?.success) continue;

      try {
        await tx.finish();
      } catch {
        // token already issued by server; finish failure should not block recovery summary
      }

      recoveredCount += 1;
      recoveredTokens += Number(data?.tokens || 0);
    }

    // 登入階段只做補單；提示文案由購買流程/通知頁處理，避免硬編碼 UI 文字。
    return recoveredCount;
  } catch (e) {
    console.warn("[PurchaseRecovery] login recovery failed:", e);
    return 0;
  }
}

