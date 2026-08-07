import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Edit, Loader2, Plus, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { validateTopicContent, getBannedWordErrorMessage } from "@/lib/bannedWords";
import { useModerationGate } from "@/hooks/useModerationGate";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

interface EditTopicDialogProps {
  topicId: string;
  currentTitle: string;
  currentDescription?: string;
  currentOptions: string[];
  createdAt: string;
  onEditSuccess?: () => void;
  triggerClassName?: string;
}

/**
 * 主題編輯對話框
 * 
 * 規則：
 * - 僅可在發布後 1 小時內編輯
 * - 可編輯：標題、說明、新增選項
 * - 不可編輯：現有選項
 */
export const EditTopicDialog = ({
  topicId,
  currentTitle,
  currentDescription = '',
  currentOptions,
  createdAt,
  onEditSuccess,
  triggerClassName
}: EditTopicDialogProps) => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(currentTitle);
  const [description, setDescription] = useState(currentDescription);
  const [newOptions, setNewOptions] = useState<string[]>([]);
  const [newOptionInput, setNewOptionInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const moderation = useModerationGate();
  const [pendingMaskTarget, setPendingMaskTarget] = useState<{
    blockType?: 'title' | 'description' | 'option' | 'tag' | 'category';
    optionIndex?: number;
    value: string;
  } | null>(null);

  // 計算是否還能編輯（發布後 60 分鐘內）
  // 注意：不要用 differenceInHours（只回傳整數小時，導致剩餘分鐘不會遞減）
  const [nowMs, setNowMs] = useState(() => Date.now());
  const createdMs = new Date(createdAt).getTime();
  const elapsedMs = Math.max(0, nowMs - createdMs);
  const editWindowMs = 60 * 60 * 1000;
  const remainingMs = Math.max(0, editWindowMs - elapsedMs);
  const canEdit = remainingMs > 0;
  const remainingTime = canEdit ? Math.ceil(remainingMs / (60 * 1000)) : 0;

  useEffect(() => {
    if (open) {
      // 重置狀態
      setTitle(currentTitle);
      setDescription(currentDescription);
      setNewOptions([]);
      setNewOptionInput('');
    }
  }, [open, currentTitle, currentDescription]);

  // 倒數更新（對話框開啟時才更新，避免不必要的 render）
  useEffect(() => {
    if (!open) return;
    // 先立刻刷新一次，確保剛開啟時顯示正確
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 10_000);
    return () => clearInterval(t);
  }, [open]);

  const handleAddOption = () => {
    const trimmed = newOptionInput.trim();
    
    if (!trimmed) {
      toast.error(getText('editTopic.error.optionEmpty', '選項不能為空'));
      return;
    }

    // 檢查是否與現有選項重複
    const allOptions = [...currentOptions, ...newOptions];
    if (allOptions.includes(trimmed)) {
      toast.error(getText('editTopic.error.optionExists', '選項已存在'));
      return;
    }

    // 檢查單一選項字元上限（50 字元）
    if (trimmed.length > 50) {
      toast.error(getText('editTopic.error.optionMaxLength', '單一選項不能超過 50 個字元'));
      return;
    }

    // 檢查總選項數（最多 6 個）
    if (currentOptions.length + newOptions.length >= 6) {
      toast.error(getText('editTopic.error.maxOptions', '最多只能有 6 個選項'));
      return;
    }

    setNewOptions([...newOptions, trimmed]);
    setNewOptionInput('');
  };

  const handleRemoveNewOption = (index: number) => {
    setNewOptions(newOptions.filter((_, i) => i !== index));
  };

  // 實際送出更新（禁字檢查通過、或使用者確認送審後才會呼叫）
  const performUpdate = async () => {
    const trimmedTitle = title.trim();

    // 檢查是否有變更
    const hasChanges =
      trimmedTitle !== currentTitle ||
      description.trim() !== currentDescription ||
      newOptions.length > 0;

    if (!hasChanges) {
      toast.info(getText('editTopic.info.noChanges', '沒有任何變更'));
      return;
    }

    setSubmitting(true);

    try {
      // 準備更新資料
      const updates: any = {};

      if (trimmedTitle !== currentTitle) {
        updates.title = trimmedTitle;
      }

      if (description.trim() !== currentDescription) {
        updates.description = description.trim();
      }

      // 如果有新增選項，更新 options JSONB
      if (newOptions.length > 0) {
        const { data: currentTopic, error: fetchError } = await supabase
          .from('topics')
          .select('options')
          .eq('id', topicId)
          .single();

        if (fetchError) throw fetchError;

        // 合併現有選項和新選項
        const updatedOptions = [...currentOptions, ...newOptions].map(opt => ({
          text: opt,
          votes: currentTopic.options.find((o: any) => o.text === opt)?.votes || 0
        }));

        updates.options = updatedOptions;
      }

      // 更新主題
      const { error } = await supabase
        .from('topics')
        .update(updates)
        .eq('id', topicId);

      if (error) throw error;

      const successDesc = newOptions.length > 0
        ? getText('editTopic.success.optionsAdded', '新增了 {{count}} 個選項').replace('{{count}}', newOptions.length.toString())
        : undefined;
      toast.success(getText('editTopic.success.updated', '主題已更新'), {
        description: successDesc
      });

      setOpen(false);

      if (onEditSuccess) {
        onEditSuccess();
      }
    } catch (error: any) {
      console.error('Edit topic error:', error);
      toast.error(getText('editTopic.error.updateFailed', '更新主題失敗'), {
        description: error.message
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMaskCancel = () => {
    moderation.closeMask();
    setPendingMaskTarget(null);
  };

  const handleMaskConfirm = () => {
    if (!pendingMaskTarget) {
      handleMaskCancel();
      return;
    }
    const masked = moderation.applyMask(pendingMaskTarget.value);
    if (pendingMaskTarget.blockType === 'title') {
      setTitle(masked);
    } else if (pendingMaskTarget.blockType === 'description') {
      setDescription(masked);
    } else if (pendingMaskTarget.blockType === 'option' && pendingMaskTarget.optionIndex !== undefined) {
      const idx = pendingMaskTarget.optionIndex;
      setNewOptions((prev) => prev.map((opt, i) => (i === idx ? masked : opt)));
    }
    moderation.closeMask();
    setPendingMaskTarget(null);
    toast.info(getText('editTopic.mask.applied', '已套用遮罩後文字，請確認內容後再次點擊「確認更新」'));
  };

  const handleReviewCancel = () => {
    moderation.closeReview();
  };

  const handleReviewConfirm = async () => {
    moderation.closeReview();
    await performUpdate();
  };

  const handleSubmit = async () => {
    // 驗證
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      toast.error(getText('editTopic.error.titleEmpty', '標題不能為空'));
      return;
    }

    if (trimmedTitle.length < 5) {
      toast.error(getText('editTopic.error.titleMinLength', '標題至少需要 5 個字元'));
      return;
    }

    if (trimmedTitle.length > 80) {
      toast.error(getText('editTopic.error.titleMaxLength', '標題不能超過 80 個字元'));
      return;
    }

    if (description.length > 500) {
      toast.error(getText('editTopic.error.descriptionMaxLength', '說明不能超過 500 個字元'));
      return;
    }

    // 檢查禁字
    const bannedCheck = await validateTopicContent(
      trimmedTitle,
      description.trim() || undefined,
      newOptions.length > 0 ? newOptions : undefined,
      undefined, // 編輯時不檢查標籤
      undefined  // 編輯時不檢查分類
    );

    const decision = moderation.evaluate(bannedCheck);
    if (decision === 'block') {
      const bannedWordDesc = getText('editTopic.error.bannedWord', '發現禁字：{{keyword}}（級別：{{level}}）')
        .replace('{{keyword}}', bannedCheck.keyword || '')
        .replace('{{level}}', bannedCheck.level || '');
      toast.error(getBannedWordErrorMessage(bannedCheck), {
        description: bannedWordDesc
      });
      return;
    }
    if (decision === 'mask') {
      // 記住命中的是哪個欄位（標題／說明／新選項），供確認遮罩後套用到正確欄位
      setPendingMaskTarget({
        blockType: bannedCheck.blockType,
        optionIndex: bannedCheck.optionIndex,
        value: bannedCheck.blockValue || '',
      });
      return;
    }
    if (decision === 'review') {
      return; // 送審確認彈窗已開，等使用者操作
    }

    await performUpdate();
  };

  // 如果超過 1 小時，禁用編輯
  if (!canEdit) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className={cn(triggerClassName)}
      >
        <Edit className="w-4 h-4 mr-2" />
        {getText('editTopic.button.expired', '編輯（已超過時限）')}
      </Button>
    );
  }

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(triggerClassName)}
        >
          <Edit className="w-4 h-4 mr-2" />
          {getText('editTopic.button.edit', '編輯主題')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getText('editTopic.dialog.title', '編輯主題')}</DialogTitle>
          <DialogDescription>
            {getText('editTopic.dialog.description', '發布後 1 小時內可以編輯（剩餘 {{minutes}} 分鐘）')
              .replace('{{minutes}}', remainingTime.toString())}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 編輯規則提示 */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>{getText('editTopic.dialog.rules.title', '編輯規則：')}</strong>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                <li>{getText('editTopic.dialog.rules.canEdit', '可以修改標題和說明')}</li>
                <li>{getText('editTopic.dialog.rules.canAdd', '可以新增選項（最多 6 個）')}</li>
                <li>{getText('editTopic.dialog.rules.cannotEdit', '不可以修改或刪除現有選項')}</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* 標題 */}
          <div className="space-y-2">
            <Label htmlFor="edit-title">{getText('editTopic.form.titleLabel', '主題標題 *')}</Label>
            <Input
              id="edit-title"
              placeholder={getText('editTopic.form.titlePlaceholder', '輸入主題標題')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">
              {title.length}/80
            </p>
          </div>

          {/* 說明 */}
          <div className="space-y-2">
            <Label htmlFor="edit-description">{getText('editTopic.form.descriptionLabel', '主題說明（選填）')}</Label>
            <Textarea
              id="edit-description"
              placeholder={getText('editTopic.form.descriptionPlaceholder', '補充說明這個主題...')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/500
            </p>
          </div>

          {/* 現有選項（不可編輯）*/}
          <div className="space-y-2">
            <Label>{getText('editTopic.form.existingOptionsLabel', '現有選項（不可修改）')}</Label>
            <div className="space-y-2 bg-muted/50 rounded-lg p-3">
              {currentOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span>{option}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 新增選項 */}
          <div className="space-y-2">
            <Label htmlFor="new-option">
              {getText('editTopic.form.newOptionLabel', '新增選項（最多 {{count}} 個）')
                .replace('{{count}}', (6 - currentOptions.length).toString())}
            </Label>
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <Input
                  id="new-option"
                  placeholder={getText('editTopic.form.newOptionPlaceholder', '輸入新選項')}
                  value={newOptionInput}
                  onChange={(e) => setNewOptionInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOption();
                    }
                  }}
                  disabled={currentOptions.length + newOptions.length >= 6}
                  maxLength={50}
                />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddOption}
                disabled={currentOptions.length + newOptions.length >= 6}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-right">
              {newOptionInput.length}/50
            </p>
            </div>

            {/* 新增選項列表 */}
            {newOptions.length > 0 && (
              <div className="space-y-2 bg-primary/5 rounded-lg p-3">
                <p className="text-xs font-medium text-primary">{getText('editTopic.form.newOptionsList', '新增的選項：')}</p>
                {newOptions.map((option, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span>
                      <span className="font-medium text-primary">
                        {currentOptions.length + index + 1}.
                      </span>{' '}
                      {option}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveNewOption(index)}
                    >
                      {getText('editTopic.button.remove', '移除')}
                    </Button>
                  </div>
                ))}
              </div>
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
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {getText('editTopic.button.updating', '更新中...')}
              </>
            ) : (
              getText('editTopic.button.confirm', '確認更新')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={moderation.maskState.open} onOpenChange={(o) => !o && handleMaskCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{getText('topic.mask.title', '內容包含敏感字詞')}</AlertDialogTitle>
          <AlertDialogDescription>
            {getText('topic.mask.description', '發現敏感字詞「{{keyword}}」，將依規則遮罩後再送出。是否確認？')
              .replace('{{keyword}}', moderation.maskState.keyword)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleMaskCancel}>{getText('arena.cancel', '取消')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleMaskConfirm}>{getText('topic.mask.confirm', '確認遮罩')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={moderation.reviewState.open} onOpenChange={(o) => !o && handleReviewCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{getText('topic.review.title', '內容需經審核')}</AlertDialogTitle>
          <AlertDialogDescription>
            {getText('topic.review.description', '發現需審核字詞「{{keyword}}」。仍要送出嗎？送出後將進入審核流程。')
              .replace('{{keyword}}', moderation.reviewState.keyword)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleReviewCancel} disabled={submitting}>{getText('arena.cancel', '取消')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleReviewConfirm} disabled={submitting}>{getText('topic.review.confirm', '仍要送出')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

export default EditTopicDialog;


