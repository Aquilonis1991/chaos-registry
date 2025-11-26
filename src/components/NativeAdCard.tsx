import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NativeAdData } from "@/types/nativeAd";
import { NativeAd } from "@votechaos/native-ad-plugin";

interface NativeAdCardProps {
  adUnitId?: string;
  className?: string;
  onAdLoaded?: (ad?: NativeAdData) => void;
  /**
   * 在尚未串接原生插件前，是否允許使用 mock 資料。
   * 預設 true，等 Native Ad Plugin 完成後可以關閉。
   */
  enableMock?: boolean;
}

type AdStatus = "idle" | "loading" | "ready" | "error";

/**
 * 原生廣告卡片組件（會根據 AdMob Native Ad 資料渲染）
 */
export const NativeAdCard = ({
  adUnitId,
  className = "",
  onAdLoaded,
  enableMock = true,
}: NativeAdCardProps) => {
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const [status, setStatus] = useState<AdStatus>("idle");
  const [adData, setAdData] = useState<NativeAdData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const placeholderText = getText("home.ad.native.placeholder", "📱 AdMob 原生廣告");
  const debugMessage = getText("home.ad.native.debugMode", "除錯模式：原生廣告模擬資料");
  const retryText = getText("common.button.retry", "重新嘗試");
  const loadingText = getText("common.state.loading", "載入中...");

  const mockData = useMemo<NativeAdData>(
    () => ({
      headline: "ChaosRegistry Fun Poll",
      body: "立即參與最混亂的話題，投下你的關鍵一票，解鎖更多任務獎勵！",
      callToAction: "立即參與",
      advertiser: "AdMob Demo Advertiser",
      store: "App Store & Play Store",
      price: "免費",
      starRating: 4.8,
      iconUrl: "https://i.imgur.com/xY6G9.png",
      imageUrl: "https://i.imgur.com/N1JcPTb.png",
      mediaContent: {
        type: "image",
        url: "https://i.imgur.com/N1JcPTb.png",
        aspectRatio: 1.6,
      },
      adUnitId,
      adNetworkName: "AdMob (Mock)",
    }),
    [adUnitId]
  );

  const loadNativeAd = useCallback(async () => {
    if (!adUnitId) {
      setStatus("error");
      setErrorMessage("缺少 adUnitId，無法載入廣告");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      let data: NativeAdData | undefined;

      if (NativeAd && typeof NativeAd.loadNativeAd === "function") {
        const result = await NativeAd.loadNativeAd({ adUnitId });
        if (result?.data) {
          data = result.data;
        } else if (result?.error) {
          throw new Error(result.error);
        }
      } else if (enableMock) {
        data = await loadMockNativeAd(mockData);
      } else {
        throw new Error("NativeAdPlugin 尚未整合");
      }

      if (!data) {
        throw new Error("未取得原生廣告資料");
      }

      setAdData(data);
      setStatus("ready");
      onAdLoaded?.(data);
    } catch (error: any) {
      console.error("[NativeAdCard] 載入原生廣告失敗", error);
      setStatus("error");
      setErrorMessage(error?.message || "載入原生廣告失敗");
      setAdData(null);
      onAdLoaded?.();
    }
  }, [adUnitId, enableMock, mockData, onAdLoaded]);

  useEffect(() => {
    loadNativeAd();
  }, [loadNativeAd]);

  const renderMedia = () => {
    if (!adData?.mediaContent && !adData?.imageUrl && !adData?.imageBase64) {
      return null;
    }

    const media = adData.mediaContent;
    const isVideo = media?.type === "video";
    const mediaUrl = media?.url || adData.imageUrl || adData.imageBase64;

    if (!mediaUrl) {
      return null;
    }

    return (
      <div className="rounded-2xl overflow-hidden border border-border">
        {isVideo ? (
          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-xs uppercase tracking-widest">
              Video Preview
            </div>
            <video
              src={mediaUrl}
              className="w-full h-48 object-cover"
              muted
              playsInline
              autoPlay
              loop
            />
          </div>
        ) : (
          <img
            src={mediaUrl}
            alt={adData.headline}
            className="w-full h-48 object-cover"
            loading="lazy"
          />
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (status === "loading") {
      return (
        <div className="flex flex-col items-center justify-center gap-3 min-h-[220px] text-muted-foreground">
          <div className="w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin" />
          <p className="text-sm font-medium">{loadingText}</p>
        </div>
      );
    }

    if (status === "error" || !adData) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 min-h-[220px] text-center">
          <p className="text-sm text-muted-foreground">
            {errorMessage || debugMessage}
          </p>
          <Button variant="outline" size="sm" onClick={loadNativeAd}>
            {retryText}
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {renderMedia()}

        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {(adData.iconUrl || adData.iconBase64) && (
                <img
                  src={adData.iconUrl || adData.iconBase64}
                  alt={adData.advertiser || "ad"}
                  className="w-12 h-12 rounded-2xl object-cover border border-border"
                  loading="lazy"
                />
              )}
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-semibold mb-1">
                  {adData.advertiser || "Sponsored"}
                </p>
                <h3 className="text-lg font-bold text-foreground">
                  {adData.headline}
                </h3>
              </div>
            </div>
            {adData.starRating ? (
              <div className="flex flex-col items-end">
                <span className="text-sm font-semibold text-amber-500">
                  ★ {adData.starRating.toFixed(1)}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase">
                  Rated
                </span>
              </div>
            ) : null}
          </div>

          {adData.body && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {adData.body}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {adData.store && (
            <span className="rounded-full bg-muted px-3 py-1">
              {adData.store}
            </span>
          )}
          {adData.price && (
            <span className="rounded-full bg-muted px-3 py-1">
              {adData.price}
            </span>
          )}
        </div>

        <Button
          className="w-full"
          onClick={() => {
            if (adData.clickUrl) {
              window.open(adData.clickUrl, "_blank", "noopener,noreferrer");
            }
          }}
        >
          {adData.callToAction || "了解更多"}
        </Button>
      </div>
    );
  };

  return (
    <Card
      className={`bg-gradient-card shadow-card w-full ${className}`}
      style={{
        minWidth: "300px",
        minHeight: "250px",
        width: "100%",
        maxWidth: "100%",
      }}
    >
      <CardContent className="p-4 sm:p-6 space-y-4">
        {renderContent()}
      </CardContent>
    </Card>
  );
};

const loadMockNativeAd = (mockData: NativeAdData) => {
  return new Promise<NativeAdData>((resolve) => {
    setTimeout(() => resolve(mockData), 600);
  });
};

export default NativeAdCard;

