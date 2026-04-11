import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Smartphone, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_DEEP_LINK = (import.meta.env.VITE_APP_DEEP_LINK as string | undefined)?.trim() || "votechaos://auth/verify";

const buildDeepLink = (base: string, token: string, type: string) => {
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}token=${encodeURIComponent(token)}&type=${encodeURIComponent(type)}`;
};

/** Supabase 驗證信可能把參數放在 query、hash，或兩者皆有（與 OAuthCallbackPage 一致）。 */
function mergeSearchAndHashParams(): URLSearchParams {
  const merged = new URLSearchParams(window.location.search);
  const rawHash = window.location.hash.replace(/^#/, "");
  if (rawHash) {
    const fromHash = new URLSearchParams(rawHash.startsWith("?") ? rawHash.slice(1) : rawHash);
    fromHash.forEach((v, k) => merged.set(k, v));
  }
  return merged;
}

type ResolveState =
  | { status: "loading" }
  | { status: "success" }
  | { status: "legacy_app"; token: string; type: string }
  | { status: "error"; message: string }
  | { status: "redirect_auth" };

const VerifyRedirectPage = () => {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<ResolveState>({ status: "loading" });
  const { language } = useLanguage();
  const { getText, isLoading } = useUIText(language);

  const queryType = searchParams.get("type") ?? "signup";

  const deepLink = useMemo(() => {
    if (state.status !== "legacy_app") return null;
    return buildDeepLink(DEFAULT_DEEP_LINK, state.token, state.type);
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    const fail = (message: string) => {
      if (!cancelled) setState({ status: "error", message });
    };

    const ok = () => {
      if (!cancelled) setState({ status: "success" });
    };

    const stripAuthFromUrl = () => {
      window.history.replaceState({}, document.title, `${window.location.pathname}`);
    };

    (async () => {
      const merged = mergeSearchAndHashParams();
      const err =
        merged.get("error_description") ||
        merged.get("error_code") ||
        merged.get("error");
      if (err) {
        fail(decodeURIComponent(String(err).replace(/\+/g, " ")));
        return;
      }

      const legacyToken = searchParams.get("token");
      const legacyType = searchParams.get("type") ?? "signup";

      if (queryType === "oauth" && !legacyToken) {
        if (!cancelled) setState({ status: "redirect_auth" });
        return;
      }

      if (legacyToken) {
        if (!cancelled) setState({ status: "legacy_app", token: legacyToken, type: legacyType });
        return;
      }

      const code = merged.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          fail(error.message);
          return;
        }
        stripAuthFromUrl();
        ok();
        return;
      }

      const tokenHash = merged.get("token_hash");
      if (tokenHash) {
        const rawType = merged.get("type") ?? "signup";
        const otpType: "signup" | "email" | "recovery" | "magiclink" =
          rawType === "recovery"
            ? "recovery"
            : rawType === "magiclink"
              ? "magiclink"
              : rawType === "email"
                ? "email"
                : "signup";

        const { error } = await supabase.auth.verifyOtp({
          type: otpType,
          token_hash: tokenHash,
        });
        if (cancelled) return;
        if (error) {
          fail(error.message);
          return;
        }
        stripAuthFromUrl();
        ok();
        return;
      }

      const hasImplicitSession = merged.has("access_token") || window.location.hash.includes("access_token");
      if (hasImplicitSession) {
        for (let i = 0; i < 20; i++) {
          const { data } = await supabase.auth.getSession();
          if (cancelled) return;
          if (data.session) {
            stripAuthFromUrl();
            ok();
            return;
          }
          await new Promise((r) => setTimeout(r, 120));
        }
        fail("無法完成信箱驗證，請稍後再試或重新寄送驗證信。");
        return;
      }

      if (!cancelled) setState({ status: "redirect_auth" });
    })();

    return () => {
      cancelled = true;
    };
  }, [queryType, searchParams]);

  const handleOpenApp = () => {
    if (deepLink) {
      window.location.href = deepLink;
    }
  };

  if (state.status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-6">
        <Loader2 className="w-10 h-10 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  if (state.status === "redirect_auth") {
    return <Navigate to="/auth" replace />;
  }

  if (state.status === "error") {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-6 pt-[calc(1rem+env(safe-area-inset-top,0px))]">
        <div className="w-full max-w-md bg-card shadow-glow rounded-3xl p-8 text-center space-y-4">
          <Logo size="lg" className="mx-auto" />
          <h1 className="text-xl font-semibold text-foreground">
            {getText("auth_verifyRedirect_errorTitle", "驗證失敗")}
          </h1>
          <p className="text-sm text-muted-foreground break-words">{state.message}</p>
          <Button asChild className="w-full">
            <Link to="/auth">{getText("auth_verifyRedirect_backToAuth", "返回登入")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-6 pt-[calc(1rem+env(safe-area-inset-top,0px))]">
      <div className="w-full max-w-md bg-card shadow-glow rounded-3xl p-8 text-center">
        <div className="flex justify-center mb-4">
          <Logo size="lg" />
        </div>
        <h1 className="text-2xl font-semibold mb-3 text-foreground">
          {getText("auth_verifyRedirect_title", "註冊成功")}
        </h1>
        <p className="text-muted-foreground mb-6">
          {getText("auth_verifyRedirect_description", "您的信箱驗證已完成，請點選下方按鈕回到 App 繼續使用。")}
        </p>

        <div className="flex flex-col gap-3">
          {state.status === "legacy_app" && deepLink ? (
            <Button className="w-full h-14 text-lg font-bold shadow-lg bg-primary hover:bg-primary/90" onClick={handleOpenApp}>
              <Smartphone className="w-6 h-6 mr-2" />
              {getText("auth_verifyRedirect_openApp", "回到 App")}
            </Button>
          ) : (
            <Button asChild className="w-full h-14 text-lg font-bold shadow-lg bg-primary hover:bg-primary/90">
              <Link to="/home">{getText("auth_verifyRedirect_continueWeb", "進入首頁")}</Link>
            </Button>
          )}
        </div>

        <div className="mt-6">
          <p className="text-xs text-muted-foreground mb-3">
            {getText("auth_verifyRedirect_footer", "若未自動開啟，請再點一次按鈕。")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyRedirectPage;
