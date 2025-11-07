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
  placeholderText = "AdMob Banner 廣告（暫時停用）",
  className = ""
}: AdBannerProps) => {
  // 暫時完全停用 AdMob，只顯示佔位符
  return (
    <div className={`bg-muted/50 border-2 border-dashed border-muted-foreground/30 rounded-lg p-4 text-center ${className}`}>
      <p className="text-muted-foreground text-sm">📱 {placeholderText}</p>
      <p className="text-muted-foreground text-xs">除錯模式：廣告功能暫時停用</p>
    </div>
  );
};

export default AdBanner;
