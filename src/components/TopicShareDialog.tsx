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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useAuth } from "@/hooks/useAuth";
import { DAILY_SHARE_COPIED_EVENT, markDailyShareCopied } from "@/lib/dailyShareCopyGate";

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
  const [draftText, setDraftText] = useState("");

  const shareUrl = useMemo(() => buildShareUrl(topicId), [topicId]);

  useEffect(() => {
    if (!open) return;
    const key = TEMPLATE_KEYS[Math.floor(Math.random() * TEMPLATE_KEYS.length)]!;
    const raw = getText(`topic.share.template.${key}`, FALLBACK_TEMPLATE[key]);
    const text = applyTemplate(raw?.trim() ? raw : FALLBACK_TEMPLATE[key], topicTitle, shareUrl);
    setDraftText(text);
  }, [open, topicId, topicTitle, shareUrl, getText]);

  const handleCopyAndShare = useCallback(async () => {
    const text = draftText.trim();
    if (!text) {
      toast.info(getText("topic.share.emptyDraft", "請先輸入要分享的內容"));
      return;
    }
    // 任務條件是「有點擊複製按鈕」，不依賴原生環境 clipboard API 是否可用
    if (user?.id) {
      markDailyShareCopied(user.id);
      window.dispatchEvent(new Event(DAILY_SHARE_COPIED_EVENT));
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(getText("topic.share.toast.copiedTitle", "已複製"), {
        description: getText(
          "topic.share.toast.afterCopyHint",
          "請貼到 LINE / Threads 等；每日獎勵請至任務頁領取"
        ),
      });
      onOpenChange(false);
    } catch {
      toast.success(getText("topic.share.toast.copiedTitle", "已登記"), {
        description: getText(
          "topic.share.clipboardError",
          "此裝置無法直接複製到剪貼簿，但已記錄口耳相傳任務，可回任務頁領取"
        ),
      });
      onOpenChange(false);
    }
  }, [draftText, getText, onOpenChange, user?.id]);

  const title = getText("topic.share.title", "分享這個話題");
  const subtitle = getText(
    "topic.share.subtitle",
    "已隨機套用一種語氣，可自行修改後複製分享"
  );
  const missionHint = getText(
    "topic.share.missionHint",
    "代幣獎勵請至「任務」頁完成領取（每日一次）"
  );
  const copyShareLabel = getText("topic.share.copyAndShareButton", "複製並分享");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-left">{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            className="min-h-[9rem] resize-y text-sm leading-relaxed"
            aria-label={getText("topic.share.draft.aria", "分享文案，可編輯")}
          />
          <p className="text-xs text-muted-foreground">{missionHint}</p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button
            type="button"
            className="w-full bg-[#FF4D94] text-white hover:bg-[#FF4D94]/90"
            onClick={() => void handleCopyAndShare()}
          >
            {copyShareLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
