import { getTaipeiDateKey } from "@/lib/taipeiCalendar";

/** 供「口耳相傳」每日複製門檻使用 */
export function getTaipeiDateKeyForShare(date = new Date()): string {
  return getTaipeiDateKey(date);
}

const storageKey = (userId: string) =>
  `votechaos_daily_share_copied_${userId}_${getTaipeiDateKeyForShare()}`;

export function markDailyShareCopied(userId: string): void {
  try {
    localStorage.setItem(storageKey(userId), "1");
  } catch {
    /* ignore */
  }
}

export function hasDailyShareCopiedToday(userId: string): boolean {
  try {
    return localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return false;
  }
}

export const DAILY_SHARE_COPIED_EVENT = "votechaos-daily-share-copied";
