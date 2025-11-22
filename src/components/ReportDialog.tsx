import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Flag, 
  AlertCircle, 
  Loader2, 
  ShieldAlert,
  MessageSquare,
  Heart,
  Zap,
  Scale,
  Mail,
  Link as LinkIcon,
  Ban,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

interface ReportDialogProps {
  targetType: 'topic' | 'user' | 'comment';
  targetId: string;
  targetTitle?: string;
  trigger?: React.ReactNode;
  onReportSubmitted?: () => void;
}

export const ReportDialog = ({ 
  targetType, 
  targetId, 
  targetTitle,
  trigger,
  onReportSubmitted 
}: ReportDialogProps) => {
  const { user, isAnonymous } = useAuth();
  const { language } = useLanguage();
  const { getText } = useUIText(language);

  // 檢舉類型定義（使用 UI 文字管理）
  const reportTypes = [
    { 
      value: 'hate_speech', 
      label: getText('report.type.hateSpeech', '仇恨言論'), 
      icon: Ban, 
      description: getText('report.type.hateSpeech.desc', '包含歧視、仇恨或攻擊特定群體的內容') 
    },
    { 
      value: 'sexual_content', 
      label: getText('report.type.sexualContent', '色情內容'), 
      icon: Heart, 
      description: getText('report.type.sexualContent.desc', '包含色情、裸露或性暗示的內容') 
    },
    { 
      value: 'violence', 
      label: getText('report.type.violence', '暴力內容'), 
      icon: Zap, 
      description: getText('report.type.violence.desc', '包含暴力、血腥或危險行為的內容') 
    },
    { 
      value: 'illegal', 
      label: getText('report.type.illegal', '違法內容'), 
      icon: Scale, 
      description: getText('report.type.illegal.desc', '包含非法活動或違反法律的內容') 
    },
    { 
      value: 'spam', 
      label: getText('report.type.spam', '垃圾訊息'), 
      icon: Mail, 
      description: getText('report.type.spam.desc', '重複、無意義或廣告性質的內容') 
    },
    { 
      value: 'phishing', 
      label: getText('report.type.phishing', '釣魚詐騙'), 
      icon: LinkIcon, 
      description: getText('report.type.phishing.desc', '試圖詐騙或竊取個人資訊的內容') 
    },
    { 
      value: 'misinformation', 
      label: getText('report.type.misinformation', '虛假訊息'), 
      icon: AlertCircle, 
      description: getText('report.type.misinformation.desc', '故意傳播錯誤或誤導性的資訊') 
    },
    { 
      value: 'harassment', 
      label: getText('report.type.harassment', '騷擾'), 
      icon: ShieldAlert, 
      description: getText('report.type.harassment.desc', '針對性的騷擾、欺凌或威脅') 
    },
    { 
      value: 'other', 
      label: getText('report.type.other', '其他'), 
      icon: Info, 
      description: getText('report.type.other.desc', '其他違反社群規範的內容') 
    },
  ];
  const [open, setOpen] = useState(false);
  const [reportType, setReportType] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setReportType(null);
    setReason("");
    setDetails("");
    setIsSubmitting(false);
  }, []);

  const handleDialogOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
  }, []);

  const handleReportTypeGroupChange = useCallback((value: string) => {
    setReportType(value);
  }, []);

  const isSubmitDisabled = useMemo(() => isSubmitting, [isSubmitting]);
  const previousOpenRef = useRef(open);

  useEffect(() => {
    if (previousOpenRef.current && !open) {
      resetForm();
    }
    previousOpenRef.current = open;
  }, [open, resetForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reportType) {
      toast.error(getText('report.error.selectType', '請選擇檢舉類型'));
      return;
    }

    if (!reason.trim()) {
      toast.error(getText('report.error.fillReason', '請填寫檢舉原因'));
      return;
    }

    if (reason.length > 500) {
      toast.error(getText('report.error.reasonTooLong', '檢舉原因不能超過500字'));
      return;
    }

    if (details.length > 2000) {
      toast.error(getText('report.error.detailsTooLong', '詳細說明不能超過2000字'));
      return;
    }

    setIsSubmitting(true);

    try {
      const reportData = {
        reporter_id: user?.id || null,
        target_type: targetType,
        target_id: targetId || null,
        report_type: reportType,
        reason: reason.trim(),
        details: details.trim() || null,
        status: 'pending'
      };

      const { error } = await supabase
        .from('reports')
        .insert(reportData);

      if (error) {
        // Check for duplicate report
        if (error.code === '23505') {
          toast.error(getText('report.error.duplicate', '您已經檢舉過此內容'));
          return;
        }
        throw error;
      }

      // Log audit
      if (user) {
        await supabase
          .from('audit_logs')
          .insert({
            user_id: user.id,
            action: 'create_report',
            resource_type: targetType,
            resource_id: targetId || null,
            metadata: { 
              report_type: reportType,
              reason: reason.substring(0, 100)
            }
          });
      }

      toast.success(getText('report.success.submitted', '檢舉已提交'), {
        description: getText('report.success.description', '我們會盡快審核您的檢舉，感謝您的協助')
      });

      // Reset form
      resetForm();
      setOpen(false);

      onReportSubmitted?.();
    } catch (error: any) {
      console.error('Error submitting report:', error);
      toast.error(getText('report.error.submitFailed', '提交檢舉失敗，請稍後再試'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTargetTypeLabel = () => {
    switch (targetType) {
      case 'topic':
        return getText('report.target.topic', '主題');
      case 'user':
        return getText('report.target.user', '用戶');
      case 'comment':
        return getText('report.target.comment', '留言');
      default:
        return getText('report.target.content', '內容');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
            <Flag className="w-4 h-4 mr-2" />
            {getText('report.button.report', '檢舉')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-destructive" />
            {getText('report.dialog.title', '檢舉')}{getTargetTypeLabel()}
          </DialogTitle>
          <DialogDescription>
            {targetTitle && (
              <div className="mt-2 p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">{getText('report.dialog.target', '檢舉對象：')}</span>
                <span className="text-sm ml-2">{targetTitle}</span>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {getText('report.dialog.warning', '請認真填寫檢舉資訊。惡意或虛假檢舉可能導致您的帳號受到處罰。')}
            </AlertDescription>
          </Alert>

          {/* Report Type Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">{getText('report.dialog.typeLabel', '檢舉類型 *')}</Label>
            <RadioGroup
              value={reportType ?? undefined}
              onValueChange={handleReportTypeGroupChange}
            >
              <div className="grid grid-cols-1 gap-3">
                {reportTypes.map((type) => {
                  const Icon = type.icon;
                  const inputId = `report-type-${type.value}`;
                  return (
                    <Label
                      key={type.value}
                      htmlFor={inputId}
                      className={cn(
                        "flex items-start space-x-3 p-3 rounded-lg border-2 transition-all cursor-pointer",
                        reportType === type.value
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-primary/50",
                        isSubmitDisabled && "opacity-70 pointer-events-none"
                      )}
                    >
                      <RadioGroupItem
                        value={type.value}
                        id={inputId}
                        className="mt-1"
                        disabled={isSubmitDisabled}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 font-semibold mb-1">
                          <Icon className="w-4 h-4" />
                          {type.label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {type.description}
                        </div>
                      </div>
                    </Label>
                  );
                })}
              </div>
            </RadioGroup>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">{getText('report.dialog.reasonLabel', '檢舉原因 *')}</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={getText('report.dialog.reasonPlaceholder', '請簡要說明檢舉原因（必填）')}
              className="min-h-[100px]"
              maxLength={500}
              required
            />
            <div className="text-xs text-muted-foreground text-right">
              {reason.length}/500 {getText('report.dialog.characters', '字元')}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2">
            <Label htmlFor="details">{getText('report.dialog.detailsLabel', '詳細說明')}</Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={getText('report.dialog.detailsPlaceholder', '提供更多詳細資訊（選填）')}
              className="min-h-[120px]"
              maxLength={2000}
            />
            <div className="text-xs text-muted-foreground text-right">
              {details.length}/2000 {getText('report.dialog.characters', '字元')}
            </div>
          </div>

          {/* Privacy Notice */}
          <Alert>
            <MessageSquare className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {getText('report.dialog.privacy', '您的檢舉將會被保密處理。我們會仔細審核每一個檢舉，並採取適當的措施。')}
              {!isAnonymous && getText('report.dialog.privacy.viewHistory', '您可以在個人中心查看檢舉記錄。')}
            </AlertDescription>
          </Alert>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              {getText('common.button.cancel', '取消')}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {getText('report.button.submitting', '提交中...')}
                </>
              ) : (
                <>
                  <Flag className="w-4 h-4 mr-2" />
                  {getText('report.button.submit', '提交檢舉')}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
