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
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { cn } from "@/lib/utils";

interface DeleteTopicDialogProps {
  topicId: string;
  topicTitle: string;
  /**
   * 刪除成功後的回調
   */
  onDeleteSuccess?: () => void;
  
  /**
   * 是否在刪除後導航到首頁
   * @default true
   */
  navigateAfterDelete?: boolean;
  triggerClassName?: string;
}

const CONFIRM_TEXT = 'delete';

/**
 * 主題刪除對話框
 * 
 * 規則：
 * - 需要輸入 "delete" 確認
 * - 刪除不會歸還代幣
 * - 刪除後無法恢復
 */
export const DeleteTopicDialog = ({
  topicId,
  topicTitle,
  onDeleteSuccess,
  navigateAfterDelete = true,
  triggerClassName
}: DeleteTopicDialogProps) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isConfirmValid = confirmText === CONFIRM_TEXT;

  const handleDelete = async () => {
    if (!isConfirmValid) {
      toast.error(getText('deleteTopic.error.confirmText', `請輸入 "${CONFIRM_TEXT}" 確認刪除`));
      return;
    }

    setSubmitting(true);

    try {
      // 刪除主題
      const { error } = await supabase
        .from('topics')
        .delete()
        .eq('id', topicId);

      if (error) throw error;

      toast.success(getText('deleteTopic.success.deleted', '主題已刪除'), {
        description: getText('deleteTopic.success.irreversible', '此操作無法撤銷')
      });

      setOpen(false);
      
      if (onDeleteSuccess) {
        onDeleteSuccess();
      }

      // 導航到首頁或主題歷史頁
      if (navigateAfterDelete) {
        setTimeout(() => {
          navigate('/history/topics');
        }, 500);
      }
    } catch (error: any) {
      console.error('Delete topic error:', error);
      
      // 處理特定錯誤
      if (error.message?.includes('foreign key')) {
        toast.error(getText('deleteTopic.error.cannotDelete', '無法刪除'), {
          description: getText('deleteTopic.error.hasVotes', '此主題有相關投票記錄')
        });
      } else {
        toast.error(getText('deleteTopic.error.deleteFailed', '刪除主題失敗'), {
          description: error.message
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // 重置確認文字
      setConfirmText('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          className={cn(triggerClassName)}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          {getText('deleteTopic.button.delete', '刪除主題')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            {getText('deleteTopic.dialog.title', '刪除主題')}
          </DialogTitle>
          <DialogDescription>
            {getText('deleteTopic.dialog.description', '此操作無法撤銷，請謹慎操作')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 警告提示 */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{getText('deleteTopic.dialog.warning.title', '重要提醒')}</AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              <p>{getText('deleteTopic.dialog.warning.afterDelete', '刪除主題後：')}</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li><strong>{getText('deleteTopic.dialog.warning.cannotRestore', '無法恢復')}</strong>{getText('deleteTopic.dialog.warning.cannotRestoreDesc', '主題內容')}</li>
                <li><strong>{getText('deleteTopic.dialog.warning.noRefund', '不會歸還')}</strong>{getText('deleteTopic.dialog.warning.noRefundDesc', '發布時消耗的代幣')}</li>
                <li><strong>{getText('deleteTopic.dialog.warning.votesRemain', '已投票的用戶')}</strong>{getText('deleteTopic.dialog.warning.votesRemainDesc', '仍可查看投票記錄')}</li>
                <li><strong>{getText('deleteTopic.dialog.warning.removed', '主題將從首頁')}</strong>{getText('deleteTopic.dialog.warning.removedDesc', '永久移除')}</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* 主題資訊 */}
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm font-medium mb-2">{getText('deleteTopic.dialog.targetLabel', '即將刪除：')}</p>
            <p className="text-sm text-foreground font-semibold">
              {topicTitle}
            </p>
          </div>

          {/* 確認輸入 */}
          <div className="space-y-2">
            <Label htmlFor="confirm-delete">
              {getText('deleteTopic.dialog.confirmLabel', '請輸入 {{confirmText}} 確認刪除')
                .replace('{{confirmText}}', CONFIRM_TEXT)}
            </Label>
            <Input
              id="confirm-delete"
              placeholder={getText('deleteTopic.dialog.confirmPlaceholder', `輸入 "${CONFIRM_TEXT}" 確認`)}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className={confirmText && !isConfirmValid ? 'border-destructive' : ''}
            />
            {confirmText && !isConfirmValid && (
              <p className="text-xs text-destructive">
                {getText('deleteTopic.error.confirmInvalid', '確認文字不正確')}
              </p>
            )}
          </div>
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
            variant="destructive"
            onClick={handleDelete}
            disabled={submitting || !isConfirmValid}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {getText('deleteTopic.button.deleting', '刪除中...')}
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                {getText('deleteTopic.button.confirm', '確認刪除')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteTopicDialog;


