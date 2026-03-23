import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Edit,
  Trash2,
  Calendar,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useSystemConfig } from "@/hooks/useSystemConfig";
import { invalidateConfigCache } from "@/hooks/useSystemConfigCache";
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_STYLE_PRESETS,
  type AnnouncementCategory,
} from "@/lib/announcementStyles";

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
  created_at: string;
  updated_at: string;
  created_by?: string;
  announcement_category?: string;
  style_preset?: number;
  display_date?: string | null;
}

type Props = {
  /** 嵌入系統配置「公告顯示」分頁時縮小標題區 */
  embedded?: boolean;
};

const AnnouncementManager = ({ embedded = false }: Props) => {
  const { configs, updateConfig } = useSystemConfig();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displaySaving, setDisplaySaving] = useState(false);
  const [displayCountInput, setDisplayCountInput] = useState("3");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [priority, setPriority] = useState(50);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [announcementCategory, setAnnouncementCategory] = useState<AnnouncementCategory>("一般");
  const [stylePreset, setStylePreset] = useState(1);
  const [displayDate, setDisplayDate] = useState("");

  const announcementMaxDisplayConfig = configs.find(
    (c) => c.key === "announcement_max_display"
  );

  useEffect(() => {
    if (!announcementMaxDisplayConfig) return;
    const raw = announcementMaxDisplayConfig.value;
    const n =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number(raw)
          : Number.NaN;
    const safe = Number.isFinite(n) ? Math.max(1, Math.min(50, Math.floor(n))) : 3;
    setDisplayCountInput(String(safe));
  }, [announcementMaxDisplayConfig?.id, announcementMaxDisplayConfig?.value]);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      toast.error("獲取公告列表失敗");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setSummary("");
    setImageUrl("");
    setPriority(50);
    const now = new Date();
    const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setStartDate(now.toISOString().slice(0, 16));
    setEndDate(week.toISOString().slice(0, 16));
    setIsActive(true);
    setAnnouncementCategory("一般");
    setStylePreset(1);
    setDisplayDate("");
    setEditingAnnouncement(null);
  };

  const handleEdit = (announcement: Announcement) => {
    setTitle(announcement.title);
    setContent(announcement.content);
    setSummary(announcement.summary || "");
    setImageUrl(announcement.image_url || "");
    setPriority(
      Math.min(100, Math.max(1, Number(announcement.priority) || 50))
    );
    setStartDate(new Date(announcement.start_date).toISOString().slice(0, 16));
    setEndDate(new Date(announcement.end_date).toISOString().slice(0, 16));
    setIsActive(announcement.is_active);
    const cat = announcement.announcement_category as AnnouncementCategory | undefined;
    setAnnouncementCategory(
      cat && ANNOUNCEMENT_CATEGORIES.includes(cat) ? cat : "一般"
    );
    setStylePreset(
      typeof announcement.style_preset === "number" &&
        announcement.style_preset >= 1 &&
        announcement.style_preset <= 8
        ? announcement.style_preset
        : 1
    );
    setDisplayDate(
      announcement.display_date
        ? String(announcement.display_date).slice(0, 10)
        : ""
    );
    setEditingAnnouncement(announcement);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      toast.error("請填寫標題和內容");
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      toast.error("結束時間必須晚於開始時間");
      return;
    }

    const p = Math.min(100, Math.max(1, Math.floor(Number(priority)) || 50));
    if (p !== Number(priority)) {
      setPriority(p);
    }

    setIsSubmitting(true);

    try {
      const announcementData = {
        title: title.trim(),
        content: content.trim(),
        summary: summary.trim() || null,
        image_url: imageUrl.trim() || null,
        priority: p,
        start_date: startDate,
        end_date: endDate,
        is_active: isActive,
        announcement_category: announcementCategory,
        style_preset: stylePreset,
        display_date: displayDate.trim() ? displayDate.trim() : null,
      };

      if (editingAnnouncement) {
        const { error } = await supabase.rpc("admin_update_announcement", {
          p_id: editingAnnouncement.id,
          p_title: announcementData.title,
          p_content: announcementData.content,
          p_summary: announcementData.summary,
          p_image_url: announcementData.image_url,
          p_priority: announcementData.priority,
          p_start_date: announcementData.start_date,
          p_end_date: announcementData.end_date,
          p_is_active: announcementData.is_active,
          p_announcement_category: announcementData.announcement_category,
          p_style_preset: announcementData.style_preset,
          p_display_date: announcementData.display_date,
        });
        if (error) throw error;
        toast.success("公告更新成功");
      } else {
        const { error } = await supabase.from("announcements").insert(announcementData);

        if (error) throw error;
        toast.success("公告創建成功");
      }

      await fetchAnnouncements();
      setIsDialogOpen(false);
      resetForm();
    } catch (error: unknown) {
      console.error("Error saving announcement:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "保存公告失敗";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("確定要刪除這個公告嗎？")) return;

    try {
      const { error } = await supabase.rpc("admin_delete_announcement", { p_id: id });
      if (error) throw error;
      toast.success("公告刪除成功");
      await fetchAnnouncements();
    } catch (error) {
      console.error("Error deleting announcement:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "刪除公告失敗";
      toast.error(message);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.rpc("admin_toggle_announcement_active", {
        p_id: id,
        p_is_active: !currentStatus,
      });
      if (error) throw error;
      toast.success(`公告已${!currentStatus ? "啟用" : "停用"}`);
      await fetchAnnouncements();
    } catch (error) {
      console.error("Error toggling announcement status:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "更新公告狀態失敗";
      toast.error(message);
    }
  };

  const getStatusBadge = (announcement: Announcement) => {
    const now = new Date();
    const start = new Date(announcement.start_date);
    const end = new Date(announcement.end_date);

    if (!announcement.is_active) {
      return <Badge variant="secondary">已停用</Badge>;
    }

    if (now < start) {
      return <Badge variant="outline">未開始</Badge>;
    }

    if (now > end) {
      return <Badge variant="destructive">已過期</Badge>;
    }

    return <Badge variant="default">進行中</Badge>;
  };

  const getWeightLabel = (w: number) => {
    if (w >= 80) return "高";
    if (w >= 50) return "中";
    return "低";
  };

  const saveAnnouncementMaxDisplay = async () => {
    if (!announcementMaxDisplayConfig) {
      toast.error("找不到 announcement_max_display 設定");
      return;
    }
    const n = parseInt(displayCountInput.trim(), 10);
    if (Number.isNaN(n) || n < 1 || n > 50) {
      toast.error("請輸入 1～50 的整數");
      return;
    }
    setDisplaySaving(true);
    try {
      const success = await updateConfig(announcementMaxDisplayConfig.id, n);
      if (!success) {
        toast.error("儲存失敗");
        return;
      }
      invalidateConfigCache();
      toast.success("前台公告顯示則數已更新");
      setDisplayCountInput(String(n));
    } finally {
      setDisplaySaving(false);
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
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold">前台公告顯示則數</p>
              <p className="text-xs text-muted-foreground">
                `announcement_max_display`：公告輪播一次向 get_active_announcements 請求的最多筆數（1～50）。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={displayCountInput}
                onChange={(e) => setDisplayCountInput(e.target.value)}
                type="number"
                min={1}
                max={50}
                step={1}
                className="w-28"
              />
              <Button
                onClick={saveAnnouncementMaxDisplay}
                disabled={displaySaving || !announcementMaxDisplayConfig}
              >
                {displaySaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "儲存"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold">公告管理</h2>
          <p className="text-muted-foreground">管理平台公告內容與前台輪播顯示</p>
          <p className="text-sm text-muted-foreground mt-1">
            分類、背景配色、顯示日期、權重（1～100）、排程（開始／結束時間）；前台僅在排程內顯示。
          </p>
        </div>

      <div className="flex w-full shrink-0 justify-end sm:w-auto">
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                resetForm();
                setIsDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              新增公告
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingAnnouncement ? "編輯公告" : "新增公告"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div className="text-xs text-muted-foreground">{title.length}/100 字元</div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">分類 *</Label>
                  <Select
                    value={announcementCategory}
                    onValueChange={(v) => setAnnouncementCategory(v as AnnouncementCategory)}
                  >
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ANNOUNCEMENT_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>背景配色（前台輪播）*</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ANNOUNCEMENT_STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setStylePreset(preset.id)}
                      className={`rounded-lg border-2 p-2 text-left transition-all ${
                        stylePreset === preset.id
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-transparent hover:border-muted-foreground/30"
                      }`}
                    >
                      <div
                        className={`h-10 w-full rounded-md ${preset.className} mb-1`}
                      />
                      <span className="text-xs font-medium">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayDate">顯示日期（選填）</Label>
                  <Input
                    id="displayDate"
                    type="date"
                    value={displayDate}
                    onChange={(e) => setDisplayDate(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    用於前台卡片顯示；未填則顯示建立時間日期。
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">公告權重（1～100）*</Label>
                  <Input
                    id="priority"
                    type="number"
                    min={1}
                    max={100}
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    數字越高排序越前（目前：{getWeightLabel(priority)}）
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">公告摘要（選填）</Label>
                <Input
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="簡短摘要"
                  maxLength={200}
                />
                <div className="text-xs text-muted-foreground">{summary.length}/200 字元</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">公告內文 *</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="輸入公告詳細內容"
                  className="min-h-[120px]"
                  maxLength={1000}
                  required
                />
                <div className="text-xs text-muted-foreground">{content.length}/1000 字元</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="imageUrl">圖片網址（選填）</Label>
                <Input
                  id="imageUrl"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  type="url"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">開始時間 *（到達後顯示）</Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">結束時間 *（到達後下架）</Label>
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
                <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="isActive">啟用（停用則前台永不顯示）</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  取消
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    "保存"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>標題</TableHead>
                <TableHead>分類</TableHead>
                <TableHead>配色</TableHead>
                <TableHead>權重</TableHead>
                <TableHead>顯示日</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead>排程</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {announcements.map((announcement) => (
                <TableRow key={announcement.id}>
                  <TableCell>
                    <div className="space-y-1 max-w-[200px]">
                      <div className="font-medium line-clamp-2">{announcement.title}</div>
                      {announcement.summary && (
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {announcement.summary}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {announcement.announcement_category || "一般"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-6 w-10 rounded shrink-0 ${
                          ANNOUNCEMENT_STYLE_PRESETS.find(
                            (p) => p.id === (announcement.style_preset ?? 1)
                          )?.className ?? ANNOUNCEMENT_STYLE_PRESETS[0].className
                        }`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {ANNOUNCEMENT_STYLE_PRESETS.find(
                          (p) => p.id === (announcement.style_preset ?? 1)
                        )?.label ?? "—"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {announcement.priority}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {announcement.display_date
                      ? format(new Date(announcement.display_date + "T12:00:00"), "yyyy/MM/dd", {
                          locale: zhTW,
                        })
                      : "—"}
                  </TableCell>
                  <TableCell>{getStatusBadge(announcement)}</TableCell>
                  <TableCell>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 shrink-0" />
                        {format(new Date(announcement.start_date), "MM/dd HH:mm", { locale: zhTW })}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 shrink-0" />
                        {format(new Date(announcement.end_date), "MM/dd HH:mm", { locale: zhTW })}
                      </div>
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
