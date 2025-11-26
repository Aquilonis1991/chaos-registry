import type { PluginListenerHandle } from "@capacitor/core";

export type NativeAdMediaType = "image" | "video";

export interface NativeAdMediaContent {
  type: NativeAdMediaType;
  url?: string;
  aspectRatio?: number;
  durationSeconds?: number;
}

export interface NativeAdData {
  headline: string;
  body?: string;
  callToAction?: string;
  advertiser?: string;
  store?: string;
  price?: string;
  starRating?: number;
  iconUrl?: string;
  imageUrl?: string;
  mediaContent?: NativeAdMediaContent;
  clickUrl?: string;
  adUnitId?: string;
  adNetworkName?: string;
  extras?: Record<string, any>;
}

export interface LoadNativeAdOptions {
  adUnitId?: string;
}

export interface NativeAdLoadResult {
  data?: NativeAdData;
  error?: string;
}

export interface NativeAdPlugin {
  loadNativeAd(options: LoadNativeAdOptions): Promise<NativeAdLoadResult>;
  addListener(
    eventName: "onNativeAdClicked" | "onNativeAdImpression",
    listenerFunc: (data: NativeAdData) => void
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

