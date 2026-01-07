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
  const { user, signOut } = useAuth(); // 使用 useAuth 獲取用戶資訊

  const [connStatus, setConnStatus] = useState<string>('等待測試 (Waiting)...');
  const [connDetails, setConnDetails] = useState<string>('');

  // 強制輸出日誌確認頁面被渲染
  if (typeof window !== 'undefined') {
    window.console?.log?.('[WebAdminOnlyPage] Page rendered - Non-admin user blocked', { userId: user?.id });
  }

  // 自動執行連線測試
  useEffect(() => {
    if (user?.id) {
      handleTestConnection();
    }
  }, [user?.id]);

  const handleClearCache = () => {
    localStorage.removeItem('admin_status_cache');
    window.location.reload();
  };

  const handleTestConnection = async () => {
    try {
      setConnStatus('測試中 (Testing)...');
      setConnDetails('');
      console.log('[WebAdminOnlyPage] Testing connection...');

      const start = Date.now();
      // 嘗試讀取自己的 admin status
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      const end = Date.now();
      const timeMs = end - start;

      console.log('[WebAdminOnlyPage] Connection test result:', { data, error, timeMs });

      if (error) {
        setConnStatus(`❌ 失敗 (Failed)`);
        setConnDetails(`Error: ${error.message} (Code: ${error.code})\nTime: ${timeMs}ms`);
      } else {
        if (data) {
          // @ts-ignore
          const role = data.role || 'admin';
          // @ts-ignore
          const isSuper = data.is_super_admin;
          setConnStatus(`✅ 成功且是管理員 (Admin)`);
          setConnDetails(`Data found. Role: ${role}, Super: ${isSuper}\nTime: ${timeMs}ms`);
        } else {
          setConnStatus(`⚠️ 連線成功但無權限 (No Record)`);
          setConnDetails(`No record found in admin_users for this ID.\nTime: ${timeMs}ms`);
        }
      }
    } catch (err: any) {
      console.error('[WebAdminOnlyPage] Connection exception:', err);
      setConnStatus(`❌ 異常 (Exception)`);
      setConnDetails(`Error: ${err.message}\nBypass: Check Network/VPN`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
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
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleTestConnection}
            className="w-full px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors"
          >
            測試資料庫連線 (Test DB Connection)
          </button>
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
    </div >
  );
};

export default WebAdminOnlyPage;

