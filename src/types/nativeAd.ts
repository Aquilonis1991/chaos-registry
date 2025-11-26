export type NativeAdMediaType = 'image' | 'video';

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
  iconBase64?: string;
  imageUrl?: string;
  imageBase64?: string;
  mediaContent?: NativeAdMediaContent;
  clickUrl?: string;
  adUnitId?: string;
  adNetworkName?: string;
  extras?: Record<string, any>;
}

export interface NativeAdLoadResult {
  data?: NativeAdData;
  error?: string;
}

