import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContext";

function sanitizeNextPath(nextRaw: string | null): string {
  if (!nextRaw) return "/home?tab=hot#topics";
  // 只允許站內路徑，避免開放重導
  if (!nextRaw.startsWith("/")) return "/home?tab=hot#topics";
  return nextRaw;
}

const GuestEntryPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, user, isAnonymous, signOut, signInAnonymously } = useAuthContext();

  useEffect(() => {
    if (loading) return;

    const params = new URLSearchParams(location.search);
    const nextPath = sanitizeNextPath(params.get("next"));

    const enterGuest = async () => {
      if (user) {
        await signOut();
      } else if (!isAnonymous) {
        signInAnonymously();
      }
      navigate(nextPath, { replace: true });
    };

    void enterGuest();
  }, [loading, user, isAnonymous, signOut, signInAnonymously, navigate, location.search]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">正在進入訪客模式...</span>
      </div>
    </div>
  );
};

export default GuestEntryPage;
