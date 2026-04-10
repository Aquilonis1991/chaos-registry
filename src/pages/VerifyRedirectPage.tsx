import { Navigate, useSearchParams } from "react-router-dom";
import { Smartphone } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

const DEFAULT_DEEP_LINK = (import.meta.env.VITE_APP_DEEP_LINK as string | undefined)?.trim() || "votechaos://auth/verify";

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

  if (token) {
    // Email Verification
    deepLink = buildDeepLink(DEFAULT_DEEP_LINK, token, type);
  }

  // 如果不是 oauth 且沒有 token，轉導回首頁
  if (type !== 'oauth' && !token) {
    return <Navigate to="/auth" replace />;
  }

  const handleOpenApp = () => {
    if (deepLink) {
      window.location.href = deepLink;
    }
  };

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
          <Button className="w-full h-14 text-lg font-bold shadow-lg bg-primary hover:bg-primary/90" onClick={handleOpenApp}>
            <Smartphone className="w-6 h-6 mr-2" />
            {getText("auth_verifyRedirect_openApp", "回到 App")}
          </Button>
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




