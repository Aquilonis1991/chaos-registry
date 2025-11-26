import { WebPlugin, PluginListenerHandle } from "@capacitor/core";
import type {
  LoadNativeAdOptions,
  NativeAdLoadResult,
  NativeAdPlugin,
  NativeAdData,
} from "./definitions";

export class NativeAdWeb extends WebPlugin implements NativeAdPlugin {
  async loadNativeAd(_: LoadNativeAdOptions): Promise<NativeAdLoadResult> {
    const error = "NativeAdPlugin is only available on Android/iOS";
    console.warn("[NativeAdPlugin] web stub invoked");
    return { error };
  }

  async addListener(
    eventName: "onNativeAdClicked" | "onNativeAdImpression",
    listenerFunc: (data: NativeAdData) => void
  ): Promise<PluginListenerHandle> {
    console.warn(
      `[NativeAdPlugin] addListener (\${eventName}) called on web; no-op.`
    );
    return super.addListener(eventName, listenerFunc);
  }

  async removeAllListeners(): Promise<void> {
    return super.removeAllListeners();
  }
}

