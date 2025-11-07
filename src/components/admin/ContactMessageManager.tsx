import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Check, X } from "lucide-react";
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

interface ContactMessage {
  id: string;
  user_id: string | null;
  category: string;
  title: string;
  content: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  admin_response: string | null;
  admin_id: string | null;
  created_at: string;
  updated_at: string;
  user_nickname: string | null;
  user_email: string | null;
}

const ContactMessageManager = () => {
  const queryClient = useQueryClient();
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [adminResponse, setAdminResponse] = useState("");
  const [updating, setUpdating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // 獲取所有聯絡訊息
  const { data: messages, isLoading, error } = useQuery({
    queryKey: ['admin-contact-messages'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_contact_messages');

      if (error) throw error;
      return data as ContactMessage[];
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
    if (!selectedMessage || !adminResponse.trim()) {
      toast.error("請輸入回覆內容");
      return;
    }

    setUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("未登入");

      const { error } = await supabase
        .from('contact_messages')
        .update({
          status: 'resolved',
          admin_response: adminResponse.trim(),
          admin_id: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedMessage.id);

      if (error) throw error;

      toast.success("回覆已送出");
      setResponseDialogOpen(false);
      setAdminResponse("");
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
          {filteredMessages.map((message) => (
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
                        {message.content}
                      </p>
                      {message.admin_response && (
                        <div className="mt-3 p-3 bg-muted rounded-md">
                          <p className="text-sm font-semibold mb-1">管理員回覆：</p>
                          <p className="text-sm whitespace-pre-wrap">{message.admin_response}</p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.created_at), {
                          addSuffix: true,
                          locale: zhTW,
                        })}
                      </p>
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
                    {!message.admin_response && (
                      <Dialog
                        open={responseDialogOpen && selectedMessage?.id === message.id}
                        onOpenChange={(open) => {
                          setResponseDialogOpen(open);
                          if (open) {
                            setSelectedMessage(message);
                          } else {
                            setSelectedMessage(null);
                            setAdminResponse("");
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
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>回覆訊息</DialogTitle>
                            <DialogDescription>
                              回覆給：{message.user_nickname || '未命名'}{message.user_email ? ` (${message.user_email})` : ''}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="p-3 bg-muted rounded-md">
                              <p className="text-sm font-semibold mb-1">用戶訊息：</p>
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            </div>
                            <div className="space-y-2">
                              <Label>回覆內容 *</Label>
                              <Textarea
                                value={adminResponse}
                                onChange={(e) => setAdminResponse(e.target.value)}
                                placeholder="輸入回覆內容..."
                                rows={6}
                                maxLength={2000}
                              />
                              <p className="text-xs text-muted-foreground text-right">
                                {adminResponse.length} / 2000
                              </p>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setResponseDialogOpen(false);
                                setSelectedMessage(null);
                                setAdminResponse("");
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
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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

