import { useEffect } from "react";
import { toast } from "sonner";
import { RECOVERY_RECEIPT_STORAGE_KEY } from "@/lib/purchaseRecovery";

type ReceiptPayload = {
  title?: string;
  description?: string;
  ts?: number;
};

export function PurchaseRecoveryToastGate() {
  useEffect(() => {
    const consumeReceipt = () => {
      try {
        const raw = localStorage.getItem(RECOVERY_RECEIPT_STORAGE_KEY);
        if (!raw) return;
        const payload = JSON.parse(raw) as ReceiptPayload;
        localStorage.removeItem(RECOVERY_RECEIPT_STORAGE_KEY);

        toast.info(payload.title || "[行政回執] 延遲入帳完成", {
          description:
            payload.description ||
            "[行政回執] 偵測到一筆未結案的資源撥付，代幣已存入您的錢包。",
        });
      } catch (e) {
        console.warn("[PurchaseRecoveryToastGate] failed to consume receipt:", e);
      }
    };

    // 首次掛載就檢查一次（處理先寫入、後顯示 UI 的情境）
    consumeReceipt();

    // 補單流程完成時即時彈出
    const onReady = () => consumeReceipt();
    window.addEventListener("purchase-recovery-receipt-ready", onReady as EventListener);

    // App 回前景再檢查一次，避免時序漏接
    const onVisibility = () => {
      if (document.visibilityState === "visible") consumeReceipt();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("purchase-recovery-receipt-ready", onReady as EventListener);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}

