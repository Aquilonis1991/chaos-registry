import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCcw, Home, Bug } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * 全局錯誤邊界組件
 * 捕獲子組件中的 JavaScript 錯誤，顯示友善的錯誤頁面
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新 state 以顯示錯誤 UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 記錄錯誤到錯誤報告服務
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // 調用自定義錯誤處理器
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // TODO: 在這裡整合 Sentry 或其他錯誤追蹤服務
    // Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定義 fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 否則顯示預設的錯誤 UI
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-lg w-full">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-2xl">哎呀！出錯了</CardTitle>
                  <CardDescription>應用程式遇到了一些問題</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm font-medium mb-2">錯誤訊息：</p>
                <p className="text-sm text-muted-foreground font-mono">
                  {this.state.error?.message || '未知錯誤'}
                </p>
              </div>

              {/* 開發模式顯示詳細資訊 */}
              {import.meta.env.DEV && this.state.errorInfo && (
                <details className="bg-muted rounded-lg p-4">
                  <summary className="text-sm font-medium cursor-pointer mb-2">
                    技術詳情（開發模式）
                  </summary>
                  <pre className="text-xs text-muted-foreground overflow-auto max-h-40 mt-2">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="flex flex-col gap-2">
                <Button onClick={this.handleReset} className="w-full">
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  重試
                </Button>
                
                <Button onClick={this.handleReload} variant="outline" className="w-full">
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  重新載入頁面
                </Button>

                <Button onClick={this.handleGoHome} variant="outline" className="w-full">
                  <Home className="w-4 h-4 mr-2" />
                  返回首頁
                </Button>
              </div>

              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  如果問題持續發生，請聯繫客服
                </p>
                <Button variant="link" size="sm" asChild>
                  <a href="mailto:support@votechaos.com">
                    <Bug className="w-4 h-4 mr-2" />
                    回報問題
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;


