import { useEffect } from "react";
import { recoverAndroidPendingPurchasesOnLogin } from "@/lib/purchaseRecovery";
import { AUTH_SIGNED_IN_EVENT, AUTH_SIGNED_OUT_EVENT } from "@/lib/auth/authEvents";

/**
 * 原本這段 [0, 5000, 20000]ms 重試排程掛在 AuthContext 的 onAuthStateChange 內；
 * 現在改為監聽 AUTH_SIGNED_IN_EVENT / AUTH_SIGNED_OUT_EVENT，讓購買復原邏輯與
 * auth session 生命週期解耦——AuthContext 不該知道 IAP 復原這件事。
 * 掛載方式與 OAuthCallbackHandler / PurchaseRecoveryToastGate 相同：全域掛載、不渲染內容。
 */
export const PurchaseRecoveryScheduler = () => {
  useEffect(() => {
    let recoveryAttemptSeq = 0;
    const recoveryRetryTimers: ReturnType<typeof setTimeout>[] = [];

    const clearRecoveryRetryTimers = () => {
      while (recoveryRetryTimers.length > 0) {
        const t = recoveryRetryTimers.pop();
        if (t) clearTimeout(t);
      }
    };

    const schedulePurchaseRecoveryRetries = () => {
      recoveryAttemptSeq += 1;
      const runId = recoveryAttemptSeq;
      clearRecoveryRetryTimers();
      const retryDelaysMs = [0, 5000, 20000];
      retryDelaysMs.forEach((delay) => {
        const timer = setTimeout(() => {
          // 若有較新的登入事件，舊排程不再執行
          if (runId !== recoveryAttemptSeq) return;
          void recoverAndroidPendingPurchasesOnLogin();
        }, delay);
        recoveryRetryTimers.push(timer);
      });
    };

    const handleSignedIn = () => schedulePurchaseRecoveryRetries();
    const handleSignedOut = () => clearRecoveryRetryTimers();

    window.addEventListener(AUTH_SIGNED_IN_EVENT, handleSignedIn);
    window.addEventListener(AUTH_SIGNED_OUT_EVENT, handleSignedOut);

    return () => {
      clearRecoveryRetryTimers();
      window.removeEventListener(AUTH_SIGNED_IN_EVENT, handleSignedIn);
      window.removeEventListener(AUTH_SIGNED_OUT_EVENT, handleSignedOut);
    };
  }, []);

  return null;
};
