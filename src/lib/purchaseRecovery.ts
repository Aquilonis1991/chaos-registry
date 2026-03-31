import { isNative, getPlatform } from "@/lib/capacitor";
import { supabase } from "@/integrations/supabase/client";
import { purchaseService, PRODUCT_ID_MAP } from "@/lib/purchase";
export const RECOVERY_RECEIPT_STORAGE_KEY = "purchase_recovery_receipt";

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

    // 登入補單成功時先寫入待顯示回執，交由 UI 就緒後統一彈窗（避免 Auth 初始化期看不到）。
    if (recoveredCount > 0) {
      try {
        const payload = {
          title: "[行政回執] 延遲入帳完成",
          description: `[行政回執] 偵測到一筆未結案的資源撥付。${recoveredTokens.toLocaleString()} 代幣 已存入您的錢包。`,
          ts: Date.now(),
        };
        localStorage.setItem(RECOVERY_RECEIPT_STORAGE_KEY, JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent("purchase-recovery-receipt-ready"));
      } catch (e) {
        console.warn("[PurchaseRecovery] failed to persist recovery receipt payload:", e);
      }
    }

    return recoveredCount;
  } catch (e) {
    console.warn("[PurchaseRecovery] login recovery failed:", e);
    return 0;
  }
}

