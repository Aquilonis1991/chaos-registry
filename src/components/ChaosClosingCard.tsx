import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Copy, Zap } from "lucide-react";
import { useUIText } from "@/hooks/useUIText";
import { LoadingBubble } from "@/components/ui/LoadingBubble";

export interface AiClosingStatement {
  id: string;
  topic_id: string;
  content: string;
  created_at: string;
}

interface ChaosClosingCardProps {
  statement: AiClosingStatement | null;
  isLoading: boolean;
  language: string;
}

export const ChaosClosingCard = ({ statement, isLoading, language }: ChaosClosingCardProps) => {
  const { getText } = useUIText(language as any);
  const [expanded, setExpanded] = useState(true);

  const title = getText("chaos_closing.title", "⚡ 混亂結語");
  const loadingText = getText("chaos_closing.loading", "系統正在生成混亂結語...");
  const copySuccess = getText("chaos_closing.copySuccess", "已複製到剪貼簿");
  const copyButton = getText("chaos_closing.copy", "複製");

  const handleCopy = async () => {
    if (!statement?.content) return;
    try {
      await navigator.clipboard.writeText(statement.content);
      toast.success(copySuccess);
    } catch {
      toast.error("複製失敗");
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full border-2 border-accent/30 shadow-lg">
        <CardContent className="flex flex-col items-center justify-center p-8 min-h-[120px]">
          <LoadingBubble isLoading defaultText={loadingText} />
        </CardContent>
      </Card>
    );
  }

  if (!statement) return null;

  return (
    <Card className="w-full border-2 border-accent/30 shadow-xl overflow-hidden">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded((e) => !e)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-accent-foreground">
            <Zap className="w-5 h-5 text-accent" />
            {title}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0 pb-4">
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-base leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {statement.content}
            </p>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
              <Copy className="w-4 h-4" />
              {copyButton}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
