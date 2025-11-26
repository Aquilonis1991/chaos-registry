import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Bell, CheckCheck, AlertCircle, MessageSquare, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
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
  type: 'announcement' | 'personal' | 'system' | 'contact';
  title: string;
  content: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
}

interface ContactReply {
  message_id: string;
  message_title: string;
  message_category: string;
  message_created_at: string;
  reply_id: string;
  reply_content: string;
  reply_created_at: string;
  responder_id: string;
  responder_name: string | null;
}

const NotificationsPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [contactReplies, setContactReplies] = useState<ContactReply[]>([]);
  const [contactLoading, setContactLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'announcement' | 'personal' | 'contact'>('all');
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
  const tabContactLabel = getText('notifications.tabs.contact', '客服回覆');
  const toastMarkError = getText('notifications.toast.markError', '標記失敗');
  const toastMarkAllSuccess = getText('notifications.toast.markAllSuccess', '已標記所有通知為已讀');
  const toastMarkAllError = getText('notifications.toast.markAllError', '標記失敗');
  const emptyUnreadText = getText('notifications.empty.unread', '沒有未讀通知');
  const emptyAllText = getText('notifications.empty.all', '沒有通知');
  const emptyContactText = getText('notifications.empty.contact', '尚未收到客服回覆');
  const unreadBadgeText = getText('notifications.badge.unread', '未讀');
  const markAsReadButtonText = getText('notifications.list.markAsRead', '標記為已讀');

  // 使用 useMemo 穩定錯誤訊息，避免無限循環
  const toastLoadError = useMemo(
    () => getText('notifications.toast.loadError', '載入通知失敗'),
    [getText]
  );
  const toastContactLoadError = useMemo(
    () => getText('notifications.toast.contactLoadError', '載入客服回覆失敗'),
    [getText]
  );

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 過濾已過期的通知，並排除客服回覆（客服回覆有獨立的獲取方式）
      const now = new Date();
      const validNotifications = (data || []).filter(
        (n) => n.type !== 'contact' && (!n.expires_at || new Date(n.expires_at) > now)
      );

      setNotifications(validNotifications);
    } catch (error: any) {
      console.error("Fetch notifications error:", error);
      toast.error(toastLoadError);
    } finally {
      setLoading(false);
    }
  }, [user?.id, toastLoadError]);

  const fetchContactReplies = useCallback(async () => {
    if (!user) return;

    try {
      setContactLoading(true);
      const { data, error } = await supabase.rpc('user_list_contact_replies');

      if (error) throw error;

      setContactReplies((data || []) as ContactReply[]);
    } catch (error: any) {
      console.error("Fetch contact replies error:", error);
      toast.error(toastContactLoadError);
    } finally {
      setContactLoading(false);
    }
  }, [user?.id, toastContactLoadError]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setContactReplies([]);
      setLoading(false);
      setContactLoading(false);
      return;
    }

    void Promise.allSettled([fetchNotifications(), fetchContactReplies()]);
  }, [user?.id, fetchNotifications, fetchContactReplies]);

  if (uiTextsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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

      // 只更新非客服回覆的通知（客服回覆有獨立的標籤頁）
      setNotifications((prev) =>
        prev.map((n) => 
          n.type !== 'contact' 
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
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
      case 'contact':
        return <MessageSquare className="w-5 h-5 text-amber-500" />;
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
      case 'contact':
        return getText('notifications.type.contact', '客服回覆');
      case 'personal':
        return getText('notifications.type.personal', '個人通知');
      case 'system':
        return getText('notifications.type.system', '系統通知');
      default:
        return getText('notifications.type.default', '通知');
    }
  };

  const getContactCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      bug: getText('contact.category.bug', '錯誤回報'),
      suggestion: getText('contact.category.suggestion', '建議'),
      question: getText('contact.category.question', '問題詢問'),
      complaint: getText('contact.category.complaint', '投訴'),
      other: getText('contact.category.other', '其他'),
    };
    return labels[category] || category;
  };

  const filterNotifications = (tab: 'all' | 'unread' | 'announcement' | 'personal') => {
    switch (tab) {
      case 'unread':
        return notifications.filter((n) => !n.is_read && n.type !== 'contact');
      case 'announcement':
        return notifications.filter((n) => n.type === 'announcement');
      case 'personal':
        return notifications.filter((n) => n.type === 'personal');
      default:
        // 'all' 標籤中排除 'contact' 類型，因為它們在獨立的「客服回覆」標籤中顯示
        return notifications.filter((n) => n.type !== 'contact');
    }
  };

  const renderNotificationList = (tab: 'all' | 'unread' | 'announcement' | 'personal') => {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    const list = filterNotifications(tab);

    if (list.length === 0) {
      const emptyText = tab === 'unread' ? emptyUnreadText : emptyAllText;
      return (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg">{emptyText}</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-3">
        {list.map((notification) => (
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
    );
  };

  const renderContactReplies = () => {
    if (contactLoading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    if (contactReplies.length === 0) {
      return (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg">{emptyContactText}</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-3">
        {contactReplies.map((reply) => (
          <Card key={reply.reply_id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">{reply.message_title}</h3>
                  <Badge variant="outline" className="text-xs">
                    {getContactCategoryLabel(reply.message_category)}
                  </Badge>
                </div>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-xs text-muted-foreground mb-1">
                    {getText('notifications.contactReply.from', '來自：')}{reply.responder_name || getText('notifications.contactReply.admin', '管理員')}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">
                    {reply.reply_content}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {getText('notifications.contactReply.questionCreated', '問題建立：')}{formatDistanceToNow(new Date(reply.message_created_at), {
                      addSuffix: true,
                      locale: zhTW,
                    })}
                  </span>
                  <span>
                    {getText('notifications.contactReply.replyTime', '回覆時間：')}{formatDistanceToNow(new Date(reply.reply_created_at), {
                      addSuffix: true,
                      locale: zhTW,
                    })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  // 未讀計數排除客服回覆（客服回覆有獨立的標籤頁）
  const unreadCount = notifications.filter((n) => !n.is_read && n.type !== 'contact').length;
  const announcementCount = notifications.filter((n) => n.type === 'announcement').length;
  const personalCount = notifications.filter((n) => n.type === 'personal').length;
  const contactCount = contactReplies.length;
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
          <TabsList 
            className="!flex !flex-col !w-full gap-2 !h-auto p-2 !items-stretch"
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              height: 'auto',
              alignItems: 'stretch'
            }}
          >
            {/* 第一行：重要分類 */}
            <div className="grid grid-cols-2 gap-2 w-full">
              <TabsTrigger value="all" className="w-full">
                {tabAllLabel}
                {notifications.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {notifications.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="unread" className="w-full">
                {tabUnreadLabel}
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
            </div>
            {/* 第二行：其他分類 */}
            <div className="grid grid-cols-3 gap-2 w-full">
              <TabsTrigger value="announcement" className="w-full">
                {tabAnnouncementLabel}
                {announcementCount > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {announcementCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="personal" className="w-full">
                {tabPersonalLabel}
                {personalCount > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {personalCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="contact" className="w-full">
                {tabContactLabel}
                {contactReplies.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {contactReplies.length}
                  </Badge>
                )}
              </TabsTrigger>
            </div>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            {renderNotificationList('all')}
          </TabsContent>
          <TabsContent value="unread" className="mt-6">
            {renderNotificationList('unread')}
          </TabsContent>
          <TabsContent value="announcement" className="mt-6">
            {renderNotificationList('announcement')}
          </TabsContent>
          <TabsContent value="personal" className="mt-6">
            {renderNotificationList('personal')}
          </TabsContent>
          <TabsContent value="contact" className="mt-6">
            {renderContactReplies()}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default NotificationsPage;

