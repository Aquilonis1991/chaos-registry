import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useEffect, useRef, useState } from "react";

interface NativeAdCardProps {
  adUnitId?: string;
  className?: string;
  onAdLoaded?: () => void;
}

/**
 * 原生廣告卡片組件
 * 與 TopicCard 相同的尺寸和樣式，用於穿插在主題列表中
 */
export const NativeAdCard = ({ 
  adUnitId,
  className = "",
  onAdLoaded
}: NativeAdCardProps) => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const adContainerRef = useRef<HTMLDivElement>(null);
  const [adLoaded, setAdLoaded] = useState(false);

  // 調試信息
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('NativeAdCard 渲染:', { adUnitId, adLoaded });
    }
  }, [adUnitId, adLoaded]);

  useEffect(() => {
    // 檢查是否在 Capacitor 環境中
    const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor;
    const platform = isCapacitor ? (window as any).Capacitor.getPlatform() : 'web';
    
    console.log('[NativeAdCard] 環境檢查:', { 
      isCapacitor, 
      platform, 
      adUnitId,
      hasContainer: !!adContainerRef.current 
    });
    
    // 目前 @capacitor-community/admob 不支援原生廣告卡片 API
    // 在 Android/iOS 上顯示佔位符，未來可以整合原生廣告 SDK
    // 現在先確保卡片能正常顯示
    setAdLoaded(true);
    onAdLoaded?.();
    
    // 未來可以在此處整合原生廣告 SDK
    // 例如：使用 AdMob Native Ads API 或第三方原生廣告解決方案
  }, [adUnitId, onAdLoaded]);

  const placeholderText = getText('home.ad.native.placeholder', '📱 AdMob 原生廣告');
  const debugMessage = getText('home.ad.native.debugMode', '除錯模式：廣告功能暫時停用');
  const testLabel = getText('home.ad.native.testLabel', '測試用廣告卡片');

  return (
    <Card
      className={`bg-gradient-to-br from-[#fff2f7] via-white to-[#ffe0f0] border-2 border-dashed border-pink-500/70 shadow-[0_8px_30px_rgba(255,105,180,0.25)] ring-2 ring-pink-200/60 ${className}`}
    >
      <CardContent className="p-6">
        {/* 測試標記 */}
        <div className="flex items-center justify-between mb-4">
          <Badge variant="destructive" className="text-xs font-bold tracking-wide px-3 py-1">
            {testLabel}
          </Badge>
          <span className="text-[10px] uppercase font-semibold text-pink-600 tracking-[0.2em]">
            Demo Only
          </span>
        </div>

        <div
          ref={adContainerRef}
          className="min-h-[220px] flex flex-col items-center justify-center gap-4 rounded-2xl border border-pink-200/70 bg-white/60 p-6 text-center"
        >
          <div className="space-y-3 w-full">
            <div className="flex items-center justify-center gap-3 text-pink-600">
              <span className="text-2xl">🎯</span>
              <p className="text-base font-semibold">{placeholderText}</p>
            </div>
            <p className="text-xs text-muted-foreground text-center">{debugMessage}</p>
            <div className="flex justify-center gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-full bg-muted px-3 py-1">AdMob</span>
              <span className="rounded-full bg-muted px-3 py-1">Native</span>
              <span className="rounded-full bg-muted px-3 py-1">Preview</span>
            </div>
            {/* 未來 AdMob 原生廣告會在這裡渲染 */}
            <div 
              ref={adContainerRef}
              id={`native-ad-${adUnitId || 'default'}`} 
              className="mt-4 min-h-[100px]"
            >
              {/* 原生廣告容器 */}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NativeAdCard;

