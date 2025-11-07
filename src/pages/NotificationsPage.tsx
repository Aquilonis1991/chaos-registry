import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Bell, CheckCheck, AlertCircle, MessageSquare, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

interface Notification {
  id: string;
  type: 'announcement' | 'personal' | 'system';
  title: string;
  content: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
}

const NotificationsPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'announcement' | 'personal'>('all');
  const { language } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);

  const headerTitle = getText('notifications.header.title', '通知與公告');
  const headerSubtitleTemplate = getText('notifications.header.subtitleWithCount', '{{count}} 則未讀通知');
  const headerSubtitleEmpty = getText('notifications.header.subtitleEmpty', '沒有未讀通知');
  const markAllButtonText = getText('notifications.header.markAll', '全部已讀');
  const tabAllLabel = getText('notifications.tabs.all', '全部');
  const tabUnreadLabel = getText('notifications.tabs.unread', '未讀');
  const tabAnnouncementLabel = getText('notifications.tabs.announcement', '公告');
  const tabPersonalLabel = getText('notifications.tabs.personal', '個人');
  const toastLoadError = getText('notifications.toast.loadError', '載入通知失敗');
  const toastMarkError = getText('notifications.toast.markError', '標記失敗');
  const toastMarkAllSuccess = getText('notifications.toast.markAllSuccess', '已標記所有通知為已讀');
  const toastMarkAllError = getText('notifications.toast.markAllError', '標記失敗');
  const emptyUnreadText = getText('notifications.empty.unread', '沒有未讀通知');
  const emptyAllText = getText('notifications.empty.all', '沒有通知');
  const unreadBadgeText = getText('notifications.badge.unread', '未讀');
  const markAsReadButtonText = getText('notifications.list.markAsRead', '標記為已讀');

  if (uiTextsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 過濾已過期的通知
      const now = new Date();
      const validNotifications = (data || []).filter(
        (n) => !n.expires_at || new Date(n.expires_at) > now
      );

      setNotifications(validNotifications);
    } catch (error: any) {
      console.error("Fetch notifications error:", error);
      toast.error(toastLoadError);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      );
    } catch (error: any) {
      console.error("Mark as read error:", error);
      toast.error(toastMarkError);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase.rpc('mark_all_notifications_read');

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      toast.success(toastMarkAllSuccess);
    } catch (error: any) {
      console.error("Mark all as read error:", error);
      toast.error(toastMarkAllError);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'announcement':
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      case 'personal':
        return <MessageSquare className="w-5 h-5 text-purple-500" />;
      case 'system':
        return <Info className="w-5 h-5 text-gray-500" />;
      default:
        return <Bell className="w-5 h-5 text-primary" />;
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case 'announcement':
        return getText('notifications.type.announcement', '公告');
      case 'personal':
        return getText('notifications.type.personal', '個人通知');
      case 'system':
        return getText('notifications.type.system', '系統通知');
      default:
        return getText('notifications.type.default', '通知');
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.is_read;
    if (activeTab === 'announcement') return n.type === 'announcement';
    if (activeTab === 'personal') return n.type === 'personal';
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const headerSubtitle = unreadCount > 0
    ? headerSubtitleTemplate.replace('{{count}}', unreadCount.toString())
    : headerSubtitleEmpty;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-primary shadow-lg">
        <div className="max-w-screen-xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/profile">
                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-primary-foreground">{headerTitle}</h1>
                <p className="text-sm text-primary-foreground/80">
                  {headerSubtitle}
                </p>
              </div>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-primary-foreground hover:bg-primary-foreground/20"
              >
                <CheckCheck className="w-4 h-4 mr-1" />
                {markAllButtonText}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">
              {tabAllLabel}
              {notifications.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {notifications.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="unread">
              {tabUnreadLabel}
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="announcement">{tabAnnouncementLabel}</TabsTrigger>
            <TabsTrigger value="personal">{tabPersonalLabel}</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <Card>
                <CardContent className="p-12">
                  <div className="text-center">
                    <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-lg">
                      {activeTab === 'unread' ? emptyUnreadText : emptyAllText}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map((notification) => (
                  <Card
                    key={notification.id}
                    className={`hover:shadow-md transition-shadow ${
                      !notification.is_read ? 'border-primary border-2' : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold text-foreground">
                                  {notification.title}
                                </h3>
                                <Badge variant="outline" className="text-xs">
                                  {getNotificationTypeLabel(notification.type)}
                                </Badge>
                                {!notification.is_read && (
                                  <Badge variant="default" className="text-xs">
                                    {unreadBadgeText}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {notification.content}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.created_at), {
                                addSuffix: true,
                                locale: zhTW,
                              })}
                            </span>
                            {!notification.is_read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => markAsRead(notification.id)}
                                className="text-xs"
                              >
                                {markAsReadButtonText}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default NotificationsPage;

