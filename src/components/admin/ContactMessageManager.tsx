import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface ContactMessageReply {
  id: string;
  message_id: string;
  responder_id: string;
  responder_role: 'admin' | 'user';
  content: string;
  created_at: string;
  responder_name?: string | null;
}

interface ContactMessage {
  id: string;
  user_id: string | null;
  category: string;
  title: string;
  content: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  admin_id: string | null;
  created_at: string;
  updated_at: string;
  user_nickname: string | null;
  user_email: string | null;
  admin_response: string | null;
  replies: ContactMessageReply[];
}

const TECH_SECTION_PREFIXES = ['Stack Trace:', 'Recent Errors:', 'Client Info:'];

const splitMessageContent = (content: string) => {
  const sections = content
    .split(/\n\s*\n/)
    .map((section) => section.trim())
    .filter(Boolean);

  const technicalSections: { title: string; content: string }[] = [];
  const generalSections: string[] = [];

  sections.forEach((section) => {
    const normalizedSection = section.replace(/^([^：]+)：/, '$1:');
    const prefix = TECH_SECTION_PREFIXES.find((key) =>
      normalizedSection.toLowerCase().startsWith(key.toLowerCase())
    );

    if (prefix) {
      const title = prefix.replace(':', '');
      const body = normalizedSection.slice(prefix.length).trim();
      technicalSections.push({
        title,
        content: body || section,
      });
    } else {
      generalSections.push(section);
    }
  });

  return {
    generalContent: generalSections.length ? generalSections.join('\n\n') : content,
    technicalSections,
  };
};

const ContactMessageManager = () => {
  const queryClient = useQueryClient();
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [updating, setUpdating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [technicalExpanded, setTechnicalExpanded] = useState<Record<string, boolean>>({});

  // 獲取所有聯絡訊息
  const { data: messages, isLoading, error } = useQuery({
    queryKey: ['admin-contact-messages'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_contact_messages');

      if (error) throw error;

      return (data as any[]).map((message) => ({
        ...message,
        replies: Array.isArray(message.replies)
          ? message.replies.map((reply: any) => ({
              id: reply.id,
              message_id: reply.message_id,
              responder_id: reply.responder_id,
              responder_role: reply.responder_role,
              content: reply.content,
              created_at: reply.created_at,
              responder_name: reply.responder_name ?? null,
            }))
          : [],
      })) as ContactMessage[];
    },
  });

  const handleUpdateStatus = async (messageId: string, newStatus: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登入");

      const { error } = await supabase
        .from('contact_messages')
        .update({
          status: newStatus,
          admin_id: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', messageId);

      if (error) throw error;

      toast.success("狀態已更新");
      queryClient.invalidateQueries({ queryKey: ['admin-contact-messages'] });
    } catch (error: any) {
      console.error("Update status error:", error);
      toast.error("更新失敗");
    }
  };

  const handleSubmitResponse = async () => {
    if (!selectedMessage || !replyContent.trim()) {
      toast.error("請輸入回覆內容");
      return;
    }

    setUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登入");

      const nextStatus = selectedMessage.status === 'pending' ? 'in_progress' : selectedMessage.status;

      const { error } = await supabase.rpc('admin_reply_contact_message', {
        p_message_id: selectedMessage.id,
        p_content: replyContent.trim(),
        p_status: nextStatus,
      });

      if (error) throw error;

      toast.success("回覆已送出");
      setResponseDialogOpen(false);
      setReplyContent("");
      setSelectedMessage(null);
      queryClient.invalidateQueries({ queryKey: ['admin-contact-messages'] });
    } catch (error: any) {
      console.error("Submit response error:", error);
      toast.error("回覆失敗");
    } finally {
      setUpdating(false);
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      bug: '錯誤回報',
      suggestion: '建議',
      question: '問題詢問',
      complaint: '投訴',
      other: '其他',
    };
    return labels[category] || category;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: '待處理',
      in_progress: '處理中',
      resolved: '已解決',
      closed: '已關閉',
    };
    return labels[status] || status;
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'pending':
        return 'destructive';
      case 'in_progress':
        return 'default';
      case 'resolved':
        return 'secondary';
      case 'closed':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const filteredMessages = messages?.filter((m) => {
    if (statusFilter === 'all') return true;
    return m.status === statusFilter;
  });

  const pendingCount = messages?.filter((m) => m.status === 'pending').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">聯絡訊息管理</h2>
          <p className="text-muted-foreground">
            管理用戶提交的聯絡訊息 {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingCount} 待處理
              </Badge>
            )}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('all')}
        >
          全部
        </Button>
        <Button
          variant={statusFilter === 'pending' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('pending')}
        >
          待處理
          {pendingCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {pendingCount}
            </Badge>
          )}
        </Button>
        <Button
          variant={statusFilter === 'in_progress' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('in_progress')}
        >
          處理中
        </Button>
        <Button
          variant={statusFilter === 'resolved' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('resolved')}
        >
          已解決
        </Button>
        <Button
          variant={statusFilter === 'closed' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('closed')}
        >
          已關閉
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-12">
            <div className="text-center text-destructive">
              無法載入聯絡訊息：{(error as Error).message}
            </div>
          </CardContent>
        </Card>
      ) : filteredMessages && filteredMessages.length > 0 ? (
        <div className="space-y-3">
          {filteredMessages.map((message) => {
            const latestReply = message.replies?.[message.replies.length - 1];
            const { generalContent, technicalSections } = splitMessageContent(message.content);
            const isTechnicalOpen = technicalExpanded[message.id];
            return (
              <Card key={message.id}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{message.title}</h3>
                          <Badge variant="outline">{getCategoryLabel(message.category)}</Badge>
                          <Badge variant={getStatusVariant(message.status)}>
                            {getStatusLabel(message.status)}
                          </Badge>
                        </div>
                        {(message.user_nickname || message.user_email) && (
                          <p className="text-sm text-muted-foreground mb-2">
                            來自：{message.user_nickname || '未命名'}{message.user_email ? ` (${message.user_email})` : ''}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-2">
                          {generalContent}
                        </p>
                        {technicalSections.length > 0 && (
                          <div className="border rounded-md p-3 bg-muted/60">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold">技術資訊</p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setTechnicalExpanded((prev) => ({
                                    ...prev,
                                    [message.id]: !prev[message.id],
                                  }))
                                }
                                className="h-8"
                              >
                                {isTechnicalOpen ? '收合' : '展開'}
                              </Button>
                            </div>
                            {isTechnicalOpen && (
                              <div className="mt-3 space-y-3 text-xs font-mono whitespace-pre-wrap break-all">
                                {technicalSections.map((section, index) => (
                                  <div key={`${message.id}-tech-${index}`}>
                                    <p className="font-semibold mb-1">{section.title}</p>
                                    <pre className="whitespace-pre-wrap break-all">
                                      {section.content}
                                    </pre>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="mt-3 space-y-2">
                          <p className="text-sm font-semibold">對話紀錄</p>
                          <div className="space-y-2">
                            <div className="p-3 bg-muted rounded-md">
                              <p className="text-xs text-muted-foreground mb-1">用戶訊息</p>
                              <p className="text-sm whitespace-pre-wrap">{generalContent}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(message.created_at), {
                                  addSuffix: true,
                                  locale: zhTW,
                                })}
                              </p>
                            </div>
                            {message.replies?.length ? (
                              message.replies.map((reply) => (
                                <div
                                  key={reply.id}
                                  className="p-3 rounded-md border border-primary/40 bg-primary/5"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-primary">
                                      {reply.responder_role === 'admin'
                                        ? '管理員回覆'
                                        : reply.responder_name || '用戶'}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(reply.created_at), {
                                        addSuffix: true,
                                        locale: zhTW,
                                      })}
                                    </span>
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                                </div>
                              ))
                            ) : (
                              <div className="p-3 bg-muted/60 rounded-md text-xs text-muted-foreground">
                                尚未有回覆
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(message.created_at), {
                            addSuffix: true,
                            locale: zhTW,
                          })}
                        </p>
                        {latestReply && (
                          <p className="text-xs text-muted-foreground">
                            最新回覆：{formatDistanceToNow(new Date(latestReply.created_at), {
                              addSuffix: true,
                              locale: zhTW,
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={message.status}
                        onValueChange={(value) => handleUpdateStatus(message.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">待處理</SelectItem>
                          <SelectItem value="in_progress">處理中</SelectItem>
                          <SelectItem value="resolved">已解決</SelectItem>
                          <SelectItem value="closed">已關閉</SelectItem>
                        </SelectContent>
                      </Select>
                      <Dialog
                        open={responseDialogOpen && selectedMessage?.id === message.id}
                        onOpenChange={(open) => {
                          setResponseDialogOpen(open);
                          if (open) {
                            setSelectedMessage(message);
                          } else {
                            setSelectedMessage(null);
                            setReplyContent("");
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedMessage(message);
                              setResponseDialogOpen(true);
                            }}
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            回覆
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>回覆訊息</DialogTitle>
                            <DialogDescription>
                              回覆給：{message.user_nickname || '未命名'}{message.user_email ? ` (${message.user_email})` : ''}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                            <div className="p-3 bg-muted rounded-md">
                              <p className="text-xs text-muted-foreground mb-1">用戶訊息</p>
                              <p className="text-sm whitespace-pre-wrap">{generalContent}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(message.created_at), {
                                  addSuffix: true,
                                  locale: zhTW,
                                })}
                              </p>
                            </div>
                            {technicalSections.length > 0 && (
                              <div className="border rounded-md p-3 bg-muted/40">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-semibold">技術資訊</p>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setTechnicalExpanded((prev) => ({
                                        ...prev,
                                        [message.id]: !prev[message.id],
                                      }))
                                    }
                                    className="h-8"
                                  >
                                    {isTechnicalOpen ? '收合' : '展開'}
                                  </Button>
                                </div>
                                {isTechnicalOpen && (
                                  <div className="mt-3 space-y-3 text-xs font-mono whitespace-pre-wrap break-all">
                                    {technicalSections.map((section, index) => (
                                      <div key={`${message.id}-dialog-tech-${index}`}>
                                        <p className="font-semibold mb-1">{section.title}</p>
                                        <pre className="whitespace-pre-wrap break-all">
                                          {section.content}
                                        </pre>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {message.replies?.length ? (
                              message.replies.map((reply) => (
                                <div
                                  key={reply.id}
                                  className="p-3 rounded-md border border-primary/40 bg-primary/5"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-primary">
                                      {reply.responder_role === 'admin'
                                        ? '管理員回覆'
                                        : reply.responder_name || '用戶'}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(reply.created_at), {
                                        addSuffix: true,
                                        locale: zhTW,
                                      })}
                                    </span>
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                                </div>
                              ))
                            ) : (
                              <div className="p-3 bg-muted/60 rounded-md text-xs text-muted-foreground">
                                尚未有回覆
                              </div>
                            )}
                            <div className="space-y-2">
                              <Label>回覆內容 *</Label>
                              <Textarea
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                placeholder="輸入回覆內容..."
                                rows={6}
                                maxLength={2000}
                              />
                              <p className="text-xs text-muted-foreground text-right">
                                {replyContent.length} / 2000
                              </p>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setResponseDialogOpen(false);
                                setSelectedMessage(null);
                                setReplyContent("");
                              }}
                            >
                              取消
                            </Button>
                            <Button onClick={handleSubmitResponse} disabled={updating}>
                              {updating ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  送出中...
                                </>
                              ) : (
                                <>
                                  <Check className="w-4 h-4 mr-2" />
                                  送出回覆
                                </>
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12">
            <div className="text-center text-muted-foreground">
              沒有聯絡訊息
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ContactMessageManager;

