import { NativeModules, Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let _geoApi = null;
let _nativeLinked = null;
let _lastCoords = null;
let _lastCoordsAt = 0;

const isNativeGeolocationLinked = () => {
  if (_nativeLinked === false) return false;
  if (_nativeLinked === true) return true;

  try {
    if (NativeModules.RNCGeolocation) {
      _nativeLinked = true;
      return true;
    }
    if (global.__turboModuleProxy != null) {
      const { TurboModuleRegistry } = require('react-native');
      if (TurboModuleRegistry.get('RNCGeolocation')) {
        _nativeLinked = true;
        return true;
      }
    }
  } catch (e) {
    // not linked
  }

  _nativeLinked = false;
  return false;
};

const loadGeolocation = () => {
  if (!isNativeGeolocationLinked()) return null;
  try {
    const mod = require('@react-native-community/geolocation');
    const Geo = mod?.default || mod;
    if (Geo && typeof Geo.getCurrentPosition === 'function') return Geo;
  } catch (e) {
    // not available
  }
  return null;
};

const getGeolocationApi = () => {
  if (_geoApi) return _geoApi;
  _geoApi = loadGeolocation();
  return _geoApi;
};

export const isGeolocationAvailable = () => isNativeGeolocationLinked() && !!getGeolocationApi();

const PERMISSION_MESSAGES = {
  delivery: 'Delivery verify ke liye aapki location chahiye',
  general: 'PIN code auto-fill ke liye location chahiye',
};

const requestIosAuthorization = (Geo) => new Promise((resolve) => {
  try {
    if (typeof Geo.setRNConfiguration === 'function') {
      Geo.setRNConfiguration({ authorizationLevel: 'whenInUse' });
    }
    if (typeof Geo.requestAuthorization !== 'function') {
      resolve({ ok: true });
      return;
    }
    Geo.requestAuthorization(
      () => resolve({ ok: true }),
      () => resolve({ ok: false, error: 'permission_denied' }),
    );
  } catch (e) {
    resolve({ ok: false, error: 'permission_denied' });
  }
});

export const ensureLocationPermission = async (purpose = 'general') => {
  if (!isNativeGeolocationLinked()) return { ok: false, error: 'unavailable' };

  const Geo = getGeolocationApi();
  if (!Geo) return { ok: false, error: 'unavailable' };

  if (Platform.OS === 'ios') {
    return requestIosAuthorization(Geo);
  }

  try {
    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    if (await PermissionsAndroid.check(fine)) return { ok: true };

    const granted = await PermissionsAndroid.request(fine, {
      title: 'Location permission',
      message: PERMISSION_MESSAGES[purpose] || PERMISSION_MESSAGES.general,
      buttonPositive: 'Allow',
      buttonNegative: 'Cancel',
    });

    if (granted === PermissionsAndroid.RESULTS.GRANTED) return { ok: true };
    return { ok: false, error: 'permission_denied' };
  } catch (e) {
    return { ok: false, error: 'permission_denied' };
  }
};

/** @deprecated use ensureLocationPermission */
export const requestLocationPermission = async (purpose = 'general') => {
  const result = await ensureLocationPermission(purpose);
  return result.ok;
};

const cacheCoords = (lat, lng) => {
  _lastCoords = { lat, lng };
  _lastCoordsAt = Date.now();
};

const readCachedCoords = (maxAgeMs = 120000) => {
  if (!_lastCoords || Date.now() - _lastCoordsAt > maxAgeMs) return null;
  return { lat: String(_lastCoords.lat), lng: String(_lastCoords.lng) };
};

const getCurrentCoordsWithFallback = ({ fresh = false } = {}) => new Promise((resolve, reject) => {
  const Geo = getGeolocationApi();
  if (!Geo) {
    reject(new Error('Geolocation unavailable'));
    return;
  }

  const finish = (lat, lng) => {
    cacheCoords(lat, lng);
    resolve({ lat, lng });
  };

  const tryPosition = (options, next) => {
    try {
      Geo.getCurrentPosition(
        (pos) => finish(pos.coords.latitude, pos.coords.longitude),
        (err) => {
          if (next) tryPosition(next, null);
          else reject(err);
        },
        options,
      );
    } catch (e) {
      if (next) tryPosition(next, null);
      else reject(e);
    }
  };

  if (fresh) {
    tryPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }, null);
    return;
  }

  tryPosition(
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
    { enableHighAccuracy: false, timeout: 25000, maximumAge: 300000 },
  );
});

export const getCurrentCoords = () => getCurrentCoordsWithFallback();

export const getCurrentCoordsWithPermission = async (purpose = 'general', { useCache = true } = {}) => {
  if (!isNativeGeolocationLinked()) {
    return { lat: '', lng: '', error: 'unavailable' };
  }

  if (useCache) {
    const cached = readCachedCoords();
    if (cached) return cached;
  }

  const perm = await ensureLocationPermission(purpose);
  if (!perm.ok) {
    if (!useCache) {
      return { lat: '', lng: '', error: perm.error || 'permission_denied' };
    }
    const cached = readCachedCoords(600000);
    if (cached) return cached;
    return { lat: '', lng: '', error: perm.error || 'permission_denied' };
  }

  try {
    if (Platform.OS === 'ios') {
      await new Promise((r) => setTimeout(r, 400));
    }
    const { lat, lng } = await getCurrentCoordsWithFallback({ fresh: !useCache });
    return { lat: String(lat), lng: String(lng) };
  } catch (e) {
    if (!useCache) {
      return { lat: '', lng: '', error: 'location_unavailable' };
    }
    const cached = readCachedCoords(600000);
    if (cached) return cached;
    return { lat: '', lng: '', error: 'location_unavailable' };
  }
};

export const getCachedCoordsForApi = (maxAgeMs = 900000) => {
  const cached = readCachedCoords(maxAgeMs);
  if (cached?.lat && cached?.lng) return cached;
  return { lat: null, lng: null };
};

const hasCoord = (v) => v != null && String(v).trim() !== '';

/** Coords for update_order_status — never blocks; uses null when GPS unavailable. */
export const coordsForStatusApi = (coords = {}) => {
  const lat = coords?.lat ?? coords?.latitude;
  const lng = coords?.lng ?? coords?.long ?? coords?.longitude;
  if (hasCoord(lat) && hasCoord(lng)) {
    return { lat: String(lat), long: String(lng) };
  }
  return { lat: null, long: null };
};

export const appendCoordsToFormData = (fd, coords = {}) => {
  const { lat, long } = coordsForStatusApi(coords);
  fd.append('lat', lat == null ? 'null' : lat);
  fd.append('long', long == null ? 'null' : long);
};

/** Start fetching GPS when verify screen opens — never blocks the verify button. */
export const prefetchVerifyLocation = (onReady) => {
  if (!isNativeGeolocationLinked()) return;

  const deliver = (coords) => {
    if (coords?.lat && coords?.lng) {
      onReady?.({ lat: String(coords.lat), lng: String(coords.lng) });
    }
  };

  const cached = readCachedCoords(300000);
  if (cached?.lat && cached?.lng) deliver(cached);

  ensureLocationPermission('delivery').then((perm) => {
    if (!perm.ok) return;
    getCurrentCoordsWithPermission('delivery', { useCache: true })
      .then((result) => {
        if (result?.lat && result?.lng) {
          deliver(result);
          return null;
        }
        return getCurrentCoordsWithPermission('delivery', { useCache: false });
      })
      .then((result) => {
        if (result?.lat && result?.lng) deliver(result);
      })
      .catch(() => {});
  });
};

/** Fast coords for verify/update APIs — waits for GPS but caps wait so API is not blocked forever. */
export const getCoordsForApiCall = async (purpose = 'delivery', { maxWaitMs = 12000 } = {}) => {
  const cached = readCachedCoords(300000);
  if (cached?.lat && cached?.lng) return cached;

  if (!isNativeGeolocationLinked()) {
    console.log('[location] native geolocation not linked — lat/long will be empty');
    return { lat: '', lng: '' };
  }

  await ensureLocationPermission(purpose);

  const result = await Promise.race([
    getCurrentCoordsWithPermission(purpose, { useCache: false }),
    new Promise((resolve) => {
      setTimeout(() => resolve({ lat: '', lng: '', error: 'timeout' }), maxWaitMs);
    }),
  ]);

  if (result?.error === 'timeout') {
    console.log(`[location] GPS timeout after ${maxWaitMs}ms`);
    const stale = readCachedCoords(900000);
    if (stale?.lat && stale?.lng) return stale;
  }

  return { lat: result?.lat || '', lng: result?.lng || '' };
};

const normalizePincode = (raw) => {
  const pin = String(raw || '').replace(/\D/g, '').slice(0, 6);
  return pin.length === 6 ? pin : '';
};

const fetchJsonWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;
  try {
    const res = await fetch(url, {
      ...options,
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (res.status === 429) return { __rateLimited: true };
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const PIN_DISK_PREFIX = '@lmd_pin_coords:';
const NOMINATIM_ZOOM = 14;
const NOMINATIM_MIN_GAP_MS = 2000;
const PIN_LOOKUP_CACHE_TTL = 86400000;
const PIN_DISK_TTL = 604800000;
let _pinLookupCache = new Map();
let _pinLookupInflight = new Map();
let _lastNominatimAt = 0;
let _nominatimGlobalLock = Promise.resolve();

const coordCacheKey = (lat, lng) => `${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}`;

const withNominatimLock = async (fn) => {
  const prev = _nominatimGlobalLock;
  let release;
  _nominatimGlobalLock = new Promise((r) => { release = r; });
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
};

const waitForNominatimSlot = async () => {
  const wait = NOMINATIM_MIN_GAP_MS - (Date.now() - _lastNominatimAt);
  if (wait > 0) await new Promise((r) => { setTimeout(r, wait); });
};

const readPinDiskCache = async (key) => {
  try {
    const raw = await AsyncStorage.getItem(`${PIN_DISK_PREFIX}${key}`);
    if (!raw) return '';
    const data = JSON.parse(raw);
    if (!data?.pin || Date.now() - (data.at || 0) > PIN_DISK_TTL) return '';
    return String(data.pin);
  } catch (e) {
    return '';
  }
};

const writePinDiskCache = async (key, pin) => {
  try {
    await AsyncStorage.setItem(`${PIN_DISK_PREFIX}${key}`, JSON.stringify({ pin, at: Date.now() }));
  } catch (e) { /* ignore */ }
};

const reverseGeocodeNominatimOnce = async (lat, lng) => withNominatimLock(async () => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => { setTimeout(r, 3500); });
    }
    // eslint-disable-next-line no-await-in-loop
    await waitForNominatimSlot();
    _lastNominatimAt = Date.now();
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json&addressdetails=1&zoom=${NOMINATIM_ZOOM}`;
    // eslint-disable-next-line no-await-in-loop
    const json = await fetchJsonWithTimeout(url, {
      headers: { 'User-Agent': 'GramikLMD/1.0 (React Native)' },
    }, 9000);
    if (json?.__rateLimited) continue;
    if (!json?.address) return '';
    return normalizePincode(json.address.postcode);
  }
  return '';
});

const reverseGeocodeGeocodeXyz = async (lat, lng) => {
  const url = `https://geocode.xyz/${encodeURIComponent(lat)},${encodeURIComponent(lng)}?geoit=json`;
  const json = await fetchJsonWithTimeout(url, {}, 7000);
  if (!json || typeof json !== 'object' || json.__rateLimited) return '';
  const err = String(json.error || json.err || '').toLowerCase();
  if (err.includes('throttled') || err.includes('payment')) return '';
  const postal = json?.standard?.postal ?? json?.postal;
  if (String(postal || '').toLowerCase().includes('throttled')) return '';
  return normalizePincode(postal);
};

const gatherPinCandidates = async (lat, lng) => {
  const pins = [];
  const add = (raw) => {
    const pin = normalizePincode(raw);
    if (pin && !pins.includes(pin)) pins.push(pin);
  };
  add(await reverseGeocodeNominatimOnce(lat, lng));
  if (!pins.length) add(await reverseGeocodeGeocodeXyz(lat, lng));
  return pins;
};

const validatePinWithRetry = async (validatePin, pin, lat, lng, attempts = 2) => {
  if (!validatePin) return true;
  for (let i = 0; i < attempts; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await validatePin(pin, lat, lng)) return true;
    if (i < attempts - 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => { setTimeout(r, 500); });
    }
  }
  return false;
};

const cacheResolvedPin = async (key, lat, lng, pin) => {
  _pinLookupCache.set(key, { pin, at: Date.now() });
  await writePinDiskCache(key, pin);
  storePinPrefetch({ lat, lng, pincode: pin });
};

/**
 * Resolve PIN from GPS coords — one Nominatim call, deduped, disk-cached.
 */
export const lookupPincodeFromCoords = async (lat, lng, validatePin) => {
  const latN = Number(lat);
  const lngN = Number(lng);
  if (!Number.isFinite(latN) || !Number.isFinite(lngN)) return '';

  const key = coordCacheKey(latN, lngN);

  const diskPin = await readPinDiskCache(key);
  if (diskPin.length === 6) {
    if (await validatePinWithRetry(validatePin, diskPin, latN, lngN)) {
      await cacheResolvedPin(key, latN, lngN, diskPin);
      return diskPin;
    }
  }

  const mem = _pinLookupCache.get(key);
  if (mem?.pin && Date.now() - mem.at < PIN_LOOKUP_CACHE_TTL) {
    if (await validatePinWithRetry(validatePin, mem.pin, latN, lngN)) return mem.pin;
  }

  if (_pinLookupInflight.has(key)) return _pinLookupInflight.get(key);

  const task = (async () => {
    const candidates = await gatherPinCandidates(latN, lngN);
    for (const candidate of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await validatePinWithRetry(validatePin, candidate, latN, lngN)) {
        await cacheResolvedPin(key, latN, lngN, candidate);
        return candidate;
      }
    }
    return '';
  })()
    .catch(() => '')
    .finally(() => { _pinLookupInflight.delete(key); });

  _pinLookupInflight.set(key, task);
  return task;
};

/** @deprecated use lookupPincodeFromCoords */
export const getPincodeCandidates = async (lat, lng) => gatherPinCandidates(lat, lng);

export const reverseGeocodePincode = async (lat, lng) => {
  const pins = await gatherPinCandidates(lat, lng);
  return pins[0] || '';
};

export const getLocationPincode = async ({ maxWaitMs = 15000, useCache = true } = {}) => {
  const coordsPromise = getCurrentCoordsWithPermission('general', { useCache });
  const result = await Promise.race([
    coordsPromise,
    new Promise((resolve) => {
      setTimeout(() => resolve({ lat: '', lng: '', error: 'timeout' }), maxWaitMs);
    }),
  ]);

  if (result.error === 'permission_denied') {
    return { lat: '', lng: '', pincode: '', error: 'permission_denied' };
  }
  if (result.error === 'timeout') {
    if (!useCache) {
      return { lat: '', lng: '', pincode: '', error: 'timeout' };
    }
    const cached = readCachedCoords(600000);
    if (cached?.lat && cached?.lng) {
      const pincode = await reverseGeocodePincode(cached.lat, cached.lng);
      return { lat: cached.lat, lng: cached.lng, pincode, error: pincode ? undefined : 'location_unavailable' };
    }
    return { lat: '', lng: '', pincode: '', error: 'timeout' };
  }
  if (!result.lat || !result.lng) {
    return { lat: '', lng: '', pincode: '', error: result.error || 'location_unavailable' };
  }
  const pincode = await reverseGeocodePincode(result.lat, result.lng);
  return { lat: result.lat, lng: result.lng, pincode, error: pincode ? undefined : 'location_unavailable' };
};

const PIN_PREFETCH_TTL = 120000; // in-memory only, short-lived session cache
let _pinPrefetch = null;
let _pinPrefetchAt = 0;
let _pinPrefetchPromise = null;
const _pinPrefetchListeners = new Set();

const storePinPrefetch = (payload) => {
  if (!payload?.pincode || String(payload.pincode).length !== 6) return;
  _pinPrefetch = {
    lat: String(payload.lat || ''),
    lng: String(payload.lng || ''),
    pincode: String(payload.pincode),
  };
  _pinPrefetchAt = Date.now();
  _pinPrefetchListeners.forEach((fn) => {
    try { fn(_pinPrefetch); } catch (e) { /* ignore */ }
  });
};

export const getCachedPrefetchedPincode = () => {
  if (!_pinPrefetch?.pincode || Date.now() - _pinPrefetchAt > PIN_PREFETCH_TTL) return null;
  return { ..._pinPrefetch };
};

/** Fetch fresh GPS coords (no PIN). */
export const getFreshCoords = async ({ maxWaitMs = 15000 } = {}) => {
  const result = await Promise.race([
    getCurrentCoordsWithPermission('general', { useCache: false }),
    new Promise((resolve) => {
      setTimeout(() => resolve({ lat: '', lng: '', error: 'timeout' }), maxWaitMs);
    }),
  ]);
  if (result.error === 'permission_denied') {
    return { lat: '', lng: '', error: 'permission_denied' };
  }
  if (result.error === 'timeout' || !result.lat || !result.lng) {
    return { lat: '', lng: '', error: result.error || 'timeout' };
  }
  return { lat: result.lat, lng: result.lng };
};

/** Fetch fresh GPS + reverse-geocode PIN. Never reads stored/static PIN. */
export const fetchFreshSoilOrderPincode = ({ maxWaitMs = 15000, validatePin } = {}) => {
  if (_pinPrefetchPromise) return _pinPrefetchPromise;

  _pinPrefetchPromise = (async () => {
    const coords = await getFreshCoords({ maxWaitMs });
    if (!coords.lat || !coords.lng) {
      return { lat: '', lng: '', pincode: '', error: coords.error || 'location_unavailable' };
    }

    const pincode = await lookupPincodeFromCoords(coords.lat, coords.lng, validatePin);

    if (pincode.length === 6) {
      return { lat: coords.lat, lng: coords.lng, pincode };
    }
    return { lat: coords.lat, lng: coords.lng, pincode: '', error: 'location_unavailable' };
  })()
    .catch(() => ({ lat: '', lng: '', pincode: '', error: 'location_unavailable' }))
    .finally(() => { _pinPrefetchPromise = null; });

  return _pinPrefetchPromise;
};

/** Warm GPS only — geocoding runs once on CreateSoilOrder to avoid Nominatim 429. */
export const prefetchSoilOrderPincode = () => {
  getFreshCoords({ maxWaitMs: 12000 }).catch(() => {});
};

let _soilPrefillInflight = null;

/** Ensures only one soil PIN prefill runs app-wide (React Strict Mode safe). */
export const runSoilPinPrefill = (fn) => {
  if (_soilPrefillInflight) return _soilPrefillInflight;
  _soilPrefillInflight = Promise.resolve()
    .then(fn)
    .finally(() => { _soilPrefillInflight = null; });
  return _soilPrefillInflight;
};

export const unsubscribeSoilOrderPincode = (onReady) => {
  if (typeof onReady === 'function') _pinPrefetchListeners.delete(onReady);
};

export const warmUpLocation = (purpose = 'delivery') => {
  if (!isNativeGeolocationLinked()) return;
  getCurrentCoordsWithPermission(purpose, { useCache: false }).catch(() => {});
};
