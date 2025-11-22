import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { Bug, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ErrorLogger, getLocalErrorLogs } from "@/lib/errorLogger";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

interface ErrorFeedbackProps {
  /**
   * 預填的錯誤資訊
   */
  error?: Error;
  
  /**
   * 觸發按鈕文字
   */
  triggerText?: string;
  
  /**
   * 觸發按鈕變體
   */
  triggerVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

/**
 * 錯誤回饋組件
 * 允許用戶回報 Bug 和錯誤
 */
export const ErrorFeedback = ({ 
  error, 
  triggerText,
  triggerVariant = "outline"
}: ErrorFeedbackProps) => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(error?.name || '');
  const [description, setDescription] = useState(error?.message || '');
  const [steps, setSteps] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 使用 UI 文字管理或傳入的 triggerText
  const displayTriggerText = triggerText || getText('errorFeedback.button.report', '回報問題');

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error(getText('errorFeedback.error.fillRequired', '請填寫標題和描述'));
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 收集錯誤資訊
      const errorInfo = {
        title: title.trim(),
        description: description.trim(),
        steps: steps.trim(),
        email: email.trim(),
        user_id: user?.id,
        error_stack: error?.stack,
        client_info: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          platform: navigator.platform,
          language: navigator.language,
        },
        // 附加最近的錯誤日誌
        recent_errors: getLocalErrorLogs().slice(-5),
      };

      // 建立聯絡訊息，讓客服後台可追蹤
      if (user?.id) {
        const contentSections = [
          `${getText('errorFeedback.form.descriptionLabel', '問題描述 *')}\n${description.trim()}`,
          steps.trim()
            ? `${getText('errorFeedback.form.stepsLabel', '重現步驟（選填）')}\n${steps.trim()}`
            : null,
          email.trim()
            ? `${getText('errorFeedback.form.emailLabel', '聯繫郵箱（選填）')}\n${email.trim()}`
            : null,
          error?.stack ? `Stack Trace:\n${error.stack}` : null,
          errorInfo.recent_errors?.length
            ? `Recent Errors:\n${JSON.stringify(errorInfo.recent_errors, null, 2)}`
            : null,
          `Client Info:\n${JSON.stringify(errorInfo.client_info, null, 2)}`,
        ].filter(Boolean);

        const { error: contactError } = await supabase.from('contact_messages').insert({
          user_id: user.id,
          category: 'bug',
          title: title.trim().slice(0, 100),
          content: contentSections.join('\n\n'),
        });

        if (contactError) {
          throw contactError;
        }
      }

      // 記錄到審計日誌
      const { error: logError } = await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'bug_report',
        resource_type: 'feedback',
        resource_id: user?.id || null,
        details: errorInfo,
        metadata: errorInfo,
        user_agent: navigator.userAgent,
      });

      if (logError) {
        throw logError;
      }

      // 記錄錯誤
      ErrorLogger.info('User submitted bug report', { 
        title, 
        hasEmail: !!email 
      });

      toast.success(getText('errorFeedback.success.submitted', '問題已回報，感謝您的反饋！'), {
        description: getText('errorFeedback.success.description', '我們會盡快處理')
      });

      // 重置表單
      setTitle('');
      setDescription('');
      setSteps('');
      setEmail('');
      setOpen(false);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast.error(getText('errorFeedback.error.submitFailed', '回報失敗，請稍後再試'));
      
      // 記錄錯誤
      ErrorLogger.error(error, { action: 'submit_bug_report' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm">
          <Bug className="w-4 h-4 mr-2" />
          {displayTriggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{getText('errorFeedback.dialog.title', '回報問題')}</DialogTitle>
          <DialogDescription>
            {getText('errorFeedback.dialog.description', '請詳細描述您遇到的問題，我們會盡快處理')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 標題 */}
          <div className="space-y-2">
            <Label htmlFor="error-title">{getText('errorFeedback.form.titleLabel', '問題標題 *')}</Label>
            <Input
              id="error-title"
              placeholder={getText('errorFeedback.form.titlePlaceholder', '簡短描述問題，例：無法投票')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* 描述 */}
          <div className="space-y-2">
            <Label htmlFor="error-description">{getText('errorFeedback.form.descriptionLabel', '問題描述 *')}</Label>
            <Textarea
              id="error-description"
              placeholder={getText('errorFeedback.form.descriptionPlaceholder', '詳細描述發生了什麼問題...')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/500
            </p>
          </div>

          {/* 重現步驟 */}
          <div className="space-y-2">
            <Label htmlFor="error-steps">{getText('errorFeedback.form.stepsLabel', '重現步驟（選填）')}</Label>
            <Textarea
              id="error-steps"
              placeholder={getText('errorFeedback.form.stepsPlaceholder', '如何重現這個問題？例：1. 進入主題詳情頁 2. 點擊投票按鈕 3. ...')}
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              rows={3}
              maxLength={300}
            />
          </div>

          {/* Email（選填）*/}
          <div className="space-y-2">
            <Label htmlFor="error-email">{getText('errorFeedback.form.emailLabel', '聯繫郵箱（選填）')}</Label>
            <Input
              id="error-email"
              type="email"
              placeholder={getText('errorFeedback.form.emailPlaceholder', '如需回覆請提供郵箱')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* 錯誤資訊預覽（如果有）*/}
          {error && (
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xs font-medium mb-1">{getText('errorFeedback.form.errorInfoLabel', '錯誤資訊（自動附加）：')}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {error.message}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            {getText('common.button.cancel', '取消')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !description.trim()}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {getText('errorFeedback.button.submitting', '提交中...')}
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                {getText('errorFeedback.button.submit', '提交回報')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ErrorFeedback;


