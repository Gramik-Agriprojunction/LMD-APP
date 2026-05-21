import { Platform } from 'react-native';
import {
  APP_VERSION,
  HAS_NATIVE_VERSION,
  APP_BUNDLE_ID,
  PLAY_STORE_URL,
  APP_STORE_LOOKUP_URL,
} from './version';

// ---- Version comparison -----------------------------------------------------

// Compare two semver-ish strings: "1.0", "1.2.3", "12.10.0".
// Returns 1 if a > b, -1 if a < b, 0 if equal.
export function compareVersions(a, b) {
  if (!a || !b) return 0;
  const norm = s =>
    String(s)
      .trim()
      .replace(/[^\d.]/g, '') // strip any "v" prefix, build suffix, etc.
      .split('.')
      .map(n => {
        const x = parseInt(n, 10);
        return Number.isFinite(x) ? x : 0;
      });
  const pa = norm(a);
  const pb = norm(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

// ---- Play Store version extraction ------------------------------------------

async function getPlayStoreVersion() {
  try {
    const res = await fetch(PLAY_STORE_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
        'Accept-Language': 'en-IN,en;q=0.9',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Play Store markup changes over time — try several patterns to stay robust.
    const patterns = [
      /\[\[\["(\d+(?:\.\d+)+)"\]\]/,
      /"softwareVersion"\s*:\s*"([\d.]+)"/,
      /Current Version[\s\S]{0,500}?>([\d.]+)</i,
      />Version[\s\S]{0,200}?(\d+\.\d+(?:\.\d+)?)/i,
      /\[\["(\d+(?:\.\d+)+)"\]\]/,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m && m[1]) {
        const v = m[1].trim();
        // Sanity: must look like a version (at least one dot, digits)
        if (/^\d+(\.\d+)+$/.test(v)) return v;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ---- App Store version extraction (iTunes lookup) ---------------------------

async function getAppStoreInfo() {
  try {
    // Cache-bust so iOS doesn't return a stale response.
    const url = `${APP_STORE_LOOKUP_URL}&t=${Date.now()}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const result = Array.isArray(json?.results) ? json.results[0] : null;
    if (!result) return null;
    return {
      version: result.version || null,
      storeUrl: result.trackViewUrl || null,
    };
  } catch (e) {
    return null;
  }
}

// ---- Main entry -------------------------------------------------------------

export async function checkForUpdate() {
  const current = APP_VERSION;

  // Without a real native-read version, refuse to trigger the popup —
  // a wrong hardcoded JS version could nag the user incorrectly.
  if (!HAS_NATIVE_VERSION) {
    return { available: false, current, latest: null, storeUrl: null, reason: 'no_native_version' };
  }

  try {
    if (Platform.OS === 'ios') {
      const info = await getAppStoreInfo();
      if (!info?.version) {
        return { available: false, current, latest: null, storeUrl: null, reason: 'no_store_version' };
      }
      const cmp = compareVersions(info.version, current);
      return {
        available: cmp > 0,
        current,
        latest: info.version,
        storeUrl: info.storeUrl || `https://apps.apple.com/app/id${APP_BUNDLE_ID}`,
      };
    } else {
      const latest = await getPlayStoreVersion();
      if (!latest) {
        return { available: false, current, latest: null, storeUrl: null, reason: 'no_store_version' };
      }
      const cmp = compareVersions(latest, current);
      return {
        available: cmp > 0,
        current,
        latest,
        storeUrl: PLAY_STORE_URL,
      };
    }
  } catch (e) {
    return { available: false, current, latest: null, storeUrl: null, reason: 'exception' };
  }
}
