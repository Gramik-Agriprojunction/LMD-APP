// Simple in-memory data cache with pub/sub.
// Screens read from the cache on mount → show data instantly, no loader.
// Background fetch updates the cache → subscribers (other mounted screens) re-render automatically.
// Mutations call invalidate(key) so the next screen visit refetches.

const cache = {};
const subscribers = {};

export function get(key) {
  return cache[key];
}

export function has(key) {
  return Object.prototype.hasOwnProperty.call(cache, key);
}

export function set(key, value) {
  cache[key] = value;
  const subs = subscribers[key];
  if (subs) subs.forEach(cb => { try { cb(value); } catch (e) {} });
}

export function subscribe(key, cb) {
  if (!subscribers[key]) subscribers[key] = [];
  subscribers[key].push(cb);
  return () => {
    if (!subscribers[key]) return;
    subscribers[key] = subscribers[key].filter(s => s !== cb);
  };
}

export function invalidate(...keys) {
  keys.forEach(k => { delete cache[k]; });
}

export function invalidateAll() {
  Object.keys(cache).forEach(k => { delete cache[k]; });
}

// Common cache keys (string constants to avoid typos)
export const KEYS = {
  DASHBOARD: 'dashboard',
  ORDERS: 'orders',
  SETTLEMENTS: 'settlements',
  SETTLEMENT_HISTORY: 'settlementHistory',
  NOTIFICATIONS: 'notifications',
  EARNINGS: 'earnings',
  PROFILE: 'profile',
};

// Invalidate every cache that depends on order state mutations
// (call this after delivering/rejecting/rescheduling an order)
export function invalidateOrderRelated() {
  invalidate(KEYS.DASHBOARD, KEYS.ORDERS);
}

// Invalidate settlement-related caches (after cash settlement)
export function invalidateSettlementRelated() {
  invalidate(KEYS.DASHBOARD, KEYS.SETTLEMENTS, KEYS.SETTLEMENT_HISTORY, KEYS.EARNINGS);
}
