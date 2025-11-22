export const formatRelativeTime = (
  dateInput: Date | string | number,
  getText: (key: string, fallback: string) => string
): string => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const now = Date.now();
  const diffMs = now - date.getTime();

  // Handle future times by showing "just now"
  if (diffMs < 0) {
    return getText('common.time.justNow', '剛剛');
  }

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return getText('common.time.justNow', '剛剛');
  }

  if (minutes < 60) {
    const count = Math.max(1, minutes);
    return getText('common.time.minutesAgo', '大約 {{count}} 分鐘前').replace('{{count}}', count.toString());
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const count = Math.max(1, hours);
    return getText('common.time.hoursAgo', '大約 {{count}} 小時前').replace('{{count}}', count.toString());
  }

  const days = Math.floor(hours / 24);
  const count = Math.max(1, days);
  return getText('common.time.daysAgo', '{{count}} 天前').replace('{{count}}', count.toString());
};

export const formatRemainingTime = (
  dateInput: Date | string | number,
  getText: (key: string, fallback: string) => string
): string => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const now = Date.now();
  const diffMs = date.getTime() - now;

  if (diffMs <= 0) {
    return getText('common.time.expired', '已結束');
  }

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return getText('common.time.remainingSoon', '即將結束');
  }

  if (minutes < 60) {
    const count = Math.max(1, minutes);
    return getText('common.time.remainingMinutes', '剩餘 {{count}} 分鐘').replace('{{count}}', count.toString());
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const count = Math.max(1, hours);
    return getText('common.time.remainingHours', '剩餘 {{count}} 小時').replace('{{count}}', count.toString());
  }

  const days = Math.floor(hours / 24);
  const count = Math.max(1, days);
  return getText('common.time.remainingDays', '剩餘 {{count}} 天').replace('{{count}}', count.toString());
};

