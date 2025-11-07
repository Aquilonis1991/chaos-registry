import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Shield, 
  Ban, 
  AlertTriangle, 
  Filter, 
  Eye,
  UserX,
  Network,
  FileText,
  Trash2,
  CheckCircle,
  XCircle
} from "lucide-react";
import { format } from "date-fns";

interface UserBlock {
  id: string;
  user_id: string;
  block_type: 'temporary' | 'permanent' | 'warning';
  reason: string;
  reason_detail?: string;
  blocked_at: string;
  blocked_until?: string;
  is_active: boolean;
  profiles?: {
    nickname: string;
    email: string;
  };
}

interface IPBlock {
  id: string;
  ip_address: string;
  block_type: 'temporary' | 'permanent' | 'suspicious';
  reason: string;
  violation_count: number;
  last_violation_at: string;
  is_active: boolean;
}

interface SensitiveWord {
  id: string;
  word: string;
  category: string;
  action: string;
  severity: number;
  is_active: boolean;
}

export const SecurityManager = () => {
  const [userBlocks, setUserBlocks] = useState<UserBlock[]>([]);
  const [ipBlocks, setIPBlocks] = useState<IPBlock[]>([]);
  const [sensitiveWords, setSensitiveWords] = useState<SensitiveWord[]>([]);
  const [loading, setLoading] = useState(true);

  // 載入資料
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUserBlocks(),
        loadIPBlocks(),
        loadSensitiveWords()
      ]);
    } catch (error) {
      console.error('Error loading security data:', error);
      toast.error('載入資料失敗');
    } finally {
      setLoading(false);
    }
  };

  const loadUserBlocks = async () => {
    const { data, error } = await supabase
      .from('user_blocks')
      .select(`
        *,
        profiles:user_id (
          nickname,
          email
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error loading user blocks:', error);
    } else {
      setUserBlocks(data || []);
    }
  };

  const loadIPBlocks = async () => {
    const { data, error } = await supabase
      .from('ip_blacklist')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error loading IP blocks:', error);
    } else {
      setIPBlocks(data || []);
    }
  };

  const loadSensitiveWords = async () => {
    const { data, error } = await supabase
      .from('sensitive_words')
      .select('*')
      .order('severity', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error loading sensitive words:', error);
    } else {
      setSensitiveWords(data || []);
    }
  };

  // 封鎖用戶
  const blockUser = async (userId: string, blockType: string, reason: string, detail: string) => {
    const { error } = await supabase
      .from('user_blocks')
      .insert({
        user_id: userId,
        block_type: blockType,
        reason: reason,
        reason_detail: detail,
        blocked_by: (await supabase.auth.getUser()).data.user?.id
      });

    if (error) {
      toast.error('封鎖用戶失敗');
      console.error(error);
    } else {
      toast.success('用戶已封鎖');
      loadUserBlocks();
    }
  };

  // 解除封鎖
  const unblockUser = async (blockId: string) => {
    const { error } = await supabase
      .from('user_blocks')
      .update({
        is_active: false,
        unblocked_at: new Date().toISOString(),
        unblocked_by: (await supabase.auth.getUser()).data.user?.id
      })
      .eq('id', blockId);

    if (error) {
      toast.error('解除封鎖失敗');
    } else {
      toast.success('已解除封鎖');
      loadUserBlocks();
    }
  };

  // 封鎖 IP
  const blockIP = async (ip: string, blockType: string, reason: string) => {
    const { error } = await supabase
      .from('ip_blacklist')
      .insert({
        ip_address: ip,
        block_type: blockType,
        reason: reason,
        blocked_by: (await supabase.auth.getUser()).data.user?.id
      });

    if (error) {
      toast.error('封鎖 IP 失敗');
      console.error(error);
    } else {
      toast.success('IP 已封鎖');
      loadIPBlocks();
    }
  };

  // 移除 IP 封鎖
  const unblockIP = async (blockId: string) => {
    const { error } = await supabase
      .from('ip_blacklist')
      .update({ is_active: false })
      .eq('id', blockId);

    if (error) {
      toast.error('解除 IP 封鎖失敗');
    } else {
      toast.success('已解除 IP 封鎖');
      loadIPBlocks();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="w-6 h-6 text-red-500" />
        <h2 className="text-2xl font-bold">安全管理中心</h2>
      </div>

      <Tabs defaultValue="user-blocks" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="user-blocks">
            <UserX className="w-4 h-4 mr-2" />
            用戶封鎖
          </TabsTrigger>
          <TabsTrigger value="ip-blocks">
            <Network className="w-4 h-4 mr-2" />
            IP 黑名單
          </TabsTrigger>
          <TabsTrigger value="sensitive-words">
            <Filter className="w-4 h-4 mr-2" />
            敏感詞過濾
          </TabsTrigger>
          <TabsTrigger value="audit-logs">
            <FileText className="w-4 h-4 mr-2" />
            審計日誌
          </TabsTrigger>
        </TabsList>

        {/* 用戶封鎖 */}
        <TabsContent value="user-blocks">
          <Card>
            <CardHeader>
              <CardTitle>用戶封鎖管理</CardTitle>
              <CardDescription>管理被封鎖的用戶帳號</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>用戶</TableHead>
                        <TableHead>類型</TableHead>
                        <TableHead>原因</TableHead>
                        <TableHead>封鎖時間</TableHead>
                        <TableHead>狀態</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userBlocks.map((block) => (
                        <TableRow key={block.id}>
                          <TableCell>
                            <div className="font-medium">{block.profiles?.nickname || '未知用戶'}</div>
                            <div className="text-sm text-muted-foreground">{block.profiles?.email}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={block.block_type === 'permanent' ? 'destructive' : 'secondary'}>
                              {block.block_type === 'permanent' ? '永久' : 
                               block.block_type === 'temporary' ? '臨時' : '警告'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>{block.reason}</div>
                            {block.reason_detail && (
                              <div className="text-sm text-muted-foreground">{block.reason_detail}</div>
                            )}
                          </TableCell>
                          <TableCell>{format(new Date(block.blocked_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                          <TableCell>
                            {block.is_active ? (
                              <Badge variant="destructive">
                                <XCircle className="w-3 h-3 mr-1" />
                                已封鎖
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                已解除
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {block.is_active && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => unblockUser(block.id)}
                              >
                                解除封鎖
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* IP 黑名單 */}
        <TabsContent value="ip-blocks">
          <Card>
            <CardHeader>
              <CardTitle>IP 黑名單管理</CardTitle>
              <CardDescription>管理被封鎖的 IP 地址</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP 地址</TableHead>
                      <TableHead>類型</TableHead>
                      <TableHead>原因</TableHead>
                      <TableHead>違規次數</TableHead>
                      <TableHead>最後違規</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ipBlocks.map((block) => (
                      <TableRow key={block.id}>
                        <TableCell className="font-mono">{block.ip_address}</TableCell>
                        <TableCell>
                          <Badge variant={
                            block.block_type === 'permanent' ? 'destructive' : 
                            block.block_type === 'suspicious' ? 'secondary' : 'outline'
                          }>
                            {block.block_type === 'permanent' ? '永久' : 
                             block.block_type === 'temporary' ? '臨時' : '可疑'}
                          </Badge>
                        </TableCell>
                        <TableCell>{block.reason}</TableCell>
                        <TableCell>
                          <Badge variant={block.violation_count >= 5 ? 'destructive' : 'outline'}>
                            {block.violation_count} 次
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(block.last_violation_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                        <TableCell>
                          {block.is_active ? (
                            <Badge variant="destructive">已封鎖</Badge>
                          ) : (
                            <Badge variant="outline">已解除</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {block.is_active && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => unblockIP(block.id)}
                            >
                              解除
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 敏感詞過濾 */}
        <TabsContent value="sensitive-words">
          <Card>
            <CardHeader>
              <CardTitle>敏感詞管理</CardTitle>
              <CardDescription>管理內容過濾規則</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>詞彙</TableHead>
                      <TableHead>類別</TableHead>
                      <TableHead>動作</TableHead>
                      <TableHead>嚴重度</TableHead>
                      <TableHead>狀態</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sensitiveWords.map((word) => (
                      <TableRow key={word.id}>
                        <TableCell className="font-medium">{word.word}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{word.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            word.action === 'block' ? 'destructive' : 
                            word.action === 'review' ? 'secondary' : 'outline'
                          }>
                            {word.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {Array.from({ length: word.severity }).map((_, i) => (
                              <AlertTriangle key={i} className="w-3 h-3 text-red-500" />
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {word.is_active ? (
                            <Badge variant="default">啟用</Badge>
                          ) : (
                            <Badge variant="outline">停用</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 審計日誌（佔位符）*/}
        <TabsContent value="audit-logs">
          <Card>
            <CardHeader>
              <CardTitle>審計日誌</CardTitle>
              <CardDescription>查看系統操作記錄</CardDescription>
            </CardHeader>
            <CardContent>
              <AuditLogsViewer />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// 審計日誌查看器組件
const AuditLogsViewer = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error loading audit logs:', error);
      toast.error('載入審計日誌失敗');
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  };

  if (loading) {
    return <div>載入中...</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>時間</TableHead>
            <TableHead>操作</TableHead>
            <TableHead>用戶</TableHead>
            <TableHead>IP 地址</TableHead>
            <TableHead>詳情</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}</TableCell>
              <TableCell>
                <Badge>{log.action}</Badge>
              </TableCell>
              <TableCell>{log.user_id ? log.user_id.slice(0, 8) + '...' : '系統'}</TableCell>
              <TableCell className="font-mono text-sm">{log.ip_address || '-'}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {log.details ? JSON.stringify(log.details).slice(0, 50) + '...' : '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default SecurityManager;


