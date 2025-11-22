import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

interface AdBannerProps {
  placeholderText?: string;
  className?: string;
  autoShow?: boolean;
  autoRemove?: boolean;
}

/**
 * AdMob Banner 廣告組件（暫時停用 - 除錯模式）
 */
export const AdBanner = ({ 
  placeholderText,
  className = ""
}: AdBannerProps) => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);

  // 使用 UI 文字管理或傳入的 placeholderText
  const displayPlaceholderText = placeholderText || getText('adBanner.placeholder', 'AdMob Banner 廣告（暫時停用）');
  const debugMessage = getText('adBanner.debugMode', '除錯模式：廣告功能暫時停用');

  // 暫時完全停用 AdMob，只顯示佔位符
  return (
    <div className={`bg-muted/50 border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center ${className}`}>
      <p className="text-muted-foreground text-sm">📱 {displayPlaceholderText}</p>
      <p className="text-muted-foreground text-xs">{debugMessage}</p>
    </div>
  );
};

export default AdBanner;
