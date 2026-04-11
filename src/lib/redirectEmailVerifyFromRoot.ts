/**
 * 必須在載入 Supabase client 之前執行。
 * Supabase 若將驗證導回 Site URL（/）而非 emailRedirectTo，token 會留在 /#…；
 * 此時須先改寫為 /auth/verify-redirect，否則 VerifyRedirectPage 永遠收不到參數。
 */
function looksLikeSupabaseAuthUrl(search: string, hash: string): boolean {
  const s = `${search}${hash}`;
  if (!s) return false;
  return (
    /\bcode=/.test(s) ||
    /\btoken_hash=/.test(s) ||
    /[#&?]access_token=/.test(s) ||
    /[#&?]refresh_token=/.test(s) ||
    /[#&?]type=(signup|email|recovery|magiclink)\b/.test(s)
  );
}

export function redirectEmailVerifyFromRoot(): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname || "/";
  if (path !== "/" && path !== "") return;

  const search = window.location.search;
  const hash = window.location.hash;
  if (!looksLikeSupabaseAuthUrl(search, hash)) return;

  const next = `${window.location.origin}/auth/verify-redirect${search}${hash}`;
  window.history.replaceState(null, "", next);
}

redirectEmailVerifyFromRoot();
