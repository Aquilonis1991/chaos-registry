/**
 * 機器人營運政策（與 ChaosRegistry 一般用戶一致，但**禁止儲值／內購**）。
 * 所有對 Supabase 的 RPC 必須經白名單，避免日後誤接 verify-*-purchase、add_tokens 等。
 */

/** 機器人允許呼叫的 RPC（其餘一律拒絕） */
export const BOT_ALLOWED_RPC_NAMES = new Set<string>(["cast_vote_atomic", "post_arena_message"]);

/** 明確禁止的關鍵字（文件／審查用；實際阻擋以白名單為準） */
export const RECHARGE_AND_PURCHASE_DENY_KEYWORDS = [
  "verify-app-store-purchase",
  "verify-google-play-purchase",
  "verify_stripe",
  "create_checkout",
  "add_tokens"
] as const;

export function assertBotRpcAllowed(rpcName: string): void {
  if (!BOT_ALLOWED_RPC_NAMES.has(rpcName)) {
    throw new Error(
      `機器人政策：禁止呼叫 RPC「${rpcName}」。允許清單：${[...BOT_ALLOWED_RPC_NAMES].join(", ")}。儲值／內購相關 API 不得實作於機器人。`
    );
  }
}
