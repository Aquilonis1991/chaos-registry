import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { isNative } from "@/lib/capacitor";
import WebAdminOnlyPage from "./WebAdminOnlyPage";

const Index = () => {
  const { user, isAnonymous, loading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();

  console.log('[Index] Render:', { 
    hasUser: !!user, 
    isAnonymous, 
    loading, 
    isAdmin, 
    adminLoading,
    isNative: isNative() 
  });

  // 載入中顯示載入畫面
  if (loading || adminLoading) {
    console.log('[Index] Still loading...');
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center">
        <div className="text-primary-foreground text-xl">Loading...</div>
      </div>
    );
  }

  // 網頁版管理員檢查 - 必須明確處理所有情況
  if (!isNative() && user && !isAnonymous) {
    console.log('[Index] Web version, user logged in, checking admin status:', isAdmin);
    
    // 如果管理員狀態還在載入中（undefined），繼續等待
    if (isAdmin === undefined && adminLoading) {
      console.log('[Index] Admin status still loading, waiting...');
      return (
        <div className="min-h-screen bg-gradient-primary flex items-center justify-center">
          <div className="text-primary-foreground text-xl">Loading...</div>
        </div>
      );
    }
    
    // 重要：如果查詢完成但結果是 undefined，或者明確是 false，都視為非管理員
    // 這確保了即使查詢失敗，也會阻止非管理員訪問
    if (isAdmin === false || (isAdmin === undefined && !adminLoading)) {
      console.log('[Index] Non-admin user on web, showing restriction page');
      return <WebAdminOnlyPage />;
    }
    
    // 只有明確是 true 時才允許導向
    if (isAdmin !== true) {
      // 如果還不確定，繼續等待
      console.log('[Index] Admin status uncertain, waiting...');
      return (
        <div className="min-h-screen bg-gradient-primary flex items-center justify-center">
          <div className="text-primary-foreground text-xl">Loading...</div>
        </div>
      );
    }
    
    // 是管理員，正常導向
    console.log('[Index] Admin user on web, navigating to home');
    return <Navigate to="/home" replace />;
  }

  // 原生 App 用戶或匿名用戶，正常導向
  if (user) {
    console.log('[Index] Native app or anonymous user, navigating to home');
    return <Navigate to="/home" replace />;
  }

  // 未登入用戶（包括匿名），導向認證頁面
  console.log('[Index] No user, navigating to auth');
  return <Navigate to="/auth" replace />;
};

export default Index;
