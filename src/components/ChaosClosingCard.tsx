import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";
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

  const title = getText("chaos_closing.title", "⚡ 混亂結語");
  const loadingText = getText("chaos_closing.loading", "系統正在生成混亂結語...");

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
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-bold text-accent-foreground">
          <Zap className="w-5 h-5 text-accent" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <div className="prose dark:prose-invert max-w-none">
          <p className="text-base leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {statement.content}
          </p>
        </div>
        {statement.created_at && (
          <div className="mt-4">
            <span className="text-xs text-muted-foreground">
              {getText("chaos_closing.generatedAt", "生成於")}{" "}
              {new Date(statement.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
