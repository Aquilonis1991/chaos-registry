/**
 * 辨識是否為「後台未設定 AI Prompt」的錯誤，並取得對應的 system_config key。
 * 供前台在顯示錯誤時，可跳出「可設定的對話框」並顯示 key 值。
 */

export const PROMPT_CONFIG_KEYS = [
  "ai_closing_prompt",
  "ai_chaos_rewrite_prompt",
  "ai_chaos_verification_prompt",
] as const;

export type PromptConfigKey = (typeof PROMPT_CONFIG_KEYS)[number];

/**
 * 若錯誤訊息為「未設定 prompt」或「無法載入 prompt」，回傳 true。
 */
export function isPromptConfigError(message: string | undefined): boolean {
  if (!message || typeof message !== "string") return false;
  const lower = message.toLowerCase();
  return (
    (lower.includes("not configured in system_config") ||
      (lower.includes("failed to load") && lower.includes("from system_config"))) &&
    PROMPT_CONFIG_KEYS.some((k) => message.includes(k))
  );
}

/**
 * 從錯誤訊息中取出對應的 system_config key；若非 prompt 設定錯誤則回傳 null。
 */
export function getPromptConfigKeyFromError(
  message: string | undefined
): PromptConfigKey | null {
  if (!message || typeof message !== "string") return null;
  for (const key of PROMPT_CONFIG_KEYS) {
    if (message.includes(key)) return key;
  }
  return null;
}
