import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Trash2, AlertTriangle } from "lucide-react";
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
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

interface Topic {
  id: string;
  title: string;
  description?: string;
  creator_id: string;
  is_hidden: boolean;
  auto_hidden: boolean;
  report_count: number;
  exposure_level: string;
  duration_days: number;
  created_at: string;
  options: any;
  tags: string[];
  status: string;
}

export const TopicManager = () => {
  const queryClient = useQueryClient();
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [showHideDialog, setShowHideDialog] = useState(false);
  const [showUnhideDialog, setShowUnhideDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [hideReason, setHideReason] = useState("");

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

  const hideMutation = useMutation({
    mutationFn: async ({ topicId, reason }: { topicId: string; reason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('topics')
        .update({
          is_hidden: true,
          hidden_at: new Date().toISOString(),
          hidden_by: user?.id || null,
          hidden_reason: reason || '管理員隱藏'
        })
        .eq('id', topicId);

      if (error) {
        console.error('Hide error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-topics'] });
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      toast.success('主題已隱藏');
      setShowHideDialog(false);
      setHideReason("");
      setSelectedTopic(null);
    },
    onError: (error: any) => {
      console.error('Hide mutation error:', error);
      toast.error('隱藏失敗：' + (error.message || '未知錯誤'));
    },
  });

  const unhideMutation = useMutation({
    mutationFn: async (topicId: string) => {
      const { error } = await supabase
        .from('topics')
        .update({
          is_hidden: false,
          hidden_at: null,
          hidden_by: null,
          hidden_reason: null,
          auto_hidden: false  // 解除自動隱藏標記
        })
        .eq('id', topicId);

      if (error) {
        console.error('Unhide error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-topics'] });
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      toast.success('主題已解除隱藏');
      setShowUnhideDialog(false);
      setSelectedTopic(null);
    },
    onError: (error: any) => {
      console.error('Unhide mutation error:', error);
      toast.error('解除隱藏失敗：' + (error.message || '未知錯誤'));
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
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      toast.success('主題已刪除');
      setShowDeleteDialog(false);
      setSelectedTopic(null);
    },
    onError: (error: any) => {
      console.error('Delete error:', error);
      toast.error('刪除失敗：' + (error.message || '未知錯誤'));
    },
  });

  const handleHide = (topic: Topic) => {
    setSelectedTopic(topic);
    setShowHideDialog(true);
  };

  const handleUnhide = (topic: Topic) => {
    setSelectedTopic(topic);
    setShowUnhideDialog(true);
  };

  const handleDelete = (topic: Topic) => {
    setSelectedTopic(topic);
    setShowDeleteDialog(true);
  };

  const confirmHide = () => {
    if (selectedTopic) {
      hideMutation.mutate({
        topicId: selectedTopic.id,
        reason: hideReason || undefined
      });
    }
  };

  const confirmUnhide = () => {
    if (selectedTopic) {
      unhideMutation.mutate(selectedTopic.id);
    }
  };

  const confirmDelete = () => {
    if (selectedTopic) {
      deleteMutation.mutate(selectedTopic.id);
    }
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
      <h2 className="text-2xl font-semibold mb-4">主題管理</h2>
      <p className="text-muted-foreground mb-6">
        管理所有主題，可以隱藏、解除隱藏或刪除主題
      </p>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>標題</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>檢舉數</TableHead>
              <TableHead>曝光度</TableHead>
              <TableHead>天數</TableHead>
              <TableHead>建立時間</TableHead>
              <TableHead className="w-[250px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics?.map((topic) => (
              <TableRow key={topic.id}>
                <TableCell className="font-medium max-w-xs truncate">
                  {topic.title}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {topic.is_hidden ? (
                      <Badge variant="destructive">已隱藏</Badge>
                    ) : (
                      <Badge variant="default">顯示中</Badge>
                    )}
                    {topic.auto_hidden && (
                      <Badge variant="outline" className="text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        自動隱藏
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {topic.report_count > 0 ? (
                    <Badge variant="secondary">{topic.report_count}</Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell>{topic.exposure_level}</TableCell>
                <TableCell>{topic.duration_days}天</TableCell>
                <TableCell>
                  {format(new Date(topic.created_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {topic.is_hidden ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnhide(topic)}
                        disabled={unhideMutation.isPending}
                      >
                        {unhideMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Eye className="w-4 h-4 mr-1" />
                        )}
                        解除隱藏
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleHide(topic)}
                        disabled={hideMutation.isPending}
                      >
                        {hideMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <EyeOff className="w-4 h-4 mr-1" />
                        )}
                        隱藏
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(topic)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 隱藏對話框 */}
      <AlertDialog open={showHideDialog} onOpenChange={setShowHideDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>隱藏主題</AlertDialogTitle>
            <AlertDialogDescription>
              隱藏後，此主題將不會在前台顯示。請輸入隱藏原因（選填）
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <textarea
              placeholder="隱藏原因..."
              value={hideReason}
              onChange={(e) => setHideReason(e.target.value)}
              className="w-full min-h-[100px] p-2 border rounded-md"
              rows={4}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmHide}>
              確認隱藏
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 解除隱藏對話框 */}
      <AlertDialog open={showUnhideDialog} onOpenChange={setShowUnhideDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>解除隱藏主題</AlertDialogTitle>
            <AlertDialogDescription>
              確定要解除隱藏此主題嗎？解除後主題將重新在前台顯示。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnhide}>
              確認解除隱藏
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 刪除對話框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除主題</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除此主題嗎？此操作無法撤銷。
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

