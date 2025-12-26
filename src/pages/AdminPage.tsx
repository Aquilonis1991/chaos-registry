import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { UITextManager } from "@/components/admin/UITextManager";
import { TopicManager } from "@/components/admin/TopicManager";
import SystemConfigManager from "@/components/admin/SystemConfigManager";
import ReportManager from "@/components/admin/ReportManager";
import SecurityManager from "@/components/admin/SecurityManager";
import { BannedWordsManager } from "@/components/admin/BannedWordsManager";
import { UserRestrictionManager } from "@/components/admin/UserRestrictionManager";
import { UserManager } from "@/components/admin/UserManager";
import NotificationManager from "@/components/admin/NotificationManager";
import ContactMessageManager from "@/components/admin/ContactMessageManager";
import { isNative } from "@/lib/capacitor";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import LegalContentManager from "@/components/admin/LegalContentManager";

const AdminPage = () => {
  const { isAdmin, isLoading, error: adminError } = useAdmin();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("users");
  const [selectedUserIdForRestriction, setSelectedUserIdForRestriction] = useState<string | null>(null);
  const { language } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);

  const headerTitle = getText('admin.header.title', '後台管理');
  const tabUsers = getText('admin.tabs.users', '用戶管理');
  const tabNotifications = getText('admin.tabs.notifications', '通知管理');
  const tabContact = getText('admin.tabs.contact', '聯絡訊息');
  const tabReports = getText('admin.tabs.reports', '檢舉管理');
  const tabTopics = getText('admin.tabs.topics', '主題管理');
  const tabRestrictions = getText('admin.tabs.userRestrictions', '用戶限制');
  const tabSecurity = getText('admin.tabs.security', '安全管理');
  const tabUiTexts = getText('admin.tabs.uiTexts', 'UI文字管理');
  const tabConfig = getText('admin.tabs.config', '系統配置');
  const tabBannedWords = getText('admin.tabs.bannedWords', '禁字表');
  const tabLegal = getText('admin.tabs.legal', '條款管理');

  useEffect(() => {
    // 檢查管理員權限
    if (!isLoading && !isAdmin) {
      console.log('[AdminPage] Not admin, redirecting to home');
      navigate('/', { replace: true });
    }
  }, [isAdmin, isLoading, navigate]);

  // 顯示錯誤訊息（如果有）
  if (adminError) {
    console.error('[AdminPage] Admin check error:', adminError);
  }

  // 如果載入超過10秒，顯示錯誤提示（減少等待時間）
  const [loadTimeout, setLoadTimeout] = useState(false);
  useEffect(() => {
    if (isLoading || uiTextsLoading) {
      const timer = setTimeout(() => {
        setLoadTimeout(true);
      }, 10000); // 10秒超時（減少等待時間）
      return () => clearTimeout(timer);
    } else {
      setLoadTimeout(false);
    }
  }, [isLoading, uiTextsLoading]);

  // 如果只是 UI 文字載入中，允許先顯示後台（使用默認文字）
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            {getText('admin.loading.checking', '檢查管理員權限中...')}
          </p>
          {loadTimeout && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md mx-auto">
              <p className="text-sm text-yellow-800 font-semibold mb-2">
                載入時間過長
              </p>
              <p className="text-xs text-yellow-700 mb-3">
                如果持續無法載入，請：
              </p>
              <ul className="text-xs text-yellow-700 text-left space-y-1 list-disc list-inside">
                <li>檢查網絡連接</li>
                <li>重新整理頁面</li>
                <li>清除瀏覽器快取</li>
                <li>檢查瀏覽器控制台的錯誤訊息</li>
              </ul>
              <button
                onClick={() => {
                  // 清除快取並重新載入
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('admin_status_cache');
                  }
                  window.location.reload();
                }}
                className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
              >
                清除快取並重新載入
              </button>
            </div>
          )}
          {adminError && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg max-w-md mx-auto">
              <p className="text-xs text-destructive font-semibold mb-1">
                {getText('admin.error.checking', '錯誤：')}
              </p>
              <p className="text-xs text-destructive">
                {adminError instanceof Error ? adminError.message : getText('admin.error.unknown', '未知錯誤')}
              </p>
              <button
                onClick={() => {
                  // 清除快取並重新載入
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('admin_status_cache');
                  }
                  window.location.reload();
                }}
                className="mt-3 px-4 py-2 bg-destructive text-destructive-foreground rounded text-xs hover:bg-destructive/90"
              >
                清除快取並重新載入
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // UI 文字載入中不阻塞後台顯示（使用默認文字）
  if (uiTextsLoading && !isLoading) {
    // 允許顯示後台，但顯示載入提示
    console.log('[AdminPage] UI texts loading, but allowing access');
  }

  if (!isAdmin) {
    console.log('[AdminPage] User is not admin, returning null');
    return null;
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">{headerTitle}</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-10 mb-6">
          <TabsTrigger value="users">{tabUsers}</TabsTrigger>
          <TabsTrigger value="notifications">{tabNotifications}</TabsTrigger>
          <TabsTrigger value="contact">{tabContact}</TabsTrigger>
          <TabsTrigger value="reports">{tabReports}</TabsTrigger>
          <TabsTrigger value="topics">{tabTopics}</TabsTrigger>
          <TabsTrigger value="user-restrictions">{tabRestrictions}</TabsTrigger>
          <TabsTrigger value="security">{tabSecurity}</TabsTrigger>
          <TabsTrigger value="ui-texts">{tabUiTexts}</TabsTrigger>
          <TabsTrigger value="config">{tabConfig}</TabsTrigger>
          <TabsTrigger value="banned-words">{tabBannedWords}</TabsTrigger>
          <TabsTrigger value="legal">{tabLegal}</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="p-6">
            <UserManager
              onSetRestriction={(userId) => {
                setSelectedUserIdForRestriction(userId);
                setActiveTab("user-restrictions");
              }}
            />
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="p-6">
            <NotificationManager />
          </Card>
        </TabsContent>

        <TabsContent value="contact">
          <Card className="p-6">
            <ContactMessageManager />
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card className="p-6">
            <ReportManager />
          </Card>
        </TabsContent>

        <TabsContent value="topics">
          <Card className="p-6">
            <TopicManager />
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card className="p-6">
            <SecurityManager />
          </Card>
        </TabsContent>

        <TabsContent value="ui-texts">
          <Card className="p-6">
            <UITextManager />
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <SystemConfigManager />
        </TabsContent>

        <TabsContent value="banned-words">
          <BannedWordsManager />
        </TabsContent>

        <TabsContent value="legal">
          <LegalContentManager />
        </TabsContent>

        <TabsContent value="user-restrictions">
          <Card className="p-6">
            <UserRestrictionManager
              preselectedUserId={selectedUserIdForRestriction}
              onUserSelected={() => setSelectedUserIdForRestriction(null)}
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;
