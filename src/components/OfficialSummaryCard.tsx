import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Sparkles } from "lucide-react";
import { useUIText } from "@/hooks/useUIText";
import { LoadingBubble } from "@/components/ui/LoadingBubble";

// Define interface for summary data
export interface TopicSummary {
    id: string;
    topic_id: string;
    summary_zh: string;
    summary_en: string;
    summary_ja: string;
    chaos_level: string;
    created_at: string;
}

interface OfficialSummaryCardProps {
    summary: TopicSummary | null;
    isLoading: boolean;
    language: string; // 'zh', 'en', 'ja'
}

export const OfficialSummaryCard = ({ summary, isLoading, language }: OfficialSummaryCardProps) => {
    const { getText } = useUIText(language as any);

    // Localization for Title and Footer
    // Defaults to IV if not present
    const rawTitle = getText('official_summary.title', '📄 官方結語（混亂等級 {{level}}）');
    const title = rawTitle.replace('{{level}}', summary?.chaos_level || 'IV');
    const footer = getText('official_summary.footer', '系統已完成資料彙整。');
    const loadingText = getText('official_summary.loading', '系統正在彙整混亂數據...');

    if (isLoading) {
        return (
            <Card className="w-full border-2 border-primary/20 shadow-lg animate-pulse">
                <CardContent className="flex flex-col items-center justify-center p-8 min-h-[200px] gap-4">
                    <LoadingBubble
                        isLoading={true}
                        defaultText={loadingText}
                    />
                </CardContent>
            </Card>
        );
    }

    if (!summary) return null;

    // Determine content based on language
    let content = summary.summary_en;
    if (language === 'zh' || language.startsWith('zh')) content = summary.summary_zh || summary.summary_en;
    if (language === 'ja') content = summary.summary_ja || summary.summary_en;

    return (
        <Card className="w-full border-2 border-primary/50 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary animate-gradient" />

            <CardHeader className="bg-muted/30 pb-2">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-primary">
                    {title}
                </CardTitle>
            </CardHeader>

            <CardContent className="p-6 pt-4">
                <div className="prose dark:prose-invert max-w-none">
                    <p className="text-lg leading-relaxed font-medium text-foreground/90">
                        {content}
                    </p>
                </div>

                <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-end text-sm text-muted-foreground italic gap-2">
                    <Sparkles className="w-4 h-4" />
                    {footer}
                </div>
            </CardContent>
        </Card>
    );
};
