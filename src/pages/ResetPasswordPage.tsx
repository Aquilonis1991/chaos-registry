import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [ready, setReady] = useState(false);

  const hashParams = useMemo(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.substring(1)
      : window.location.hash;
    return new URLSearchParams(hash);
  }, []);

  useEffect(() => {
    let mounted = true;

    const initRecoverySession = async () => {
      try {
        const type = hashParams.get("type");
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (type && type !== "recovery") {
          toast.error("此連結不是重設密碼連結");
          navigate("/auth", { replace: true });
          return;
        }

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          if (mounted) setReady(true);
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!data.session) {
          toast.error("重設連結已失效，請重新申請");
          navigate("/auth", { replace: true });
          return;
        }

        if (mounted) setReady(true);
      } catch (error: any) {
        toast.error(error?.message || "重設連結驗證失敗");
        navigate("/auth", { replace: true });
      } finally {
        if (mounted) setInitializing(false);
      }
    };

    initRecoverySession();
    return () => {
      mounted = false;
    };
  }, [hashParams, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("兩次密碼輸入不一致");
      return;
    }
    if (password.length < 8) {
      toast.error("密碼至少 8 個字元");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success("密碼已更新，請使用新密碼登入");
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch (error: any) {
      toast.error(error?.message || "更新密碼失敗");
    } finally {
      setSubmitting(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4 sm:p-6 pt-[calc(1rem+env(safe-area-inset-top,0px))]">
      <Card className="w-full max-w-md shadow-glow">
        <CardHeader className="space-y-2 pb-4 sm:pb-6">
          <div className="flex justify-center">
            <Logo size="xl" className="rounded-2xl" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-center bg-gradient-accent bg-clip-text text-transparent">
            重設密碼
          </CardTitle>
          <CardDescription className="text-center text-sm sm:text-base">
            請輸入新的登入密碼
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-6 sm:pb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password">新密碼</Label>
              <Input
                id="reset-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 8 個字元"
                minLength={8}
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-confirm-password">確認新密碼</Label>
              <Input
                id="reset-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次輸入新密碼"
                minLength={8}
                required
                disabled={submitting}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              更新密碼
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
