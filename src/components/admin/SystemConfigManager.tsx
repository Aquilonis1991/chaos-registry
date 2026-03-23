import { useState, useEffect } from "react";
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

/** 後台可直接以數字編輯、並附中文說明的系統配置 */
const INTEGER_ADMIN_CONFIG: Record<
  string,
  { label: string; min: number; max: number; helper: string }
> = {
  report_auto_hide_threshold: {
    label: "檢舉自動隱藏閾值",
    min: 1,
    max: 999,
    helper:
      "當同一主題被「不同用戶」檢舉累計達此人數時，系統自動隱藏該主題（與 handle_topic_report 一致）。",
  },
  announcement_max_display: {
    label: "前台公告顯示則數",
    min: 1,
    max: 50,
    helper:
      "公告輪播一次向 get_active_announcements 請求的最多筆數；儲存後前台快取會於重新載入後生效。",
  },
};

function coerceConfigNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  if (v && typeof v === "object" && v !== null && "value" in v) {
    return coerceConfigNumber((v as { value: unknown }).value);
  }
  return NaN;
}

const SystemConfigManager = () => {
  const { configs, loading, updateConfig } = useSystemConfig();
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testResults, setTestResults] = useState<number[]>([]);
  const [configTab, setConfigTab] = useState<string>("");

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

  // 廣告單元 ID 依平台區分：key 為 admob_native_ad_unit_id 或 admob_rewarded_ad_unit_id 時，顯示 Android / iOS 兩欄
  const AD_UNIT_IDS_BY_PLATFORM = ['admob_native_ad_unit_id', 'admob_rewarded_ad_unit_id'];

  const getPlatformAdUnitValue = (config: { id: string; value: any }, platform: 'android' | 'ios') => {
    const editKey = `${config.id}_${platform}`;
    if (editedValues[editKey] !== undefined) return editedValues[editKey];
    const v = config.value;
    if (v == null) return '';
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'object' && v !== null) return String(v[platform] ?? '').trim();
    return '';
  };

  const handlePlatformAdUnitChange = (configId: string, platform: 'android' | 'ios', value: string) => {
    setEditedValues(prev => ({ ...prev, [`${configId}_${platform}`]: value }));
  };

  const handleSavePlatformAdUnit = async (config: { id: string; key: string; value: any }) => {
    const androidVal = getPlatformAdUnitValue(config, 'android');
    const iosVal = getPlatformAdUnitValue(config, 'ios');
    setSaving(config.id);
    try {
      const payload = { android: androidVal, ios: iosVal };
      const success = await updateConfig(config.id, payload);
      if (success) {
        setEditedValues(prev => {
          const next = { ...prev };
          delete next[`${config.id}_android`];
          delete next[`${config.id}_ios`];
          return next;
        });
        invalidateConfigCache();
        toast.success('已儲存');
      }
    } catch (e) {
      toast.error('更新失敗');
    } finally {
      setSaving(null);
    }
  };

  const isPlatformAdUnitChanged = (config: { id: string; value: any }) => {
    const curAndroid = config.value && typeof config.value === 'object' ? String(config.value.android ?? '').trim() : (typeof config.value === 'string' ? config.value.trim() : '');
    const curIos = config.value && typeof config.value === 'object' ? String(config.value.ios ?? '').trim() : (typeof config.value === 'string' ? config.value.trim() : '');
    const editAndroid = editedValues[`${config.id}_android`];
    const editIos = editedValues[`${config.id}_ios`];
    return (editAndroid !== undefined && editAndroid !== curAndroid) || (editIos !== undefined && editIos !== curIos);
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

  const saveIntegerAdminConfig = async (
    config: { id: string; key: string; value: unknown },
    meta: (typeof INTEGER_ADMIN_CONFIG)[string]
  ) => {
    const edited = editedValues[config.id];
    if (edited === undefined) return;
    const n = parseInt(String(edited).trim(), 10);
    if (Number.isNaN(n) || n < meta.min || n > meta.max) {
      toast.error(`請輸入 ${meta.min}～${meta.max} 的整數`);
      return;
    }
    setSaving(config.id);
    try {
      const success = await updateConfig(config.id, n);
      if (success) {
        setEditedValues((prev) => {
          const next = { ...prev };
          delete next[config.id];
          return next;
        });
        invalidateConfigCache();
      }
    } finally {
      setSaving(null);
    }
  };

  // Keys that are managed by dedicated components and should be hidden here
  const HIDDEN_KEYS = [
    'legal_terms_content',
    'legal_privacy_content',
    'ai_chaos_rewrite_prompt',
    'ai_chaos_verification_prompt',
    'ai_closing_prompt'
  ];

  /** 舊分類 battlefield 已廢棄且程式未使用；資料請以 migration 20260321130000 自 DB 刪除／合併 */
  const HIDDEN_CATEGORIES = ['battlefield'] as const;

  const groupedConfigs = configs
    .filter(config => !HIDDEN_KEYS.includes(config.key))
    .filter(config => !HIDDEN_CATEGORIES.includes(config.category as (typeof HIDDEN_CATEGORIES)[number]))
    .reduce((acc, config) => {
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
    'arena',
    'home',
    'mission',
    'advertising',
    'user',
    'report',
    'announcement'
  ];

  const existingCategories = Object.keys(groupedConfigs);
  const primaryCategories = orderedCategories.filter(category => existingCategories.includes(category));
  const remainingCategories = existingCategories.filter(category => !orderedCategories.includes(category));
  const sortedCategories = [...primaryCategories, ...remainingCategories];

  /** 分頁標籤拆成兩行（上／下各約一半） */
  const tabRowSplitIndex = Math.ceil(sortedCategories.length / 2);
  const categoryTabsRow1 = sortedCategories.slice(0, tabRowSplitIndex);
  const categoryTabsRow2 = sortedCategories.slice(tabRowSplitIndex);

  // 當 configs 載入完成後，若尚未設定分頁則選第一個
  useEffect(() => {
    if (loading || configs.length === 0) return;
    const cats = Object.keys(groupedConfigs);
    const ordered = ['validation','recharge','voting','topic_cost','arena','home','mission','advertising','user','report','announcement'];
    const primary = ordered.filter(c => cats.includes(c));
    const remaining = cats.filter(c => !ordered.includes(c));
    const sorted = [...primary, ...remaining];
    if (sorted[0]) {
      setConfigTab(prev => !prev || !sorted.includes(prev) ? sorted[0] : prev);
    }
  }, [loading, configs]);

  const categoryNames: Record<string, string> = {
    recharge: '儲值配置',
    validation: '驗證限制',
    voting: '投票配置',
    topic_cost: '主題成本',
    arena: '觀點角鬥場',
    mission: '任務獎勵',
    advertising: '廣告配置',
    user: '用戶配置',
    home: '首頁配置',
    report: '檢舉',
    announcement: '公告顯示'
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
        <Tabs
          value={configTab || sortedCategories[0] || ""}
          onValueChange={(v) => setConfigTab(v)}
          className="w-full"
        >
          <TabsList className="flex h-auto min-h-0 w-full flex-col gap-2 rounded-md bg-muted p-2 items-stretch justify-start">
            <div className="flex w-full flex-wrap gap-2" role="presentation">
              {categoryTabsRow1.map((category) => (
                <TabsTrigger
                  key={category}
                  value={category}
                  className="min-w-[100px] flex-1 whitespace-nowrap sm:min-w-[120px]"
                  type="button"
                >
                  {categoryNames[category] || category}
                </TabsTrigger>
              ))}
            </div>
            {categoryTabsRow2.length > 0 ? (
              <div className="flex w-full flex-wrap gap-2" role="presentation">
                {categoryTabsRow2.map((category) => (
                  <TabsTrigger
                    key={category}
                    value={category}
                    className="min-w-[100px] flex-1 whitespace-nowrap sm:min-w-[120px]"
                    type="button"
                  >
                    {categoryNames[category] || category}
                  </TabsTrigger>
                ))}
              </div>
            ) : null}
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
                    const isPlatformAdUnit = AD_UNIT_IDS_BY_PLATFORM.includes(config.key);
                    const currentValue = getValue(config.id, config.value);
                    const hasChanged = isPlatformAdUnit ? isPlatformAdUnitChanged(config) : editedValues[config.id] !== undefined;
                    const isObject = typeof config.value === 'object';
                    const isAdConfig = config.key === 'ad_insertion_interval' ||
                      config.key === 'ad_insertion_skip_first' ||
                      config.key === 'ad_insertion_enabled';

                    // Force textarea for AI prompts if they somehow appear here
                    const isLongText = typeof config.value === 'string' && (
                      config.value.length > 50 ||
                      config.key.includes('prompt') ||
                      config.key.includes('content')
                    );

                    // 廣告單元 ID：Android / iOS 分開輸入（與 admob_rewarded_ad_unit_id 同形式）
                    if (isPlatformAdUnit) {
                      return (
                        <div key={config.id} className="space-y-2 border-b pb-4 last:border-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <Label className="font-semibold">{config.key}</Label>
                              {config.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {config.description}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleSavePlatformAdUnit(config)}
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`${config.id}_android`} className="text-muted-foreground">Android</Label>
                              <Input
                                id={`${config.id}_android`}
                                value={getPlatformAdUnitValue(config, 'android')}
                                onChange={(e) => handlePlatformAdUnitChange(config.id, 'android', e.target.value)}
                                placeholder="ca-app-pub-XXXX/YYYY"
                                className="font-mono text-sm"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`${config.id}_ios`} className="text-muted-foreground">iOS</Label>
                              <Input
                                id={`${config.id}_ios`}
                                value={getPlatformAdUnitValue(config, 'ios')}
                                onChange={(e) => handlePlatformAdUnitChange(config.id, 'ios', e.target.value)}
                                placeholder="ca-app-pub-XXXX/YYYY"
                                className="font-mono text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const intAdmin = INTEGER_ADMIN_CONFIG[config.key];
                    if (intAdmin) {
                      const coerced = coerceConfigNumber(config.value);
                      const storedInt = Number.isFinite(coerced)
                        ? Math.floor(coerced)
                        : intAdmin.min;
                      const displayStr =
                        editedValues[config.id] !== undefined
                          ? editedValues[config.id]
                          : String(storedInt);
                      const hasIntChanged =
                        editedValues[config.id] !== undefined &&
                        String(editedValues[config.id]).trim() !== String(storedInt);

                      return (
                        <div
                          key={config.id}
                          className="space-y-2 border-b pb-4 last:border-0 rounded-md border border-primary/20 bg-muted/30 p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-1">
                              <p className="text-sm font-semibold text-foreground">{intAdmin.label}</p>
                              <p className="text-xs font-mono text-muted-foreground">{config.key}</p>
                              <p className="text-sm text-muted-foreground">{intAdmin.helper}</p>
                              {config.description ? (
                                <p className="text-xs text-muted-foreground/80">{config.description}</p>
                              ) : null}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => saveIntegerAdminConfig(config, intAdmin)}
                              disabled={!hasIntChanged || saving === config.id}
                              variant={hasIntChanged ? "default" : "outline"}
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
                          <div className="flex flex-wrap items-center gap-2">
                            <Label htmlFor={config.id} className="sr-only">
                              {intAdmin.label}
                            </Label>
                            <Input
                              id={config.id}
                              type="number"
                              min={intAdmin.min}
                              max={intAdmin.max}
                              step={1}
                              value={displayStr}
                              onChange={(e) => handleValueChange(config.id, e.target.value)}
                              className="max-w-[12rem] font-mono"
                            />
                            <span className="text-xs text-muted-foreground">
                              範圍：{intAdmin.min}～{intAdmin.max}
                            </span>
                          </div>
                        </div>
                      );
                    }

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
                        {isObject || isLongText ? (
                          <textarea
                            id={config.id}
                            value={currentValue}
                            onChange={(e) => handleValueChange(config.id, e.target.value)}
                            className="w-full min-h-[200px] p-2 border rounded-md font-mono text-sm bg-background"
                            rows={isLongText ? 10 : 3}
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
