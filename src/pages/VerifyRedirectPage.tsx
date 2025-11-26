import { useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Smartphone, ExternalLink, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

const DEFAULT_DEEP_LINK = (import.meta.env.VITE_APP_DEEP_LINK as string | undefined)?.trim() || "chaosregistry://auth/verify";
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

  const deepLink = token ? buildDeepLink(DEFAULT_DEEP_LINK, token, type) : null;

  useEffect(() => {
    if (!deepLink || !token) return;

    const openTimer = setTimeout(() => {
      if (typeof window !== "undefined") {
        window.location.href = deepLink;
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
  }, [deepLink, token]);

  if (!token) {
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
          <Button className="w-full h-12 text-base" onClick={handleOpenApp}>
            <Smartphone className="w-4 h-4 mr-2" />
            {getText("auth_verifyRedirect_openApp", "立即開啟 App")}
          </Button>
          <Button variant="outline" className="w-full h-12 text-base" onClick={handleDownload}>
            <ExternalLink className="w-4 h-4 mr-2" />
            {getText("auth_verifyRedirect_download", "下載或更新 App")}
          </Button>
        </div>

        <div className="mt-6">
          <p className="text-xs text-muted-foreground mb-3">
            {getText("auth_verifyRedirect_footer", "若仍無法開啟，請確認 App 已安裝，或使用下方按鈕重試。")}
          </p>
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{getText("auth_verifyRedirect_waiting", "正在等待 App 回應...")}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyRedirectPage;

