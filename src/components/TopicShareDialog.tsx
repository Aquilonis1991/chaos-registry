import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useMissionOperations } from "@/hooks/useMissionOperations";
import { playTokenAmountHaptic } from "@/lib/tokenHaptics";

const DAILY_SHARE_MISSION_ID = "daily_share_1";

type TemplateKey = "normal" | "help" | "challenge" | "chaos";

const TEMPLATE_KEYS: TemplateKey[] = ["normal", "help", "challenge", "chaos"];

/** 後台尚未設定文案時的備援（與 migration 預設一致） */
const FALLBACK_TEMPLATE: Record<TemplateKey, string> = {
  normal: "這題怎麼看？\n「{{title}}」\n\n{{url}}",
  help: "急！在線等！這題超難抉擇，大家會怎麼選？🤔\n「{{title}}」\n\n{{url}}",
  challenge: "我覺得選這個穩贏，敢不敢來投票對決？😎\n「{{title}}」\n\n{{url}}",
  chaos: "世界越快，心則慢... 拜託告訴我這題的正確答案是什麼🤯\n「{{title}}」\n\n{{url}}",
};

function buildShareUrl(topicId: string): string {
  if (typeof window === "undefined") return "";
  const base = window.location.origin.replace(/\/$/, "");
  return `${base}/vote/${topicId}`;
}

function applyTemplate(raw: string, title: string, url: string): string {
  return raw.replace(/\{\{title\}\}/g, title).replace(/\{\{url\}\}/g, url);
}

interface TopicShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
  topicTitle: string;
}

export function TopicShareDialog({ open, onOpenChange, topicId, topicTitle }: TopicShareDialogProps) {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const { user } = useAuth();
  const { refreshProfile } = useProfile();
  const { completeMission } = useMissionOperations();
  const [copied, setCopied] = useState(false);
  const [completing, setCompleting] = useState(false);

  const shareUrl = useMemo(() => buildShareUrl(topicId), [topicId]);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setCompleting(false);
    }
  }, [open]);

  const copyTemplate = useCallback(
    async (key: TemplateKey) => {
      const raw = getText(`topic.share.template.${key}`, FALLBACK_TEMPLATE[key]);
      const text = applyTemplate(raw?.trim() ? raw : FALLBACK_TEMPLATE[key], topicTitle, shareUrl);
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success(getText("topic.share.toast.copiedTitle", "已複製"), {
          description: getText("topic.share.toast.copiedDesc", "請貼到 LINE / Threads 分享"),
        });
      } catch {
        toast.error(getText("topic.share.clipboardError", "無法複製到剪貼簿"));
      }
    },
    [getText, shareUrl, topicTitle]
  );

  const handleComplete = useCallback(async () => {
    if (!user?.id) {
      toast.info(getText("topic.share.loginRequired", "請先登入以領取分享獎勵"));
      return;
    }
    setCompleting(true);
    try {
      const result = await completeMission(DAILY_SHARE_MISSION_ID);
      if (result?.success) {
        const reward = result.reward ?? 0;
        void playTokenAmountHaptic(reward, "gain");
        await refreshProfile();
        toast.success(getText("topic.share.completeSuccess", "已領取今日分享獎勵"), {
          description: `+${reward.toLocaleString()}`,
        });
        onOpenChange(false);
      }
    } catch {
      // useMissionOperations 已 toast RPC 錯誤
    } finally {
      setCompleting(false);
    }
  }, [completeMission, getText, onOpenChange, refreshProfile, user?.id]);

  const title = getText("topic.share.title", "分享這個話題");
  const subtitle = getText("topic.share.subtitle", "選一則文案複製，貼到 LINE / Threads 等");
  const completeLabel = getText("topic.share.completeButton", "我已分享完成");
  const claimingLabel = getText("mission.list.claiming", "領取中...");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-left">{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {TEMPLATE_KEYS.map((key) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              className="h-auto min-h-[3rem] whitespace-normal py-2 text-sm"
              onClick={() => void copyTemplate(key)}
            >
              {getText(`topic.share.templateLabel.${key}`, key)}
            </Button>
          ))}
        </div>

        {copied && (
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              className="w-full bg-[#FF4D94] text-white hover:bg-[#FF4D94]/90"
              disabled={completing}
              onClick={() => void handleComplete()}
            >
              {completing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin shrink-0" aria-hidden />
                  {claimingLabel}
                </>
              ) : (
                completeLabel
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
