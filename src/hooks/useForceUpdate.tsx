import { useEffect, useState } from "react";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";
import { getAppInfo, getPlatform, isNative } from "@/lib/capacitor";
import { isVersionAtLeast } from "@/lib/versionCheck";

const ANDROID_PACKAGE = "com.votechaos.app";
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
const APP_STORE_URL = "https://apps.apple.com/app/id000000000"; // 上架後改為實際 App Store ID

export interface ForceUpdateState {
  /** 是否需強制更新（當前版本 < 後端要求之最低版本） */
  needsForceUpdate: boolean;
  /** 當前 App 版本 */
  currentVersion: string;
  /** 後端要求之最低版本 */
  minimumVersion: string | null;
  /** 前往商店的連結（依平台） */
  storeUrl: string;
  /** 檢查中（尚未取得版本或設定） */
  loading: boolean;
}

/**
 * 僅在原生 App 時檢查；從 system_config 讀取 app_min_version，
 * 若當前版本低於該值則 needsForceUpdate = true。
 */
function getConfigValue(configs: Record<string, unknown>, key: string): string {
  const v = configs[key];
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  return String(v).trim();
}

export function useForceUpdate(): ForceUpdateState {
  const { configs, loading: configLoading } = useSystemConfigCache();
  const [currentVersion, setCurrentVersion] = useState("");
  const [minimumVersion, setMinimumVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isNative()) {
      setCurrentVersion(typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "");
      return;
    }

    let cancelled = false;

    const run = async () => {
      const minRaw = getConfigValue(configs, "app_min_version");
      const min = minRaw ? minRaw : null;
      if (!cancelled) setMinimumVersion(min);

      try {
        const info = await getAppInfo();
        const version = info?.version ?? (typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "");
        if (!cancelled) setCurrentVersion(version);
      } catch {
        if (!cancelled) setCurrentVersion(typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [configs]);

  const loading = configLoading && isNative();
  const minVer = minimumVersion ?? "";
  const needsForceUpdate =
    isNative() &&
    !!minVer &&
    !!currentVersion &&
    !isVersionAtLeast(currentVersion, minVer);

  const platform = getPlatform();
  const storeUrlFromConfig =
    platform === "ios"
      ? getConfigValue(configs, "app_store_url_ios")
      : getConfigValue(configs, "app_store_url_android");
  const storeUrl =
    storeUrlFromConfig || (platform === "ios" ? APP_STORE_URL : PLAY_STORE_URL);

  return {
    needsForceUpdate,
    currentVersion,
    minimumVersion,
    storeUrl,
    loading,
  };
}
