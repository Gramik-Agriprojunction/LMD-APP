import { NativeModules, Platform } from 'react-native';

// Hardcoded fallbacks — only used if the native bridge can't supply the value.
const FALLBACK_VERSION = Platform.select({ ios: '1.0', android: '12.0' });

// Read the actual build's version from native land.
// Android: AppVersionModule (Kotlin) exposes versionName via getConstants().
// iOS: React Native's built-in RCTSettingsManager exposes CFBundleShortVersionString
//      directly from the app's Info.plist — no extra native code needed.
function readNativeVersion() {
  try {
    if (Platform.OS === 'android') {
      const av = NativeModules.AppVersion;
      const v = av?.versionName || av?.getConstants?.()?.versionName;
      if (v) return String(v);
    } else if (Platform.OS === 'ios') {
      const sm = NativeModules.SettingsManager;
      const v =
        sm?.settings?.CFBundleShortVersionString ||
        sm?.getConstants?.()?.settings?.CFBundleShortVersionString;
      if (v) return String(v);
    }
  } catch (e) {}
  return null;
}

function readNativeBuildNumber() {
  try {
    if (Platform.OS === 'android') {
      const av = NativeModules.AppVersion;
      const c = av?.versionCode ?? av?.getConstants?.()?.versionCode;
      if (c != null) return String(c);
    } else if (Platform.OS === 'ios') {
      const sm = NativeModules.SettingsManager;
      const c =
        sm?.settings?.CFBundleVersion ||
        sm?.getConstants?.()?.settings?.CFBundleVersion;
      if (c) return String(c);
    }
  } catch (e) {}
  return null;
}

function readNativePackageName() {
  try {
    if (Platform.OS === 'android') {
      const av = NativeModules.AppVersion;
      const p = av?.packageName || av?.getConstants?.()?.packageName;
      if (p) return String(p);
    } else if (Platform.OS === 'ios') {
      const sm = NativeModules.SettingsManager;
      const p =
        sm?.settings?.CFBundleIdentifier ||
        sm?.getConstants?.()?.settings?.CFBundleIdentifier;
      if (p) return String(p);
    }
  } catch (e) {}
  return null;
}

const NATIVE_VERSION = readNativeVersion();
const NATIVE_BUILD = readNativeBuildNumber();
const NATIVE_PKG = readNativePackageName();

// Public exports — read live from the build, with safe fallback.
export const APP_VERSION = NATIVE_VERSION || FALLBACK_VERSION;
export const BUILD_NUMBER = NATIVE_BUILD || null;
export const APP_BUNDLE_ID = NATIVE_PKG || 'com.app.lmd';

// Whether we successfully read the version from the native side.
// If false, the update check will refuse to trigger a popup (we can't trust the comparison).
export const HAS_NATIVE_VERSION = !!NATIVE_VERSION;

export const PLAY_STORE_URL =
  `https://play.google.com/store/apps/details?id=${APP_BUNDLE_ID}&hl=en_IN`;

export const APP_STORE_LOOKUP_URL =
  `https://itunes.apple.com/lookup?bundleId=${APP_BUNDLE_ID}`;

export const STORE_URL = Platform.select({
  ios: `itms-apps://apps.apple.com/app/id${APP_BUNDLE_ID}`, // resolved at runtime via fallback
  android: PLAY_STORE_URL,
});
