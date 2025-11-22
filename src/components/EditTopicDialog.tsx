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
import { Edit, Loader2, Plus, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { differenceInHours } from "date-fns";
import { validateTopicContent, getBannedWordErrorMessage } from "@/lib/bannedWords";
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

  // 計算是否還能編輯（1小時內）
  const hoursSinceCreated = differenceInHours(new Date(), new Date(createdAt));
  const canEdit = hoursSinceCreated < 1;
  const remainingTime = canEdit ? 60 - Math.floor(hoursSinceCreated * 60) : 0;

  useEffect(() => {
    if (open) {
      // 重置狀態
      setTitle(currentTitle);
      setDescription(currentDescription);
      setNewOptions([]);
      setNewOptionInput('');
    }
  }, [open, currentTitle, currentDescription]);

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

    if (trimmedTitle.length > 200) {
      toast.error(getText('editTopic.error.titleMaxLength', '標題不能超過 200 個字元'));
      return;
    }

    if (description.length > 150) {
      toast.error(getText('editTopic.error.descriptionMaxLength', '說明不能超過 150 個字元'));
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

    if (bannedCheck.found) {
      if (bannedCheck.action === 'block') {
        const bannedWordDesc = getText('editTopic.error.bannedWord', '發現禁字：{{keyword}}（級別：{{level}}）')
          .replace('{{keyword}}', bannedCheck.keyword || '')
          .replace('{{level}}', bannedCheck.level || '');
        toast.error(getBannedWordErrorMessage(bannedCheck), {
          description: bannedWordDesc
        });
        return;
      } else if (bannedCheck.action === 'review') {
        const reviewDesc = getText('editTopic.warning.review', '發現敏感字詞：{{keyword}}')
          .replace('{{keyword}}', bannedCheck.keyword || '');
        toast.warning(getText('editTopic.warning.needsReview', '內容需要人工審核'), {
          description: reviewDesc
        });
      }
    }

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
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">
              {title.length}/200
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
              maxLength={150}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/150
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
  );
};

export default EditTopicDialog;


