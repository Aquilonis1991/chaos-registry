import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Loader2, 
  Search, 
  Gift, 
  Ban, 
  MoreVertical, 
  Coins,
  TrendingUp,
  Trash2,
  Eye,
  User as UserIcon,
  Calendar,
  Clock,
  FileText,
  Vote
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

interface UserProfile {
  id: string;
  nickname: string;
  avatar?: string;
  tokens: number;
  created_at: string;
  last_login_date?: string;
  is_admin?: boolean;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_reason?: string | null;
}

interface UserStats {
  total_topics: number;
  total_votes: number;
  total_free_votes: number;
  total_tokens: number;
  created_at: string;
  last_login: string;
}

interface UserManagerProps {
  onSetRestriction?: (userId: string) => void;
}

export const UserManager = ({ onSetRestriction }: UserManagerProps) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [showRewardDialog, setShowRewardDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [rewardType, setRewardType] = useState<'tokens' | 'free_create'>('tokens');
  const [rewardAmount, setRewardAmount] = useState("");
  const [rewardReason, setRewardReason] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailUser, setDetailUser] = useState<UserProfile | null>(null);

  // 獲取用戶列表
  const { language } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);

  const titleText = getText('admin.userManager.title', '用戶管理');
  const subtitleText = getText('admin.userManager.subtitle', '查看和管理所有用戶，派發獎勵和設置限制');
  const searchPlaceholder = getText('admin.userManager.search.placeholder', '搜尋用戶暱稱...');
  const searchButtonText = getText('admin.userManager.search.button', '搜尋');
  const tableHeaderUser = getText('admin.userManager.table.header.user', '用戶');
  const tableHeaderTokens = getText('admin.userManager.table.header.tokens', '代幣');
  const tableHeaderCreatedAt = getText('admin.userManager.table.header.createdAt', '註冊時間');
  const tableHeaderLastLogin = getText('admin.userManager.table.header.lastLogin', '最後登入');
  const tableHeaderActions = getText('admin.userManager.table.header.actions', '操作');
  const tableEmptyText = getText('admin.userManager.table.empty', '沒有找到用戶');
  const lastLoginNeverText = getText('admin.userManager.lastLogin.never', '從未登入');
  const dropdownRewardText = getText('admin.userManager.dropdown.reward', '派發獎勵');
  const dropdownRestrictionText = getText('admin.userManager.dropdown.restriction', '設置限制');
  const dropdownStatsText = getText('admin.userManager.dropdown.stats', '查看統計');
  const dropdownViewDetailText = getText('admin.userManager.dropdown.viewDetail', '查看詳細');
  const restrictionErrorText = getText('admin.userManager.dropdown.restrictionError', '無法切換到限制管理頁面');
  const paginationTemplate = getText('admin.userManager.pagination.summary', '共 {{total}} 位用戶，第 {{page}} / {{totalPages}} 頁');
  const paginationPrevText = getText('admin.userManager.pagination.prev', '上一頁');
  const paginationNextText = getText('admin.userManager.pagination.next', '下一頁');
  const rewardDialogTitle = getText('admin.userManager.dialog.title', '派發獎勵');
  const rewardDialogDescriptionTemplate = getText('admin.userManager.dialog.description', '為 {{nickname}} 派發獎勵');
  const rewardTypeLabel = getText('admin.userManager.dialog.rewardTypeLabel', '獎勵類型');
  const rewardTypeTokensLabel = getText('admin.userManager.dialog.rewardType.tokens', '代幣');
  const rewardTypeFreeCreateLabel = getText('admin.userManager.dialog.rewardType.freeCreate', '免費創建資格');
  const rewardTypePlaceholder = getText('admin.userManager.dialog.rewardTypePlaceholder', '選擇獎勵類型');
  const rewardTokenAmountLabel = getText('admin.userManager.dialog.tokenAmountLabel', '代幣數量');
  const rewardTokenAmountPlaceholder = getText('admin.userManager.dialog.tokenAmountPlaceholder', '輸入代幣數量');
  const rewardReasonLabel = getText('admin.userManager.dialog.reasonLabel', '派發原因（選填）');
  const rewardReasonPlaceholder = getText('admin.userManager.dialog.reasonPlaceholder', '輸入派發原因...');
  const rewardStatsTokensTemplate = getText('admin.userManager.dialog.stats.tokens', '當前代幣：{{amount}}');
  const rewardStatsTopicsTemplate = getText('admin.userManager.dialog.stats.topics', '創建主題數：{{count}}');
  const rewardStatsVotesTemplate = getText('admin.userManager.dialog.stats.votes', '投票總數：{{count}}');
  const dialogCancelText = getText('admin.userManager.dialog.cancel', '取消');
  const dialogConfirmText = getText('admin.userManager.dialog.confirm', '確認派發');
  const dialogProcessingText = getText('admin.userManager.dialog.processing', '派發中...');
  const tokensSuccessTemplate = getText('admin.userManager.toast.tokensSuccess', '已派發 {{amount}} 代幣');
  const freeCreateSuccessText = getText('admin.userManager.toast.freeCreateSuccess', '已派發免費創建資格');
  const rewardErrorPrefix = getText('admin.userManager.toast.rewardErrorPrefix', '派發失敗：');
  const unknownErrorText = getText('admin.userManager.toast.unknownError', '未知錯誤');
  const noUserSelectedError = getText('admin.userManager.error.noUserSelected', '未選擇用戶');
  const notLoggedInError = getText('admin.userManager.error.notLoggedIn', '未登入');
  const tokenAmountMustBePositive = getText('admin.userManager.error.tokenAmountPositive', '代幣數量必須大於 0');
  const rewardFailureDefault = getText('admin.userManager.error.rewardFailure', '派發失敗');
  const invalidTokenAmountText = getText('admin.userManager.error.invalidTokenAmount', '請輸入有效的代幣數量');
  const dropdownDeleteText = getText('admin.userManager.dropdown.delete', '刪除用戶');
  const deleteDialogTitle = getText('admin.userManager.delete.title', '刪除用戶');
  const deleteDialogDescriptionTemplate = getText('admin.userManager.delete.description', '確定要刪除 {{nickname}} 嗎？資料會被保留於後台日誌，使用者可重新註冊。');
  const deleteReasonLabel = getText('admin.userManager.delete.reasonLabel', '刪除原因（選填）');
  const deleteReasonPlaceholder = getText('admin.userManager.delete.reasonPlaceholder', '輸入刪除原因...');
  const deleteConfirmText = getText('admin.userManager.delete.confirm', '確認刪除');
  const deleteProcessingText = getText('admin.userManager.delete.processing', '刪除中...');
  const deleteSuccessText = getText('admin.userManager.delete.success', '已刪除用戶並保留紀錄');
  const deleteErrorPrefix = getText('admin.userManager.delete.errorPrefix', '刪除失敗：');
  const deletedBadgeText = getText('admin.userManager.badge.deleted', '已刪除');
  const deletedUserActionError = getText('admin.userManager.error.userDeleted', '此用戶已被刪除，無法執行該操作');

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users', searchQuery, page],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, nickname, avatar, tokens, created_at, last_login_date, is_deleted, deleted_at, deleted_reason')
        .order('created_at', { ascending: false });

      if (searchQuery.trim()) {
        query = query.ilike('nickname', `%${searchQuery.trim()}%`);
      }

      const { data, error, count } = await query
        .range((page - 1) * pageSize, page * pageSize - 1)
        .select('*', { count: 'exact' });

      if (error) throw error;
      return { users: data as UserProfile[], total: count || 0 };
    },
  });

  // 獲取用戶統計（當選擇用戶時）
  const { data: userStats } = useQuery({
    queryKey: ['admin-user-stats', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser) return null;
      const { data, error } = await supabase.rpc('get_user_stats', {
        p_user_id: selectedUser.id
      });
      if (error) throw error;
      return data?.[0] as UserStats | null;
    },
    enabled: !!selectedUser,
  });

  // 獲取詳細用戶信息（用於詳細對話框）
  const { data: detailUserStats, isLoading: detailStatsLoading, error: detailStatsError } = useQuery({
    queryKey: ['admin-user-detail-stats', detailUser?.id],
    queryFn: async () => {
      if (!detailUser) return null;
      
      console.log('[UserManager] Fetching user stats for:', detailUser.id);
      
      // 添加超時處理（30秒，增加時間以處理複雜查詢）
      const rpcPromise = supabase.rpc('get_user_stats', {
        p_user_id: detailUser.id
      });
      
      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((_, reject) => 
        setTimeout(() => reject(new Error('查詢超時（30秒）')), 30000)
      );
      
      let result: { data: any; error: any };
      try {
        result = await Promise.race([
          rpcPromise,
          timeoutPromise
        ]) as { data: any; error: any };
      } catch (timeoutError: any) {
        console.error('[UserManager] RPC timeout:', timeoutError);
        throw new Error('查詢統計數據超時，請稍後再試');
      }
      
      const { data, error } = result;
      
      if (error) {
        console.error('[UserManager] Error fetching user stats:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }
      
      console.log('[UserManager] User stats fetched:', data);
      
      if (!data || data.length === 0) {
        console.warn('[UserManager] No stats data returned, returning default values');
        // 返回默認值而不是 null，避免 UI 一直顯示載入中
        return {
          total_topics: 0,
          total_votes: 0,
          total_free_votes: 0,
          total_tokens: detailUser.tokens || 0,
          created_at: detailUser.created_at,
          last_login: detailUser.last_login_date || ''
        } as UserStats;
      }
      
      const stats = data[0] as UserStats;
      console.log('[UserManager] Parsed stats:', stats);
      return stats;
    },
    enabled: !!detailUser,
    retry: 1,
    staleTime: 30000, // 30秒內不重新查詢
  });

  // 獲取用戶代幣交易記錄（最近 20 筆）
  const { data: tokenTransactions, isLoading: transactionsLoading, error: transactionsError } = useQuery({
    queryKey: ['admin-user-token-transactions', detailUser?.id],
    queryFn: async () => {
      if (!detailUser) return null;
      
      console.log('[UserManager] Fetching token transactions for:', detailUser.id);
      
      // 添加超時處理（30秒，增加時間以處理大量數據）
      const queryPromise = supabase
        .from('token_transactions')
        .select('id, amount, transaction_type, description, reference_id, created_at')
        .eq('user_id', detailUser.id)
        .order('created_at', { ascending: false })
        .limit(50); // 增加顯示數量到50筆
      
      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((_, reject) => 
        setTimeout(() => reject(new Error('查詢超時（30秒）')), 30000)
      );
      
      let result: { data: any; error: any };
      try {
        result = await Promise.race([
          queryPromise,
          timeoutPromise
        ]) as { data: any; error: any };
      } catch (timeoutError: any) {
        console.error('[UserManager] Token transactions query timeout:', timeoutError);
        throw new Error('查詢交易記錄超時，請稍後再試');
      }
      
      const { data, error } = result;
      
      if (error) {
        console.error('[UserManager] Error fetching token transactions:', {
          error,
          code: error.code,
          message: error.message
        });
        throw error;
      }
      
      console.log('[UserManager] Token transactions fetched:', data?.length || 0, 'records');
      
      return data || [];
    },
    enabled: !!detailUser,
    retry: 1,
    staleTime: 30000,
  });

  // 獲取用戶創建的主題（最近 10 個）
  const { data: userTopics, isLoading: topicsLoading, error: topicsError } = useQuery({
    queryKey: ['admin-user-topics', detailUser?.id],
    queryFn: async () => {
      if (!detailUser) return null;
      
      console.log('[UserManager] Fetching user topics for:', detailUser.id);
      
      // 添加超時處理（30秒，增加時間以處理大量數據）
      const queryPromise = supabase
        .from('topics')
        .select('id, title, created_at, status, vote_count')
        .eq('creator_id', detailUser.id)
        .order('created_at', { ascending: false })
        .limit(20); // 增加顯示數量到20個
      
      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((_, reject) => 
        setTimeout(() => reject(new Error('查詢超時（30秒）')), 30000)
      );
      
      let result: { data: any; error: any };
      try {
        result = await Promise.race([
          queryPromise,
          timeoutPromise
        ]) as { data: any; error: any };
      } catch (timeoutError: any) {
        console.error('[UserManager] User topics query timeout:', timeoutError);
        throw new Error('查詢主題列表超時，請稍後再試');
      }
      
      const { data, error } = result;
      
      if (error) {
        console.error('[UserManager] Error fetching user topics:', {
          error,
          code: error.code,
          message: error.message
        });
        throw error;
      }
      
      console.log('[UserManager] User topics fetched:', data?.length || 0, 'topics');
      
      return data || [];
    },
    enabled: !!detailUser,
    retry: 1,
    staleTime: 30000,
  });

  // 派發獎勵
  const rewardMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error(noUserSelectedError);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(notLoggedInError);

      if (rewardType === 'tokens') {
        const amount = parseInt(rewardAmount);
        if (isNaN(amount) || amount <= 0) {
          throw new Error(tokenAmountMustBePositive);
        }

        const { data, error } = await supabase.rpc('admin_grant_tokens', {
          p_user_id: selectedUser.id,
          p_amount: amount,
          p_admin_id: user.id,
          p_reason: rewardReason.trim() || null
        });

        if (error) throw error;
        if (data && data.length > 0 && !data[0].success) {
          throw new Error(data[0].message || rewardFailureDefault);
        }
        return data?.[0];
      } else {
        const { data, error } = await supabase.rpc('admin_grant_free_create', {
          p_user_id: selectedUser.id,
          p_admin_id: user.id,
          p_reason: rewardReason.trim() || null
        });

        if (error) throw error;
        if (data && data.length > 0 && !data[0].success) {
          throw new Error(data[0].message || rewardFailureDefault);
        }
        return data?.[0];
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-stats'] });
      if (rewardType === 'tokens') {
        const formattedAmount = Number(rewardAmount || 0).toLocaleString();
        toast.success(tokensSuccessTemplate.replace('{{amount}}', formattedAmount));
      } else {
        toast.success(freeCreateSuccessText);
      }
      setShowRewardDialog(false);
      setRewardAmount("");
      setRewardReason("");
    },
    onError: (error: any) => {
      const errorMessage = error.message || unknownErrorText;
      toast.error(rewardErrorPrefix + errorMessage);
    },
  });

  const handleSearch = () => {
    setPage(1);
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
  };

  const handleOpenRewardDialog = (user: UserProfile) => {
    if (user.is_deleted) {
      toast.error(deletedUserActionError);
      return;
    }
    setSelectedUser(user);
    setShowRewardDialog(true);
    setRewardType('tokens');
    setRewardAmount("");
    setRewardReason("");
  };

  const handleOpenDeleteDialog = (user: UserProfile) => {
    if (user.is_deleted) {
      toast.error(deletedUserActionError);
      return;
    }
    setDeleteTarget(user);
    setDeleteReason("");
    setShowDeleteDialog(true);
  };

  const handleOpenDetailDialog = (user: UserProfile) => {
    setDetailUser(user);
    setShowDetailDialog(true);
  };

  const handleSubmitReward = () => {
    if (!selectedUser) return;
    if (rewardType === 'tokens' && (!rewardAmount.trim() || parseInt(rewardAmount) <= 0)) {
      toast.error(invalidTokenAmountText);
      return;
    }
    rewardMutation.mutate();
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) throw new Error(noUserSelectedError);
      const { data, error } = await supabase.rpc('admin_soft_delete_user', {
        p_target_user_id: deleteTarget.id,
        p_reason: deleteReason.trim() || null
      });
      if (error) throw error;
      if (!data || !data.success) {
        throw new Error(data?.error || unknownErrorText);
      }
      return data;
    },
    onSuccess: () => {
      toast.success(deleteSuccessText);
      setShowDeleteDialog(false);
      setDeleteTarget(null);
      setDeleteReason("");
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any) => {
      const message = error?.message || unknownErrorText;
      toast.error(deleteErrorPrefix + message);
    },
  });

  const totalPages = Math.ceil((usersData?.total || 0) / pageSize);
  const paginationSummary = paginationTemplate
    .replace('{{total}}', (usersData?.total || 0).toLocaleString())
    .replace('{{page}}', page.toString())
    .replace('{{totalPages}}', totalPages.toString());

  if (uiTextsLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">{titleText}</h2>
          <p className="text-muted-foreground mt-1">
            {subtitleText}
          </p>
        </div>
      </div>

      {/* 搜尋和篩選 */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch}>
              <Search className="w-4 h-4 mr-2" />
              {searchButtonText}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 用戶列表 */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{tableHeaderUser}</TableHead>
                      <TableHead>{tableHeaderTokens}</TableHead>
                      <TableHead>{tableHeaderCreatedAt}</TableHead>
                      <TableHead>{tableHeaderLastLogin}</TableHead>
                      <TableHead>{tableHeaderActions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersData?.users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          {tableEmptyText}
                        </TableCell>
                      </TableRow>
                    ) : (
                      usersData?.users.map((user) => (
                        <TableRow key={user.id} className={user.is_deleted ? "opacity-60" : ""}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm">
                                {user.avatar || '👤'}
                              </div>
                              <div>
                                <div className="font-medium flex items-center gap-2">
                                  {user.nickname}
                                  {user.is_deleted && (
                                    <span className="text-xs text-destructive font-semibold">{deletedBadgeText}</span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {user.id.substring(0, 8)}...
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Coins className="w-4 h-4 text-yellow-500" />
                              <span className="font-semibold">{user.tokens || 0}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {format(new Date(user.created_at), 'yyyy/MM/dd', { locale: zhTW })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {user.last_login_date
                                ? format(new Date(user.last_login_date), 'yyyy/MM/dd HH:mm', { locale: zhTW })
                                : lastLoginNeverText}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenRewardDialog(user)}>
                                  <Gift className="w-4 h-4 mr-2" />
                                  {dropdownRewardText}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  disabled={user.is_deleted}
                                  onClick={() => {
                                    if (user.is_deleted) {
                                      toast.error(deletedUserActionError);
                                      return;
                                    }
                                    if (onSetRestriction) {
                                      onSetRestriction(user.id);
                                    } else {
                                      toast.error(restrictionErrorText);
                                    }
                                  }}
                                >
                                  <Ban className="w-4 h-4 mr-2" />
                                  {dropdownRestrictionText}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenDetailDialog(user)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  {dropdownViewDetailText}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedUser(user);
                                    queryClient.invalidateQueries({ queryKey: ['admin-user-stats'] });
                                  }}
                                >
                                  <TrendingUp className="w-4 h-4 mr-2" />
                                  {dropdownStatsText}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleOpenDeleteDialog(user)}
                                  className="text-destructive focus:text-destructive"
                                  disabled={user.is_deleted}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  {dropdownDeleteText}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* 分頁 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    {paginationSummary}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      {paginationPrevText}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      {paginationNextText}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 派發獎勵對話框 */}
      <Dialog open={showRewardDialog} onOpenChange={setShowRewardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rewardDialogTitle}</DialogTitle>
            <DialogDescription>
              {rewardDialogDescriptionTemplate.replace('{{nickname}}', selectedUser?.nickname || '')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{rewardTypeLabel}</Label>
              <Select value={rewardType} onValueChange={(v: any) => setRewardType(v)}>
                <SelectTrigger>
                  <SelectValue placeholder={rewardTypePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tokens">{rewardTypeTokensLabel}</SelectItem>
                  <SelectItem value="free_create">{rewardTypeFreeCreateLabel}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {rewardType === 'tokens' && (
              <div>
                <Label>{rewardTokenAmountLabel}</Label>
                <Input
                  type="number"
                  placeholder={rewardTokenAmountPlaceholder}
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(e.target.value)}
                  min="1"
                />
              </div>
            )}
            <div>
              <Label>{rewardReasonLabel}</Label>
              <Input
                placeholder={rewardReasonPlaceholder}
                value={rewardReason}
                onChange={(e) => setRewardReason(e.target.value)}
              />
            </div>
            {selectedUser && userStats && (
              <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                <div>{rewardStatsTokensTemplate.replace('{{amount}}', (selectedUser.tokens || 0).toLocaleString())}</div>
                <div>{rewardStatsTopicsTemplate.replace('{{count}}', (userStats.total_topics || 0).toLocaleString())}</div>
                <div>{rewardStatsVotesTemplate.replace('{{count}}', (userStats.total_votes + userStats.total_free_votes || 0).toLocaleString())}</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRewardDialog(false)}>
              {dialogCancelText}
            </Button>
            <Button onClick={handleSubmitReward} disabled={rewardMutation.isPending}>
              {rewardMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {dialogProcessingText}
                </>
              ) : (
                <>
                  <Gift className="w-4 h-4 mr-2" />
                  {dialogConfirmText}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除用戶對話框 */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open);
        if (!open) {
          setDeleteTarget(null);
          setDeleteReason("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleteDialogTitle}</DialogTitle>
            <DialogDescription>
              {deleteDialogDescriptionTemplate.replace('{{nickname}}', deleteTarget?.nickname || '')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded text-sm">
              <div className="font-semibold">{deleteTarget?.nickname}</div>
              <div className="text-muted-foreground text-xs">{deleteTarget?.id}</div>
            </div>
            <div>
              <Label>{deleteReasonLabel}</Label>
              <Textarea
                placeholder={deleteReasonPlaceholder}
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {dialogCancelText}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending || !deleteTarget}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {deleteProcessingText}
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleteConfirmText}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 用戶詳細信息對話框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{getText('admin.userManager.detail.title', '用戶詳細信息')}</DialogTitle>
            <DialogDescription>
              {getText('admin.userManager.detail.description', '查看用戶的完整信息和活動記錄')}
            </DialogDescription>
          </DialogHeader>
          
          {detailUser && (
            <div className="space-y-6 py-4">
              {/* 基本信息 */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <UserIcon className="w-5 h-5" />
                    {getText('admin.userManager.detail.basicInfo', '基本信息')}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">
                        {getText('admin.userManager.detail.nickname', '暱稱')}
                      </div>
                      <div className="font-medium">{detailUser.nickname}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">
                        {getText('admin.userManager.detail.userId', '用戶 ID')}
                      </div>
                      <div className="font-mono text-xs break-all">{detailUser.id}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {getText('admin.userManager.detail.registeredAt', '註冊時間')}
                      </div>
                      <div className="text-sm">
                        {format(new Date(detailUser.created_at), 'yyyy/MM/dd HH:mm:ss', { locale: zhTW })}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getText('admin.userManager.detail.lastLogin', '最後登入')}
                      </div>
                      <div className="text-sm">
                        {detailUser.last_login_date
                          ? format(new Date(detailUser.last_login_date), 'yyyy/MM/dd HH:mm:ss', { locale: zhTW })
                          : lastLoginNeverText}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                        <Coins className="w-3 h-3" />
                        {getText('admin.userManager.detail.tokens', '代幣餘額')}
                      </div>
                      <div className="font-semibold text-lg">{detailUser.tokens || 0}</div>
                    </div>
                    {detailUser.is_deleted && (
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">
                          {getText('admin.userManager.detail.status', '狀態')}
                        </div>
                        <div className="text-destructive font-semibold">{deletedBadgeText}</div>
                        {detailUser.deleted_at && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {getText('admin.userManager.detail.deletedAt', '刪除時間')}: {format(new Date(detailUser.deleted_at), 'yyyy/MM/dd HH:mm:ss', { locale: zhTW })}
                          </div>
                        )}
                        {detailUser.deleted_reason && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {getText('admin.userManager.detail.deleteReason', '刪除原因')}: {detailUser.deleted_reason}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 統計數據 */}
              {detailStatsLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">載入統計數據中...</span>
                </div>
              ) : detailStatsError ? (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      {getText('admin.userManager.detail.statistics', '統計數據')}
                    </h3>
                    <div className="text-center text-destructive py-4">
                      {getText('admin.userManager.detail.statsError', '載入統計數據失敗')}
                    </div>
                  </CardContent>
                </Card>
              ) : detailUserStats ? (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      {getText('admin.userManager.detail.statistics', '統計數據')}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">
                          {getText('admin.userManager.detail.totalTopics', '創建主題')}
                        </div>
                        <div className="text-2xl font-bold">{detailUserStats.total_topics || 0}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">
                          {getText('admin.userManager.detail.totalVotes', '投票總數')}
                        </div>
                        <div className="text-2xl font-bold">
                          {(detailUserStats.total_votes || 0) + (detailUserStats.total_free_votes || 0)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {getText('admin.userManager.detail.tokenVotes', '代幣投票')}: {detailUserStats.total_votes || 0} | {getText('admin.userManager.detail.freeVotes', '免費投票')}: {detailUserStats.total_free_votes || 0}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">
                          {getText('admin.userManager.detail.totalTokens', '累計代幣')}
                        </div>
                        <div className="text-2xl font-bold">{detailUserStats.total_tokens || 0}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">
                          {getText('admin.userManager.detail.createdAt', '註冊日期')}
                        </div>
                        <div className="text-sm">
                          {format(new Date(detailUserStats.created_at || detailUser.created_at), 'yyyy/MM/dd', { locale: zhTW })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      {getText('admin.userManager.detail.statistics', '統計數據')}
                    </h3>
                    <div className="text-center text-muted-foreground py-4">
                      {getText('admin.userManager.detail.noStats', '無法載入統計數據')}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 代幣交易記錄 */}
              {transactionsLoading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">載入交易記錄中...</span>
                </div>
              ) : transactionsError ? (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Coins className="w-5 h-5" />
                      {getText('admin.userManager.detail.tokenTransactions', '代幣交易記錄')}
                    </h3>
                    <div className="text-center text-destructive py-4">
                      {getText('admin.userManager.detail.transactionsError', '載入交易記錄失敗')}: {transactionsError.message}
                    </div>
                  </CardContent>
                </Card>
              ) : tokenTransactions && tokenTransactions.length > 0 ? (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Coins className="w-5 h-5" />
                      {getText('admin.userManager.detail.tokenTransactions', '代幣交易記錄')} ({tokenTransactions.length})
                    </h3>
                    
                    {/* 分類統計 */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="p-2 bg-blue-50 rounded text-center">
                        <div className="text-xs text-muted-foreground">儲值</div>
                        <div className="font-semibold text-blue-600">
                          {tokenTransactions.filter((tx: any) => tx.transaction_type === 'deposit' || tx.transaction_type === 'purchase').length}
                        </div>
                      </div>
                      <div className="p-2 bg-green-50 rounded text-center">
                        <div className="text-xs text-muted-foreground">觀看廣告</div>
                        <div className="font-semibold text-green-600">
                          {tokenTransactions.filter((tx: any) => tx.transaction_type === 'watch_ad').length}
                        </div>
                      </div>
                      <div className="p-2 bg-purple-50 rounded text-center">
                        <div className="text-xs text-muted-foreground">點擊卡片</div>
                        <div className="font-semibold text-purple-600">
                          {tokenTransactions.filter((tx: any) => tx.transaction_type === 'click_native_ad').length}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {tokenTransactions.map((tx: any) => {
                        // 根據交易類型設置圖標和顏色
                        let typeIcon = '💰';
                        let typeColor = 'text-gray-600';
                        let typeLabel = tx.transaction_type;
                        
                        if (tx.transaction_type === 'deposit' || tx.transaction_type === 'purchase') {
                          typeIcon = '💳';
                          typeColor = 'text-blue-600';
                          typeLabel = '儲值';
                        } else if (tx.transaction_type === 'watch_ad') {
                          typeIcon = '📺';
                          typeColor = 'text-green-600';
                          typeLabel = '觀看廣告';
                        } else if (tx.transaction_type === 'click_native_ad') {
                          typeIcon = '🖱️';
                          typeColor = 'text-purple-600';
                          typeLabel = '點擊卡片廣告';
                        } else if (tx.transaction_type === 'create_topic') {
                          typeIcon = '📝';
                          typeColor = 'text-orange-600';
                          typeLabel = '建立主題';
                        } else if (tx.transaction_type === 'cast_vote') {
                          typeIcon = '🗳️';
                          typeColor = 'text-red-600';
                          typeLabel = '投票';
                        } else if (tx.transaction_type === 'complete_mission') {
                          typeIcon = '✅';
                          typeColor = 'text-teal-600';
                          typeLabel = '完成任務';
                        }
                        
                        return (
                          <div key={tx.id} className="flex items-center justify-between p-2 border rounded text-sm">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{typeIcon}</span>
                                <div>
                                  <div className={`font-medium ${typeColor}`}>
                                    {tx.description || typeLabel}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {format(new Date(tx.created_at), 'yyyy/MM/dd HH:mm:ss', { locale: zhTW })}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className={`font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {tx.amount > 0 ? '+' : ''}{tx.amount}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Coins className="w-5 h-5" />
                      {getText('admin.userManager.detail.tokenTransactions', '代幣交易記錄')}
                    </h3>
                    <div className="text-center text-muted-foreground py-4">
                      {getText('admin.userManager.detail.noTransactions', '該用戶尚無交易記錄')}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 創建的主題 */}
              {topicsLoading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="ml-2 text-sm text-muted-foreground">載入主題列表中...</span>
                </div>
              ) : topicsError ? (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      {getText('admin.userManager.detail.createdTopics', '創建的主題')}
                    </h3>
                    <div className="text-center text-destructive py-4">
                      {getText('admin.userManager.detail.topicsError', '載入主題列表失敗')}: {topicsError.message}
                    </div>
                  </CardContent>
                </Card>
              ) : userTopics && userTopics.length > 0 ? (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      {getText('admin.userManager.detail.createdTopics', '創建的主題')} ({userTopics.length})
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {userTopics.map((topic: any) => (
                        <div key={topic.id} className="flex items-center justify-between p-2 border rounded text-sm">
                          <div className="flex-1">
                            <div className="font-medium">{topic.title}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                              <span>{format(new Date(topic.created_at), 'yyyy/MM/dd HH:mm', { locale: zhTW })}</span>
                              <span>•</span>
                              <span>{getText('admin.userManager.detail.votes', '投票')}: {topic.vote_count || 0}</span>
                              <span>•</span>
                              <span>{getText('admin.userManager.detail.status', '狀態')}: {topic.status}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      {getText('admin.userManager.detail.createdTopics', '創建的主題')}
                    </h3>
                    <div className="text-center text-muted-foreground py-4">
                      {getText('admin.userManager.detail.noTopics', '該用戶尚未創建任何主題')}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              {dialogCancelText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

