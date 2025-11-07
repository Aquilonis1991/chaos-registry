import { useNavigate, useRouteError } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Home, RefreshCcw, ArrowLeft } from "lucide-react";

/**
 * 路由錯誤頁面
 * 當路由發生錯誤時顯示
 */
export const ErrorPage = () => {
  const error = useRouteError() as any;
  const navigate = useNavigate();

  console.error('Route error:', error);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-2xl">頁面載入失敗</CardTitle>
              <CardDescription>無法載入此頁面</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm font-medium mb-2">錯誤訊息：</p>
            <p className="text-sm text-muted-foreground">
              {error?.statusText || error?.message || '未知錯誤'}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate(-1)} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回上一頁
            </Button>

            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              <Home className="w-4 h-4 mr-2" />
              返回首頁
            </Button>

            <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
              <RefreshCcw className="w-4 h-4 mr-2" />
              重新載入
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ErrorPage;


