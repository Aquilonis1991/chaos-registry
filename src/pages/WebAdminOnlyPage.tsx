import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldX } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

/**
 * 網頁版僅限管理員使用頁面
 * 當非管理員用戶嘗試在網頁版訪問時顯示
 */
const WebAdminOnlyPage = () => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);

  // 強制輸出日誌確認頁面被渲染
  if (typeof window !== 'undefined') {
    window.console?.log?.('[WebAdminOnlyPage] Page rendered - Non-admin user blocked');
  }

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
            <p className="text-sm text-muted-foreground">
              {getText('webAdminOnly.message', '一般用戶請使用手機 App 版本。如需使用網頁版，請聯繫系統管理員。')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WebAdminOnlyPage;

