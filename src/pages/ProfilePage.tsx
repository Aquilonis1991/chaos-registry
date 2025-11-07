import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { useUserStats } from "@/hooks/useUserStats";
import { supabase } from "@/integrations/supabase/client";
import { profileUpdateSchema } from "@/lib/validationSchemas";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { ErrorFeedback } from "@/components/ErrorFeedback";
import { validateNickname, getBannedWordErrorMessage } from "@/lib/bannedWords";

const ProfilePage = () => {
  const { profile, loading: profileLoading } = useProfile();
  const { user, signOut } = useAuth();
  const { stats, loading: statsLoading } = useUserStats(user?.id);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempNickname, setTempNickname] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("🔥");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const { language, setLanguage, t } = useLanguage();

  // 獲取未讀通知數量
  useEffect(() => {
    if (user?.id) {
      const fetchUnreadCount = async () => {
        try {
          const { data, error } = await supabase.rpc('get_unread_notification_count');
          if (!error && data !== null) {
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
  }, [user?.id]);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };
  
  const handleSaveName = async () => {
    if (!profile) return;

    const trimmedNickname = tempNickname.trim();
    if (!trimmedNickname) {
      toast.error('名稱不能為空白');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      // 檢查用戶是否被限制修改名稱
      const { checkUserRestriction } = await import("@/lib/userRestrictions");
      const restriction = await checkUserRestriction(profile.id, 'modify_name');
      if (restriction.restricted) {
        toast.error(restriction.reason || '修改名稱功能已被暫停');
        setIsUpdatingProfile(false);
        return;
      }

      // Validate with Zod
      profileUpdateSchema.parse({
        nickname: trimmedNickname,
        avatar: selectedAvatar,
        notifications
      });

      // 檢查禁字
      const bannedCheck = await validateNickname(trimmedNickname);
      if (bannedCheck.found) {
        if (bannedCheck.action === 'block') {
          toast.error(getBannedWordErrorMessage(bannedCheck), {
            description: `發現禁字：${bannedCheck.keyword}（級別：${bannedCheck.level}）`
          });
          return;
        } else if (bannedCheck.action === 'review') {
          toast.warning('名稱需要人工審核', {
            description: `發現敏感字詞：${bannedCheck.keyword}`
          });
        }
      }

      // 檢查是否與現有用戶重複（忽略大小寫）
      const { data: existingNickname, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .ilike('nickname', trimmedNickname)
        .neq('id', profile.id)
        .limit(1)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingNickname) {
        toast.error('名稱已被其他用戶使用，請選擇不同的名稱');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ nickname: trimmedNickname })
        .eq('id', profile.id);

      if (error) throw error;

      setTempNickname(trimmedNickname);
      setIsEditingName(false);
      toast.success(t("profile.nameUpdated"));
    } catch (error: any) {
      if (error.errors) {
        toast.error(error.errors[0]?.message || "更新失敗");
      } else {
        toast.error("更新失敗");
      }
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

  const handleAvatarSelect = async (avatar: string) => {
    if (!profile) return;
    
    setIsUpdatingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar })
        .eq('id', profile.id);

      if (error) throw error;

      setSelectedAvatar(avatar);
      setShowAvatarPicker(false);
      toast.success(t("profile.avatarUpdated"));
    } catch (error) {
      toast.error("更新失敗");
    } finally {
      setIsUpdatingProfile(false);
    }
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
      toast.success("設定已更新");
    } catch (error) {
      toast.error("更新失敗");
    }
  };

  if (profileLoading || !profile) {
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

  const avatarOptions = ["🔥", "😎", "🎮", "🎨", "🎵", "⚡", "🌟", "💎", "🚀", "🎯", "🦄", "🐱", "🐶", "🐼", "🦊", "🦁"];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-gradient-primary shadow-lg">
        <div className="max-w-screen-xl mx-auto px-4 py-8">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                className="w-20 h-20 rounded-full bg-gradient-accent flex items-center justify-center text-4xl shadow-glow hover:scale-105 transition-transform cursor-pointer relative"
              >
                {selectedAvatar}
                <div className="absolute bottom-0 right-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <Edit className="w-3 h-3 text-primary-foreground" />
                </div>
              </button>
              
              {showAvatarPicker && (
                <Card className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 w-64 shadow-glow">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-4 gap-2">
                      {avatarOptions.map((avatar) => (
                        <button
                          key={avatar}
                          onClick={() => handleAvatarSelect(avatar)}
                          className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl hover:bg-muted transition-colors ${
                            selectedAvatar === avatar ? 'bg-primary text-primary-foreground' : ''
                          }`}
                        >
                          {avatar}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            
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
              <span className="text-primary-foreground/80 text-sm">代幣</span>
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
                  {userStats.totalVotes}
                </div>
                <div className="text-xs text-muted-foreground">投票次數</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-primary mb-1">
                  {userStats.topicsCreated}
                </div>
                <div className="text-xs text-muted-foreground">發起主題</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {stats.totalFreeVotes}
                </div>
                <div className="text-xs text-muted-foreground">免費票</div>
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
            歷史紀錄
          </h2>
          
          <Card>
            <CardContent className="p-0">
              <Link to="/history/votes">
                <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <History className="w-5 h-5 text-primary" />
                    <span className="font-medium">投票紀錄</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              </Link>
              
              <Separator />
              
              <Link to="/history/topics">
                <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="font-medium">主題發起紀錄</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              </Link>
              
              <Separator />
              
              <Link to="/history/token-usage">
                <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Coins className="w-5 h-5 text-accent" />
                    <span className="font-medium">代幣使用紀錄</span>
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
            設定
          </h2>
          
          <Card>
            <CardContent className="p-0">
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-primary" />
                  <Label htmlFor="language" className="font-medium cursor-pointer">
                    語言與地區
                  </Label>
                </div>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh">中文</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ja">日本語</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
              
              <div className="px-5 py-4">
                <div className="flex items-center gap-3 mb-2">
                  <Mail className="w-5 h-5 text-primary" />
                  <Label className="font-medium">電子郵件</Label>
                </div>
                <div className="text-sm text-muted-foreground ml-8">
                  {user?.email || '未設定'}
                </div>
              </div>
              
              <Separator />
              
              <ChangePasswordDialog />
              
              <Separator />
              
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-primary" />
                  <Label htmlFor="notifications" className="font-medium cursor-pointer">
                    通知設定
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
                    <span className="font-medium">使用者條款</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              </Link>
              
              <Separator />
              
              <Link to="/privacy">
                <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-primary" />
                    <span className="font-medium">隱私權政策</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              </Link>
              
              <Separator />
              
              <Link to="/contact">
                <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-primary" />
                    <span className="font-medium">連絡我們</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
              </Link>
              
              <Separator />
              
              <Link to="/notifications">
                <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-primary" />
                    <span className="font-medium">通知與公告</span>
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
          登出
        </Button>

        {/* 錯誤回饋 */}
        <div className="flex justify-center mt-4">
          <ErrorFeedback triggerText="回報問題或建議" triggerVariant="ghost" />
        </div>

        {/* Version */}
        <div className="text-center text-sm text-muted-foreground py-4">
          VoteChaos v1.0.0
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
