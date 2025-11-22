import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, Ban, Check, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";

interface UserRestriction {
  id: string;
  user_id: string;
  restriction_type: 'create_topic' | 'vote' | 'complete_mission' | 'modify_name' | 'recharge' | 'all';
  is_active: boolean;
  reason?: string;
  restricted_by?: string;
  restricted_at: string;
  expires_at?: string;
  profiles?: {
    nickname: string;
    avatar: string;
  };
}

const restrictionLabels: Record<string, string> = {
  create_topic: '發起主題',
  vote: '投票',
  complete_mission: '完成任務',
  modify_name: '修改名稱',
  recharge: '儲值',
  all: '全部功能'
};

interface User {
  id: string;
  nickname: string;
  email?: string;
  avatar?: string;
}

interface UserRestrictionManagerProps {
  preselectedUserId?: string | null;
  onUserSelected?: () => void;
}

export const UserRestrictionManager = ({ preselectedUserId, onUserSelected }: UserRestrictionManagerProps = {}) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showUserSearchDialog, setShowUserSearchDialog] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 如果有預選的用戶 ID，自動載入用戶信息
  useEffect(() => {
    if (preselectedUserId && !selectedUser) {
      const loadPreselectedUser = async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, nickname, avatar')
            .eq('id', preselectedUserId)
            .single();

          if (error) throw error;

          if (data) {
            setSelectedUser({
              id: data.id,
              nickname: data.nickname,
              avatar: data.avatar
            });
            if (onUserSelected) {
              onUserSelected();
            }
          }
        } catch (error: any) {
          console.error('Load preselected user error:', error);
          toast.error('載入用戶失敗：' + (error.message || '未知錯誤'));
        }
      };
      loadPreselectedUser();
    }
  }, [preselectedUserId, selectedUser, onUserSelected]);
  const [newRestriction, setNewRestriction] = useState({
    restriction_type: 'create_topic' as UserRestriction['restriction_type'],
    reason: '',
    expires_at: ''
  });

  const { data: restrictions, isLoading, refetch } = useQuery({
    queryKey: ['admin-user-restrictions', selectedUser?.id],
    queryFn: async () => {
      try {
        // 查詢所有活躍的限制（不使用嵌套查詢，避免外鍵關係問題）
        let query = supabase
          .from('user_restrictions')
          .select(`
            id,
            user_id,
            restriction_type,
            is_active,
            reason,
            restricted_by,
            restricted_at,
            expires_at
          `)
          .eq('is_active', true);

        // 如果選擇了用戶，則過濾該用戶的限制
        if (selectedUser) {
          query = query.eq('user_id', selectedUser.id);
        }

        const { data: restrictionsData, error } = await query.order('restricted_at', { ascending: false });

        if (error) {
          console.error('Query restrictions error:', error);
          throw error;
        }

        if (!restrictionsData || restrictionsData.length === 0) {
          console.log('Fetched restrictions: 0 items');
          return [];
        }

        // 獲取所有唯一的 user_id
        const userIds = [...new Set(restrictionsData.map(r => r.user_id))];
        
        // 批量查詢用戶資料
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, nickname, avatar')
          .in('id', userIds);

        if (profilesError) {
          console.warn('Failed to fetch profiles:', profilesError);
          // 即使獲取 profiles 失敗，也返回限制數據（不包含用戶信息）
        }

        // 創建用戶資料映射
        const profilesMap = new Map(
          (profilesData || []).map(p => [p.id, { nickname: p.nickname, avatar: p.avatar }])
        );

        // 合併數據
        const restrictionsWithProfiles = restrictionsData.map(restriction => ({
          ...restriction,
          profiles: profilesMap.get(restriction.user_id) || { nickname: '未知用戶', avatar: '👤' }
        })) as UserRestriction[];

        console.log('Fetched restrictions:', restrictionsWithProfiles.length, 'items');
        return restrictionsWithProfiles;
      } catch (error: any) {
        console.error('Failed to fetch restrictions:', error);
        toast.error('載入限制列表失敗：' + (error.message || '未知錯誤'));
        return [];
      }
    },
    enabled: true, // 始終啟用查詢
    staleTime: 5000, // 5秒內不重新獲取
    refetchOnWindowFocus: false // 窗口聚焦時不自動刷新
  });

  const addRestrictionMutation = useMutation({
    mutationFn: async ({ userId, restrictionType, reason, expiresAt }: {
      userId: string;
      restrictionType: UserRestriction['restriction_type'];
      reason?: string;
      expiresAt?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const insertData = {
        user_id: userId,
        restriction_type: restrictionType,
        is_active: true,
        reason: reason || null,
        restricted_by: user?.id || null,
        expires_at: expiresAt || null,
        restricted_at: new Date().toISOString()
      };
      
      console.log('Inserting restriction:', insertData);
      
      const { data, error } = await supabase
        .from('user_restrictions')
        .insert(insertData)
        .select();
      
      if (data) {
        console.log('Inserted restriction:', data);
      }

      if (error) {
        console.error('Insert restriction error:', error);
        // 如果已存在，則更新
        if (error.code === '23505') {
          console.log('Restriction already exists, updating...');
          const { data: updateData, error: updateError } = await supabase
            .from('user_restrictions')
            .update({
              is_active: true,
              reason: reason || null,
              restricted_by: user?.id || null,
              expires_at: expiresAt || null,
              updated_at: new Date().toISOString(),
              restricted_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('restriction_type', restrictionType)
            .select();

          if (updateError) {
            console.error('Update restriction error:', updateError);
            throw updateError;
          }
          
          if (updateData) {
            console.log('Updated restriction:', updateData);
          }
        } else {
          throw error;
        }
      }
    },
    onSuccess: async (data, variables) => {
      console.log('Restriction added successfully, refreshing list...');
      // 立即刷新查詢
      await queryClient.invalidateQueries({ 
        queryKey: ['admin-user-restrictions'],
        exact: false
      });
      // 等待一小段時間確保數據已寫入
      await new Promise(resolve => setTimeout(resolve, 300));
      // 強制重新獲取數據
      await refetch();
      toast.success('已添加用戶限制');
      setShowAddDialog(false);
      setNewRestriction({ restriction_type: 'create_topic', reason: '', expires_at: '' });
    },
    onError: (error: any) => {
      toast.error('添加限制失敗：' + (error.message || '未知錯誤'));
    },
  });

  const removeRestrictionMutation = useMutation({
    mutationFn: async (restrictionId: string) => {
      const { error } = await supabase
        .from('user_restrictions')
        .update({ is_active: false })
        .eq('id', restrictionId);

      if (error) throw error;
    },
    onSuccess: async () => {
      console.log('Restriction removed successfully, refreshing list...');
      // 立即刷新查詢
      await queryClient.invalidateQueries({ 
        queryKey: ['admin-user-restrictions'],
        exact: false
      });
      // 等待一小段時間確保數據已更新
      await new Promise(resolve => setTimeout(resolve, 300));
      // 強制重新獲取數據
      await refetch();
      toast.success('已解除限制');
    },
    onError: (error: any) => {
      toast.error('解除限制失敗：' + (error.message || '未知錯誤'));
    },
  });

  // 搜尋用戶（通過昵稱或 email）
  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) {
      toast.error('請輸入搜尋關鍵字');
      return;
    }

    setIsSearching(true);
    try {
      // 搜尋 profiles 表（通過昵稱）
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nickname, avatar')
        .ilike('nickname', `%${searchQuery.trim()}%`)
        .limit(20);

      if (profilesError) throw profilesError;

      // 如果有 email，也搜尋 auth.users（需要通過 RPC 或 Edge Function）
      // 這裡先只搜尋 profiles
      const users: User[] = (profilesData || []).map(p => ({
        id: p.id,
        nickname: p.nickname,
        avatar: p.avatar
      }));

      setSearchResults(users);
      
      if (users.length === 0) {
        toast.info('未找到匹配的用戶');
      }
    } catch (error: any) {
      console.error('Search users error:', error);
      toast.error('搜尋用戶失敗：' + (error.message || '未知錯誤'));
    } finally {
      setIsSearching(false);
    }
  };

  // 選擇用戶
  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setShowUserSearchDialog(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleAddRestriction = () => {
    if (!selectedUser) {
      toast.error('請先選擇用戶');
      return;
    }

    // 將 datetime-local 格式轉換為 ISO 字符串
    // datetime-local 返回格式: "YYYY-MM-DDTHH:mm" (本地時間，無時區)
    // 需要轉換為 ISO 字符串，保持用戶輸入的本地時間意圖
    let expiresAtISO: string | undefined = undefined;
    if (newRestriction.expires_at) {
      // 創建本地時間的 Date 對象
      const localDate = new Date(newRestriction.expires_at);
      // 轉換為 ISO 字符串（會自動轉換為 UTC）
      expiresAtISO = localDate.toISOString();
      console.log('Converted datetime-local to ISO:', {
        input: newRestriction.expires_at,
        localDate: localDate.toString(),
        iso: expiresAtISO
      });
    }

    addRestrictionMutation.mutate({
      userId: selectedUser.id,
      restrictionType: newRestriction.restriction_type,
      reason: newRestriction.reason || undefined,
      expiresAt: expiresAtISO
    });
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
      <h2 className="text-2xl font-semibold mb-4">用戶功能限制管理</h2>
      <p className="text-muted-foreground mb-6">
        管理用戶的功能限制，可以暫停用戶的特定功能
      </p>

      {/* 搜索/篩選用戶 */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              {selectedUser ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                    {selectedUser.avatar || '👤'}
                  </div>
                  <div>
                    <div className="font-semibold">{selectedUser.nickname}</div>
                    <div className="text-sm text-muted-foreground">ID: {selectedUser.id.substring(0, 8)}...</div>
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground">顯示所有被限制的用戶</div>
              )}
            </div>
            <div className="flex gap-2">
              <Dialog open={showUserSearchDialog} onOpenChange={setShowUserSearchDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Search className="w-4 h-4 mr-2" />
                    {selectedUser ? '更換用戶' : '搜索用戶'}
                  </Button>
                </DialogTrigger>
                  <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>搜索用戶以篩選列表</DialogTitle>
                    <DialogDescription>
                      輸入用戶昵稱進行搜索，選擇後將只顯示該用戶的限制
                    </DialogDescription>
                  </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="輸入用戶昵稱..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSearchUsers()}
                        />
                        <Button 
                          onClick={handleSearchUsers} 
                          disabled={isSearching}
                        >
                          {isSearching ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Search className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      {searchResults.length > 0 && (
                        <div className="border rounded-lg max-h-60 overflow-y-auto">
                          {searchResults.map((user) => (
                            <div
                              key={user.id}
                              className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                              onClick={() => handleSelectUser(user)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  {user.avatar || '👤'}
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium">{user.nickname}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {user.id.substring(0, 8)}...
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              {selectedUser && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedUser(null);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  清除篩選
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 添加限制按鈕 */}
      <div className="mb-4 flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {restrictions && restrictions.length > 0 
            ? `共 ${restrictions.length} 個活躍限制${selectedUser ? `（已篩選：${selectedUser.nickname}）` : ''}`
            : '目前沒有活躍的限制'}
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button disabled={!selectedUser}>
              <Ban className="w-4 h-4 mr-2" />
              添加限制
            </Button>
          </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加用戶限制</DialogTitle>
                <DialogDescription>
                  為用戶「{selectedUser?.nickname}」選擇要暫停的功能
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label>用戶</Label>
                  <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                    {selectedUser?.nickname} ({selectedUser?.id.substring(0, 8)}...)
                  </div>
                </div>
                <div>
                  <Label>限制類型</Label>
                  <Select
                    value={newRestriction.restriction_type}
                    onValueChange={(v: any) => setNewRestriction({...newRestriction, restriction_type: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="create_topic">發起主題</SelectItem>
                      <SelectItem value="vote">投票</SelectItem>
                      <SelectItem value="complete_mission">完成任務</SelectItem>
                      <SelectItem value="modify_name">修改名稱</SelectItem>
                      <SelectItem value="recharge">儲值</SelectItem>
                      <SelectItem value="all">全部功能</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>限制原因（選填）</Label>
                  <Textarea
                    placeholder="輸入限制原因..."
                    value={newRestriction.reason}
                    onChange={(e) => setNewRestriction({...newRestriction, reason: e.target.value})}
                    rows={3}
                  />
                </div>
                <div>
                  <Label>到期時間（選填，格式：YYYY-MM-DD HH:MM）</Label>
                  <Input
                    type="datetime-local"
                    value={newRestriction.expires_at}
                    onChange={(e) => setNewRestriction({...newRestriction, expires_at: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  取消
                </Button>
                <Button onClick={handleAddRestriction} disabled={addRestrictionMutation.isPending}>
                  {addRestrictionMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Ban className="w-4 h-4 mr-2" />
                  )}
                  添加限制
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

      {/* 限制列表 */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用戶</TableHead>
              <TableHead>限制類型</TableHead>
              <TableHead>原因</TableHead>
              <TableHead>限制時間</TableHead>
              <TableHead>到期時間</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {restrictions?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {selectedUser 
                    ? `用戶「${selectedUser.nickname}」目前沒有功能限制` 
                    : '目前沒有任何活躍的功能限制'}
                </TableCell>
              </TableRow>
            ) : (
              restrictions?.map((restriction) => (
                <TableRow key={restriction.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{restriction.profiles?.avatar || '👤'}</span>
                      <span className="font-medium">
                        {restriction.profiles?.nickname || '未知用戶'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive">
                      {restrictionLabels[restriction.restriction_type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {restriction.reason || '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {format(new Date(restriction.restricted_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {restriction.expires_at 
                        ? format(new Date(restriction.expires_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })
                        : '永久'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      // 檢查限制是否已到期
                      const isExpired = restriction.expires_at 
                        ? new Date(restriction.expires_at) < new Date()
                        : false;
                      
                      if (isExpired) {
                        return (
                          <Badge variant="secondary" className="text-xs">
                            已到期
                          </Badge>
                        );
                      }
                      
                      return (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeRestrictionMutation.mutate(restriction.id)}
                          disabled={removeRestrictionMutation.isPending}
                        >
                          {removeRestrictionMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 mr-1" />
                          )}
                          解除限制
                        </Button>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

