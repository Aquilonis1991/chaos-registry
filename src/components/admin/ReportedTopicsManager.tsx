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

interface ReportedTopic {
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
  status: string;
}

export const ReportedTopicsManager = () => {
  const queryClient = useQueryClient();
  const [selectedTopic, setSelectedTopic] = useState<ReportedTopic | null>(null);
  const [showHideDialog, setShowHideDialog] = useState(false);
  const [showUnhideDialog, setShowUnhideDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [hideReason, setHideReason] = useState("");

  // 只查詢被檢舉的主題（report_count > 0 或 auto_hidden = true）
  const { data: topics, isLoading } = useQuery({
    queryKey: ['admin-reported-topics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('topics')
        .select('*')
        .or('report_count.gt.0,auto_hidden.eq.true')
        .order('report_count', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ReportedTopic[];
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

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reported-topics'] });
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      toast.success('主題已隱藏');
      setShowHideDialog(false);
      setHideReason("");
      setSelectedTopic(null);
    },
    onError: (error: any) => {
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
          auto_hidden: false
        })
        .eq('id', topicId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reported-topics'] });
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      toast.success('主題已解除隱藏');
      setShowUnhideDialog(false);
      setSelectedTopic(null);
    },
    onError: (error: any) => {
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
      queryClient.invalidateQueries({ queryKey: ['admin-reported-topics'] });
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      toast.success('主題已刪除');
      setShowDeleteDialog(false);
      setSelectedTopic(null);
    },
    onError: (error: any) => {
      toast.error('刪除失敗：' + (error.message || '未知錯誤'));
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">被檢舉主題管理</h2>
      <p className="text-muted-foreground mb-6">
        管理被用戶檢舉的主題，達到 10 次檢舉會自動隱藏
      </p>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>標題</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>檢舉數</TableHead>
              <TableHead>建立時間</TableHead>
              <TableHead className="w-[250px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  暫無被檢舉的主題
                </TableCell>
              </TableRow>
            ) : (
              topics?.map((topic) => (
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
                    <Badge variant="secondary">{topic.report_count}</Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(topic.created_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {topic.is_hidden ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedTopic(topic);
                            setShowUnhideDialog(true);
                          }}
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
                          onClick={() => {
                            setSelectedTopic(topic);
                            setShowHideDialog(true);
                          }}
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
                        onClick={() => {
                          setSelectedTopic(topic);
                          setShowDeleteDialog(true);
                        }}
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 隱藏對話框 */}
      <AlertDialog open={showHideDialog} onOpenChange={setShowHideDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>隱藏檢舉主題</AlertDialogTitle>
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
            <AlertDialogAction onClick={() => {
              if (selectedTopic) {
                hideMutation.mutate({
                  topicId: selectedTopic.id,
                  reason: hideReason || undefined
                });
              }
            }}>
              確認隱藏
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 解除隱藏對話框 */}
      <AlertDialog open={showUnhideDialog} onOpenChange={setShowUnhideDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>解除隱藏檢舉主題</AlertDialogTitle>
            <AlertDialogDescription>
              確定要解除隱藏此主題嗎？解除後主題將重新在前台顯示。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (selectedTopic) {
                unhideMutation.mutate(selectedTopic.id);
              }
            }}>
              確認解除隱藏
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 刪除對話框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除檢舉主題</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除此主題嗎？此操作無法撤銷。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedTopic) {
                  deleteMutation.mutate(selectedTopic.id);
                }
              }}
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

