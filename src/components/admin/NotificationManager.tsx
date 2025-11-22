import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Trash2, Users, Bell } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AdminNotification,
  NotificationProfile,
  mergeAnnouncements
} from "@/lib/notifications";

interface NotificationProfile {
  nickname: string | null;
  avatar: string | null;
}

const NotificationManager = () => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notificationType, setNotificationType] = useState<'announcement' | 'personal'>('announcement');
  const [viewFilter, setViewFilter] = useState<'all' | 'announcement' | 'personal' | 'contact'>('all');
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [users, setUsers] = useState<Array<{ id: string; nickname: string; email: string }>>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // 獲取所有通知
  const { data: notifications, isLoading } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const notificationsData = (data || []) as AdminNotification[];
      const userIds = Array.from(
        new Set(
          notificationsData
            .map((n) => n.user_id)
            .filter((id): id is string => Boolean(id))
        )
      );

      if (userIds.length === 0) {
        return notificationsData;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nickname, avatar')
        .in('id', userIds);

      if (profilesError) {
        console.warn('Failed to fetch profiles for notifications:', profilesError);
        return notificationsData;
      }

      const profileMap = new Map<string, NotificationProfile>(
        (profilesData || []).map((profile) => [
          profile.id,
          {
            nickname: profile.nickname ?? null,
            avatar: profile.avatar ?? null,
          },
        ])
      );

      const merged = notificationsData.map((notification) => ({
        ...notification,
        profiles: notification.user_id ? profileMap.get(notification.user_id) : undefined,
      }));

      return mergeAnnouncements(merged);
    },
  });

  // 獲取用戶列表
  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nickname')
        .order('nickname', { ascending: true })
        .limit(1000);

      if (error) {
        console.error('Fetch profiles for notifications failed:', error);
        toast.error('載入用戶列表失敗');
        return;
      }

      const mappedUsers = (data || []).map((user) => ({
        id: user.id,
        nickname: user.nickname || '未命名用戶',
        email: ''
      }));
      setUsers(mappedUsers);
    };
    fetchUsers();
  }, []);

  const handleSendNotification = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("請填寫標題和內容");
      return;
    }

    if (notificationType === 'personal' && !selectedUserId) {
      toast.error("請選擇接收用戶");
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登入");

      if (notificationType === 'announcement') {
        // 發送給所有用戶
        const { data: allUsers, error: usersError } = await supabase
          .from('profiles')
          .select('id');

        if (usersError) throw usersError;

        const notificationsToInsert = (allUsers || []).map((u) => ({
          user_id: u.id,
          type: 'announcement' as const,
          title: title.trim(),
          content: content.trim(),
          created_by: user.id,
          expires_at: expiresAt || null,
        }));

        const { error: insertError } = await supabase
          .from('notifications')
          .insert(notificationsToInsert);

        if (insertError) throw insertError;

        toast.success(`已發送公告給 ${notificationsToInsert.length} 位用戶`);
      } else {
        // 發送給指定用戶
        const { error: insertError } = await supabase
          .from('notifications')
          .insert({
            user_id: selectedUserId,
            type: 'personal',
            title: title.trim(),
            content: content.trim(),
            created_by: user.id,
            expires_at: expiresAt || null,
          });

        if (insertError) throw insertError;

        toast.success("個人通知已發送");
      }

      setDialogOpen(false);
      setTitle("");
      setContent("");
      setSelectedUserId("");
      setExpiresAt("");
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    } catch (error: any) {
      console.error("Send notification error:", error);
      toast.error("發送失敗：" + (error.message || "請稍後再試"));
    } finally {
      setSending(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!confirm("確定要刪除此通知嗎？")) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("通知已刪除");
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    } catch (error: any) {
      console.error("Delete notification error:", error);
      toast.error("刪除失敗");
    }
  };

  const filteredUsers = users.filter((u) => {
    const nicknameMatch = u.nickname?.toLowerCase().includes(searchTerm.toLowerCase());
    const emailMatch = u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    return (nicknameMatch || emailMatch);
  });

  const filteredNotifications = notifications?.filter((n) => {
    if (viewFilter === 'announcement') {
      return n.type === 'announcement';
    } else if (viewFilter === 'personal') {
      return n.type === 'personal';
    } else if (viewFilter === 'contact') {
      return n.type === 'contact';
    }
    return true;
  });

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case 'announcement':
        return '公告';
      case 'contact':
        return '客服回覆';
      case 'personal':
        return '個人通知';
      case 'system':
      default:
        return '系統通知';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">通知管理</h2>
          <p className="text-muted-foreground">管理公告、個人通知與客服回覆</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Send className="w-4 h-4 mr-2" />
              發送通知
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>發送通知</DialogTitle>
              <DialogDescription>發送公告給所有用戶或個人通知給指定用戶</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>通知類型</Label>
                <Select value={notificationType} onValueChange={(v) => setNotificationType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="announcement">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        公告（發送給所有用戶）
                      </div>
                    </SelectItem>
                    <SelectItem value="personal">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        個人通知（發送給指定用戶）
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {notificationType === 'personal' && (
                <div className="space-y-2">
                  <Label>選擇用戶</Label>
                  <Input
                    placeholder="搜尋用戶..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇用戶" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredUsers.length === 0 ? (
                        <div className="px-2 py-3 text-sm text-muted-foreground">
                          找不到符合條件的用戶
                        </div>
                      ) : (
                        filteredUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.nickname}
                            {user.email ? ` (${user.email})` : ''}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>標題 *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="輸入通知標題"
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label>內容 *</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="輸入通知內容"
                  rows={6}
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {content.length} / 2000
                </p>
              </div>

              <div className="space-y-2">
                <Label>過期時間（選填）</Label>
                <Input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  留空表示永不過期
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSendNotification} disabled={sending}>
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    發送中...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    發送
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        <Button
          variant={viewFilter === 'all' ? 'default' : 'outline'}
          onClick={() => setViewFilter('all')}
        >
          全部
        </Button>
        <Button
          variant={viewFilter === 'announcement' ? 'default' : 'outline'}
          onClick={() => setViewFilter('announcement')}
        >
          公告
        </Button>
        <Button
          variant={viewFilter === 'personal' ? 'default' : 'outline'}
          onClick={() => setViewFilter('personal')}
        >
          個人通知
        </Button>
        <Button
          variant={viewFilter === 'contact' ? 'default' : 'outline'}
          onClick={() => setViewFilter('contact')}
        >
          客服回覆
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : filteredNotifications && filteredNotifications.length > 0 ? (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <Card key={notification.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{notification.title}</h3>
                      <Badge variant="outline">
                        {getNotificationTypeLabel(notification.type)}
                      </Badge>
                      {notification.type !== 'announcement' && notification.type !== 'contact' && (
                        notification.is_read ? (
                          <Badge variant="secondary">已讀</Badge>
                        ) : (
                          <Badge variant="default">未讀</Badge>
                        )
                      )}
                      {notification.type === 'contact' && (
                        <Badge variant="outline" className="text-amber-600 border-amber-600">
                          客服回覆
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-2">
                      {notification.content}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        接收者：
                        {notification.type === 'announcement'
                          ? '全體會員'
                          : notification.profiles?.nickname ?? '未知用戶'}
                      </span>

                      {notification.type === 'announcement' && notification.announcement_recipient_count && (
                        <span>發送對象數：{notification.announcement_recipient_count}</span>
                      )}
                      <span>
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: zhTW,
                        })}
                      </span>
                      {notification.expires_at && (
                        <span>
                          過期：{new Date(notification.expires_at).toLocaleString('zh-TW')}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteNotification(notification.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12">
            <div className="text-center text-muted-foreground">
              沒有通知記錄
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NotificationManager;

