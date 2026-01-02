import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Loader2, AlertCircle, CheckCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

export const ChangePasswordDialog = () => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // 密碼驗證 schema（動態生成，使用 UI 文字）
  const passwordSchema = z.object({
    newPassword: z.string()
      .min(8, getText('changePassword.validation.minLength', '密碼至少需要 8 個字元'))
      .regex(/[A-Z]/, getText('changePassword.validation.uppercase', '密碼需要包含至少一個大寫字母'))
      .regex(/[a-z]/, getText('changePassword.validation.lowercase', '密碼需要包含至少一個小寫字母'))
      .regex(/[0-9]/, getText('changePassword.validation.number', '密碼需要包含至少一個數字')),
    confirmPassword: z.string()
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: getText('changePassword.validation.mismatch', '兩次輸入的密碼不一致'),
    path: ["confirmPassword"],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    // 驗證密碼
    try {
      passwordSchema.parse({ newPassword, confirmPassword });
    } catch (error: any) {
      const validationErrors = error.errors?.map((err: any) => err.message) || [getText('changePassword.error.validationFailed', '驗證失敗')];
      setErrors(validationErrors);
      return;
    }

    setIsUpdating(true);

    try {
      // 使用 Supabase 更新密碼
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success(getText('changePassword.success.updated', '密碼更新成功'), {
        description: getText('changePassword.success.description', '請使用新密碼登入')
      });

      // 重置表單
      setNewPassword("");
      setConfirmPassword("");
      setOpen(false);
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast.error(getText('changePassword.error.updateFailed', '密碼更新失敗'), {
        description: error.message || getText('changePassword.error.tryLater', '請稍後再試')
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setNewPassword("");
    setConfirmPassword("");
    setErrors([]);
    setOpen(false);
  };

  // 密碼強度檢查
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength >= 5) return { label: getText('changePassword.strength.strong', '強'), color: 'text-green-600', width: '100%' };
    if (strength >= 3) return { label: getText('changePassword.strength.medium', '中'), color: 'text-yellow-600', width: '60%' };
    return { label: getText('changePassword.strength.weak', '弱'), color: 'text-red-600', width: '30%' };
  };

  const passwordStrength = newPassword ? getPasswordStrength(newPassword) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-primary" />
            <span className="font-medium">{getText('changePassword.button.change', '修改密碼')}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            {getText('changePassword.dialog.title', '修改密碼')}
          </DialogTitle>
          <DialogDescription>
            {getText('changePassword.dialog.description', '設置一個強密碼來保護您的帳號安全')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 錯誤提示 */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* 新密碼 */}
          <div className="space-y-2">
            <Label htmlFor="newPassword">{getText('changePassword.form.newPasswordLabel', '新密碼')}</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={getText('changePassword.form.newPasswordPlaceholder', '輸入新密碼')}
              required
              disabled={isUpdating}
            />

            {/* 密碼強度指示 */}
            {passwordStrength && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{getText('changePassword.form.strengthLabel', '密碼強度')}</span>
                  <span className={passwordStrength.color}>{passwordStrength.label}</span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${passwordStrength.color.replace('text-', 'bg-')} transition-all`}
                    style={{ width: passwordStrength.width }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 確認密碼 */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{getText('changePassword.form.confirmPasswordLabel', '確認新密碼')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={getText('changePassword.form.confirmPasswordPlaceholder', '再次輸入新密碼')}
              required
              disabled={isUpdating}
            />
            {confirmPassword && newPassword && (
              <div className="flex items-center gap-1 text-xs">
                {newPassword === confirmPassword ? (
                  <>
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="text-green-600">{getText('changePassword.form.match', '密碼一致')}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-red-600" />
                    <span className="text-red-600">{getText('changePassword.form.mismatch', '密碼不一致')}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 密碼要求提示 */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {getText('changePassword.form.requirements', '密碼要求：至少 8 個字元，包含大小寫字母和數字')}
            </AlertDescription>
          </Alert>

          <DialogFooter className="flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isUpdating}
              className="flex-1"
            >
              {getText('common.button.cancel', '取消')}
            </Button>
            <Button
              type="submit"
              disabled={isUpdating || !newPassword || !confirmPassword}
              className="flex-1"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {getText('changePassword.button.updating', '更新中...')}
                </>
              ) : (
                getText('changePassword.button.confirm', '確認修改')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

