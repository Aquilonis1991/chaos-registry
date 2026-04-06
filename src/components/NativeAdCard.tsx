import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NativeAdData } from "@/types/nativeAd";
import { isNative } from "@/lib/capacitor";

// NativeAd 將在組件內部動態載入（僅原生平台）

interface NativeAdCardProps {
  adUnitId?: string;
  className?: string;
  onAdLoaded?: (ad?: NativeAdData) => void;
  /**
   * 是否允許使用 mock 資料。
   * 預設 false，避免原生環境誤顯示 Demo 廣告。
   */
  enableMock?: boolean;
}

type AdStatus = "idle" | "loading" | "ready" | "error";

// 以 adUnitId 為維度做去重與退避，避免同時多次請求觸發 LOAD_IN_PROGRESS / too many failed requests。
const nativeAdInFlightByUnit = new Map<string, Promise<NativeAdData>>();
const nativeAdCooldownUntilByUnit = new Map<string, number>();

/**
 * 原生廣告卡片組件（會根據 AdMob Native Ad 資料渲染）
 * 注意：網頁版會自動失效，不顯示任何內容
 */
export const NativeAdCard = ({
  adUnitId,
  className = "",
  onAdLoaded,
  enableMock = false,
}: NativeAdCardProps) => {
  // 網頁版直接返回 null，不渲染任何內容
  if (!isNative()) {
    return null;
  }

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

    const cooldownUntil = nativeAdCooldownUntilByUnit.get(adUnitId) ?? 0;
    if (Date.now() < cooldownUntil) {
      setStatus("error");
      setErrorMessage("目前暫無可投放廣告，請稍後再試");
      return;
    }

    setStatus("loading");
    setErrorMessage(null);

    try {
      let data: NativeAdData | undefined;

      // 只在原生平台動態載入 NativeAd
      if (isNative()) {
        let plugin: any;
        try {
          plugin = await import("@votechaos/native-ad-plugin");
        } catch (importError) {
          console.warn('[NativeAdCard] Failed to import native-ad-plugin:', importError);
          if (enableMock) {
            data = await loadMockNativeAd(mockData);
          } else {
            throw new Error("NativeAdPlugin 載入失敗");
          }
        }

        if (!data) {
          const NativeAd = plugin?.NativeAd;
          if (!NativeAd || typeof NativeAd.loadNativeAd !== "function") {
            throw new Error("NativeAdPlugin 尚未整合");
          }

          const existingInFlight = nativeAdInFlightByUnit.get(adUnitId);
          if (existingInFlight) {
            data = await existingInFlight;
          } else {
            const loadPromise = (async (): Promise<NativeAdData> => {
              let result = await NativeAd.loadNativeAd({ adUnitId });

              // 多張廣告卡同時請求時，插件會回 LOAD_IN_PROGRESS；延遲一次重試即可。
              if (result?.error && String(result.error).toLowerCase().includes("load_in_progress")) {
                await new Promise((resolve) => setTimeout(resolve, 900));
                result = await NativeAd.loadNativeAd({ adUnitId });
              }

              if (result?.data) {
                return result.data as NativeAdData;
              }

              const rawError = String(result?.error || "UNKNOWN_ERROR");
              const lower = rawError.toLowerCase();
              if (
                lower.includes("code=1") ||
                lower.includes("nofill") ||
                lower.includes("no fill") ||
                lower.includes("too many recently failed requests")
              ) {
                nativeAdCooldownUntilByUnit.set(adUnitId, Date.now() + 30_000);
                throw new Error("目前暫無可投放廣告（No Fill），請稍後再試");
              }
              if (lower.includes("missing_ad_unit_id")) {
                throw new Error("廣告單元 ID 缺失，請檢查後台設定");
              }
              if (lower.includes("load_in_progress")) {
                throw new Error("廣告載入中，請稍後再試");
              }
              throw new Error(`原生廣告載入失敗：${rawError}`);
            })();

            nativeAdInFlightByUnit.set(adUnitId, loadPromise);
            try {
              data = await loadPromise;
            } finally {
              nativeAdInFlightByUnit.delete(adUnitId);
            }
          }
        }
      } else if (enableMock) {
        // 網頁版使用 mock 資料（但組件應該已經返回 null，這裡不會執行）
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
      console.error("[NativeAdCard] 載入原生廣告失敗:", error?.message || String(error));
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

