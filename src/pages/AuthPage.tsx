import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingBubble } from "@/components/ui/LoadingBubble";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Eye, User } from "lucide-react";
import { useUIText } from "@/hooks/useUIText";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { isNative } from "@/lib/capacitor";
import { signupSchema, loginSchema } from "@/lib/validationSchemas";
import { Logo } from "@/components/Logo";
import WebAdminOnlyPage from "./WebAdminOnlyPage";

const AuthPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { language } = useLanguage();
  const { getText, isLoading: textsLoading } = useUIText(language);
  const { user, isAnonymous, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const envPublicSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL?.trim();
  const defaultSiteUrl = "https://chaos-registry.vercel.app";
  // Always use window.location.origin if available (works for localhost and production if same domain)
  const publicSiteUrl = typeof window !== "undefined" ? window.location.origin : (envPublicSiteUrl || defaultSiteUrl);

  const emailRedirectUrl = `${publicSiteUrl}/auth/verify-redirect`;
  const appDeepLinkCallback = "votechaos://auth/callback";

  console.log('[AuthPage] Configured redirect URL:', emailRedirectUrl);

  // 檢查已登入用戶的管理員權限（僅網頁版）
  useEffect(() => {
    console.log('[AuthPage] useEffect triggered:', {
      authLoading,
      adminLoading,
      user: !!user,
      isAnonymous,
      isAdmin,
      isNative: isNative()
    });

    // 等待認證和管理員檢查完成
    if (authLoading || adminLoading) {
      console.log('[AuthPage] Still loading, waiting...');
      return;
    }

    // 如果沒有用戶，不處理
    if (!user || isAnonymous) {
      console.log('[AuthPage] No user or anonymous, skipping');
      return;
    }

    // 網頁版管理員檢查
    if (!isNative()) {
      console.log('[AuthPage] Web version, checking admin status:', { isAdmin, adminLoading });

      // 如果管理員狀態還在載入中（undefined），繼續等待
      if (isAdmin === undefined && adminLoading) {
        console.log('[AuthPage] Admin status still loading, waiting...');
        return;
      }

      // 重要：如果查詢完成但結果是 undefined，或者明確是 false，都視為非管理員
      // 這確保了即使查詢失敗，也會阻止非管理員訪問
      if (isAdmin === false || (isAdmin === undefined && !adminLoading)) {
        console.log('[AuthPage] Non-admin user on web, should show restriction page');
        // 不導向，直接顯示限制頁面（由組件返回）
        return;
      }

      // 只有明確是 true 時才允許導向
      if (isAdmin === true) {
        console.log('[AuthPage] Admin user on web, navigating to home');
        navigate("/home", { replace: true });
        return;
      }

      // 如果還不確定，繼續等待
      console.log('[AuthPage] Admin status uncertain, waiting...');
      return;
    }

    // 原生 App 用戶，直接導向首頁
    console.log('[AuthPage] Native app user, navigating to home');
    navigate("/home", { replace: true });
  }, [user, isAnonymous, isAdmin, authLoading, adminLoading, navigate]);

  // 如果正在載入，顯示載入畫面
  if (authLoading || adminLoading || textsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // 網頁版管理員檢查 - 必須明確處理所有情況
  if (!isNative() && user && !isAnonymous) {
    console.log('[AuthPage] Web version, user logged in, checking admin status:', { isAdmin, adminLoading });

    // 如果管理員狀態還在載入中（undefined），繼續等待
    if (isAdmin === undefined && adminLoading) {
      console.log('[AuthPage] Admin status still loading, showing loading screen');
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      );
    }

    // 重要：如果查詢完成但結果是 undefined，或者明確是 false，都視為非管理員
    // 這確保了即使查詢失敗，也會阻止非管理員訪問
    if (isAdmin === false || (isAdmin === undefined && !adminLoading)) {
      console.log('[AuthPage] Non-admin user on web, showing restriction page');
      return <WebAdminOnlyPage />;
    }

    // 只有明確是 true 時才允許訪問（但應該已經導向首頁了）
    if (isAdmin !== true) {
      // 如果還不確定，繼續等待
      console.log('[AuthPage] Admin status uncertain, waiting...');
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      );
    }

    // 是管理員，應該已經導向首頁了，這裡不返回任何內容
    console.log('[AuthPage] Admin user on web, should already be redirected');
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 驗證輸入
      const validation = loginSchema.safeParse({ email, password });
      if (!validation.success) {
        const firstError = validation.error.errors[0];
        toast.error(firstError.message);
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        toast.error(error.message);
        setLoading(false);
      } else {
        console.log('[AuthPage] Login successful, waiting for auth state update...');
        // 登入成功後，不立即導向
        // onAuthStateChange 會觸發，然後 useEffect 會檢查管理員權限
        // 如果是網頁版非管理員，會在 useEffect 中被攔截並顯示限制頁面
        // 如果是原生 App 或管理員，會在 useEffect 中導向首頁

        // 顯示成功訊息（但導向由 useEffect 處理）
        if (isNative()) {
          toast.success(getText('auth_login_success', '登入成功！'));
        } else {
          // 網頁版：等待管理員檢查完成後再決定是否顯示成功訊息
          // 如果非管理員，不會顯示成功訊息（會直接顯示限制頁面）
        }

        // 不設置 loading 為 false，讓 useEffect 處理後續流程
        // loading 會在 auth state 更新後自動處理
      }
    } catch (error) {
      toast.error(getText('auth_login_error', '登入失敗，請稍後再試'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error(getText('auth_password_mismatch', '密碼不一致'));
      return;
    }

    // Enhanced password validation
    if (password.length < 8) {
      toast.error(getText('auth_password_min_length', '密碼至少需要 8 個字元'));
      return;
    }

    if (password.length > 72) {
      toast.error(getText('auth_password_max_length', '密碼最多 72 個字元'));
      return;
    }

    if (!/[A-Z]/.test(password)) {
      toast.error(getText('auth_password_uppercase', '密碼需包含至少一個大寫字母'));
      return;
    }

    if (!/[a-z]/.test(password)) {
      toast.error(getText('auth_password_lowercase', '密碼需包含至少一個小寫字母'));
      return;
    }

    if (!/[0-9]/.test(password)) {
      toast.error(getText('auth_password_number', '密碼需包含至少一個數字'));
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: emailRedirectUrl,
        },
      });

      if (error) {
        console.error("REGISTRATION_ERROR_FULL:", error);
        console.error("REGISTRATION_ERROR_MSG:", error.message);
        if (error.message.includes("already registered")) {
          toast.error(getText('auth_email_exists', '此電子郵件已被註冊'));
        } else if (error.message.includes("Password")) {
          toast.error(getText('auth_password_invalid', '密碼不符合安全要求'));
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success(getText('auth_signup_success', '註冊成功！請至信箱完成驗證後再登入'));
      }
    } catch (error) {
      toast.error(getText('auth_signup_error', '註冊失敗，請稍後再試'));
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'apple' | 'discord') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          // 回歸原本設計：
          // - App：使用 Deep Link 回調（由 OAuthCallbackHandler 解析 token 並 setSession）
          // - Web：回到網站 /home（Supabase 會自動在 hash 建立 session）
          redirectTo: isNative() ? appDeepLinkCallback : `${publicSiteUrl}/home`,
        },
      });

      if (error) {
        const providerNames: Record<string, string> = {
          google: 'Google',
          apple: 'Apple',
          discord: 'Discord',
        };
        const providerName = providerNames[provider] || provider;
        const socialLoginErrorTemplate = getText('auth_social_login_error', '{{provider}}登入失敗');
        toast.error(socialLoginErrorTemplate.replace('{{provider}}', providerName));
      }
    } catch (error) {
      toast.error(getText('auth_login_error', '登入失敗，請稍後再試'));
    }
  };

  const handleEdgeSocialLogin = async (provider: 'line' | 'twitter') => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        toast.error(getText('auth_login_error', '登入失敗，請稍後再試'), {
          description: '缺少 VITE_SUPABASE_URL'
        });
        return;
      }

      const platform = isNative() ? 'app' : 'web';
      const endpoint =
        provider === 'line'
          ? `${supabaseUrl}/functions/v1/line-auth/auth?platform=${encodeURIComponent(platform)}`
          : `${supabaseUrl}/functions/v1/twitter-auth/auth?platform=${encodeURIComponent(platform)}`;

      const res = await fetch(endpoint, { method: 'GET' });
      const json = await res.json().catch(() => null);
      const authUrl = json?.authUrl;

      if (!res.ok || !authUrl) {
        const msg =
          json?.message ||
          json?.error ||
          `Edge Function 回傳異常（${res.status}）`;
        throw new Error(msg);
      }

      // 交給 provider 的 OAuth 頁面（LINE/Twitter 會再回到 Edge Function callback，最後回到 Deep Link / Web）
      window.location.href = authUrl;
    } catch (err: any) {
      const providerName = provider === 'line' ? 'LINE' : 'X (Twitter)';
      toast.error(getText('auth_social_login_error', '{{provider}}登入失敗').replace('{{provider}}', providerName), {
        description: err?.message || '未知錯誤'
      });
    }
  };

  const handleAnonymousBrowsing = () => {
    toast.success("進入匿名瀏覽模式", {
      description: "您可以瀏覽內容，但需要註冊才能投票"
    });
    navigate("/home", { replace: true });
  };

  if (textsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4 sm:p-6">
      <LoadingBubble
        isLoading={loading}
        textKey="loading.auth_processing"
        defaultText="正在處理身分驗證..."
      />
      <Card className="w-full max-w-md shadow-glow">
        <CardHeader className="space-y-2 pb-4 sm:pb-6">
          <div className="flex justify-center">
            <Logo size="xl" className="rounded-2xl" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-center bg-gradient-accent bg-clip-text text-transparent">
            {getText('auth_app_title', 'ChaosRegistry')}
          </CardTitle>
          <CardDescription className="text-center text-sm sm:text-base">
            {getText('auth_app_subtitle', '加入最有趣的投票社群')}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-6 sm:pb-8">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-11 sm:h-10">
              <TabsTrigger value="login" className="text-sm sm:text-base">{getText('auth_login_tab', '登入')}</TabsTrigger>
              <TabsTrigger value="signup" className="text-sm sm:text-base">{getText('auth_signup_tab', '註冊')}</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-5 sm:space-y-4">
                {/* 電子郵件登入表單 - 移到上方 */}
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-sm sm:text-base font-medium">
                    {getText('auth_email_label', '電子郵件')}
                  </Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder={getText('auth_email_placeholder', 'your@email.com')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-12 sm:h-10 text-base sm:text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-sm sm:text-base font-medium">
                    {getText('auth_password_label', '密碼')}
                  </Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder={getText('auth_password_placeholder', '••••••••')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-12 sm:h-10 text-base sm:text-sm"
                  />
                </div>
                <Button type="submit" className="w-full h-12 sm:h-10 text-base sm:text-sm font-medium" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-5 w-5 sm:h-4 sm:w-4 animate-spin" />}
                  {getText('auth_login_button', '登入')}
                </Button>

                {/* 第三方登入 - 圓形 ICON */}
                <div className="flex justify-center items-center gap-3 sm:gap-4 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-14 w-14 sm:h-12 sm:w-12 rounded-full touch-manipulation"
                    onClick={() => handleSocialLogin('google')}
                    title={getText('auth_google_login', '使用 Google 登入')}
                  >
                    <svg className="h-7 w-7 sm:h-6 sm:w-6" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-14 w-14 sm:h-12 sm:w-12 rounded-full touch-manipulation"
                    onClick={() => handleSocialLogin('apple')}
                    title={getText('auth_apple_login', '使用 Apple 登入')}
                  >
                    <svg className="h-7 w-7 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                    </svg>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-14 w-14 sm:h-12 sm:w-12 rounded-full touch-manipulation"
                    onClick={() => handleSocialLogin('discord')}
                    title={getText('auth_discord_login', '使用 Discord 登入')}
                  >
                    <svg className="h-7 w-7 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-14 w-14 sm:h-12 sm:w-12 rounded-full touch-manipulation"
                    onClick={() => handleEdgeSocialLogin('twitter')}
                    title={getText('auth_twitter_login', '使用 X (Twitter) 登入')}
                  >
                    {/* X / Twitter */}
                    <svg className="h-7 w-7 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M18.244 2H21l-6.52 7.455L22.5 22h-6.58l-5.16-6.94L4.67 22H2l7.05-8.08L1.5 2h6.7l4.66 6.25L18.244 2Zm-1.15 18h1.53L7.04 3.9H5.4l11.694 16.1Z" />
                    </svg>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-14 w-14 sm:h-12 sm:w-12 rounded-full touch-manipulation"
                    onClick={() => handleEdgeSocialLogin('line')}
                    title={getText('auth_line_login', '使用 LINE 登入')}
                  >
                    <svg className="h-7 w-7 sm:h-6 sm:w-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.029-.199.029-.211 0-.391-.09-.51-.25l-2.443-3.317v2.942c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.029.194-.029.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.086.766.062 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                    </svg>
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-5 sm:space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-sm sm:text-base font-medium">
                    {getText('auth_email_label', '電子郵件')}
                  </Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder={getText('auth_email_placeholder', 'your@email.com')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="h-12 sm:h-10 text-base sm:text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-sm sm:text-base font-medium">
                    {getText('auth_password_label', '密碼')}
                  </Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder={getText('auth_password_placeholder_signup', '至少 8 個字元，含大小寫字母和數字')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={8}
                    maxLength={72}
                    className="h-12 sm:h-10 text-base sm:text-sm"
                  />
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {getText('auth_password_requirements', '密碼需包含: 大寫字母、小寫字母、數字 (8-72 字元)')}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-sm sm:text-base font-medium">
                    {getText('auth_confirm_password_label', '確認密碼')}
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder={getText('auth_confirm_password_placeholder', '請再次輸入密碼')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={8}
                    maxLength={72}
                    className="h-12 sm:h-10 text-base sm:text-sm"
                  />
                </div>
                <Button type="submit" className="w-full h-12 sm:h-10 text-base sm:text-sm font-medium" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-5 w-5 sm:h-4 sm:w-4 animate-spin" />}
                  {getText('auth_signup_button', '註冊')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Anonymous Browsing Option - 移到最下方 */}
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t">
            <Button
              variant="outline"
              className="w-full h-12 sm:h-10 text-sm sm:text-base"
              onClick={handleAnonymousBrowsing}
            >
              <Eye className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              {getText('auth_anonymous_browse', '匿名瀏覽')}
            </Button>
            <p className="text-xs sm:text-sm text-muted-foreground text-center mt-2 sm:mt-3">
              {getText('auth_anonymous_note', '僅可瀏覽內容，需要註冊才能投票')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
