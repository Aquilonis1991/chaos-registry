import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportedTopicsManager } from "./ReportedTopicsManager";
import { 
  Flag, 
  Eye, 
  Check, 
  X, 
  Clock,
  AlertCircle,
  Loader2,
  Ban,
  Heart,
  Zap,
  Scale,
  Mail,
  Link as LinkIcon,
  ShieldAlert,
  Info,
  FileText,
  User,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ReportManagerProps {
  onJumpToTopic?: (topicId: string) => void;
}

interface Report {
  id: string;
  reporter_id?: string;
  reporter_email?: string;
  target_type: string;
  target_id: string;
  target_title?: string;
  report_type: string;
  reason: string;
  details?: string;
  status: string;
  reviewed_by?: string;
  reviewed_at?: string;
  admin_notes?: string;
  resolution?: string;
  created_at: string;
  updated_at: string;
}

interface ReportStats {
  total_reports: number;
  pending_reports: number;
  reviewing_reports: number;
  resolved_reports: number;
  rejected_reports: number;
}

const reportTypeIcons: Record<string, any> = {
  hate_speech: Ban,
  sexual_content: Heart,
  violence: Zap,
  illegal: Scale,
  spam: Mail,
  phishing: LinkIcon,
  misinformation: AlertCircle,
  harassment: ShieldAlert,
  other: Info
};

const reportTypeLabels: Record<string, string> = {
  hate_speech: '仇恨言論',
  sexual_content: '色情內容',
  violence: '暴力內容',
  illegal: '違法內容',
  spam: '垃圾訊息',
  phishing: '釣魚詐騙',
  misinformation: '虛假訊息',
  harassment: '騷擾',
  other: '其他'
};

const statusLabels: Record<string, string> = {
  pending: '待處理',
  reviewing: '審核中',
  resolved: '已處理',
  rejected: '已駁回',
  closed: '已關閉'
};

const targetTypeLabels: Record<string, string> = {
  topic: '主題',
  user: '用戶',
  comment: '留言'
};

const noop = () => {};

const ReportManager = ({ onJumpToTopic = noop }: ReportManagerProps) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<ReportStats>({
    total_reports: 0,
    pending_reports: 0,
    reviewing_reports: 0,
    resolved_reports: 0,
    rejected_reports: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState<string>("all");
  const [isUpdating, setIsUpdating] = useState(false);

  // Form state
  const [newStatus, setNewStatus] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [resolution, setResolution] = useState("");

  useEffect(() => {
    fetchReports();
    fetchStats();
  }, [currentTab]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      
      const statusFilter = currentTab === 'all' ? null : currentTab;
      
      const { data, error } = await supabase.rpc('get_reports_with_details', {
        p_status: statusFilter,
        p_limit: 100,
        p_offset: 0
      });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('獲取檢舉列表失敗');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_report_stats');
      
      if (error) throw error;
      if (data && data.length > 0) {
        setStats(data[0]);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleViewReport = (report: Report) => {
    setSelectedReport(report);
    setNewStatus(report.status);
    setAdminNotes(report.admin_notes || "");
    setResolution(report.resolution || "");
    setIsDialogOpen(true);
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedReport) return;

    setIsUpdating(true);

    try {
      const { error } = await supabase.rpc('update_report_status', {
        p_report_id: selectedReport.id,
        p_status: newStatus,
        p_admin_notes: adminNotes.trim() || null,
        p_resolution: resolution.trim() || null
      });

      if (error) throw error;

      toast.success('檢舉狀態已更新');
      
      await fetchReports();
      await fetchStats();
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error('Error updating report:', error);
      toast.error('更新檢舉狀態失敗');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleQuickAction = async (reportId: string, status: string) => {
    try {
      const { error } = await supabase.rpc('update_report_status', {
        p_report_id: reportId,
        p_status: status,
        p_admin_notes: null,
        p_resolution: null
      });

      if (error) throw error;

      toast.success(`檢舉已標記為${statusLabels[status]}`);
      
      await fetchReports();
      await fetchStats();
    } catch (error) {
      console.error('Error updating report:', error);
      toast.error('更新檢舉失敗');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="w-3 h-3" />待處理</Badge>;
      case 'reviewing':
        return <Badge variant="default" className="flex items-center gap-1"><Eye className="w-3 h-3" />審核中</Badge>;
      case 'resolved':
        return <Badge variant="outline" className="flex items-center gap-1 bg-green-500/10 text-green-600 border-green-500/30"><Check className="w-3 h-3" />已處理</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="flex items-center gap-1 bg-red-500/10 text-red-600 border-red-500/30"><X className="w-3 h-3" />已駁回</Badge>;
      case 'closed':
        return <Badge variant="outline">已關閉</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getReportTypeIcon = (type: string) => {
    const Icon = reportTypeIcons[type] || Info;
    return <Icon className="w-4 h-4" />;
  };

  const getTargetIcon = (type: string) => {
    switch (type) {
      case 'topic':
        return <FileText className="w-4 h-4" />;
      case 'user':
        return <User className="w-4 h-4" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
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
      <Tabs defaultValue="reports" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="reports">檢舉記錄</TabsTrigger>
          <TabsTrigger value="reported-topics">被檢舉主題</TabsTrigger>
        </TabsList>

        <TabsContent value="reports">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">檢舉管理</h2>
                <p className="text-muted-foreground">審核和處理用戶檢舉</p>
              </div>
            </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">總檢舉數</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_reports}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">待處理</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pending_reports}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">審核中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.reviewing_reports}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">已處理</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resolved_reports}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">已駁回</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected_reports}</div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Table */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="w-full grid grid-cols-5 rounded-none border-b">
              <TabsTrigger value="all">全部</TabsTrigger>
              <TabsTrigger value="pending">待處理</TabsTrigger>
              <TabsTrigger value="reviewing">審核中</TabsTrigger>
              <TabsTrigger value="resolved">已處理</TabsTrigger>
              <TabsTrigger value="rejected">已駁回</TabsTrigger>
            </TabsList>

            <TabsContent value={currentTab} className="m-0">
              {reports.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  暫無檢舉記錄
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>檢舉對象</TableHead>
                      <TableHead>類型</TableHead>
                      <TableHead>原因</TableHead>
                      <TableHead>檢舉人</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>時間</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTargetIcon(report.target_type)}
                            <div>
                              <div className="font-medium">
                                {targetTypeLabels[report.target_type]}
                              </div>
                              {report.target_title && (
                                <div className="text-sm text-muted-foreground line-clamp-1">
                                  {report.target_title}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getReportTypeIcon(report.report_type)}
                            <span className="text-sm">
                              {reportTypeLabels[report.report_type]}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            <p className="text-sm line-clamp-2">{report.reason}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {report.reporter_email || '匿名'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(report.status)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(report.created_at), 'MM/dd HH:mm', { locale: zhTW })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {report.target_type === 'topic' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onJumpToTopic(report.target_id)}
                              >
                                前往主題管理
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewReport(report)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {report.status === 'pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleQuickAction(report.id, 'reviewing')}
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <Clock className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleQuickAction(report.id, 'resolved')}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleQuickAction(report.id, 'rejected')}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
          </div>
        </TabsContent>

        <TabsContent value="reported-topics">
          <ReportedTopicsManager />
        </TabsContent>
      </Tabs>

      {/* Report Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-destructive" />
              檢舉詳情
            </DialogTitle>
          </DialogHeader>

          {selectedReport && (
            <form onSubmit={handleUpdateStatus} className="space-y-4">
              {/* Report Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">檢舉對象</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {getTargetIcon(selectedReport.target_type)}
                    <span className="font-medium">
                      {targetTypeLabels[selectedReport.target_type]}
                    </span>
                  </div>
                  {selectedReport.target_title && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {selectedReport.target_title}
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">檢舉類型</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {getReportTypeIcon(selectedReport.report_type)}
                    <span className="font-medium">
                      {reportTypeLabels[selectedReport.report_type]}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">檢舉人</Label>
                  <div className="mt-1 font-medium">
                    {selectedReport.reporter_email || '匿名用戶'}
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">檢舉時間</Label>
                  <div className="mt-1">
                    {format(new Date(selectedReport.created_at), 'yyyy年MM月dd日 HH:mm', { locale: zhTW })}
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div>
                <Label className="text-sm text-muted-foreground">檢舉原因</Label>
                <div className="mt-1 p-3 bg-muted rounded-lg">
                  {selectedReport.reason}
                </div>
              </div>

              {/* Details */}
              {selectedReport.details && (
                <div>
                  <Label className="text-sm text-muted-foreground">詳細說明</Label>
                  <div className="mt-1 p-3 bg-muted rounded-lg whitespace-pre-wrap">
                    {selectedReport.details}
                  </div>
                </div>
              )}

              {/* Status Update */}
              <div className="space-y-2">
                <Label htmlFor="status">處理狀態</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">待處理</SelectItem>
                    <SelectItem value="reviewing">審核中</SelectItem>
                    <SelectItem value="resolved">已處理</SelectItem>
                    <SelectItem value="rejected">已駁回</SelectItem>
                    <SelectItem value="closed">已關閉</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Admin Notes */}
              <div className="space-y-2">
                <Label htmlFor="adminNotes">管理員備註</Label>
                <Textarea
                  id="adminNotes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="內部備註（用戶不可見）"
                  className="min-h-[80px]"
                />
              </div>

              {/* Resolution */}
              <div className="space-y-2">
                <Label htmlFor="resolution">處理結果</Label>
                <Textarea
                  id="resolution"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="處理結果說明"
                  className="min-h-[80px]"
                />
              </div>

              {/* Previous Review Info */}
              {selectedReport.reviewed_at && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">
                    上次審核時間：{format(new Date(selectedReport.reviewed_at), 'yyyy年MM月dd日 HH:mm', { locale: zhTW })}
                  </div>
                  {selectedReport.admin_notes && (
                    <div className="text-sm mt-2">
                      備註：{selectedReport.admin_notes}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isUpdating}
                >
                  取消
                </Button>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      更新中...
                    </>
                  ) : (
                    '更新狀態'
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportManager;
