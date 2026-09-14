// 共用的商店連結設定，供 LandingPage / WebAdminOnlyPage 等頁面使用。
// 實際網址可透過 system_config 的 app_store_url_android / app_store_url_ios 覆寫，
// 這裡的常數只是後台尚未設定時的預設值。
export const ANDROID_PACKAGE = "com.votechaos.app";
export const DEFAULT_ANDROID_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
export const DEFAULT_IOS_STORE_URL = "https://apps.apple.com/app/id000000000";

export function normalizeStoreUrl(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  return String(raw).trim();
}
