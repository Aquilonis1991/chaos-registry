import { useForceUpdate } from "@/hooks/useForceUpdate";
import { isNative } from "@/lib/capacitor";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useUIText } from "@/hooks/useUIText";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect } from "react";

async function openStoreUrl(url: string) {
  if (isNative()) {
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url });
    } catch {
      window.open(url, "_blank");
    }
  } else {
    window.open(url, "_blank");
  }
}

export function ForceUpdateGate({ children }: { children: React.ReactNode }) {
  const { needsForceUpdate, storeUrl, loading, currentVersion, minimumVersion } = useForceUpdate();
  const { language } = useLanguage();
  const { getText } = useUIText(language);

  const title = getText("forceUpdate.title", "請更新至最新版本");
  const message = getText(
    "forceUpdate.message",
    "此版本已停止使用，請前往商店更新後再繼續。"
  );
  const buttonLabel = getText("forceUpdate.button", "前往更新");

  useEffect(() => {
    if (needsForceUpdate) {
      console.log("[ForceUpdateGate] 需要強制更新", {
        currentVersion,
        minimumVersion,
        storeUrl,
      });
    }
  }, [needsForceUpdate, currentVersion, minimumVersion, storeUrl]);

  if (!isNative()) {
    return <>{children}</>;
  }

  if (loading) {
    return <>{children}</>;
  }

  if (needsForceUpdate) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background p-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex max-w-sm flex-col items-center gap-6 text-center">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
            {currentVersion && minimumVersion && (
              <p className="text-xs text-muted-foreground">
                {getText("forceUpdate.currentVersion", "目前版本")}: {currentVersion} →{" "}
                {getText("forceUpdate.requiredVersion", "需更新至")}: {minimumVersion}
              </p>
            )}
          </div>
          <Button
            size="lg"
            className="w-full"
            onClick={() => openStoreUrl(storeUrl)}
          >
            {buttonLabel}
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
