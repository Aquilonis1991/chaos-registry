import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Trash2, AlertTriangle, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface TopicManagerProps {
  focusTopicId?: string | null;
  onFocusHandled?: () => void;
}

export const TopicManager = ({ focusTopicId, onFocusHandled = () => {} }: TopicManagerProps) => {
  const queryClient = useQueryClient();
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [showHideDialog, setShowHideDialog] = useState(false);
  const [showUnhideDialog, setShowUnhideDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [hideReason, setHideReason] = useState("");
  const [highlightedTopicId, setHighlightedTopicId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    exposure_level: "",
    duration_days: 0,
    tags: ""
  });
  const [isEditing, setIsEditing] = useState(false);

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

  useEffect(() => {
    if (!focusTopicId || !topics || topics.length === 0) {
      return;
    }

    const row = document.getElementById(`topic-row-${focusTopicId}`);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedTopicId(focusTopicId);
      const timer = window.setTimeout(() => setHighlightedTopicId(null), 3000);
      onFocusHandled();
      return () => window.clearTimeout(timer);
    }

    onFocusHandled();
  }, [focusTopicId, topics, onFocusHandled]);

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

  const handleEdit = (topic: Topic) => {
    setSelectedTopic(topic);
    setEditForm({
      title: topic.title ?? "",
      description: topic.description ?? "",
      exposure_level: topic.exposure_level ?? "",
      duration_days: topic.duration_days ?? 0,
      tags: topic.tags?.join(", ") ?? ""
    });
    setShowEditDialog(true);
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

  const confirmEdit = async () => {
    if (!selectedTopic) return;

    try {
      setIsEditing(true);
      const tagsArray = editForm.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const { error } = await supabase.rpc("admin_update_topic", {
        p_topic_id: selectedTopic.id,
        p_title: editForm.title,
        p_description: editForm.description,
        p_exposure_level: editForm.exposure_level,
        p_duration_days: editForm.duration_days,
        p_tags: tagsArray
      });

      if (error) {
        console.error("Edit error:", error);
        toast.error("更新主題失敗：" + (error.message || "未知錯誤"));
        return;
      }

      toast.success("主題已更新");
      setShowEditDialog(false);
      setSelectedTopic(null);
      queryClient.invalidateQueries({ queryKey: ["admin-topics"] });
      queryClient.invalidateQueries({ queryKey: ["topics"] });
    } catch (error: any) {
      console.error("Edit exception:", error);
      toast.error("更新主題失敗：" + (error.message || "未知錯誤"));
    } finally {
      setIsEditing(false);
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
              <TableHead>結束時間</TableHead>
              <TableHead className="w-[250px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics?.map((topic) => (
              <TableRow
                key={topic.id}
                id={`topic-row-${topic.id}`}
                className={highlightedTopicId === topic.id ? 'bg-primary/10 ring-2 ring-primary/40' : undefined}
              >
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
                    {topic.end_at && new Date(topic.end_at) < new Date() && (
                      <Badge variant="secondary">已過期</Badge>
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
                  {topic.end_at
                    ? format(new Date(topic.end_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })
                    : '—'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(topic)}
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      編輯
                    </Button>
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

      {/* 編輯對話框 */}
      <AlertDialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>編輯主題內容</AlertDialogTitle>
            <AlertDialogDescription>
              調整主題設定後，系統會紀錄本次調整內容以供查詢。
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-title">主題標題</Label>
              <input
                id="edit-title"
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full border rounded-md px-3 py-2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">主題描述</Label>
              <textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 min-h-[120px]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-exposure">曝光方案</Label>
                <Select
                  value={editForm.exposure_level || 'normal'}
                  onValueChange={(value) =>
                    setEditForm((prev) => ({
                      ...prev,
                      exposure_level: value,
                    }))
                  }
                >
                  <SelectTrigger id="edit-exposure" className="w-full">
                    <SelectValue placeholder="選擇曝光方案" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">普通</SelectItem>
                    <SelectItem value="medium">中等</SelectItem>
                    <SelectItem value="high">高等</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-duration">投票天數</Label>
                <input
                  id="edit-duration"
                  type="number"
                  min={1}
                  value={editForm.duration_days}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      duration_days: Number.parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className="w-full border rounded-md px-3 py-2"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tags">標籤（以逗號分隔）</Label>
              <input
                id="edit-tags"
                type="text"
                value={editForm.tags}
                onChange={(e) => setEditForm((prev) => ({ ...prev, tags: e.target.value }))}
                className="w-full border rounded-md px-3 py-2"
                placeholder="例如：政治, 新聞, 社會"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isEditing}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEdit} disabled={isEditing}>
              {isEditing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  儲存中...
                </>
              ) : (
                '儲存變更'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

