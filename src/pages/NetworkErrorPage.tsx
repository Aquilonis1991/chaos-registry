import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WifiOff, RefreshCcw, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

/**
 * 網路錯誤頁面
 * 當網路連接失敗時顯示
 */
export const NetworkErrorPage = () => {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { language } = useLanguage();
  const { getText } = useUIText(language);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      // 網路恢復時自動返回首頁
      setTimeout(() => {
        navigate('/');
      }, 1000);
    }
  }, [isOnline, navigate]);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <WifiOff className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-2xl">
                {isOnline 
                  ? getText('networkError.title.recovering', '正在恢復連接...') 
                  : getText('networkError.title.failed', '網路連接失敗')}
              </CardTitle>
              <CardDescription>
                {isOnline 
                  ? getText('networkError.description.recovered', '網路已恢復，即將返回首頁') 
                  : getText('networkError.description.check', '請檢查您的網路連接')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm font-medium mb-2">{getText('networkError.reasons.title', '可能的原因：')}</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• {getText('networkError.reasons.wifi', 'WiFi 或行動數據已關閉')}</li>
              <li>• {getText('networkError.reasons.signal', '訊號不穩定')}</li>
              <li>• {getText('networkError.reasons.router', '路由器或網路設備問題')}</li>
              <li>• {getText('networkError.reasons.vpn', 'VPN 連接異常')}</li>
            </ul>
          </div>

          {!isOnline && (
            <div className="flex flex-col gap-2">
              <Button onClick={handleRetry} className="w-full">
                <RefreshCcw className="w-4 h-4 mr-2" />
                {getText('networkError.button.retry', '重試')}
              </Button>

              <Button onClick={() => navigate('/')} variant="outline" className="w-full">
                <Home className="w-4 h-4 mr-2" />
                {getText('networkError.button.home', '返回首頁')}
              </Button>
            </div>
          )}

          {isOnline && (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-green-600">
                <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
                <span className="text-sm font-medium">{getText('networkError.status.online', '網路已恢復')}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NetworkErrorPage;


