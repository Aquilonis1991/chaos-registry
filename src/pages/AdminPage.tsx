import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { UITextManager } from "@/components/admin/UITextManager";
import { TopicManager } from "@/components/admin/TopicManager";
import SystemConfigManager from "@/components/admin/SystemConfigManager";
import AnnouncementManager from "@/components/admin/AnnouncementManager";
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

const AdminPage = () => {
  const { isAdmin, isLoading } = useAdmin();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("users");
  const [selectedUserIdForRestriction, setSelectedUserIdForRestriction] = useState<string | null>(null);
  const { language } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);

  const headerTitle = getText('admin.header.title', '後台管理');
  const tabUsers = getText('admin.tabs.users', '用戶管理');
  const tabNotifications = getText('admin.tabs.notifications', '通知管理');
  const tabContact = getText('admin.tabs.contact', '聯絡訊息');
  const tabAnnouncements = getText('admin.tabs.announcements', '公告管理');
  const tabReports = getText('admin.tabs.reports', '檢舉管理');
  const tabTopics = getText('admin.tabs.topics', '主題管理');
  const tabRestrictions = getText('admin.tabs.userRestrictions', '用戶限制');
  const tabSecurity = getText('admin.tabs.security', '安全管理');
  const tabUiTexts = getText('admin.tabs.uiTexts', 'UI文字管理');
  const tabConfig = getText('admin.tabs.config', '系統配置');
  const tabBannedWords = getText('admin.tabs.bannedWords', '禁字表');

  // 方案2：在原生平台（iOS/Android）隱藏後台功能，僅在網頁版提供
  useEffect(() => {
    if (isNative()) {
      // 如果在原生平台（APP），靜默重定向到首頁
      navigate('/home', { replace: true });
      return;
    }
  }, [navigate]);

  useEffect(() => {
    // 只有在網頁版才檢查管理員權限
    if (!isLoading && !isAdmin && !isNative()) {
      navigate('/');
    }
  }, [isAdmin, isLoading, navigate]);

  // 如果在原生平台，直接返回null（會被上面的useEffect重定向）
  if (isNative()) {
    return null;
  }

  if (isLoading || uiTextsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">{headerTitle}</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-11 mb-6">
          <TabsTrigger value="users">{tabUsers}</TabsTrigger>
          <TabsTrigger value="notifications">{tabNotifications}</TabsTrigger>
          <TabsTrigger value="contact">{tabContact}</TabsTrigger>
          <TabsTrigger value="announcements">{tabAnnouncements}</TabsTrigger>
          <TabsTrigger value="reports">{tabReports}</TabsTrigger>
          <TabsTrigger value="topics">{tabTopics}</TabsTrigger>
          <TabsTrigger value="user-restrictions">{tabRestrictions}</TabsTrigger>
          <TabsTrigger value="security">{tabSecurity}</TabsTrigger>
          <TabsTrigger value="ui-texts">{tabUiTexts}</TabsTrigger>
          <TabsTrigger value="config">{tabConfig}</TabsTrigger>
          <TabsTrigger value="banned-words">{tabBannedWords}</TabsTrigger>
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
        
        <TabsContent value="announcements">
          <Card className="p-6">
            <AnnouncementManager />
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
