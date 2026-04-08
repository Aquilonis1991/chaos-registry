import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ServerTimeProvider } from "@/contexts/ServerTimeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import ErrorPage from "./pages/ErrorPage";
import NetworkErrorPage from "./pages/NetworkErrorPage";
import Index from "./pages/Index";
import HomePage from "./pages/HomePage";
import VoteDetailPage from "./pages/VoteDetailPage";
import CreateTopicPage from "./pages/CreateTopicPage";
import RechargePage from "./pages/RechargePage";
import MissionPage from "./pages/MissionPage";
import ProfilePage from "./pages/ProfilePage";
import VoteHistoryPage from "./pages/VoteHistoryPage";
import TopicHistoryPage from "./pages/TopicHistoryPage";
import TokenUsageHistoryPage from "./pages/TokenUsageHistoryPage";
import ContactPage from "./pages/ContactPage";
import NotificationsPage from "./pages/NotificationsPage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import LegalPage from "./pages/LegalPage";
import MarketingPage from "./pages/MarketingPage";
import AboutPage from "./pages/AboutPage";
import AuthPage from "./pages/AuthPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import VerifyRedirectPage from "./pages/VerifyRedirectPage";
import { OAuthCallbackPage } from "./pages/OAuthCallbackPage";
import { DeepLinkRedirectPage } from "./pages/DeepLinkRedirectPage";
import AdminPage from "./pages/AdminPage";
import SearchPage from "./pages/SearchPage";
import NotFound from "./pages/NotFound";
import { ErrorLogger } from "@/lib/errorLogger";
import { isNative } from "@/lib/capacitor";
import { OAuthCallbackHandler } from "@/components/OAuthCallbackHandler";
import { ForceUpdateGate } from "@/components/ForceUpdateGate";
import { PurchaseRecoveryToastGate } from "@/components/PurchaseRecoveryToastGate";
import { MustChangeNicknameGate } from "@/components/MustChangeNicknameGate";
import { App as CapacitorApp } from '@capacitor/app';
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // 記錄錯誤到日誌系統
        ErrorLogger.critical(error, {
          componentStack: errorInfo.componentStack,
          source: 'ErrorBoundary'
        });
      }}
    >
      <AuthProvider>
        <ProfileProvider>
          <LanguageProvider>
            <ServerTimeProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <PurchaseRecoveryToastGate />
              <ForceUpdateGate>
              <BrowserRouter>
                <MustChangeNicknameGate>
                <BackButtonHandler />
                {/* App 版第三方登入 Deep Link 回調處理（votechaos://auth/callback） */}
                <OAuthCallbackHandler />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/auth/callback" element={<OAuthCallbackPage />} />
                  <Route path="/auth/deep-link-redirect" element={<DeepLinkRedirectPage />} />
                  <Route path="/auth/verify-redirect" element={<VerifyRedirectPage />} />
                  <Route path="/error" element={<ErrorPage />} />
                  <Route path="/network-error" element={<NetworkErrorPage />} />
                  <Route path="/home" element={<ProtectedRoute><HomePage /><BottomNav /></ProtectedRoute>} />
                  <Route path="/search" element={<ProtectedRoute><SearchPage /><BottomNav /></ProtectedRoute>} />
                  <Route path="/vote/:id" element={<ProtectedRoute><VoteDetailPage /></ProtectedRoute>} />
                  <Route path="/create" element={<ProtectedRoute requireAuth><CreateTopicPage /></ProtectedRoute>} />
                  <Route path="/recharge" element={<ProtectedRoute requireAuth><RechargePage /><BottomNav /></ProtectedRoute>} />
                  <Route path="/mission" element={<ProtectedRoute requireAuth><MissionPage /><BottomNav /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute requireAuth><ProfilePage /><BottomNav /></ProtectedRoute>} />
                  <Route path="/history/votes" element={<ProtectedRoute><VoteHistoryPage /></ProtectedRoute>} />
                  <Route path="/history/topics" element={<ProtectedRoute><TopicHistoryPage /></ProtectedRoute>} />
                  <Route path="/history/token-usage" element={<ProtectedRoute><TokenUsageHistoryPage /></ProtectedRoute>} />
                  <Route path="/contact" element={<ProtectedRoute><ContactPage /></ProtectedRoute>} />
                  <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/privacy/jp" element={<PrivacyPage locale="jp" />} />
                  <Route path="/privacy/en" element={<PrivacyPage locale="en" />} />
                  <Route path="/legal" element={<LegalPage />} />
                  <Route path="/marketing" element={<MarketingPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/admin" element={<ProtectedRoute requireAuth><AdminPage /></ProtectedRoute>} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                </MustChangeNicknameGate>
              </BrowserRouter>
              </ForceUpdateGate>
            </TooltipProvider>
            </ServerTimeProvider>
          </LanguageProvider>
        </ProfileProvider>
      </AuthProvider>
    </ErrorBoundary>
  </QueryClientProvider>
);

// Wrapper component to handle Capacitor listeners inside Router context if needed
// Or just handle it at the top level, but we need access to history or window.history
// Wrapper component to handle Capacitor listeners inside Router context if needed
// Or just handle it at the top level, but we need access to history or window.history
const BackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isNative()) return;

    let listenerHandle: Promise<any> | null = null;

    const setupListener = () => {
      listenerHandle = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        // Logic for back button
        // 1. If on specific root pages, exit app
        const rootPaths = ['/', '/home', '/auth'];
        if (rootPaths.includes(location.pathname)) {
          CapacitorApp.exitApp();
        } else {
          // 2. Otherwise go back
          window.history.back();
        }
      });
    };

    setupListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.then(handle => handle.remove()).catch(console.error);
      }
    };
  }, [location]);

  return null;
};

export default App;
