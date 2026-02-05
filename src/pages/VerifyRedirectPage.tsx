import { useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Smartphone, ExternalLink, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

const DEFAULT_DEEP_LINK = (import.meta.env.VITE_APP_DEEP_LINK as string | undefined)?.trim() || "votechaos://auth/verify";
const DEFAULT_FALLBACK_URL = (import.meta.env.VITE_APP_DOWNLOAD_URL as string | undefined)?.trim() || "https://chaos-registry.vercel.app/download";

const buildDeepLink = (base: string, token: string, type: string) => {
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}token=${encodeURIComponent(token)}&type=${encodeURIComponent(type)}`;
};

const VerifyRedirectPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const type = searchParams.get("type") ?? "signup";
  const { language } = useLanguage();
  const { getText, isLoading } = useUIText(language);

  // 計算 Deep Link
  let deepLink: string | null = null;

  if (type === 'oauth') {
    // Client-Side Redirect Bridge for OAuth (Bypass 302 Block)
    // 構造: votechaos://auth/callback + current search + current hash
    // (我們會保留 ?type=oauth 但這無害)
    const currentHash = typeof window !== 'undefined' ? window.location.hash : '';
    const currentSearch = typeof window !== 'undefined' ? window.location.search : '';
    deepLink = `votechaos://auth/callback${currentSearch}${currentHash}`;
  } else if (token) {
    // Email Verification
    deepLink = buildDeepLink(DEFAULT_DEEP_LINK, token, type);
  }

  useEffect(() => {
    if (!deepLink) return; // oauth 模式下 deepLink 總是存在，如果不存則不需要等待 token

    const openTimer = setTimeout(() => {
      if (typeof window !== "undefined") {
        window.location.href = deepLink!;
      }
    }, 200);

    const fallbackTimer = setTimeout(() => {
      if (typeof window !== "undefined") {
        window.location.href = DEFAULT_FALLBACK_URL;
      }
    }, 4000);

    return () => {
      clearTimeout(openTimer);
      clearTimeout(fallbackTimer);
    };
  }, [deepLink]);

  // 如果不是 oauth 且沒有 token，轉導回首頁
  if (type !== 'oauth' && !token) {
    return <Navigate to="/auth" replace />;
  }

  const handleOpenApp = () => {
    if (deepLink) {
      window.location.href = deepLink;
    }
  };

  const handleDownload = () => {
    window.location.href = DEFAULT_FALLBACK_URL;
  };

  return (
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-card shadow-glow rounded-3xl p-8 text-center">
        <div className="flex justify-center mb-4">
          <Logo size="lg" />
        </div>
        <h1 className="text-2xl font-semibold mb-3 text-foreground">
          {getText("auth_verifyRedirect_title", "請回到 App 完成登入")}
        </h1>
        <p className="text-muted-foreground mb-6">
          {getText("auth_verifyRedirect_description", "我們正在為您打開 ChaosRegistry App，若沒有自動跳轉，請點選下方按鈕。")}
        </p>

        <div className="flex flex-col gap-3">
          <Button className="w-full h-14 text-lg font-bold animate-pulse shadow-lg bg-primary hover:bg-primary/90" onClick={handleOpenApp}>
            <Smartphone className="w-6 h-6 mr-2" />
            {getText("auth_verifyRedirect_openApp", "點擊此處開啟 App")}
          </Button>
          <Button variant="outline" className="w-full h-12 text-base" onClick={handleDownload}>
            <ExternalLink className="w-4 h-4 mr-2" />
            {getText("auth_verifyRedirect_download", "下載或更新 App")}
          </Button>
        </div>

        <div className="mt-6">
          <p className="text-xs text-muted-foreground mb-3">
            {getText("auth_verifyRedirect_footer", "若沒有自動跳轉，請點擊上方按鈕。")}
          </p>

          {/* Debug Info for User/Dev */}
          <div className="mt-4 p-2 bg-black/20 rounded text-[10px] text-left overflow-hidden">
            <p className="font-bold text-gray-400">DEBUG INFO (v1.0.33):</p>
            <p>Hash Present: {typeof window !== 'undefined' && window.location.hash ? 'YES' : 'NO'}</p>
            <p>Search Present: {typeof window !== 'undefined' && window.location.search ? 'YES' : 'NO'}</p>
            <p className="truncate text-gray-500 mt-1">Link: {deepLink || 'Generating...'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyRedirectPage;




