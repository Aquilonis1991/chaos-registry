import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Edit, Save, X, Upload, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface BannedWord {
  id: string;
  level: string;
  category: string;
  keyword: string;
  action: 'block' | 'mask' | 'review';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const BannedWordsManager = () => {
  const [words, setWords] = useState<BannedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BannedWord>>({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newWord, setNewWord] = useState({
    level: 'A',
    category: '',
    keyword: '',
    action: 'block' as 'block' | 'mask' | 'review'
  });

  useEffect(() => {
    loadWords();
  }, []);

  const loadWords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('banned_words')
        .select('*')
        .order('level', { ascending: true })
        .order('keyword', { ascending: true });

      if (error) throw error;
      setWords(data || []);
    } catch (error: any) {
      console.error('Error loading banned words:', error);
      toast.error('載入禁字表失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newWord.keyword.trim()) {
      toast.error('請輸入關鍵字');
      return;
    }

    try {
      const { error } = await supabase
        .from('banned_words')
        .insert({
          level: newWord.level,
          category: newWord.category,
          keyword: newWord.keyword.trim(),
          action: newWord.action
        });

      if (error) throw error;

      toast.success('已添加禁字');
      setShowAddDialog(false);
      setNewWord({ level: 'A', category: '', keyword: '', action: 'block' });
      await loadWords();
    } catch (error: any) {
      console.error('Error adding banned word:', error);
      if (error.code === '23505') {
        toast.error('此關鍵字已存在（同一級別）');
      } else {
        toast.error('添加失敗');
      }
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('banned_words')
        .update({
          level: editForm.level,
          category: editForm.category,
          keyword: editForm.keyword,
          action: editForm.action,
          is_active: editForm.is_active
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('已更新');
      setEditingId(null);
      setEditForm({});
      await loadWords();
    } catch (error: any) {
      console.error('Error updating banned word:', error);
      toast.error('更新失敗');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此禁字嗎？')) return;

    try {
      const { error } = await supabase
        .from('banned_words')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('已刪除');
      await loadWords();
    } catch (error: any) {
      console.error('Error deleting banned word:', error);
      toast.error('刪除失敗');
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('banned_words')
        .update({ is_active: !currentActive })
        .eq('id', id);

      if (error) throw error;

      await loadWords();
    } catch (error: any) {
      console.error('Error toggling active:', error);
      toast.error('操作失敗');
    }
  };

  const handleImportCSV = async (csvText: string) => {
    try {
      // 解析 CSV
      const lines = csvText.split('\n').filter(line => line.trim());
      const headers = lines[0].replace(/"/g, '').split(',');
      
      if (headers.length < 4) {
        toast.error('CSV 格式錯誤');
        return;
      }

      const data = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // 簡單的 CSV 解析（處理引號內的逗號）
        const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
        if (matches && matches.length >= 4) {
          const level = matches[0].replace(/"/g, '').trim();
          const category = matches[1].replace(/"/g, '').trim();
          const keyword = matches[2].replace(/"/g, '').trim();
          const action = matches[3].replace(/"/g, '').trim();
          
          if (level && keyword && action) {
            data.push({ level, category, keyword, action });
          }
        }
      }

      if (data.length === 0) {
        toast.error('沒有有效的數據');
        return;
      }

      // 使用批量插入函數
      const { data: result, error } = await supabase.rpc('import_banned_words_from_csv', {
        p_csv_data: data as any
      });

      if (error) throw error;

      const resultData = result as any;
      toast.success(`成功導入 ${resultData?.imported_count || 0} 條記錄`);
      if (resultData?.errors && Array.isArray(resultData.errors) && resultData.errors.length > 0) {
        console.warn('導入錯誤:', resultData.errors);
        toast.warning(`${resultData.errors.length} 條記錄導入失敗`);
      }

      await loadWords();
    } catch (error: any) {
      console.error('Error importing CSV:', error);
      toast.error('導入失敗：' + (error.message || '未知錯誤'));
    }
  };

  const filteredWords = words.filter(word => {
    const matchesSearch = word.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         word.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = filterLevel === 'all' || word.level === filterLevel;
    const matchesAction = filterAction === 'all' || word.action === filterAction;
    return matchesSearch && matchesLevel && matchesAction;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'A': return 'bg-red-500';
      case 'B': return 'bg-orange-500';
      case 'C': return 'bg-yellow-500';
      case 'D': return 'bg-blue-500';
      case 'E': return 'bg-purple-500';
      case 'F': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'block': return 'destructive';
      case 'mask': return 'secondary';
      case 'review': return 'default';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>禁字表管理</CardTitle>
            <CardDescription>
              管理系統禁字表，用於過濾主題標題、內容、選項、標籤、分類和會員名稱
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  新增禁字
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新增禁字</DialogTitle>
                  <DialogDescription>
                    添加新的禁字關鍵字
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>級別</Label>
                    <Select value={newWord.level} onValueChange={(v) => setNewWord({...newWord, level: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A 級（最嚴重）</SelectItem>
                        <SelectItem value="B">B 級</SelectItem>
                        <SelectItem value="C">C 級</SelectItem>
                        <SelectItem value="D">D 級</SelectItem>
                        <SelectItem value="E">E 級</SelectItem>
                        <SelectItem value="F">F 級（最低）</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>分類</Label>
                    <Input
                      value={newWord.category}
                      onChange={(e) => setNewWord({...newWord, category: e.target.value})}
                      placeholder="例如：性別/色/不當"
                    />
                  </div>
                  <div>
                    <Label>關鍵字 *</Label>
                    <Input
                      value={newWord.keyword}
                      onChange={(e) => setNewWord({...newWord, keyword: e.target.value})}
                      placeholder="輸入禁字關鍵字"
                    />
                  </div>
                  <div>
                    <Label>處理方式</Label>
                    <Select value={newWord.action} onValueChange={(v: any) => setNewWord({...newWord, action: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="block">block - 直接阻擋</SelectItem>
                        <SelectItem value="mask">mask - 遮罩處理</SelectItem>
                        <SelectItem value="review">review - 需要審核</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAdd} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    添加
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  導入 CSV
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>導入 CSV 文件</DialogTitle>
                  <DialogDescription>
                    貼上 CSV 內容（格式：level,category,keyword,action）
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  placeholder="貼上 CSV 內容..."
                  className="min-h-[300px] font-mono text-sm"
                  onChange={(e) => {
                    if (e.target.value) {
                      handleImportCSV(e.target.value);
                    }
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 搜尋和篩選 */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜尋關鍵字或分類..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={filterLevel} onValueChange={setFilterLevel}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="級別" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有級別</SelectItem>
              <SelectItem value="A">A 級</SelectItem>
              <SelectItem value="B">B 級</SelectItem>
              <SelectItem value="C">C 級</SelectItem>
              <SelectItem value="D">D 級</SelectItem>
              <SelectItem value="E">E 級</SelectItem>
              <SelectItem value="F">F 級</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="處理方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有方式</SelectItem>
              <SelectItem value="block">block</SelectItem>
              <SelectItem value="mask">mask</SelectItem>
              <SelectItem value="review">review</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 統計 */}
        <div className="flex gap-4 mb-4 text-sm text-muted-foreground">
          <span>總計：{words.length} 條</span>
          <span>活躍：{words.filter(w => w.is_active).length} 條</span>
          <span>顯示：{filteredWords.length} 條</span>
        </div>

        {/* 表格 */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">級別</TableHead>
                <TableHead>關鍵字</TableHead>
                <TableHead>分類</TableHead>
                <TableHead className="w-24">處理方式</TableHead>
                <TableHead className="w-20">狀態</TableHead>
                <TableHead className="w-32">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    沒有找到禁字記錄
                  </TableCell>
                </TableRow>
              ) : (
                filteredWords.map((word) => (
                  <TableRow key={word.id}>
                    <TableCell>
                      <Badge className={getLevelColor(word.level)}>
                        {word.level}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {editingId === word.id ? (
                        <Input
                          value={editForm.keyword || word.keyword}
                          onChange={(e) => setEditForm({...editForm, keyword: e.target.value})}
                          className="h-8"
                        />
                      ) : (
                        word.keyword
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === word.id ? (
                        <Input
                          value={editForm.category || word.category}
                          onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                          className="h-8"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">{word.category}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === word.id ? (
                        <Select
                          value={editForm.action || word.action}
                          onValueChange={(v: any) => setEditForm({...editForm, action: v})}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="block">block</SelectItem>
                            <SelectItem value="mask">mask</SelectItem>
                            <SelectItem value="review">review</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={getActionColor(word.action)}>
                          {word.action}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={editingId === word.id ? (editForm.is_active ?? word.is_active) : word.is_active}
                        onCheckedChange={(checked) => {
                          if (editingId === word.id) {
                            setEditForm({...editForm, is_active: checked});
                          } else {
                            handleToggleActive(word.id, word.is_active);
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {editingId === word.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                handleUpdate(word.id);
                              }}
                            >
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingId(null);
                                setEditForm({});
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingId(word.id);
                                setEditForm({
                                  level: word.level,
                                  category: word.category,
                                  keyword: word.keyword,
                                  action: word.action,
                                  is_active: word.is_active
                                });
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(word.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

