import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Save, ScrollText } from "lucide-react";
import { useSystemConfig } from "@/hooks/useSystemConfig";
import { invalidateConfigCache } from "@/hooks/useSystemConfigCache";
import { toast } from "sonner";

interface LegalConfigItem {
  key: string;
  label: string;
  description: string;
  placeholder: string;
}

const LEGAL_CONFIGS: LegalConfigItem[] = [
  {
    key: "legal_terms_content",
    label: "使用者條款內容",
    description: "顯示於 App /terms 頁面，可輸入純文字，換行將自動保留。",
    placeholder: "請輸入完整的使用者條款內容...",
  },
  {
    key: "legal_privacy_content",
    label: "隱私權政策內容",
    description: "顯示於 App /privacy 頁面，可輸入純文字，換行將自動保留。",
    placeholder: "請輸入完整的隱私權政策內容...",
  },
];

export const LegalContentManager = () => {
  const { configs, loading, updateConfig, fetchConfigs } = useSystemConfig();
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const getConfigValue = (key: string) => {
    const config = configs.find((c) => c.key === key);
    return config?.value ?? "";
  };

  useEffect(() => {
    if (!loading) {
      const initialValues = LEGAL_CONFIGS.reduce((acc, config) => {
        acc[config.key] = String(getConfigValue(config.key) || "");
        return acc;
      }, {} as Record<string, string>);
      setFormValues(initialValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, configs]);

  const handleSave = async (key: string) => {
    const config = configs.find((c) => c.key === key);
    if (!config) {
      toast.error(`找不到 ${key} 對應的系統配置`);
      return;
    }

    setSavingKey(key);
    try {
      const success = await updateConfig(config.id, formValues[key] ?? "");
      if (success) {
        await fetchConfigs();
        invalidateConfigCache();
        toast.success(`${key === "legal_terms_content" ? "使用者條款" : "隱私權政策"} 已更新`);
      }
    } finally {
      setSavingKey(null);
    }
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
          <ScrollText className="w-5 h-5" />
          <CardTitle>條款管理</CardTitle>
        </div>
        <CardDescription>
          直接於此編輯使用者條款與隱私權政策，儲存後 App 會立即更新。僅支援純文字與換行。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {LEGAL_CONFIGS.map((item) => (
          <div key={item.key} className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold">{item.label}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Button
                size="sm"
                onClick={() => handleSave(item.key)}
                disabled={savingKey === item.key}
                className="shrink-0"
              >
                {savingKey === item.key ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    儲存中
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    儲存
                  </>
                )}
              </Button>
            </div>
            <Textarea
              value={formValues[item.key] ?? ""}
              onChange={(e) =>
                setFormValues((prev) => ({
                  ...prev,
                  [item.key]: e.target.value,
                }))
              }
              rows={16}
              placeholder={item.placeholder}
              className="font-mono text-sm whitespace-pre-wrap"
            />
            <div className="rounded border bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground mb-2">即時預覽：</p>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-foreground">
                {formValues[item.key]?.trim() || "（目前尚無內容，請輸入文字）"}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default LegalContentManager;

