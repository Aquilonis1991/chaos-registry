import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldX } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useAuth } from "@/hooks/useAuth";

/**
 * 網頁版僅限管理員使用頁面
 * 當非管理員用戶嘗試在網頁版訪問時顯示
 */
const WebAdminOnlyPage = () => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const { user, signOut } = useAuth(); // 使用 useAuth 獲取用戶資訊

  // 強制輸出日誌確認頁面被渲染
  if (typeof window !== 'undefined') {
    window.console?.log?.('[WebAdminOnlyPage] Page rendered - Non-admin user blocked', { userId: user?.id });
  }

  const handleClearCache = () => {
    localStorage.removeItem('admin_status_cache');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldX className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-2xl">
                {getText('webAdminOnly.title', '網頁版僅限管理員使用')}
              </CardTitle>
              <CardDescription>
                {getText('webAdminOnly.description', '此網頁版本僅供管理員使用')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-4">
              {getText('webAdminOnly.message', '一般用戶請使用手機 App 版本。如需使用網頁版，請聯繫系統管理員。')}
            </p>
            {user && (
              <div className="text-xs font-mono bg-black/5 p-2 rounded break-all">
                <p>User ID: {user.id}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleClearCache}
              className="w-full px-4 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-md text-sm font-medium transition-colors"
            >
              清除快取並重試 (Clear Cache & Retry)
            </button>
            <button
              onClick={() => signOut()}
              className="w-full px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md text-sm font-medium transition-colors"
            >
              登出 (Sign Out)
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WebAdminOnlyPage;

