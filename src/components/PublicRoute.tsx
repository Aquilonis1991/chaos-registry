import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface PublicRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean; // 是否需要正式登入（非匿名）
}

/**
 * PublicRoute - 公開路由，允許所有登入用戶訪問（包括非管理者）
 * 用於隱私權政策、服務條款等公開頁面
 * 
 * 與 ProtectedRoute 的差異：
 * - ProtectedRoute：網頁版會檢查管理員權限，非管理者會被阻擋
 * - PublicRoute：不檢查管理員權限，所有登入用戶（包括非管理者）都可以訪問
 */
export const PublicRoute = ({ children, requireAuth = false }: PublicRouteProps) => {
  const { user, isAnonymous, loading } = useAuth();

  // 載入中顯示載入畫面
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // 如果需要正式登入但用戶是匿名的，重定向到認證頁面
  if (requireAuth && isAnonymous) {
    return <Navigate to="/auth" replace />;
  }

  // 如果沒有任何用戶狀態（既不是登入也不是匿名），重定向到認證頁面
  if (!user && !isAnonymous) {
    return <Navigate to="/auth" replace />;
  }

  // 允許所有登入用戶（包括非管理者）訪問
  // 注意：此路由不檢查管理員權限，所以網頁版的非管理者也可以訪問
  return <>{children}</>;
};

