import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { isNative } from "@/lib/capacitor";
import { devLog } from "@/lib/devLog";
import { Loader2 } from "lucide-react";
import WebAdminOnlyPage from "@/pages/WebAdminOnlyPage";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean; // 是否需要正式登入（非匿名）
}

/** 網頁版：已登入非管理員仍允許進入的路由（其餘受保護路由仍顯示限制頁） */
function normalizePathname(pathname: string): string {
  const t = pathname.replace(/\/+$/, "");
  return t === "" ? "/" : t;
}

const WEB_NON_ADMIN_ALLOWED_PATHS = new Set<string>(["/profile"]);

export const ProtectedRoute = ({ children, requireAuth = false }: ProtectedRouteProps) => {
  const location = useLocation();
  const { user, isAnonymous, loading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const native = isNative();
  const shouldCheckAdmin = !native && !!user && !isAnonymous;
  const webAdminExempt =
    WEB_NON_ADMIN_ALLOWED_PATHS.has(normalizePathname(location.pathname));

  // 強制輸出日誌（即使被壓縮也會保留）
  if (typeof window !== 'undefined') {
    window.console?.log?.('[ProtectedRoute] Render:', { 
      hasUser: !!user, 
      isAnonymous, 
      loading, 
      isAdmin, 
      adminLoading,
      isNative: native,
      requireAuth
    });
  }

  // 載入中顯示載入畫面
  // 注意：adminLoading 只在「網頁版 + 已登入(非匿名) + 需要檢查管理員」時才應該擋住整頁
  if (loading || (shouldCheckAdmin && !webAdminExempt && adminLoading)) {
    devLog('[ProtectedRoute] Still loading...');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // 網頁版管理員檢查 - 必須明確處理所有情況（部分路由豁免，例如個人頁）
  if (shouldCheckAdmin && !webAdminExempt) {
    if (typeof window !== 'undefined') {
      window.console?.log?.('[ProtectedRoute] Web version, user logged in, checking admin status:', { 
        isAdmin, 
        adminLoading,
        isUndefined: isAdmin === undefined,
        isFalse: isAdmin === false,
        isTrue: isAdmin === true
      });
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
      devLog('[ProtectedRoute] Admin status uncertain, waiting...');
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }
    
    devLog('[ProtectedRoute] Admin user confirmed, allowing access');
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
