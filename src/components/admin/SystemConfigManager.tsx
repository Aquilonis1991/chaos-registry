import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Settings } from "lucide-react";
import { useSystemConfig } from "@/hooks/useSystemConfig";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invalidateConfigCache } from "@/hooks/useSystemConfigCache";

const SystemConfigManager = () => {
  const { configs, loading, updateConfig } = useSystemConfig();
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<string | null>(null);

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
      if (typeof originalValue === 'object') {
        parsedValue = JSON.parse(editedValue);
      } else if (typeof originalValue === 'number') {
        parsedValue = Number(editedValue);
      } else {
        parsedValue = editedValue;
      }

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

  const groupedConfigs = configs.reduce((acc, config) => {
    if (!acc[config.category]) {
      acc[config.category] = [];
    }
    acc[config.category].push(config);
    return acc;
  }, {} as Record<string, typeof configs>);

  const categoryNames: Record<string, string> = {
    recharge: '儲值配置',
    validation: '驗證限制',
    voting: '投票配置',
    topic_cost: '主題成本',
    mission: '任務獎勵',
    user: '用戶配置'
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
        <Tabs defaultValue={Object.keys(groupedConfigs)[0]} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            {Object.keys(groupedConfigs).map(category => (
              <TabsTrigger key={category} value={category}>
                {categoryNames[category] || category}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(groupedConfigs).map(([category, categoryConfigs]) => (
            <TabsContent key={category} value={category} className="space-y-4">
              {categoryConfigs.map((config) => {
                const currentValue = getValue(config.id, config.value);
                const hasChanged = editedValues[config.id] !== undefined;
                const isObject = typeof config.value === 'object';

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
              })}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default SystemConfigManager;
