import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldX } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

/**
 * 網頁版僅限管理員使用頁面
 * 
 * 若用戶使用網頁版登入且非管理員，將被導向此頁面。
 */
export const WebAdminOnlyPage = () => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const { user, signOut } = useAuth();

  // 強制輸出日誌以供除錯 (保留基本日誌)
  if (typeof window !== 'undefined') {
    window.console?.log?.('[WebAdminOnlyPage] Page rendered - Non-admin user blocked', { userId: user?.id });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 pt-[calc(1rem+env(safe-area-inset-top,0px))]">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className=" text-center text-xl text-destructive font-bold">
            {getText('admin.web_restricted', '網頁版僅限管理員使用')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">
            {getText('webAdminOnly.message', '一般用戶請使用手機 App 版本。如需使用網頁版，請聯繫系統管理員。')}
          </p>
          {user && (
            <div className="text-xs font-mono bg-black/5 p-2 rounded break-all">
              <p>User ID: {user.id}</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={() => signOut()}
              className="w-full px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md text-sm font-medium transition-colors"
            >
              登出 (Sign Out)
            </button>
          </div>
        </CardContent>
      </Card>
    </div >
  );
};

export default WebAdminOnlyPage;

