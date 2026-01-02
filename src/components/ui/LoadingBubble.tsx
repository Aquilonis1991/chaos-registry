import { Loader2 } from "lucide-react";
import { useUIText } from "@/hooks/useUIText";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { useState, useRef } from "react";

interface LoadingBubbleProps {
    isLoading: boolean;
    textKey?: string;
    defaultText?: string;
}

const PATIENCE_MESSAGES = [
    { key: 'loading.patience_01', default: '別急，系統正在努力運轉中...' },
    { key: 'loading.patience_02', default: '再點螢幕要破了，請稍候片刻！' },
    { key: 'loading.patience_03', default: '您的請求很重要，我們正在仔細處理...' },
    { key: 'loading.patience_04', default: '喝口水休息一下，馬上就好！' },
    { key: 'loading.patience_05', default: '處理大量數據中，請給我們一點時間...' },
];

export const LoadingBubble = ({
    isLoading,
    textKey = "loading.non_essential_process",
    defaultText = "你的申請已進入非必要流程。"
}: LoadingBubbleProps) => {
    const { language } = useLanguage();
    const { getText } = useUIText(language);
    const clickCount = useRef(0);
    const lastClickTime = useRef(0);

    if (!isLoading) return null;

    const handleOverlayClick = () => {
        const now = Date.now();
        // Prevent spamming toasts (limit to one every 800ms)
        if (now - lastClickTime.current < 800) return;

        lastClickTime.current = now;
        clickCount.current += 1;

        // Pick a random message
        const randomIndex = Math.floor(Math.random() * PATIENCE_MESSAGES.length);
        const message = PATIENCE_MESSAGES[randomIndex];

        toast.info(getText(message.key, message.default), {
            duration: 2000,
            className: "bg-background/95 backdrop-blur border-primary/20"
        });
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 cursor-wait"
            onClick={handleOverlayClick}
        >
            <div
                className="bg-background/95 border border-border/50 shadow-2xl rounded-2xl p-6 max-w-[80vw] w-auto flex flex-col items-center gap-4 text-center animate-in zoom-in-95 duration-200 slide-in-from-bottom-4"
                onClick={(e) => e.stopPropagation()} // Prevent clicks on the bubble itself from triggering the "patience" toast? Or maybe allow it? User said "clicking the screen". Let's allow bubbling or handle it separately. Actually, user said "blocking user from clicking OTHER buttons". The overlay does that. Clicking the overlay should trigger the message. Clicking the bubble... probably should strictly do nothing or same thing. Let's let it bubble up to overlay for consistent experience.
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
