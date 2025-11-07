import { useState } from "react";
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

interface ReportDialogProps {
  targetType: 'topic' | 'user' | 'comment';
  targetId: string;
  targetTitle?: string;
  trigger?: React.ReactNode;
  onReportSubmitted?: () => void;
}

const reportTypes = [
  { value: 'hate_speech', label: '仇恨言論', icon: Ban, description: '包含歧視、仇恨或攻擊特定群體的內容' },
  { value: 'sexual_content', label: '色情內容', icon: Heart, description: '包含色情、裸露或性暗示的內容' },
  { value: 'violence', label: '暴力內容', icon: Zap, description: '包含暴力、血腥或危險行為的內容' },
  { value: 'illegal', label: '違法內容', icon: Scale, description: '包含非法活動或違反法律的內容' },
  { value: 'spam', label: '垃圾訊息', icon: Mail, description: '重複、無意義或廣告性質的內容' },
  { value: 'phishing', label: '釣魚詐騙', icon: LinkIcon, description: '試圖詐騙或竊取個人資訊的內容' },
  { value: 'misinformation', label: '虛假訊息', icon: AlertCircle, description: '故意傳播錯誤或誤導性的資訊' },
  { value: 'harassment', label: '騷擾', icon: ShieldAlert, description: '針對性的騷擾、欺凌或威脅' },
  { value: 'other', label: '其他', icon: Info, description: '其他違反社群規範的內容' },
];

export const ReportDialog = ({ 
  targetType, 
  targetId, 
  targetTitle,
  trigger,
  onReportSubmitted 
}: ReportDialogProps) => {
  const { user, isAnonymous } = useAuth();
  const [open, setOpen] = useState(false);
  const [reportType, setReportType] = useState("");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reportType) {
      toast.error('請選擇檢舉類型');
      return;
    }

    if (!reason.trim()) {
      toast.error('請填寫檢舉原因');
      return;
    }

    if (reason.length > 500) {
      toast.error('檢舉原因不能超過500字');
      return;
    }

    if (details.length > 2000) {
      toast.error('詳細說明不能超過2000字');
      return;
    }

    // If anonymous, require email
    if (isAnonymous && !email.trim()) {
      toast.error('匿名檢舉需要提供電子郵件以便後續聯繫');
      return;
    }

    setIsSubmitting(true);

    try {
      const reportData = {
        reporter_id: user?.id || null,
        reporter_email: isAnonymous ? email.trim() : (user?.email || null),
        target_type: targetType,
        target_id: targetId,
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
          toast.error('您已經檢舉過此內容');
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
            resource_id: targetId,
            metadata: { 
              report_type: reportType,
              reason: reason.substring(0, 100)
            }
          });
      }

      toast.success('檢舉已提交', {
        description: '我們會盡快審核您的檢舉，感謝您的協助'
      });

      // Reset form
      setReportType("");
      setReason("");
      setDetails("");
      setEmail("");
      setOpen(false);

      onReportSubmitted?.();
    } catch (error: any) {
      console.error('Error submitting report:', error);
      toast.error('提交檢舉失敗，請稍後再試');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTargetTypeLabel = () => {
    switch (targetType) {
      case 'topic':
        return '主題';
      case 'user':
        return '用戶';
      case 'comment':
        return '留言';
      default:
        return '內容';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
            <Flag className="w-4 h-4 mr-2" />
            檢舉
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-destructive" />
            檢舉{getTargetTypeLabel()}
          </DialogTitle>
          <DialogDescription>
            {targetTitle && (
              <div className="mt-2 p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium">檢舉對象：</span>
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
              請認真填寫檢舉資訊。惡意或虛假檢舉可能導致您的帳號受到處罰。
            </AlertDescription>
          </Alert>

          {/* Report Type Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">檢舉類型 *</Label>
            <RadioGroup value={reportType} onValueChange={setReportType}>
              <div className="grid grid-cols-1 gap-3">
                {reportTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <div
                      key={type.value}
                      className={cn(
                        "flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                        reportType === type.value
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-primary/50"
                      )}
                      onClick={() => setReportType(type.value)}
                    >
                      <RadioGroupItem value={type.value} id={type.value} className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor={type.value} className="cursor-pointer">
                          <div className="flex items-center gap-2 font-semibold mb-1">
                            <Icon className="w-4 h-4" />
                            {type.label}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {type.description}
                          </div>
                        </Label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </RadioGroup>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">檢舉原因 *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="請簡要說明檢舉原因（必填）"
              className="min-h-[100px]"
              maxLength={500}
              required
            />
            <div className="text-xs text-muted-foreground text-right">
              {reason.length}/500 字元
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2">
            <Label htmlFor="details">詳細說明</Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="提供更多詳細資訊（選填）"
              className="min-h-[120px]"
              maxLength={2000}
            />
            <div className="text-xs text-muted-foreground text-right">
              {details.length}/2000 字元
            </div>
          </div>

          {/* Email for anonymous users */}
          {isAnonymous && (
            <div className="space-y-2">
              <Label htmlFor="email">聯絡郵箱 *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
              <div className="text-xs text-muted-foreground">
                用於後續聯絡，不會公開顯示
              </div>
            </div>
          )}

          {/* Privacy Notice */}
          <Alert>
            <MessageSquare className="h-4 w-4" />
            <AlertDescription className="text-xs">
              您的檢舉將會被保密處理。我們會仔細審核每一個檢舉，並採取適當的措施。
              {!isAnonymous && "您可以在個人中心查看檢舉記錄。"}
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
              取消
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Flag className="w-4 h-4 mr-2" />
                  提交檢舉
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
