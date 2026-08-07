import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * 單一縫合點：呼叫 `line-auth` Edge Function 交換 LINE 登入的 code/state。
 * 原本這段 fetch 邏輯在 OAuthCallbackHandler.tsx 與 OAuthCallbackPage.tsx 兩處
 * 近乎逐字重複。刻意保留 `redirect`（3xx Location header）這個結果分支——
 * 目前只有 OAuthCallbackPage 會處理它，OAuthCallbackHandler 從未檢查過，
 * 兩邊呼叫端各自決定要不要消費這個分支，本函式本身維持對稱、不做行為選擇。
 */
export type LineExchangeResult =
  | { kind: "session_hint"; redirectUrl: string; hashedToken?: string }
  | { kind: "redirect"; location: string; status: number }
  | { kind: "error"; message: string };

export async function exchangeLineCodeForSession(params: {
  code: string;
  state: string;
  error?: string | null;
}): Promise<LineExchangeResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://epyykzxxglkjombvozhr.supabase.co";
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/line-auth/callback`;

  let response: Response;
  try {
    response = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey || "",
        Authorization: `Bearer ${supabaseAnonKey || ""}`,
      },
      body: JSON.stringify({ code: params.code, state: params.state, error: params.error || null }),
    });
  } catch (fetchError) {
    console.error("[lineEdgeAuth] Error calling Edge Function:", fetchError);
    return { kind: "error", message: "無法處理登入回調" };
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (location) {
      return { kind: "redirect", location, status: response.status };
    }
  }

  if (!response.ok) {
    console.error("[lineEdgeAuth] Edge Function error:", response.status, response.statusText);
    const errorText = await response.text().catch(() => "");
    console.error("[lineEdgeAuth] Edge Function error response:", errorText);
    return { kind: "error", message: `Edge Function 錯誤：${response.status}` };
  }

  const responseText = await response.text();
  let data: { redirectUrl?: string; hashedToken?: string } | null = null;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    console.error("[lineEdgeAuth] Failed to parse Edge Function response as JSON:", parseError, responseText);
  }

  if (!data?.redirectUrl) {
    console.error("[lineEdgeAuth] Edge Function response missing redirectUrl:", data);
    return { kind: "error", message: "Edge Function 返回的資料不完整" };
  }

  return { kind: "session_hint", redirectUrl: data.redirectUrl, hashedToken: data.hashedToken };
}

/**
 * 原本在兩處重複的 verifyOtp + getSession 確認 + setSession 後備邏輯。
 */
export async function verifyLineHashedToken(
  hashedToken: string
): Promise<{ session: Session } | { error: string }> {
  try {
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: hashedToken,
      type: "email", // 使用 'email' 類型（Supabase 已棄用 'magiclink' 類型）
    });

    if (verifyError) {
      console.error("[lineEdgeAuth] Failed to verify token:", verifyError);
      return { error: verifyError.message };
    }

    if (!verifyData.session) {
      console.warn("[lineEdgeAuth] Token verified but no session returned");
      return { error: "no session returned from verifyOtp" };
    }

    // 確認 session 已正確設置；verifyOtp 應已自動設置，這裡再次確認
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession) {
      return { session: currentSession };
    }

    console.error("[lineEdgeAuth] verifyOtp returned session but getSession() returned null; setting manually");
    const { data: setSessionData } = await supabase.auth.setSession({
      access_token: verifyData.session.access_token,
      refresh_token: verifyData.session.refresh_token || "",
    });
    return { session: setSessionData.session ?? verifyData.session };
  } catch (verifyErr) {
    console.error("[lineEdgeAuth] Error verifying token:", verifyErr);
    return { error: verifyErr instanceof Error ? verifyErr.message : String(verifyErr) };
  }
}
