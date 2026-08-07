import { useCallback, useState } from "react";
import { maskMatchedKeyword, type BannedWordCheckResult } from "@/lib/bannedWords";

export type ModerationDecision = "pass" | "block" | "mask" | "review";

export type ModerationDialogState = { open: boolean; keyword: string };

/**
 * 單一縫合點：把「違禁字檢查結果 → 決定 block/mask/review → 管理遮罩/送審確認彈窗狀態」
 * 這段邏輯集中在這裡，取代各呼叫端各自命名不同、行為不一致的 state（例如 mask 曾在
 * ProfilePage 被誤當成 block 處理、在 EditTopicDialog 被完全忽略而直接放行）。
 * 純狀態 hook，不含 JSX——彈窗文案與實際送出動作留在各呼叫端，因為那些本來就依情境而異。
 */
export function useModerationGate() {
  const [maskState, setMaskState] = useState<ModerationDialogState>({ open: false, keyword: "" });
  const [reviewState, setReviewState] = useState<ModerationDialogState>({ open: false, keyword: "" });

  /**
   * 判斷這次檢查結果該怎麼處理，並視情況打開對應的彈窗狀態。
   * 呼叫端固定寫法：
   *   const decision = evaluate(result);
   *   if (decision === "block") { toast...; return; }
   *   if (decision !== "pass") return; // mask/review 彈窗已開，等使用者操作
   *   await submit(...);
   * 找不到已知 action（含伺服器回傳非預期值）一律視為 "block"，避免內容誤放行。
   */
  const evaluate = useCallback((result: BannedWordCheckResult): ModerationDecision => {
    if (!result.found) return "pass";
    if (result.action === "mask") {
      setMaskState({ open: true, keyword: result.keyword || "" });
      return "mask";
    }
    if (result.action === "review") {
      setReviewState({ open: true, keyword: result.keyword || "" });
      return "review";
    }
    return "block";
  }, []);

  const applyMask = useCallback((text: string) => maskMatchedKeyword(text, maskState.keyword), [maskState.keyword]);
  const closeMask = useCallback(() => setMaskState({ open: false, keyword: "" }), []);
  const closeReview = useCallback(() => setReviewState({ open: false, keyword: "" }), []);

  return { maskState, reviewState, evaluate, applyMask, closeMask, closeReview };
}
