import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import {
  User,
  Coins,
  Trophy,
  FileText,
  History,
  Globe,
  Bell,
  Shield,
  Mail,
  ChevronRight,
  Edit,
  Check,
  Loader2,
  LogOut
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LoadingBubble } from "@/components/ui/LoadingBubble";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useUserStats } from "@/hooks/useUserStats";
import { supabase } from "@/integrations/supabase/client";
import { profileUpdateSchema } from "@/lib/validationSchemas";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";
import { ErrorFeedback } from "@/components/ErrorFeedback";
import { validateNickname, getBannedWordErrorMessage } from "@/lib/bannedWords";
import { formatCompactNumber } from "@/lib/numberFormat";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";

const ProfilePage = () => {
  const { profile, loading: profileLoading, refreshProfile } = useProfile();
  const { user, signOut } = useAuth();
  const { stats, loading: statsLoading } = useUserStats(user?.id);
  const { getConfig } = useSystemConfigCache();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempNickname, setTempNickname] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [pendingNickname, setPendingNickname] = useState<string | null>(null);
  const [pendingReviewKeyword, setPendingReviewKeyword] = useState<string | null>(null);
  const { language, setLanguage } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);

  // 獲取未讀通知數量
  useEffect(() => {
    if (user?.id) {
      const fetchUnreadCount = async () => {
        try {
          const { data, error } = await (supabase.rpc as any)('get_unread_notification_count');
          if (!error && typeof data === 'number') {
            setUnreadNotificationCount(data);
          }
        } catch (error) {
          console.error('Error fetching unread notification count:', error);
        }
      };

      fetchUnreadCount();
      // 每30秒更新一次
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.id, notifications]);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleNicknameUpdateError = (error: any) => {
    console.error('[ProfilePage] Nickname update error:', error);
    console.error('[ProfilePage] Error details:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      errors: error?.errors,
      fullError: error
    });

    if (error?.errors && Array.isArray(error.errors) && error.errors.length > 0) {
      toast.error(error.errors[0]?.message || getText('profile.error.updateFailed', '更新失敗'));
    } else if (error?.message) {
      // 顯示具體的錯誤訊息
      toast.error(getText('profile.error.updateFailed', '更新失敗'), {
        description: error.message
      });
    } else if (error?.code) {
      // 顯示錯誤代碼
      toast.error(getText('profile.error.updateFailed', '更新失敗'), {
        description: `錯誤代碼: ${error.code}`
      });
    } else {
      toast.error(getText('profile.error.updateFailed', '更新失敗'));
    }
  };

  const finalizeNicknameUpdate = async (nickname: string): Promise<boolean> => {
    if (!profile) {
      console.error('[ProfilePage] finalizeNicknameUpdate: No profile');
      return false;
    }

    console.log('[ProfilePage] finalizeNicknameUpdate: Starting update', {
      userId: profile.id,
      newNickname: nickname,
      currentNickname: profile.nickname
    });

    // 檢查暱稱是否重複
    const { data: existingNickname, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .ilike('nickname', nickname)
      .neq('id', profile.id)
      .limit(1)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[ProfilePage] finalizeNicknameUpdate: Check duplicate error', checkError);
      throw checkError;
    }

    if (existingNickname) {
      console.warn('[ProfilePage] finalizeNicknameUpdate: Nickname already exists', existingNickname);
      toast.error(getText('profile.error.nameDuplicate', '名稱已被其他用戶使用，請選擇不同的名稱'));
      return false;
    }

    // 更新暱稱
    console.log('[ProfilePage] finalizeNicknameUpdate: Updating nickname in database');
    const { data, error } = await supabase
      .from('profiles')
      .update({ nickname })
      .eq('id', profile.id)
      .select();

    if (error) {
      console.error('[ProfilePage] finalizeNicknameUpdate: Update error', error);
      throw error;
    }

    console.log('[ProfilePage] finalizeNicknameUpdate: Update successful', data);

    // 刷新 profile 數據
    await refreshProfile();

    setTempNickname(nickname);
    setIsEditingName(false);
    toast.success(getText('profile.nameUpdated', '名稱已更新'));
    return true;
  };

  const handleReviewCancel = () => {
    setReviewDialogOpen(false);
    setPendingNickname(null);
    setPendingReviewKeyword(null);
  };

  const handleReviewConfirm = async () => {
    if (!pendingNickname) {
      handleReviewCancel();
      return;
    }

    setReviewDialogOpen(false);
    setIsUpdatingProfile(true);

    try {
      await finalizeNicknameUpdate(pendingNickname);
    } catch (error: any) {
      handleNicknameUpdateError(error);
    } finally {
      setIsUpdatingProfile(false);
      setPendingNickname(null);
      setPendingReviewKeyword(null);
    }
  };

  const handleSaveName = async () => {
    if (!profile) {
      console.error('[ProfilePage] handleSaveName: No profile');
      return;
    }

    const trimmedNickname = tempNickname.trim();
    console.log('[ProfilePage] handleSaveName: Starting', {
      trimmedNickname,
      currentNickname: profile.nickname,
      isSame: trimmedNickname === profile.nickname
    });

    if (!trimmedNickname) {
      toast.error(getText('profile.error.nameEmpty', '名稱不能為空白'));
      return;
    }

    // 如果暱稱沒有改變，直接返回
    if (trimmedNickname === profile.nickname) {
      console.log('[ProfilePage] handleSaveName: Nickname unchanged, canceling edit');
      setIsEditingName(false);
      return;
    }

    setIsUpdatingProfile(true);
    try {
      // 檢查用戶是否被限制修改名稱
      const { checkUserRestriction } = await import("@/lib/userRestrictions");
      const restriction = await checkUserRestriction(profile.id, 'modify_name');
      console.log('[ProfilePage] handleSaveName: Restriction check', restriction);
      if (restriction.restricted) {
        toast.error(restriction.reason || getText('profile.error.nameModifyRestricted', '修改名稱功能已被暫停'));
        setIsUpdatingProfile(false);
        return;
      }

      // Validate with Zod (只驗證 nickname，avatar 會在更新時處理)
      console.log('[ProfilePage] handleSaveName: Validating with Zod');
      try {
        // 清理 avatar：如果是 URL 或超過 10 個字符，使用默認 emoji
        let cleanedAvatar = profile.avatar ?? '🔥';
        if (cleanedAvatar.length > 10 || cleanedAvatar.startsWith('http://') || cleanedAvatar.startsWith('https://')) {
          cleanedAvatar = '🔥';
        }

        profileUpdateSchema.parse({
          nickname: trimmedNickname,
          avatar: cleanedAvatar,
          notifications
        });
        console.log('[ProfilePage] handleSaveName: Zod validation passed');
      } catch (zodError: any) {
        console.error('[ProfilePage] handleSaveName: Zod validation failed', zodError);
        if (zodError.errors && zodError.errors.length > 0) {
          // 只顯示 nickname 相關的錯誤，忽略 avatar 錯誤（因為我們只更新 nickname）
          const nicknameError = zodError.errors.find((e: any) => e.path[0] === 'nickname');
          if (nicknameError) {
            toast.error(nicknameError.message);
          } else {
            // 如果是 avatar 錯誤，忽略它（因為我們只更新 nickname）
            console.warn('[ProfilePage] handleSaveName: Avatar validation error ignored (only updating nickname)');
          }
        } else {
          toast.error(getText('profile.error.updateFailed', '更新失敗'));
        }
        setIsUpdatingProfile(false);
        return;
      }

      // 檢查禁字
      console.log('[ProfilePage] handleSaveName: Checking banned words');
      const nicknameBannedLevels = getConfig('nickname_banned_check_levels', ['A', 'B', 'C', 'D', 'E']);
      const bannedCheck = await validateNickname(trimmedNickname, nicknameBannedLevels);
      console.log('[ProfilePage] handleSaveName: Banned words check result', bannedCheck);
      if (bannedCheck.found) {
        if (bannedCheck.action === 'block' || bannedCheck.action === 'mask') {
          const bannedWordFoundTemplate = getText('profile.error.bannedWordFound', '發現禁字：{{keyword}}（級別：{{level}}）');
          const bannedWordDescription = bannedWordFoundTemplate
            .replace('{{keyword}}', bannedCheck.keyword || '')
            .replace('{{level}}', bannedCheck.level || '');
          toast.error(getBannedWordErrorMessage(bannedCheck), {
            description: bannedWordDescription
          });
          setIsUpdatingProfile(false);
          return;
        } else if (bannedCheck.action === 'review') {
          const reviewTitle = getText('profile.warning.nameReviewTitle', '名稱包含敏感字詞');
          const reviewDescriptionTemplate = getText('profile.warning.nameReviewDesc', '發現敏感字詞：{{keyword}}');
          const reviewDescription = reviewDescriptionTemplate.replace('{{keyword}}', bannedCheck.keyword || '');

          toast.warning(reviewTitle, {
            description: reviewDescription
          });

          setPendingNickname(trimmedNickname);
          setPendingReviewKeyword(bannedCheck.keyword || '');
          setReviewDialogOpen(true);
          setIsUpdatingProfile(false);
          return;
        }
      }

      console.log('[ProfilePage] handleSaveName: All checks passed, calling finalizeNicknameUpdate');
      await finalizeNicknameUpdate(trimmedNickname);
    } catch (error: any) {
      console.error('[ProfilePage] handleSaveName: Error caught', error);
      handleNicknameUpdateError(error);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleCancelEdit = () => {
    if (profile) {
      setTempNickname(profile.nickname);
    }
    setIsEditingName(false);
  };


  const handleNotificationsChange = async (value: boolean) => {
    if (!profile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ notifications: value })
        .eq('id', profile.id);

      if (error) throw error;

      setNotifications(value);
      toast.success(getText("profile.settings.updated", "設定已更新"));
    } catch (error) {
      toast.error(getText("profile.error.updateFailed", "更新失敗"));
    }
  };

  if (profileLoading || !profile || uiTextsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const nickname = profile.nickname;
  const userStats = {
    tokens: profile.tokens,
    totalVotes: stats.totalVotes,
    topicsCreated: stats.topicsCreated,
  };

  // UI 文字定義
  const tokensLabel = getText('profile.tokens', '代幣');
  const votesCountLabel = getText('profile.stats.votes', '投票次數');
  const topicsCreatedLabel = getText('profile.stats.topicsCreated', '發起主題');
  const freeVotesLabel = getText('profile.stats.freeVotes', '免費票');
  const historySectionLabel = getText('profile.section.history', '歷史紀錄');
  const voteHistoryLabel = getText('profile.menu.voteHistory', '投票紀錄');
  const topicHistoryLabel = getText('profile.menu.topicHistory', '主題發起紀錄');
  const tokenHistoryLabel = getText('profile.menu.tokenHistory', '代幣使用紀錄');
  const settingsSectionLabel = getText('profile.section.settings', '設定');
  const languageLabel = getText('profile.settings.language', '語言與地區');
  const emailLabel = getText('profile.settings.email', '電子郵件');
  const emailNotSet = getText('profile.settings.emailNotSet', '未設定');
  const notificationsLabel = getText('profile.settings.notifications', '通知設定');
  const termsLabel = getText('profile.menu.terms', '使用者條款');
  const privacyLabel = getText('profile.menu.privacy', '隱私權政策');
  const contactLabel = getText('profile.menu.contact', '連絡我們');
  const notificationsMenuLabel = getText('profile.menu.notifications', '通知與公告');
  const logoutLabel = getText('profile.button.logout', '登出');
  const reportIssueLabel = getText('profile.button.reportIssue', '回報問題或建議');
  const languageOptions = {
    zh: getText('profile.language.zh', '中文'),
    en: getText('profile.language.en', 'English'),
    ja: getText('profile.language.ja', '日本語'),
  };

  const reviewDialogTitle = getText('profile.confirm.nameReviewTitle', '敏感字確認');
  const reviewDialogTemplate = getText(
    'profile.confirm.nameReview',
    '名稱包含敏感字詞（{{keyword}}），管理員可能會強制更名。仍要使用這個名稱嗎？'
  );
  const reviewDialogMessage = reviewDialogTemplate.replace('{{keyword}}', pendingReviewKeyword || '');
  const reviewDialogCancelText = getText('common.button.cancel', '取消');
  const reviewDialogConfirmText = getText('common.button.confirm', '確認');

  return (
    <>
      <AlertDialog open={reviewDialogOpen} onOpenChange={(open) => {
        if (!open) {
          handleReviewCancel();
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{reviewDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{reviewDialogMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleReviewCancel} disabled={isUpdatingProfile}>
              {reviewDialogCancelText}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleReviewConfirm} disabled={isUpdatingProfile}>
              {reviewDialogConfirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen bg-background pb-20">
        <LoadingBubble
          isLoading={isUpdatingProfile}
          textKey="loading.profile_update"
          defaultText="正在更新個人資料..."
        />
        {/* Header */}
        <header className="bg-gradient-primary shadow-lg">
          <div className="max-w-screen-xl mx-auto px-4 py-8">
            <div className="flex flex-col items-center gap-4">

              <div className="text-center">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={tempNickname}
                      onChange={(e) => setTempNickname(e.target.value)}
                      className="w-40 h-8 text-center bg-primary-foreground/20 border-primary-foreground/40 text-primary-foreground"
                      maxLength={20}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                      onClick={handleSaveName}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                      onClick={handleCancelEdit}
                    >
                      ✕
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-primary-foreground">
                      {nickname}
                    </h1>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                      onClick={() => {
                        setIsEditingName(true);
                        setTempNickname(nickname);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <button
                onClick={() => navigate('/recharge')}
                className="flex items-center gap-2 bg-primary-foreground/20 backdrop-blur-sm px-6 py-3 rounded-full hover:bg-primary-foreground/30 transition-colors cursor-pointer"
              >
                <Coins className="w-6 h-6 text-accent" />
                <span className="font-bold text-primary-foreground text-xl">
                  {userStats.tokens.toLocaleString()}
                </span>
                <span className="text-primary-foreground/80 text-sm">{tokensLabel}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Stats */}
        <div className="max-w-screen-xl mx-auto px-4 -mt-4">
          <Card className="shadow-glow">
            <CardContent className="p-5">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-1">
                    {formatCompactNumber(userStats.totalVotes)}
                  </div>
                  <div className="text-xs text-muted-foreground">{votesCountLabel}</div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-1">
                    {userStats.topicsCreated}
                  </div>
                  <div className="text-xs text-muted-foreground">{topicsCreatedLabel}</div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 mb-1">
                    {formatCompactNumber(stats.totalFreeVotes)}
                  </div>
                  <div className="text-xs text-muted-foreground">{freeVotesLabel}</div>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Content */}
        <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
          {/* History Section */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-muted-foreground px-2">
              {historySectionLabel}
            </h2>

            <Card>
              <CardContent className="p-0">
                <Link to="/history/votes">
                  <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <History className="w-5 h-5 text-primary" />
                      <span className="font-medium">{voteHistoryLabel}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                </Link>

                <Separator />

                <Link to="/history/topics">
                  <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-primary" />
                      <span className="font-medium">{topicHistoryLabel}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                </Link>

                <Separator />

                <Link to="/history/token-usage">
                  <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Coins className="w-5 h-5 text-accent" />
                      <span className="font-medium">{tokenHistoryLabel}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Settings Section */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-muted-foreground px-2">
              {settingsSectionLabel}
            </h2>

            <Card>
              <CardContent className="p-0">
                <div className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-primary" />
                    <Label htmlFor="language" className="font-medium cursor-pointer">
                      {languageLabel}
                    </Label>
                  </div>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh">{languageOptions.zh}</SelectItem>
                      <SelectItem value="en">{languageOptions.en}</SelectItem>
                      <SelectItem value="ja">{languageOptions.ja}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="px-5 py-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="w-5 h-5 text-primary" />
                    <Label className="font-medium">{emailLabel}</Label>
                  </div>
                  <div className="text-sm text-muted-foreground ml-8">
                    {user?.email || emailNotSet}
                  </div>
                </div>

                <Separator />

                <ChangePasswordDialog />

                <Separator />

                <div className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-primary" />
                    <Label htmlFor="notifications" className="font-medium cursor-pointer">
                      {notificationsLabel}
                    </Label>
                  </div>
                  <Switch
                    id="notifications"
                    checked={profile.notifications ?? true}
                    onCheckedChange={handleNotificationsChange}
                  />
                </div>

                <Separator />

                <Link to="/terms">
                  <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-primary" />
                      <span className="font-medium">{termsLabel}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                </Link>

                <Separator />

                <Link to="/privacy">
                  <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-primary" />
                      <span className="font-medium">{privacyLabel}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                </Link>

                <Separator />

                <Link to="/contact">
                  <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-primary" />
                      <span className="font-medium">{contactLabel}</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </button>
                </Link>

                <Separator />

                <Link to="/notifications">
                  <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Bell className="w-5 h-5 text-primary" />
                      <span className="font-medium">{notificationsMenuLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {unreadNotificationCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {unreadNotificationCount}
                        </Badge>
                      )}
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </button>
                </Link>

                <Separator />

                <DeleteAccountDialog />
              </CardContent>
            </Card>
          </div>

          {/* Logout Button */}
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5 mr-2" />
            {logoutLabel}
          </Button>

          {/* 錯誤回饋 */}
          <div className="flex justify-center mt-4">
            <ErrorFeedback triggerText={reportIssueLabel} triggerVariant="ghost" />
          </div>

          {/* Version */}
          <div className="text-center text-sm text-muted-foreground py-4">
            ChaosRegistry v1.0.0
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfilePage;
