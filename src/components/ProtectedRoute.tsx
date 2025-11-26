import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { isNative } from "@/lib/capacitor";
import { Loader2 } from "lucide-react";
import WebAdminOnlyPage from "@/pages/WebAdminOnlyPage";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean; // 是否需要正式登入（非匿名）
}

export const ProtectedRoute = ({ children, requireAuth = false }: ProtectedRouteProps) => {
  const { user, isAnonymous, loading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();

  // 強制輸出日誌（即使被壓縮也會保留）
  if (typeof window !== 'undefined') {
    window.console?.log?.('[ProtectedRoute] Render:', { 
      hasUser: !!user, 
      isAnonymous, 
      loading, 
      isAdmin, 
      adminLoading,
      isNative: isNative(),
      requireAuth
    });
  }

  // 載入中顯示載入畫面
  if (loading || adminLoading) {
    console.log('[ProtectedRoute] Still loading...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // 網頁版管理員檢查 - 必須明確處理所有情況
  if (!isNative() && user && !isAnonymous) {
    if (typeof window !== 'undefined') {
      window.console?.log?.('[ProtectedRoute] Web version, user logged in, checking admin status:', { 
        isAdmin, 
        adminLoading,
        isUndefined: isAdmin === undefined,
        isFalse: isAdmin === false,
        isTrue: isAdmin === true
      });
    }
    
    // 如果管理員狀態還在載入中（undefined），繼續等待
    if (isAdmin === undefined && adminLoading) {
      if (typeof window !== 'undefined') {
        window.console?.log?.('[ProtectedRoute] Admin status still loading, waiting...');
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }
    
    // 重要：如果查詢完成但結果是 undefined，或者明確是 false，都視為非管理員
    // 這確保了即使查詢失敗，也會阻止非管理員訪問
    if (isAdmin === false || (isAdmin === undefined && !adminLoading)) {
      if (typeof window !== 'undefined') {
        window.console?.log?.('[ProtectedRoute] Non-admin user on web, showing restriction page');
      }
      return <WebAdminOnlyPage />;
    }
    
    // 只有明確是 true 時才允許訪問
    if (isAdmin !== true) {
      // 如果還不確定，繼續等待
      if (typeof window !== 'undefined') {
        window.console?.log?.('[ProtectedRoute] Admin status uncertain, waiting...');
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }
    
    if (typeof window !== 'undefined') {
      window.console?.log?.('[ProtectedRoute] Admin user confirmed, allowing access');
    }
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
