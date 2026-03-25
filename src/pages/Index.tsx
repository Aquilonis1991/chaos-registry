import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isNative } from "@/lib/capacitor";

const Index = () => {
  const { user, isAnonymous, loading } = useAuth();

  console.log('[Index] Render:', {
    hasUser: !!user,
    isAnonymous,
    loading,
    isNative: isNative()
  });

  // 載入中顯示載入畫面
  // 入口只等待 Auth，管理員檢查交給 ProtectedRoute，避免首頁卡在轉圈
  if (loading) {
    console.log(`[Index] Still loading... (Auth: ${loading})`);
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center flex-col gap-4 pt-[env(safe-area-inset-top,0px)]">
        <div className="text-primary-foreground text-xl">Loading...</div>
        <div className="text-primary-foreground/70 text-sm">Authenticating...</div>
      </div>
    );
  }

  // 原生 App 用戶或匿名用戶，正常導向
  if (user) {
    console.log('[Index] User exists, navigating to home');
    return <Navigate to="/home" replace />;
  }

  // 未登入用戶（包括匿名），導向認證頁面
  console.log('[Index] No user, navigating to auth');
  return <Navigate to="/auth" replace />;
};

export default Index;
