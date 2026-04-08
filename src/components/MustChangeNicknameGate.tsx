import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";

/**
 * 後台已標記「需強制改名」時，僅允許留在個人資料頁完成修改。
 */
export function MustChangeNicknameGate({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useProfile();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || loading) return;
    if (!profile?.must_change_nickname) return;
    if (location.pathname === "/profile") return;
    navigate("/profile", { replace: true, state: { requireNicknameChange: true } });
  }, [user, loading, profile?.must_change_nickname, location.pathname, navigate]);

  return <>{children}</>;
}
