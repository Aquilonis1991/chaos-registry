import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { getCorsHeaders, handleCorsPreFlight, validateOrigin } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || "";

const normalizeProvider = (provider: string): string => {
  const p = (provider || "").toLowerCase();
  if (p === "twitter") return "x";
  return p;
};

Deno.serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const originError = validateOrigin(req);
  if (originError) return originError;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Server config missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const emailRaw = typeof body?.email === "string" ? body.email : "";
    const email = emailRaw.trim().toLowerCase();

    if (!email) {
      return new Response(
        JSON.stringify({ hasAccount: false, isSocialOnly: false, providers: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 掃描分頁查詢目標 email。為避免長時間執行，設置最大 20 頁（每頁 200）。
    let matchedUser: any = null;
    const perPage = 200;
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;

      const users = data?.users ?? [];
      matchedUser = users.find((u) => (u.email || "").toLowerCase() === email) ?? null;
      if (matchedUser) break;
      if (users.length < perPage) break;
    }

    if (!matchedUser) {
      return new Response(
        JSON.stringify({ hasAccount: false, isSocialOnly: false, providers: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const identities = Array.isArray(matchedUser.identities) ? matchedUser.identities : [];
    const providersSet = new Set<string>();
    for (const identity of identities) {
      const provider = normalizeProvider(identity?.provider || "");
      if (provider) providersSet.add(provider);
    }

    // LINE / X 客製登入：從 metadata 與 profile 特徵補判斷
    const metadata = matchedUser.user_metadata || {};
    if (metadata.line_user_id) providersSet.add("line");
    if (metadata.twitter_user_id) providersSet.add("x");
    if ((matchedUser.email || "").endsWith("@line.local")) providersSet.add("line");
    if ((matchedUser.email || "").endsWith("@twitter.local")) providersSet.add("x");

    const providers = Array.from(providersSet);
    const hasPasswordProvider = providers.includes("email");
    const hasSocialProvider = providers.some((p) => p !== "email");

    return new Response(
      JSON.stringify({
        hasAccount: true,
        providers,
        isSocialOnly: hasSocialProvider && !hasPasswordProvider,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

