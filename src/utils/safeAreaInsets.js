import { Platform } from 'react-native';

const ANDROID_FOOTER_EXTRA = 10;
const DEFAULT_IOS_FOOTER = 6;
const DEFAULT_ANDROID_OVERLAY = 24;

function liveBottomInset() {
  const v = global.__SAFE_BOTTOM_INSET__;
  return typeof v === 'number' && v >= 0 ? v : null;
}

/**
 * SafeAreaView bottom edges for in-screen layout.
 * Android 15/16 navigation bar is handled once at the app root — skip here.
 * iOS keeps applying bottom safe area per screen.
 */
export function safeBottomEdges() {
  return Platform.OS === 'android' ? [] : ['bottom'];
}

/** Extra padding for sticky screen footers (SoilOrders, CreateSoilOrder, etc.). */
export function screenFooterPadding() {
  if (Platform.OS === 'android') return ANDROID_FOOTER_EXTRA;
  const live = liveBottomInset();
  const base = live != null ? live : 34;
  return Math.max(Math.round(base * 0.35), DEFAULT_IOS_FOOTER);
}

/** Bottom inset for modals / bottom sheets (not covered by the root Android wrapper). */
export function overlayBottomPadding(fallback = 6) {
  const live = liveBottomInset();
  if (live != null) return Math.max(live, fallback);
  if (Platform.OS === 'android') return Math.max(fallback, DEFAULT_ANDROID_OVERLAY);
  return fallback;
}
