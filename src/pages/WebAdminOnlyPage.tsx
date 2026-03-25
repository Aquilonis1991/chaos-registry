import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useAuth } from "@/hooks/useAuth";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";
import { Link } from "react-router-dom";

/**
 * 網頁版僅限管理員使用頁面
 *
 * 若用戶使用網頁版登入且非管理員，將被導向此頁面。
 */
function normalizeStoreUrl(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  return String(raw).trim();
}

export const WebAdminOnlyPage = () => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const { user, signOut } = useAuth();
  const { getConfig } = useSystemConfigCache();

  const androidStoreUrl = normalizeStoreUrl(getConfig("app_store_url_android", ""));
  const iosStoreUrl = normalizeStoreUrl(getConfig("app_store_url_ios", ""));

  // 強制輸出日誌以供除錯 (保留基本日誌)
  if (typeof window !== "undefined") {
    window.console?.log?.("[WebAdminOnlyPage] Page rendered - Non-admin user blocked", {
      userId: user?.id,
    });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))]">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className=" text-center text-xl text-destructive font-bold">
            {getText("webAdminOnly.title", "網頁版僅限管理員使用")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {getText(
              "webAdminOnly.message",
              "一般用戶請使用手機 App 版本。如需使用網頁版，請聯繫系統管理員。"
            )}
          </p>
          {user ? (
            <p className="text-xs text-muted-foreground">
              {getText("webAdminOnly.profileHint", "若需查看帳號資料，請前往")}{" "}
              <Link to="/profile" className="underline underline-offset-2 hover:text-foreground">
                {getText("webAdminOnly.profileLinkText", "個人頁面")}
              </Link>
            </p>
          ) : null}

          {(androidStoreUrl || iosStoreUrl) && (
            <div className="flex flex-col gap-2">
              {androidStoreUrl ? (
                <a
                  href={androidStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  {getText("webAdminOnly.buttonAndroid", "Google Play 下載")}
                </a>
              ) : null}
              {iosStoreUrl ? (
                <a
                  href={iosStoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  {getText("webAdminOnly.buttonIos", "App Store 下載")}
                </a>
              ) : null}
            </div>
          )}

          {user && (
            <div className="text-xs font-mono bg-black/5 p-2 rounded break-all">
              <p>User ID: {user.id}</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => signOut()}
              className="w-full px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md text-sm font-medium transition-colors"
            >
              {getText("webAdminOnly.signOut", "登出")}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WebAdminOnlyPage;
