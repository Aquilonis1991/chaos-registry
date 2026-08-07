export type AdminGateState = "pending" | "denied" | "admin";

/**
 * AuthPage.tsx 的 useEffect（決定要不要 navigate）與 render body（決定要 return
 * 什麼 JSX）過去各自重複了同一組 3 個判斷式，現在共用同一份實作。
 * 注意：isNative() 的外層分支刻意留在呼叫端，不併入這裡——這是唯一決定
 * WebAdminOnlyPage 是否會顯示給原生使用者看的判斷點，不應被這個共用函式吃掉。
 */
export function computeAdminGateState(input: {
  isAdmin: boolean | undefined;
  adminLoading: boolean;
}): AdminGateState {
  // 若管理員狀態仍在載入中（undefined），繼續等待
  if (input.isAdmin === undefined && input.adminLoading) return "pending";
  // 查詢完成但結果是 undefined，或明確是 false，都視為非管理員
  // （確保即使查詢失敗，也會阻止非管理員訪問）
  if (input.isAdmin === false || (input.isAdmin === undefined && !input.adminLoading)) return "denied";
  // 只有明確是 true 時才視為管理員
  if (input.isAdmin === true) return "admin";
  return "pending";
}
