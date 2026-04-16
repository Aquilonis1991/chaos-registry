import { Loader2 } from "lucide-react";
import { useUIText } from "@/hooks/useUIText";
import { useLanguage } from "@/contexts/LanguageContext";

interface LoadingBubbleProps {
    isLoading: boolean;
    textKey?: string;
    defaultText?: string;
}

export const LoadingBubble = ({
    isLoading,
    textKey = "loading.non_essential_process",
    defaultText = "你的申請已進入非必要流程。"
}: LoadingBubbleProps) => {
    const { language } = useLanguage();
    const { getText } = useUIText(language);

    if (!isLoading) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 cursor-wait"
        >
            <div
                className="bg-background/95 border border-border/50 shadow-2xl rounded-2xl p-6 max-w-[80vw] w-auto flex flex-col items-center gap-4 text-center animate-in zoom-in-95 duration-200 slide-in-from-bottom-4"
            >
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg animate-pulse" />
                    <Loader2 className="w-10 h-10 text-primary animate-spin relative z-10" />
                </div>
                <div className="space-y-1">
                    <p className="text-lg font-medium text-foreground">
                        {getText(textKey, defaultText)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {getText('loading.please_wait', '請稍候...')}
                    </p>
                </div>
            </div>
        </div>
    );
};
