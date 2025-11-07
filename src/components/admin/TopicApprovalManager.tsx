import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Check, X, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

interface Topic {
  id: string;
  title: string;
  description?: string;
  creator_id: string;
  approval_status: string;
  exposure_level: string;
  duration_days: number;
  created_at: string;
  options: any;
  tags: string[];
}

export const TopicApprovalManager = () => {
  const queryClient = useQueryClient();
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: topics, isLoading } = useQuery({
    queryKey: ['admin-topics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Topic[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (topicId: string) => {
      // 獲取當前用戶 ID
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('topics')
        .update({
          approval_status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id || null,
          status: 'active', // 確保主題狀態為 active
        })
        .eq('id', topicId);

      if (error) {
        console.error('Approve error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-topics'] });
      queryClient.invalidateQueries({ queryKey: ['topics'] }); // 刷新前端主題列表
      toast.success('主題已批准');
    },
    onError: (error: any) => {
      console.error('Approve mutation error:', error);
      toast.error('批准失敗：' + (error.message || '未知錯誤'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ topicId, reason }: { topicId: string; reason: string }) => {
      // 獲取當前用戶 ID
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('topics')
        .update({
          approval_status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id || null,
          rejection_reason: reason,
        })
        .eq('id', topicId);

      if (error) {
        console.error('Reject error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-topics'] });
      toast.success('主題已拒絕');
      setShowRejectDialog(false);
      setRejectionReason("");
      setSelectedTopic(null);
    },
    onError: () => {
      toast.error('拒絕失敗');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (topicId: string) => {
      const { error } = await supabase
        .from('topics')
        .delete()
        .eq('id', topicId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-topics'] });
      toast.success('主題已刪除，代幣已退還');
      setShowDeleteDialog(false);
      setSelectedTopic(null);
    },
    onError: () => {
      toast.error('刪除失敗');
    },
  });

  const handleApprove = (topic: Topic) => {
    approveMutation.mutate(topic.id);
  };

  const handleReject = (topic: Topic) => {
    setSelectedTopic(topic);
    setShowRejectDialog(true);
  };

  const handleDelete = (topic: Topic) => {
    setSelectedTopic(topic);
    setShowDeleteDialog(true);
  };

  const confirmReject = () => {
    if (selectedTopic) {
      rejectMutation.mutate({
        topicId: selectedTopic.id,
        reason: rejectionReason,
      });
    }
  };

  const confirmDelete = () => {
    if (selectedTopic) {
      deleteMutation.mutate(selectedTopic.id);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: "secondary", label: "待審核" },
      approved: { variant: "default", label: "已批准" },
      rejected: { variant: "destructive", label: "已拒絕" },
    };

    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">主題審核</h2>
      <p className="text-muted-foreground mb-6">
        審核用戶提交的主題，批准後將顯示在前端
      </p>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>標題</TableHead>
              <TableHead>主題詳述</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>曝光度</TableHead>
              <TableHead>天數</TableHead>
              <TableHead>建立時間</TableHead>
              <TableHead className="w-[200px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics?.map((topic) => (
              <TableRow key={topic.id}>
                <TableCell className="font-medium max-w-xs truncate">
                  {topic.title}
                </TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                  {topic.description || '-'}
                </TableCell>
                <TableCell>{getStatusBadge(topic.approval_status)}</TableCell>
                <TableCell>{topic.exposure_level}</TableCell>
                <TableCell>{topic.duration_days}天</TableCell>
                <TableCell>
                  {format(new Date(topic.created_at), 'yyyy/MM/dd HH:mm')}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {topic.approval_status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleApprove(topic)}
                          disabled={approveMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {approveMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 mr-1" />
                          )}
                          批准
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(topic)}
                          disabled={rejectMutation.isPending}
                        >
                          {rejectMutation.isPending ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <X className="w-4 h-4 mr-1" />
                          )}
                          拒絕
                        </Button>
                      </>
                    )}
                    {topic.approval_status === 'approved' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApprove(topic)}
                        disabled={approveMutation.isPending}
                        className="text-green-600"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        已批准
                      </Button>
                    )}
                    {topic.approval_status === 'rejected' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // 允許重新批准被拒絕的主題
                          handleApprove(topic);
                        }}
                        disabled={approveMutation.isPending}
                        className="text-orange-600"
                      >
                        {approveMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 mr-1" />
                        )}
                        重新批准
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(topic)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>拒絕主題</AlertDialogTitle>
            <AlertDialogDescription>
              請輸入拒絕原因，這將通知主題發起者
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="拒絕原因..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={4}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReject}>
              確認拒絕
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除主題</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除此主題嗎？發起者將獲得代幣退還。此操作無法撤銷。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground"
            >
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
