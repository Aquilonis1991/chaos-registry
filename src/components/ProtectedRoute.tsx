import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean; // 是否需要正式登入（非匿名）
}

export const ProtectedRoute = ({ children, requireAuth = false }: ProtectedRouteProps) => {
  const { user, isAnonymous, loading } = useAuth();

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

  return <>{children}</>;
};
