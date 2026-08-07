import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * 單一縫合點：`code_already_used` 恢復流程（原本在 OAuthCallbackHandler.tsx 內被
 * 逐字複製兩份）。依序：立即檢查 session → 等待 1 秒後重查 → refreshSession →
 * getUser 後再查一次 session。任一步找到 session 就回傳；全部失敗回傳 null。
 * 導航／toast／清除已處理旗標等副作用留給呼叫端決定（兩個呼叫點在「是否導航」上行為不同）。
 */
export async function waitForSessionAfterCodeAlreadyUsed(): Promise<Session | null> {
  console.log("[sessionRetryLadder] checking session (attempt 1)");
  const { data: { session }, error: sessionError1 } = await supabase.auth.getSession();
  if (session) {
    console.log("[sessionRetryLadder] ✅ session found on attempt 1");
    return session;
  }
  console.log("[sessionRetryLadder] ⚠️ no session (attempt 1), error:", sessionError1);

  console.log("[sessionRetryLadder] waiting 1s before retry");
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const { data: { session: session2 }, error: sessionError2 } = await supabase.auth.getSession();
  if (session2) {
    console.log("[sessionRetryLadder] ✅ session found after retry");
    return session2;
  }
  console.log("[sessionRetryLadder] ⚠️ no session (attempt 2), error:", sessionError2);

  console.log("[sessionRetryLadder] attempting refreshSession");
  try {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshData?.session) {
      console.log("[sessionRetryLadder] ✅ session refreshed successfully");
      return refreshData.session;
    }
    console.log("[sessionRetryLadder] ⚠️ refreshSession: no session, error:", refreshError);
  } catch (refreshErr) {
    console.log("[sessionRetryLadder] refreshSession failed:", refreshErr);
  }

  console.log("[sessionRetryLadder] checking user directly");
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userData?.user) {
      console.log("[sessionRetryLadder] ⚠️ user exists but no session, user ID:", userData.user.id);
      const { data: sessionData, error: sessionError3 } = await supabase.auth.getSession();
      if (sessionData?.session) {
        console.log("[sessionRetryLadder] ✅ session found after user check");
        return sessionData.session;
      }
      console.log("[sessionRetryLadder] ⚠️ third session check: no session, error:", sessionError3);
    } else {
      console.log("[sessionRetryLadder] ⚠️ no user found, error:", userError);
    }
  } catch (userErr) {
    console.log("[sessionRetryLadder] user check failed:", userErr);
  }

  return null;
}
