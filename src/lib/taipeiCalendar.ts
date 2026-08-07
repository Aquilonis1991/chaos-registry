/** 單一縫合點：所有「台北日/週邊界」與「UTC 日邊界」計算集中於此，避免各檔案各自實作導致漂移。 */

export function getTaipeiDateKey(date: Date = new Date()): string {
  const shifted = new Date(date.getTime() + (8 * 60 + date.getTimezoneOffset()) * 60_000);
  return shifted.toISOString().slice(0, 10);
}

export function getTaipeiDateKeyFromIso(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return getTaipeiDateKey(date);
}

/** ((streak-1) % cycleLength) + 1；streak<=0 回傳 0。 */
export function getStreakCycleDay(streak: number, cycleLength = 30): number {
  const safeStreak = Math.max(0, Math.floor(streak || 0));
  if (safeStreak <= 0) return 0;
  return ((safeStreak - 1) % cycleLength) + 1;
}

/** 當前循環的第一天日期鍵，依 getStreakCycleDay 推算（與 isRewardClaimed 原邏輯一致）。 */
export function getStreakCycleStartDateKey(
  streak: number,
  cycleLength = 30,
  now: Date = new Date()
): string {
  const cycleDay = getStreakCycleDay(streak, cycleLength);
  const cycleStart = new Date(now.getTime() - (cycleDay - 1) * 24 * 60 * 60 * 1000);
  return getTaipeiDateKey(cycleStart);
}

/** 台北當日 [00:00, 23:59:59.999] 換算為 UTC ISO 區間，供 Supabase 查詢窗口使用。 */
export function getTaipeiDayWindowUtc(date: Date = new Date()): { startUtcIso: string; endUtcIso: string } {
  const taipeiNow = new Date(date.getTime() + (8 * 60 + date.getTimezoneOffset()) * 60_000);
  const startTaipei = new Date(taipeiNow.getFullYear(), taipeiNow.getMonth(), taipeiNow.getDate(), 0, 0, 0, 0);
  const endTaipei = new Date(taipeiNow.getFullYear(), taipeiNow.getMonth(), taipeiNow.getDate(), 23, 59, 59, 999);
  const startUtcIso = new Date(startTaipei.getTime() - 8 * 60 * 60_000).toISOString();
  const endUtcIso = new Date(endTaipei.getTime() - 8 * 60 * 60_000).toISOString();
  return { startUtcIso, endUtcIso };
}

/** 本週一 00:00 台灣時間，回傳為 UTC Date（供與 DB created_at 比較）。 */
export function getTaipeiWeekStartUtc(date: Date = new Date()): Date {
  const taiwanOffset = 8 * 60;
  const taiwanTime = new Date(date.getTime() + (date.getTimezoneOffset() + taiwanOffset) * 60_000);
  const dayOfWeek = taiwanTime.getDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  taiwanTime.setHours(0, 0, 0, 0);
  const startOfWeekTaiwan = new Date(taiwanTime.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
  return new Date(startOfWeekTaiwan.getTime() - taiwanOffset * 60_000);
}

/**
 * UTC 當日 0 點的 ISO 字串（非台北時區）。刻意與台北函式分開命名，
 * 因為 watchAd 每日上限與免費投票沿用的是 UTC 邊界（等同台北早上 8 點重置），
 * 這是既有行為，本次重構只消除重複程式碼，不變更邊界語意。
 */
export function getUtcDayStartIso(date: Date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
}
