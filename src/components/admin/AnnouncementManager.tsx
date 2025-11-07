import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Calendar, 
  Star, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

interface Announcement {
  id: string;
  title: string;
  content: string;
  summary?: string;
  image_url?: string;
  priority: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  click_count: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

const AnnouncementManager = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [priority, setPriority] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast.error('獲取公告列表失敗');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setSummary("");
    setImageUrl("");
    setPriority(0);
    setStartDate("");
    setEndDate("");
    setIsActive(true);
    setEditingAnnouncement(null);
  };

  const handleEdit = (announcement: Announcement) => {
    setTitle(announcement.title);
    setContent(announcement.content);
    setSummary(announcement.summary || "");
    setImageUrl(announcement.image_url || "");
    setPriority(announcement.priority);
    setStartDate(new Date(announcement.start_date).toISOString().slice(0, 16));
    setEndDate(new Date(announcement.end_date).toISOString().slice(0, 16));
    setIsActive(announcement.is_active);
    setEditingAnnouncement(announcement);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      toast.error('請填寫標題和內容');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      toast.error('結束時間必須晚於開始時間');
      return;
    }

    setIsSubmitting(true);

    try {
      const announcementData = {
        title: title.trim(),
        content: content.trim(),
        summary: summary.trim() || null,
        image_url: imageUrl.trim() || null,
        priority,
        start_date: startDate,
        end_date: endDate,
        is_active: isActive,
      };

      if (editingAnnouncement) {
        // Update existing announcement
        const { error } = await supabase
          .from('announcements')
          .update(announcementData)
          .eq('id', editingAnnouncement.id);

        if (error) throw error;
        toast.success('公告更新成功');
      } else {
        // Create new announcement
        const { error } = await supabase
          .from('announcements')
          .insert(announcementData);

        if (error) throw error;
        toast.success('公告創建成功');
      }

      await fetchAnnouncements();
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error saving announcement:', error);
      toast.error('保存公告失敗');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這個公告嗎？')) return;

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('公告刪除成功');
      await fetchAnnouncements();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast.error('刪除公告失敗');
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success(`公告已${!currentStatus ? '啟用' : '停用'}`);
      await fetchAnnouncements();
    } catch (error) {
      console.error('Error toggling announcement status:', error);
      toast.error('更新公告狀態失敗');
    }
  };

  const getStatusBadge = (announcement: Announcement) => {
    const now = new Date();
    const startDate = new Date(announcement.start_date);
    const endDate = new Date(announcement.end_date);

    if (!announcement.is_active) {
      return <Badge variant="secondary">已停用</Badge>;
    }

    if (now < startDate) {
      return <Badge variant="outline">未開始</Badge>;
    }

    if (now > endDate) {
      return <Badge variant="destructive">已過期</Badge>;
    }

    return <Badge variant="default">進行中</Badge>;
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 90) {
      return <Badge variant="destructive" className="flex items-center gap-1"><Star className="w-3 h-3" />高優先級</Badge>;
    } else if (priority >= 70) {
      return <Badge variant="default" className="flex items-center gap-1"><Star className="w-3 h-3" />中優先級</Badge>;
    } else {
      return <Badge variant="outline" className="flex items-center gap-1"><Star className="w-3 h-3" />低優先級</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">公告管理</h2>
          <p className="text-muted-foreground">管理平台公告內容和顯示設定</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              新增公告
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAnnouncement ? '編輯公告' : '新增公告'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">公告標題 *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="輸入公告標題"
                    maxLength={100}
                    required
                  />
                  <div className="text-xs text-muted-foreground">
                    {title.length}/100 字元
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">優先級</Label>
                  <Select value={priority.toString()} onValueChange={(value) => setPriority(parseInt(value))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">低 (0)</SelectItem>
                      <SelectItem value="50">中低 (50)</SelectItem>
                      <SelectItem value="70">中 (70)</SelectItem>
                      <SelectItem value="90">高 (90)</SelectItem>
                      <SelectItem value="100">最高 (100)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">公告摘要</Label>
                <Input
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="簡短摘要（選填）"
                  maxLength={200}
                />
                <div className="text-xs text-muted-foreground">
                  {summary.length}/200 字元
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">公告內容 *</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="輸入公告詳細內容"
                  className="min-h-[120px]"
                  maxLength={1000}
                  required
                />
                <div className="text-xs text-muted-foreground">
                  {content.length}/1000 字元
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="imageUrl">圖片網址</Label>
                <Input
                  id="imageUrl"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  type="url"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">開始時間 *</Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">結束時間 *</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="isActive">立即啟用</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    '保存'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>標題</TableHead>
                <TableHead>優先級</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>時間範圍</TableHead>
                <TableHead>點擊數</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {announcements.map((announcement) => (
                <TableRow key={announcement.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{announcement.title}</div>
                      {announcement.summary && (
                        <div className="text-sm text-muted-foreground">
                          {announcement.summary}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getPriorityBadge(announcement.priority)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(announcement)}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(announcement.start_date), 'MM/dd HH:mm', { locale: zhTW })}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(announcement.end_date), 'MM/dd HH:mm', { locale: zhTW })}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {announcement.click_count}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(announcement)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(announcement.id, announcement.is_active)}
                      >
                        {announcement.is_active ? (
                          <XCircle className="w-4 h-4" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(announcement.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnnouncementManager;
