import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import type { PromptConfigKey } from "@/lib/promptConfigError";

interface PromptNotConfiguredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  configKey: PromptConfigKey | string;
  title?: string;
  description?: string;
}

export function PromptNotConfiguredDialog({
  open,
  onOpenChange,
  configKey,
  title,
  description,
}: PromptNotConfiguredDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(configKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the input so user can Cmd+C
      const el = document.getElementById("prompt-config-key-input");
      if (el instanceof HTMLInputElement) {
        el.select();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {title ?? "此功能需要後台設定"}
          </DialogTitle>
          <DialogDescription>
            {description ??
              "請在後台「AI Prompt 管理」或「系統設定」中設定以下 key，即可使用此功能。"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 items-center">
          <Input
            id="prompt-config-key-input"
            readOnly
            value={configKey}
            className="font-mono text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleCopy}
            aria-label="複製 key"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            關閉
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
