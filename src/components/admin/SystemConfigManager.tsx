import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Settings, TestTube } from "lucide-react";
import { useSystemConfig } from "@/hooks/useSystemConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invalidateConfigCache } from "@/hooks/useSystemConfigCache";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const SystemConfigManager = () => {
  const { configs, loading, updateConfig } = useSystemConfig();
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testResults, setTestResults] = useState<number[]>([]);

  const handleValueChange = (id: string, newValue: string) => {
    setEditedValues(prev => ({ ...prev, [id]: newValue }));
  };

  const handleSave = async (id: string, key: string, originalValue: any) => {
    const editedValue = editedValues[id];
    if (editedValue === undefined) return;

    setSaving(id);
    try {
      // Parse the value based on its type
      let parsedValue;
      const originalType = typeof originalValue;
      
      if (originalType === 'object' && originalValue !== null) {
        // JSON 對象或數組
        try {
          parsedValue = JSON.parse(editedValue);
        } catch (e) {
          throw new Error('無效的 JSON 格式');
        }
      } else if (originalType === 'number') {
        // 數字類型
        const numValue = Number(editedValue);
        if (isNaN(numValue)) {
          throw new Error('無效的數字格式');
        }
        parsedValue = numValue;
      } else if (originalType === 'boolean') {
        // 布林類型
        const lowerValue = editedValue.toLowerCase().trim();
        if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes') {
          parsedValue = true;
        } else if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no') {
          parsedValue = false;
        } else {
          throw new Error('無效的布林值，請輸入 true/false');
        }
      } else {
        // 字符串類型
        parsedValue = editedValue;
      }

      console.log(`[SystemConfigManager] 更新配置: ${key}`, {
        原始值: originalValue,
        編輯值: editedValue,
        解析後: parsedValue,
        類型: typeof parsedValue
      });

      const success = await updateConfig(id, parsedValue);
      if (success) {
        setEditedValues(prev => {
          const newValues = { ...prev };
          delete newValues[id];
          return newValues;
        });
        // Invalidate cache to force refresh in other components
        invalidateConfigCache();
      }
    } catch (error) {
      console.error('Parse error:', error);
      const errorMessage = error instanceof Error ? error.message : '解析值時發生錯誤';
      toast.error(`更新失敗: ${errorMessage}`);
    } finally {
      setSaving(null);
    }
  };

  const getValue = (id: string, value: any) => {
    if (editedValues[id] !== undefined) {
      return editedValues[id];
    }
    return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  };

  // 測試廣告插入位置
  const testAdInsertion = () => {
    // 獲取當前值（優先使用編輯中的值，否則使用原始值）
    const getConfigValue = (key: string): number => {
      const config = configs.find(c => c.key === key);
      if (!config) return 10; // 默認值
      
      const editedValue = editedValues[config.id];
      if (editedValue !== undefined) {
        const numValue = Number(editedValue);
        return isNaN(numValue) ? (typeof config.value === 'number' ? config.value : 10) : numValue;
      }
      return typeof config.value === 'number' ? config.value : 10;
    };

    const interval = getConfigValue('ad_insertion_interval');
    const skipFirst = getConfigValue('ad_insertion_skip_first');
    const enabled = (() => {
      const config = configs.find(c => c.key === 'ad_insertion_enabled');
      if (!config) return true;
      const editedValue = editedValues[config.id];
      if (editedValue !== undefined) {
        const lowerValue = String(editedValue).toLowerCase().trim();
        return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes';
      }
      return config.value === true || config.value === 'true';
    })();

    if (!enabled) {
      toast.info('廣告插入功能已停用');
      setTestResults([]);
      return;
    }

    // 模擬 50 個主題的列表，計算廣告插入位置
    const totalItems = 50;
    const positions: number[] = [];
    
    for (let index = 0; index < totalItems; index++) {
      const positionAfterSkip = index + 1 - skipFirst;
      const shouldInsertAd = 
        index + 1 > skipFirst &&
        positionAfterSkip > 0 &&
        positionAfterSkip % interval === 0 &&
        index < totalItems - 1;
      
      if (shouldInsertAd) {
        positions.push(index + 1); // 位置從 1 開始
      }
    }

    setTestResults(positions);
    setTestDialogOpen(true);
  };

  const groupedConfigs = configs.reduce((acc, config) => {
    if (!acc[config.category]) {
      acc[config.category] = [];
    }
    acc[config.category].push(config);
    return acc;
  }, {} as Record<string, typeof configs>);

  const orderedCategories = [
    'validation',
    'recharge',
    'voting',
    'topic_cost',
    'home',
    'mission',
    'advertising',
    'user'
  ];

  const existingCategories = Object.keys(groupedConfigs);
  const primaryCategories = orderedCategories.filter(category => existingCategories.includes(category));
  const remainingCategories = existingCategories.filter(category => !orderedCategories.includes(category));
  const sortedCategories = [...primaryCategories, ...remainingCategories];

  const categoryNames: Record<string, string> = {
    recharge: '儲值配置',
    validation: '驗證限制',
    voting: '投票配置',
    topic_cost: '主題成本',
    mission: '任務獎勵',
    advertising: '廣告配置',
    user: '用戶配置',
    home: '首頁配置'
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          <CardTitle>系統配置管理</CardTitle>
        </div>
        <CardDescription>
          管理所有系統數值配置，修改後點擊保存即可應用
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={sortedCategories[0] || ''} className="w-full">
          <TabsList className="flex flex-wrap gap-2 w-full">
            {sortedCategories.map(category => (
              <TabsTrigger
                key={category}
                value={category}
                className="whitespace-nowrap"
              >
                {categoryNames[category] || category}
              </TabsTrigger>
            ))}
          </TabsList>

          {sortedCategories.map(category => {
            const categoryConfigs = groupedConfigs[category] || [];
            return (
              <TabsContent key={category} value={category} className="space-y-4">
                {categoryConfigs.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    尚未設定任何項目
                  </div>
                ) : (
                  categoryConfigs.map((config) => {
                    const currentValue = getValue(config.id, config.value);
                    const hasChanged = editedValues[config.id] !== undefined;
                    const isObject = typeof config.value === 'object';
                    const isAdConfig = config.key === 'ad_insertion_interval' || 
                                      config.key === 'ad_insertion_skip_first' || 
                                      config.key === 'ad_insertion_enabled';

                    return (
                      <div key={config.id} className="space-y-2 border-b pb-4 last:border-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <Label htmlFor={config.id} className="font-semibold">
                              {config.key}
                            </Label>
                            {config.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {config.description}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {isAdConfig && config.key === 'ad_insertion_interval' && (
                              <Dialog 
                                open={testDialogOpen} 
                                onOpenChange={(open) => {
                                  setTestDialogOpen(open);
                                  if (open) {
                                    testAdInsertion();
                                  }
                                }}
                              >
                                <DialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                  >
                                    <TestTube className="w-4 h-4 mr-1" />
                                    測試
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>廣告插入位置預覽</DialogTitle>
                                    <DialogDescription>
                                      根據當前配置值，廣告將出現在以下位置（假設有 50 個主題）：
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <div className="text-sm space-y-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold">間隔：</span>
                                        <span>{(() => {
                                          const config = configs.find(c => c.key === 'ad_insertion_interval');
                                          if (!config) return '10';
                                          const editedValue = editedValues[config.id];
                                          return editedValue !== undefined ? editedValue : String(config.value);
                                        })()}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold">首屏跳過：</span>
                                        <span>{(() => {
                                          const config = configs.find(c => c.key === 'ad_insertion_skip_first');
                                          if (!config) return '10';
                                          const editedValue = editedValues[config.id];
                                          return editedValue !== undefined ? editedValue : String(config.value);
                                        })()}</span>
                                      </div>
                                    </div>
                                    {testResults.length > 0 ? (
                                      <div>
                                        <p className="text-sm font-semibold mb-2">廣告位置：</p>
                                        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                                          {testResults.map((pos, idx) => (
                                            <span
                                              key={idx}
                                              className="px-2 py-1 bg-primary text-primary-foreground rounded text-sm"
                                            >
                                              第 {pos} 個
                                            </span>
                                          ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-2">
                                          共 {testResults.length} 個廣告位置
                                        </p>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground">
                                        在 50 個主題中不會插入任何廣告（可能因為間隔太大或功能已停用）
                                      </p>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                            <Button
                              size="sm"
                              onClick={() => handleSave(config.id, config.key, config.value)}
                              disabled={!hasChanged || saving === config.id}
                              variant={hasChanged ? "default" : "outline"}
                            >
                              {saving === config.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                  儲存中
                                </>
                              ) : (
                                <>
                                  <Save className="w-4 h-4 mr-1" />
                                  儲存
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                        {isObject ? (
                          <textarea
                            id={config.id}
                            value={currentValue}
                            onChange={(e) => handleValueChange(config.id, e.target.value)}
                            className="w-full min-h-[100px] p-2 border rounded-md font-mono text-sm bg-background"
                          />
                        ) : (
                          <Input
                            id={config.id}
                            value={currentValue}
                            onChange={(e) => handleValueChange(config.id, e.target.value)}
                            className="font-mono"
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SystemConfigManager;
