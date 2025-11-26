import { registerPlugin } from "@capacitor/core";
import type { NativeAdPlugin } from "./definitions";

const NativeAd = registerPlugin<NativeAdPlugin>("NativeAdPlugin", {
  web: () => import("./web").then((m) => new m.NativeAdWeb()),
});

export * from "./definitions";
export { NativeAd };

