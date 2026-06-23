import { get as cacheGet, KEYS } from './dataCache';

export const getNotificationCount = () =>
  Number(cacheGet(KEYS.DASHBOARD)?.notification_count || 0);

export const notificationBadgeMeta = (count, { large = false } = {}) => {
  const n = Math.max(0, Number(count) || 0);
  const label = n > 99 ? '99+' : String(n);
  const digits = label.length;

  if (large) {
    if (digits >= 3) return { height: 28, width: 28, fontSize: 9, padH: 0, label };
    if (digits === 2) return { height: 26, width: 26, fontSize: 11, padH: 0, label };
    return { height: 24, width: 24, fontSize: 12, padH: 0, label };
  }

  if (digits >= 3) {
    return { height: 18, minWidth: 28, fontSize: 8, padH: 4, label };
  }
  if (digits === 2) {
    return { height: 18, minWidth: 22, fontSize: 10, padH: 3, label };
  }
  return { height: 18, width: 18, fontSize: 10, padH: 0, label };
};
