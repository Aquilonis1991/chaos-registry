import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
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
import AuthPage from "./pages/AuthPage";
import VerifyRedirectPage from "./pages/VerifyRedirectPage";
import AdminPage from "./pages/AdminPage";
import SearchPage from "./pages/SearchPage";
import NotFound from "./pages/NotFound";
import { ErrorLogger } from "@/lib/errorLogger";
import { isNative } from "@/lib/capacitor";
import { OAuthCallbackHandler } from "@/components/OAuthCallbackHandler";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // 確保查詢不會因為 enabled 變化而清除數據
      keepPreviousData: true,
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
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              {/* App 版第三方登入 Deep Link 回調處理（votechaos://auth/callback） */}
              <OAuthCallbackHandler />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<AuthPage />} />
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
                <Route path="/history/votes" element={<ProtectedRoute requireAuth><VoteHistoryPage /></ProtectedRoute>} />
                <Route path="/history/topics" element={<ProtectedRoute requireAuth><TopicHistoryPage /></ProtectedRoute>} />
                <Route path="/history/token-usage" element={<ProtectedRoute requireAuth><TokenUsageHistoryPage /></ProtectedRoute>} />
                <Route path="/contact" element={<ProtectedRoute requireAuth><ContactPage /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute requireAuth><NotificationsPage /></ProtectedRoute>} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/admin" element={<ProtectedRoute requireAuth><AdminPage /></ProtectedRoute>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  </QueryClientProvider>
);

export default App;
