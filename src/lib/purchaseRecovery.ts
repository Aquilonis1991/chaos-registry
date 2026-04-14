import { isNative, getPlatform } from "@/lib/capacitor";
import { supabase } from "@/integrations/supabase/client";
import { purchaseService, PRODUCT_ID_MAP } from "@/lib/purchase";

export const RECOVERY_RECEIPT_STORAGE_KEY = "purchase_recovery_receipt";

const ANDROID_PRODUCT_IDS = new Set(Object.values(PRODUCT_ID_MAP).map((p) => p.android));
const IOS_PRODUCT_IDS = new Set(Object.values(PRODUCT_ID_MAP).map((p) => p.ios));

type AndroidPendingTx = {
  productId: string;
  purchaseToken: string;
  transactionId: string;
  finish: () => Promise<unknown>;
};

type IosPendingTx = {
  productId: string;
  transactionId: string;
  finish: () => Promise<unknown>;
};

function persistPurchaseRecoveryReceipt(recoveredCount: number, recoveredTokens: number): void {
  if (recoveredCount <= 0) return;
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

function pushIosPendingTx(pending: IosPendingTx[], seen: Set<string>, tx: any): void {
  const productId = String(tx?.products?.[0]?.id || tx?.productId || "");
  if (!productId || !IOS_PRODUCT_IDS.has(productId)) return;

  const transactionId = String(tx?.transactionId || tx?.id || "");
  if (!transactionId) return;

  const uniqKey = `${productId}:${transactionId}`;
  if (seen.has(uniqKey)) return;
  seen.add(uniqKey);

  pending.push({
    productId,
    transactionId,
    finish: () => (typeof tx?.finish === "function" ? tx.finish() : Promise.resolve()),
  });
}

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
    const pending: AndroidPendingTx[] = [];

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

    persistPurchaseRecoveryReceipt(recoveredCount, recoveredTokens);
    return recoveredCount;
  } catch (e) {
    console.warn("[PurchaseRecovery] Android login recovery failed:", e);
    return 0;
  }
}

/**
 * iOS：登入後掃描 CdvPurchase 已 approved、尚未 finish 的交易，送 verify-app-store-purchase 入帳。
 * 資料來源：store.when().approved 短窗收集 + localReceipts（相容不同插件版本）。
 */
export async function recoverIosPendingPurchasesOnLogin(): Promise<number> {
  if (!isNative() || getPlatform() !== "ios") return 0;

  try {
    if (!purchaseService.isInitialized()) {
      const ok = await purchaseService.initialize();
      if (!ok) return 0;
    }

    const store = purchaseService.getStore();
    if (!store) return 0;

    const seen = new Set<string>();
    const pending: IosPendingTx[] = [];

    await new Promise<void>((resolve) => {
      let done = false;
      const finishCollect = () => {
        if (done) return;
        done = true;
        try {
          store.off(collectApproved);
        } catch {
          // ignore
        }
        resolve();
      };

      const timer = setTimeout(() => finishCollect(), 4000);
      const collectApproved = (tx: any) => {
        pushIosPendingTx(pending, seen, tx);
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

    try {
      await store.update();
    } catch {
      // ignore
    }

    const receipts = Array.isArray(store.localReceipts) ? store.localReceipts : [];
    for (const r of receipts) {
      const txs = Array.isArray(r?.transactions) ? r.transactions : [];
      for (const tx of txs) {
        const state = String(tx?.state ?? "").toLowerCase();
        if (!state.includes("approved")) continue;
        pushIosPendingTx(pending, seen, tx);
      }
    }

    let recoveredCount = 0;
    let recoveredTokens = 0;

    for (const tx of pending) {
      const { data, error } = await supabase.functions.invoke("verify-app-store-purchase", {
        body: {
          transactionId: tx.transactionId,
          productId: tx.productId,
          packageName: "com.votechaos.app",
          platform: "ios",
        },
      });
      if (error || !data?.success) continue;

      if (data?.applied || data?.alreadyProcessed) {
        try {
          await tx.finish();
        } catch {
          // 已入帳或 finish 失敗不阻擋統計
        }
        recoveredCount += 1;
        recoveredTokens += Number(data?.tokens || 0);
      }
    }

    persistPurchaseRecoveryReceipt(recoveredCount, recoveredTokens);
    return recoveredCount;
  } catch (e) {
    console.warn("[PurchaseRecovery] iOS login recovery failed:", e);
    return 0;
  }
}
