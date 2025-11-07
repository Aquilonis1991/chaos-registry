import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Edit, Save, X, Plus, RefreshCcw, Upload } from "lucide-react";
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
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import type { BaseLanguage } from "@/contexts/LanguageContext";

const parseCSVLine = (line: string): string[] => {
  const regex = /("(?:[^"]|"")*"|[^,]+)/g;
  const result: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    result.push(match[0].replace(/^"|"$/g, '').replace(/""/g, '"'));
  }
  return result;
};

const parseCSVToRows = (csvText: string) => {
  const normalized = csvText.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [] as Array<Record<string, string>>;

  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = parseCSVLine(lines[0]).map((header) => header.trim().toLowerCase());
  const requiredHeaders = ['key', 'zh'];
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error(`CSV 必須包含 ${header} 欄位`);
    }
  }

  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    if (cells.length === 0) continue;

    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] || '').trim();
    });

    if (!row['key'] || !row['zh']) {
      continue;
    }

    rows.push({
      key: row['key'],
      category: row['category'] || 'general',
      zh: row['zh'],
      en: row['en'] || '',
      ja: row['ja'] || '',
      description: row['description'] || '',
    });
  }

  return rows;
};

interface UIText {
  id: string;
  key: string;
  value: string;
  description?: string;
  category: string;
  zh?: string;
  en?: string;
  ja?: string;
}

const UI_LANGUAGES: BaseLanguage[] = ["zh", "en", "ja"];

const clearUITextCache = () => {
  if (typeof window === "undefined") return;
  UI_LANGUAGES.forEach((lang) => {
    window.localStorage.removeItem(`ui_texts_version_${lang}`);
    window.localStorage.removeItem(`ui_texts_cache_${lang}`);
  });
};

export const UITextManager = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<UIText>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [newText, setNewText] = useState({
    key: "",
    category: "general",
    zh: "",
    en: "",
    ja: "",
    description: "",
  });
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const { language } = useLanguage();
  const { getText, isLoading: uiTextsLoading } = useUIText(language);

  const titleText = getText('admin.uiTextManager.title', 'UI文字管理');
  const searchLabelText = getText('admin.uiTextManager.search.label', '搜尋文字');
  const searchPlaceholder = getText('admin.uiTextManager.search.placeholder', '輸入關鍵字或翻譯...');
  const categoryLabelText = getText('admin.uiTextManager.category.label', '分類');
  const categoryAllText = getText('admin.uiTextManager.category.all', '全部分類');
  const refreshButtonText = getText('admin.uiTextManager.refresh', '重新整理');
  const createSectionTitle = getText('admin.uiTextManager.create.title', '新增 UI 文字');
  const importCsvButtonText = getText('admin.uiTextManager.import.button', '導入 CSV');
  const importDialogTitle = getText('admin.uiTextManager.import.dialogTitle', '導入 UI 文字 CSV');
  const importDialogDescription = getText('admin.uiTextManager.import.dialogDescription', '請貼上或匯入 CSV 內容，支援欄位：key, category, zh, en, ja, description');
  const importDialogTipLeft = getText('admin.uiTextManager.import.tipLeft', '貼上 CSV 內容，每行對應一筆 UI 文字');
  const importDialogTipRight = getText('admin.uiTextManager.import.tipRight', '若未提供 category，將預設為 general');
  const importDialogCancelText = getText('common.button.cancel', '取消');
  const importDialogConfirmText = getText('admin.uiTextManager.import.confirm', '導入');
  const importCsvPlaceholder = getText('admin.uiTextManager.import.placeholder', 'key,category,zh,en,ja,description\nnav.home,navigation,首頁,Home,ホーム,Bottom navigation - Home');
  const newKeyLabel = getText('admin.uiTextManager.create.keyLabel', 'Key *');
  const newKeyPlaceholder = getText('admin.uiTextManager.create.keyPlaceholder', '例：home.title');
  const newCategoryLabel = getText('admin.uiTextManager.create.categoryLabel', '分類 *');
  const newCategoryPlaceholder = getText('admin.uiTextManager.create.categoryPlaceholder', '例：home');
  const newDescriptionLabel = getText('admin.uiTextManager.create.descriptionLabel', '描述');
  const newDescriptionPlaceholder = getText('admin.uiTextManager.create.descriptionPlaceholder', '用途說明 (選填)');
  const newZhLabel = getText('admin.uiTextManager.create.zhLabel', '中文 (ZH) *');
  const newZhPlaceholder = getText('admin.uiTextManager.create.zhPlaceholder', '輸入中文顯示文字');
  const newEnLabel = getText('admin.uiTextManager.create.enLabel', '英文 (EN)');
  const newEnPlaceholder = getText('admin.uiTextManager.create.enPlaceholder', 'English translation (optional)');
  const newJaLabel = getText('admin.uiTextManager.create.jaLabel', '日文 (JA)');
  const newJaPlaceholder = getText('admin.uiTextManager.create.jaPlaceholder', '日本語の翻訳 (任意)');
  const createButtonText = getText('admin.uiTextManager.create.button', '新增');
  const tableHeaderCategory = getText('admin.uiTextManager.table.category', '分類');
  const tableHeaderKey = getText('admin.uiTextManager.table.key', 'Key');
  const tableHeaderZh = getText('admin.uiTextManager.table.zh', '中文 (ZH)');
  const tableHeaderEn = getText('admin.uiTextManager.table.en', '英文 (EN)');
  const tableHeaderJa = getText('admin.uiTextManager.table.ja', '日文 (JA)');
  const tableHeaderDescription = getText('admin.uiTextManager.table.description', '說明');
  const tableHeaderActions = getText('admin.uiTextManager.table.actions', '操作');
  const actionSaveText = getText('common.button.save', '儲存');
  const actionCancelText = getText('common.button.cancel', '取消');
  const actionEditText = getText('common.button.edit', '編輯');
  const toastUpdateSuccess = getText('admin.uiTextManager.toast.updateSuccess', 'UI 文字已更新');
  const toastUpdateFailurePrefix = getText('admin.uiTextManager.toast.updateFailure', '更新失敗: ');
  const toastCreateSuccess = getText('admin.uiTextManager.toast.createSuccess', '已新增 UI 文字');
  const toastCreateFailurePrefix = getText('admin.uiTextManager.toast.createFailure', '新增失敗：');
  const toastZhRequired = getText('admin.uiTextManager.toast.zhRequired', '中文 (ZH) 內容不能為空');
  const toastKeyRequired = getText('admin.uiTextManager.toast.keyRequired', '請輸入唯一的 Key');
  const toastCsvEmpty = getText('admin.uiTextManager.toast.csvEmpty', '請貼上 CSV 內容');
  const toastCsvNoData = getText('admin.uiTextManager.toast.csvNoData', '沒有有效的資料');
  const toastImportSuccessTemplate = getText('admin.uiTextManager.toast.importSuccess', '成功導入 {{count}} 筆 UI 文字');
  const toastImportWarningTemplate = getText('admin.uiTextManager.toast.importWarning', '{{count}} 筆資料導入失敗，詳情請查看主控台');
  const toastImportFailurePrefix = getText('admin.uiTextManager.toast.importFailure', '導入失敗：');
  const toastCsvParseMissingHeaderTemplate = getText('admin.uiTextManager.toast.csvMissingHeader', 'CSV 必須包含 {{header}} 欄位');

  const { data: texts, isLoading } = useQuery({
    queryKey: ['admin-ui-texts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ui_texts')
        .select('*')
        .order('category', { ascending: true })
        .order('key', { ascending: true });

      if (error) throw error;
      return data as UIText[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<UIText> }) => {
      const { error } = await supabase
        .from('ui_texts')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ui-texts'] });
      queryClient.invalidateQueries({ queryKey: ['ui-texts'] });
      toast.success(toastUpdateSuccess);
      clearUITextCache();
      setEditingId(null);
      setEditValues({});
    },
    onError: (error) => {
      toast.error(toastUpdateFailurePrefix + error.message);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof newText) => {
      const { error } = await supabase.from('ui_texts').insert({
        key: payload.key.trim(),
        category: (payload.category || 'general').trim(),
        value: payload.zh.trim(),
        zh: payload.zh.trim(),
        en: payload.en.trim() || null,
        ja: payload.ja.trim() || null,
        description: payload.description.trim() || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(toastCreateSuccess);
      setNewText({ key: '', category: 'general', zh: '', en: '', ja: '', description: '' });
      queryClient.invalidateQueries({ queryKey: ['admin-ui-texts'] });
      queryClient.invalidateQueries({ queryKey: ['ui-texts'] });
      clearUITextCache();
    },
    onError: (error: any) => {
      toast.error(toastCreateFailurePrefix + (error?.message || ''));
    }
  });

  const handleEdit = (text: UIText) => {
    setEditingId(text.id);
    setEditValues({
      value: text.value,
      zh: text.zh || text.value || '',
      en: text.en || '',
      ja: text.ja || '',
      description: text.description || '',
      category: text.category,
    });
  };

  const handleSave = (text: UIText) => {
    const zh = (editValues.zh ?? '').trim();
    if (!zh) {
      toast.error(toastZhRequired);
      return;
    }

    const updates: Partial<UIText> = {
      value: zh,
      zh,
      en: (editValues.en ?? '').trim() || null,
      ja: (editValues.ja ?? '').trim() || null,
      description: (editValues.description ?? '').trim() || null,
    };

    if (editValues.category && editValues.category !== text.category) {
      updates.category = editValues.category.trim() || text.category;
    }

    updateMutation.mutate({ id: text.id, updates });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValues({});
  };

  const categories = useMemo(() => {
    if (!texts) return [] as string[];
    const unique = new Set<string>();
    texts.forEach((t) => {
      if (t.category) unique.add(t.category);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [texts]);

  const filteredTexts = useMemo(() => {
    if (!texts) return [] as UIText[];
    const term = searchTerm.trim().toLowerCase();
    return texts.filter((text) => {
      const matchesCategory = categoryFilter === 'all' || text.category === categoryFilter;
      const matchesTerm = !term ||
        text.key.toLowerCase().includes(term) ||
        (text.zh || '').toLowerCase().includes(term) ||
        (text.en || '').toLowerCase().includes(term) ||
        (text.ja || '').toLowerCase().includes(term) ||
        (text.description || '').toLowerCase().includes(term);
      return matchesCategory && matchesTerm;
    });
  }, [texts, searchTerm, categoryFilter]);

  const handleCreate = () => {
    const trimmedKey = newText.key.trim();
    const trimmedZH = newText.zh.trim();

    if (!trimmedKey) {
      toast.error(toastKeyRequired);
      return;
    }

    if (!trimmedZH) {
      toast.error(toastZhRequired);
      return;
    }

    createMutation.mutate({ ...newText, key: trimmedKey, zh: trimmedZH });
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-ui-texts'] });
    clearUITextCache();
  };

  const handleImportCSV = async () => {
    if (!csvText.trim()) {
      toast.error(toastCsvEmpty);
      return;
    }

    try {
      setImporting(true);
      const rows = parseCSVToRows(csvText);
      if (rows.length === 0) {
        toast.error(toastCsvNoData);
        return;
      }

      const { data, error } = await supabase.rpc('import_ui_texts_from_csv', {
        p_rows: rows,
      });

      if (error) throw error;

      const importedCount = data?.imported_count ?? rows.length;
      toast.success(toastImportSuccessTemplate.replace('{{count}}', String(importedCount)));

      if (Array.isArray(data?.errors) && data.errors.length > 0) {
        console.warn('UI text import errors:', data.errors);
        toast.warning(toastImportWarningTemplate.replace('{{count}}', String(data.errors.length)));
      }

      setShowImportDialog(false);
      setCsvText("");
      handleRefresh();
      queryClient.invalidateQueries({ queryKey: ['ui-texts'] });
      clearUITextCache();
    } catch (error: any) {
      console.error('Import UI texts error:', error);
      if (typeof error?.message === 'string' && error.message.includes('CSV 必須包含')) {
        const header = error.message.split('CSV 必須包含 ')[1]?.replace(' 欄位', '') || '';
        toast.error(toastCsvParseMissingHeaderTemplate.replace('{{header}}', header));
      } else {
        toast.error(toastImportFailurePrefix + (error?.message || ''));
      }
    } finally {
      setImporting(false);
    }
  };

  if (isLoading || uiTextsLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">{titleText}</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="ui-text-search">{searchLabelText}</Label>
          <Input
            id="ui-text-search"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ui-text-category">{categoryLabelText}</Label>
          <select
            id="ui-text-category"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">{categoryAllText}</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCcw className="w-4 h-4 mr-2" />{refreshButtonText}
          </Button>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4" /> {createSectionTitle}
          </h3>
          <div className="flex gap-2">
            <Dialog
              open={showImportDialog}
              onOpenChange={(open) => {
                setShowImportDialog(open);
                if (!open && !importing) {
                  setCsvText("");
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" /> {importCsvButtonText}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>{importDialogTitle}</DialogTitle>
                    <DialogDescription className="text-sm">
                      {importDialogDescription}
                    </DialogDescription>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getText('admin.uiTextManager.import.requiredNote', 'key 與 zh 為必填。若 key 已存在，將以匯入資料覆蓋原有內容。')}
                    </p>
                </DialogHeader>
                <Textarea
                  placeholder={importCsvPlaceholder}
                  className="min-h-[280px] font-mono text-sm"
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{importDialogTipLeft}</span>
                  <span>{importDialogTipRight}</span>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCsvText("");
                      setShowImportDialog(false);
                    }}
                    disabled={importing}
                  >
                    {importDialogCancelText}
                  </Button>
                  <Button onClick={handleImportCSV} disabled={importing}>
                    {importing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>{importDialogConfirmText}</>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>{newKeyLabel}</Label>
            <Input
              placeholder={newKeyPlaceholder}
              value={newText.key}
              onChange={(e) => setNewText({ ...newText, key: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{newCategoryLabel}</Label>
            <Input
              placeholder={newCategoryPlaceholder}
              value={newText.category}
              onChange={(e) => setNewText({ ...newText, category: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{newDescriptionLabel}</Label>
            <Input
              placeholder={newDescriptionPlaceholder}
              value={newText.description}
              onChange={(e) => setNewText({ ...newText, description: e.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>{newZhLabel}</Label>
            <Textarea
              placeholder={newZhPlaceholder}
              value={newText.zh}
              onChange={(e) => setNewText({ ...newText, zh: e.target.value })}
              className="min-h-[60px]"
            />
          </div>
          <div className="space-y-2">
            <Label>{newEnLabel}</Label>
            <Textarea
              placeholder={newEnPlaceholder}
              value={newText.en}
              onChange={(e) => setNewText({ ...newText, en: e.target.value })}
              className="min-h-[60px]"
            />
          </div>
          <div className="space-y-2">
            <Label>{newJaLabel}</Label>
            <Textarea
              placeholder={newJaPlaceholder}
              value={newText.ja}
              onChange={(e) => setNewText({ ...newText, ja: e.target.value })}
              className="min-h-[60px]"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <><Plus className="w-4 h-4 mr-1" />{createButtonText}</>
            )}
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">{tableHeaderCategory}</TableHead>
              <TableHead className="w-48">{tableHeaderKey}</TableHead>
              <TableHead className="w-48">{tableHeaderZh}</TableHead>
              <TableHead className="w-48">{tableHeaderEn}</TableHead>
              <TableHead className="w-48">{tableHeaderJa}</TableHead>
              <TableHead className="w-64">{tableHeaderDescription}</TableHead>
              <TableHead className="w-32">{tableHeaderActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTexts.map((text) => (
              <TableRow key={text.id}>
                <TableCell className="font-medium">
                  {editingId === text.id ? (
                    <Input
                      value={editValues.category ?? text.category}
                      onChange={(e) => setEditValues({ ...editValues, category: e.target.value })}
                    />
                  ) : (
                    text.category
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">{text.key}</TableCell>
                <TableCell>
                  {editingId === text.id ? (
                    <Textarea
                      value={editValues.zh || ''}
                      onChange={(e) => setEditValues({ ...editValues, zh: e.target.value })}
                      className="min-h-[60px]"
                    />
                  ) : (
                    <div className="text-sm whitespace-pre-wrap">{text.zh || text.value}</div>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === text.id ? (
                    <Textarea
                      value={editValues.en || ''}
                      onChange={(e) => setEditValues({ ...editValues, en: e.target.value })}
                      className="min-h-[60px]"
                    />
                  ) : (
                    <div className="text-sm whitespace-pre-wrap">{text.en}</div>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === text.id ? (
                    <Textarea
                      value={editValues.ja || ''}
                      onChange={(e) => setEditValues({ ...editValues, ja: e.target.value })}
                      className="min-h-[60px]"
                    />
                  ) : (
                    <div className="text-sm whitespace-pre-wrap">{text.ja}</div>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === text.id ? (
                    <Textarea
                      value={editValues.description || ''}
                      onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                      className="min-h-[60px]"
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {text.description}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === text.id ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSave(text)}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <><Save className="w-4 h-4 mr-1" />儲存</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={updateMutation.isPending}
                      >
                        <X className="w-4 h-4 mr-1" />取消
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(text)}
                    >
                      <Edit className="w-4 h-4 mr-1" />編輯
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const UI_LANGUAGES: BaseLanguage[] = ['zh', 'en', 'ja'];

const clearUITextCache = () => {
  if (typeof window === 'undefined') return;
  UI_LANGUAGES.forEach((lang) => {
    window.localStorage.removeItem(`ui_texts_version_${lang}`);
    window.localStorage.removeItem(`ui_texts_cache_${lang}`);
  });
};
