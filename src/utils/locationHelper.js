import {
  Platform, PermissionsAndroid, Alert, Linking, AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANDROID_LOCATION_SETTINGS = 'android.settings.LOCATION_SOURCE_SETTINGS';

let _geoApi = null;
let _nativeLinked = null;
let _lastCoords = null;
let _lastCoordsAt = 0;

const loadGeolocation = () => {
  try {
    const mod = require('@react-native-community/geolocation');
    const Geo = mod?.default || mod;
    if (Geo && typeof Geo.getCurrentPosition === 'function') return Geo;
  } catch (e) {
    // not available
  }
  return null;
};

const isNativeGeolocationLinked = () => {
  if (_nativeLinked === true) return true;
  const Geo = loadGeolocation();
  if (Geo) {
    _nativeLinked = true;
    return true;
  }
  return false;
};

const getGeolocationApi = () => {
  if (_geoApi) return _geoApi;
  _geoApi = loadGeolocation();
  if (_geoApi) configureGeolocation(_geoApi);
  return _geoApi;
};

let _geoConfigured = false;

/**
 * skipPermissionRequests: we request via PermissionsAndroid ourselves.
 * Letting the native module also prompt races the Activity (Play crash).
 * locationProvider 'auto' falls back to Android LocationManager when Play
 * Services is missing/outdated on pre-launch devices.
 */
const configureGeolocation = (Geo) => {
  if (!Geo?.setRNConfiguration || _geoConfigured) return;
  try {
    Geo.setRNConfiguration({
      skipPermissionRequests: true,
      authorizationLevel: 'whenInUse',
      locationProvider: 'auto',
    });
    _geoConfigured = true;
  } catch (e) {
    console.log('[location] setRNConfiguration failed:', e?.message || e);
  }
};

const requestNativeAuthorization = (Geo) => new Promise((resolve) => {
  if (typeof Geo.requestAuthorization !== 'function') {
    resolve({ ok: true });
    return;
  }
  let done = false;
  const finish = (value) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    resolve(value);
  };
  const timer = setTimeout(() => finish({ ok: false, error: 'permission_denied' }), 90000);
  Geo.requestAuthorization(
    () => finish({ ok: true }),
    (err) => {
      console.log('[location] requestAuthorization failed:', err?.message || err);
      finish({ ok: false, error: 'permission_denied' });
    },
  );
});

const hasAndroidLocationPermission = async () => {
  try {
    const fine = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    const coarse = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
    return !!(fine || coarse);
  } catch (e) {
    return false;
  }
};

let _androidPermInFlight = null;

/** Shows the system permission dialog on Android (more reliable than native module alone). */
const requestAndroidLocationPermission = async () => {
  try {
    if (await hasAndroidLocationPermission()) {
      return { ok: true };
    }

    if (_androidPermInFlight) return _androidPermInFlight;

    const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

    _androidPermInFlight = (async () => {
      console.log('[location] requesting Android location permission');
      const result = await PermissionsAndroid.requestMultiple([fine, coarse]);
      const fineResult = result[fine];
      const coarseResult = result[coarse];

      if (
        fineResult === PermissionsAndroid.RESULTS.GRANTED
        || coarseResult === PermissionsAndroid.RESULTS.GRANTED
      ) {
        return { ok: true };
      }

      if (
        fineResult === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        || coarseResult === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
      ) {
        console.log('[location] Android location permission blocked (never ask again)');
        return { ok: false, error: 'permission_blocked' };
      }

      console.log('[location] Android location permission denied');
      return { ok: false, error: 'permission_denied' };
    })()
      .catch((e) => {
        console.log('[location] Android permission request failed:', e?.message || e);
        return { ok: false, error: 'permission_denied' };
      })
      .finally(() => { _androidPermInFlight = null; });

    return _androidPermInFlight;
  } catch (e) {
    console.log('[location] Android permission request failed:', e?.message || e);
    return { ok: false, error: 'permission_denied' };
  }
};

export const ensureLocationPermission = async (purpose = 'general', { prompt = true } = {}) => {
  const Geo = getGeolocationApi();
  if (!Geo) {
    console.log('[location] geolocation module not loaded');
    return { ok: false, error: 'unavailable' };
  }

  configureGeolocation(Geo);

  if (Platform.OS === 'android') {
    if (await hasAndroidLocationPermission()) return { ok: true };
    if (!prompt) return { ok: false, error: 'permission_denied' };
    return requestAndroidLocationPermission();
  }

  if (!prompt) return { ok: true };
  const auth = await requestNativeAuthorization(Geo);
  if (auth.ok) return auth;
  // iOS often errors even when When In Use is already granted.
  try {
    await new Promise((resolve, reject) => {
      Geo.getCurrentPosition(
        () => resolve(true),
        reject,
        { enableHighAccuracy: false, timeout: 3000, maximumAge: 300000 },
      );
    });
    return { ok: true };
  } catch (e) {
    return auth;
  }
};

const normalizeGeoError = (err) => {
  if (err && typeof err === 'object') return err;
  return { message: String(err || ''), code: 2 };
};

const isLocationServicesError = (err) => {
  const e = normalizeGeoError(err);
  const msg = String(e.message || '').toLowerCase();
  return e.code === 2
    || msg.includes('fusedlocationprovider/settings')
    || msg.includes('fusedlocationprovider')
    || msg.includes('no location provider')
    || msg.includes('location not available')
    || (msg.includes('provider') && msg.includes('unavailable'));
};

const openDeviceLocationSettings = async () => {
  try {
    if (Platform.OS === 'android') {
      await Linking.sendIntent(ANDROID_LOCATION_SETTINGS);
      return true;
    }
    await Linking.openSettings();
    return true;
  } catch (e) {
    try {
      await Linking.openSettings();
      return true;
    } catch (e2) {
      console.log('[location] failed to open location settings');
      return false;
    }
  }
};

let _locationServicesPromptOpen = false;

const promptEnableLocationServices = () => new Promise((resolve) => {
  if (_locationServicesPromptOpen) {
    resolve(false);
    return;
  }
  _locationServicesPromptOpen = true;
  Alert.alert(
    'Location ON karein',
    'Delivery update ke liye phone ka GPS/Location chalu karna zaroori hai. Location settings mein jaakar ON karein.',
    [
      {
        text: 'Baad mein',
        style: 'cancel',
        onPress: () => {
          _locationServicesPromptOpen = false;
          resolve(false);
        },
      },
      {
        text: 'Location ON karein',
        onPress: async () => {
          _locationServicesPromptOpen = false;
          const opened = await openDeviceLocationSettings();
          resolve(opened);
        },
      },
    ],
    { cancelable: true, onDismiss: () => { _locationServicesPromptOpen = false; resolve(false); } },
  );
});

let _settingsPromptOpen = false;

const promptOpenAppSettings = () => new Promise((resolve) => {
  if (_settingsPromptOpen) {
    resolve(false);
    return;
  }
  _settingsPromptOpen = true;
  Alert.alert(
    'Location permission',
    'App ko location access dena zaroori hai. Settings > Permissions > Location mein Allow karein.',
    [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => {
          _settingsPromptOpen = false;
          resolve(false);
        },
      },
      {
        text: 'Settings kholein',
        onPress: async () => {
          _settingsPromptOpen = false;
          try {
            await Linking.openSettings();
          } catch (e) { /* ignore */ }
          resolve(true);
        },
      },
    ],
    { cancelable: true, onDismiss: () => { _settingsPromptOpen = false; resolve(false); } },
  );
});

const waitForAppResume = (timeoutMs = 120000) => new Promise((resolve) => {
  let sawBackground = AppState.currentState !== 'active';
  let done = false;
  const finish = (value) => {
    if (done) return;
    done = true;
    sub?.remove();
    clearTimeout(timer);
    resolve(value);
  };
  const sub = AppState.addEventListener('change', (next) => {
    if (next === 'background' || next === 'inactive') sawBackground = true;
    if (sawBackground && next === 'active') finish(true);
  });
  const timer = setTimeout(() => finish(sawBackground), timeoutMs);
});

/** Read GPS; if device location/GPS is off, prompt user to turn it on and retry. */
const readCoordsWithLocationRecovery = async ({
  purpose = 'delivery',
  maxWaitMs = 10000,
  maxPrompts = 2,
} = {}) => {
  const tryRead = () => Promise.race([
    getFastCoordsForStatus(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), maxWaitMs);
    }),
  ]);

  for (let attempt = 0; attempt <= maxPrompts; attempt += 1) {
    try {
      const coords = await tryRead();
      if (coords?.lat && coords?.lng) return coords;
    } catch (err) {
      const e = normalizeGeoError(err);
      console.log('[location] GPS read failed:', e.message || err);
      if (!isLocationServicesError(e) || attempt >= maxPrompts) break;

      const opened = await promptEnableLocationServices();
      if (!opened) break;

      await waitForAppResume(120000);
      await new Promise((r) => { setTimeout(r, 1000); });
      await ensureLocationPermission(purpose);
    }
  }

  return null;
};

/** @deprecated use ensureLocationPermission */
export const requestLocationPermission = async (purpose = 'general') => {
  const result = await ensureLocationPermission(purpose);
  return result.ok;
};

const cacheCoords = (lat, lng) => {
  const latN = Number(lat);
  const lngN = Number(lng);
  if (!Number.isFinite(latN) || !Number.isFinite(lngN)) return;
  _lastCoords = { lat: latN, lng: lngN };
  _lastCoordsAt = Date.now();
  writeCoordsDisk(String(latN), String(lngN)).catch(() => {});
};

const COORDS_DISK_KEY = '@lmd_status_coords';
const COORDS_DISK_TTL = 86400000;

const writeCoordsDisk = async (lat, lng) => {
  await AsyncStorage.setItem(COORDS_DISK_KEY, JSON.stringify({ lat, lng, at: Date.now() }));
};

const readCoordsDisk = async () => {
  try {
    const raw = await AsyncStorage.getItem(COORDS_DISK_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - (data.at || 0) > COORDS_DISK_TTL) return null;
    if (data.lat && data.lng) return { lat: String(data.lat), lng: String(data.lng) };
  } catch (e) { /* ignore */ }
  return null;
};

const hydrateCoordsFromDisk = async () => {
  const disk = await readCoordsDisk();
  if (disk?.lat && disk?.lng) {
    _lastCoords = { lat: Number(disk.lat), lng: Number(disk.lng) };
    _lastCoordsAt = Date.now();
    return disk;
  }
  return null;
};

readCoordsDisk().then((disk) => {
  if (disk?.lat && disk?.lng) {
    _lastCoords = { lat: Number(disk.lat), lng: Number(disk.lng) };
    _lastCoordsAt = Date.now();
  }
});

const readCachedCoords = (maxAgeMs = 120000) => {
  if (!_lastCoords || Date.now() - _lastCoordsAt > maxAgeMs) return null;
  return { lat: String(_lastCoords.lat), lng: String(_lastCoords.lng) };
};

/** Fast GPS read tuned for order status updates (simulator-friendly). */
const getFastCoordsForStatus = () => new Promise((resolve, reject) => {
  const Geo = getGeolocationApi();
  if (!Geo) {
    reject(new Error('Geolocation unavailable'));
    return;
  }

  const finish = (lat, lng) => {
    cacheCoords(lat, lng);
    resolve({ lat: String(lat), lng: String(lng) });
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

  tryPosition(
    { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 },
  );
});

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

export const getCurrentCoordsWithPermission = async (purpose = 'general', { useCache = true, prompt = true } = {}) => {
  if (!isNativeGeolocationLinked()) {
    return { lat: '', lng: '', error: 'unavailable' };
  }

  if (useCache) {
    const cached = readCachedCoords();
    if (cached) return cached;
  }

  const perm = await ensureLocationPermission(purpose, { prompt });
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

/** In-flight GPS prefetch for status updates — shared across screens. */
let _statusLocationPrefetch = null;

const runStatusLocationPrefetch = (purpose = 'delivery') => {
  const cached = readCachedCoords(900000);
  if (cached?.lat && cached?.lng) {
    return Promise.resolve(cached);
  }

  if (!getGeolocationApi()) {
    return Promise.resolve({ lat: '', lng: '' });
  }

  if (_statusLocationPrefetch) return _statusLocationPrefetch;

  _statusLocationPrefetch = ensureLocationPermission(purpose)
    .then(async (perm) => {
      if (!perm.ok) return { lat: '', lng: '' };
      if (Platform.OS === 'ios') {
        await new Promise((r) => { setTimeout(r, 300); });
      } else if (Platform.OS === 'android') {
        await new Promise((r) => { setTimeout(r, 200); });
      }
      try {
        const coords = await readCoordsWithLocationRecovery({ purpose, maxWaitMs: 10000, maxPrompts: 1 });
        if (coords?.lat && coords?.lng) return coords;
        return getCurrentCoordsWithPermission(purpose, { useCache: false });
      } catch (e) {
        return getCurrentCoordsWithPermission(purpose, { useCache: false });
      }
    })
    .catch(() => ({ lat: '', lng: '' }))
    .finally(() => {
      _statusLocationPrefetch = null;
    });

  return _statusLocationPrefetch;
};

/** Start fetching GPS when verify/status screen opens — never blocks submit. */
export const prefetchVerifyLocation = (onReady) => {
  const deliver = (coords) => {
    if (coords?.lat && coords?.lng) {
      onReady?.({ lat: String(coords.lat), lng: String(coords.lng) });
    }
  };

  const cached = readCachedCoords(900000);
  if (cached?.lat && cached?.lng) deliver(cached);

  if (!getGeolocationApi()) return;

  ensureLocationPermission('delivery').then(() => {
    runStatusLocationPrefetch('delivery').then((result) => {
      if (result?.lat && result?.lng) deliver(result);
    });
  });
};

/** Ask permission (if needed) and warm GPS — call when status screen opens. */
export const requestStatusLocationAccess = async (purpose = 'delivery') => {
  if (!getGeolocationApi()) return { ok: false, error: 'unavailable' };

  // Wait until the current screen has finished mounting. A permission dialog
  // during a native-stack transition recreates the Activity and crashes
  // react-native-screens on some Play pre-launch devices.
  await new Promise((r) => { setTimeout(r, 450); });

  let perm = await ensureLocationPermission(purpose);
  if (!perm.ok) {
    if (perm.error === 'permission_blocked') {
      const opened = await promptOpenAppSettings();
      if (opened) {
        await waitForAppResume(120000);
        perm = await ensureLocationPermission(purpose);
      }
    }
    return perm;
  }

  warmUpStatusLocation(purpose);

  // If GPS/location is off, prompt early so coords are ready before submit.
  readCoordsWithLocationRecovery({ purpose, maxWaitMs: 8000, maxPrompts: 1 }).catch(() => {});

  return perm;
};

/** Warm GPS cache app-wide — call on dashboard / login focus. */
export const warmUpStatusLocation = (purpose = 'delivery') => {
  if (!getGeolocationApi()) return;
  runStatusLocationPrefetch(purpose);
};

/** Instant lat/long — cache/prefetch only, never waits. */
export const getInstantCoordsForStatusUpdate = (prefetched) => {
  if (prefetched?.lat != null && prefetched?.lng != null) {
    const lat = String(prefetched.lat).trim();
    const lng = String(prefetched.lng).trim();
    if (lat && lng) return coordsForStatusApi({ lat, lng });
  }
  const cached = readCachedCoords(900000);
  if (cached?.lat && cached?.lng) {
    return coordsForStatusApi(cached);
  }
  return coordsForStatusApi({ lat: null, lng: null });
};

/**
 * Best-effort lat/long for status API — instant when cached; otherwise requests
 * permission and reads GPS (maxWaitMs cap, default 6s).
 */
export const resolveCoordsForStatusUpdate = async (
  prefetched,
  { maxWaitMs = 15000, purpose = 'delivery' } = {},
) => {
  const instant = getInstantCoordsForStatusUpdate(prefetched);
  if (instant.lat != null && instant.long != null) return instant;

  await hydrateCoordsFromDisk();
  const afterDisk = getInstantCoordsForStatusUpdate(prefetched);
  if (afterDisk.lat != null && afterDisk.long != null) return afterDisk;

  const Geo = getGeolocationApi();
  if (!Geo) {
    console.log('[location] geolocation module unavailable');
    return afterDisk;
  }

  let perm = await ensureLocationPermission(purpose);
  if (!perm.ok) {
    if (perm.error === 'permission_blocked') {
      const opened = await promptOpenAppSettings();
      if (opened) {
        await waitForAppResume(120000);
        perm = await ensureLocationPermission(purpose);
      }
    }
    if (!perm.ok) {
      console.log('[location] permission denied or unavailable');
      return afterDisk;
    }
  }

  if (Platform.OS === 'ios') {
    await new Promise((r) => { setTimeout(r, 500); });
  } else if (Platform.OS === 'android') {
    await new Promise((r) => { setTimeout(r, 300); });
  }

  const coords = await readCoordsWithLocationRecovery({
    purpose,
    maxWaitMs,
    maxPrompts: 2,
  });
  if (coords?.lat && coords?.lng) {
    return coordsForStatusApi(coords);
  }

  const prefetch = _statusLocationPrefetch || runStatusLocationPrefetch(purpose);
  const result = await Promise.race([
    prefetch,
    new Promise((resolve) => { setTimeout(() => resolve(null), 3000); }),
  ]);
  if (result?.lat && result?.lng) {
    return coordsForStatusApi(result);
  }

  return getInstantCoordsForStatusUpdate(prefetched);
};

/** @deprecated use resolveCoordsForStatusUpdate */
export const fetchCoordsForStatusUpdate = async (purpose = 'delivery', options = {}) =>
  resolveCoordsForStatusUpdate(options.prefetched, { ...options, purpose });

/** @deprecated prefer fetchCoordsForStatusUpdate */
export const getCoordsForApiCall = async (purpose = 'delivery', { maxWaitMs = 2500 } = {}) => {
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

/** GPS for farmer form / land map. Asks permission only when GPS is actually blocked. */
export const getLocationForForm = async ({ maxWaitMs = 12000, prompt = true } = {}) => {
  const mem = readCachedCoords(900000);
  if (mem?.lat && mem?.lng) {
    getFastCoordsForStatus().catch(() => {});
    return { lat: mem.lat, lng: mem.lng };
  }

  const disk = await hydrateCoordsFromDisk();
  if (disk?.lat && disk?.lng) return disk;

  const Geo = getGeolocationApi();
  if (!Geo) return { lat: '', lng: '', error: 'unavailable' };

  try {
    const fast = await Promise.race([
      getFastCoordsForStatus(),
      new Promise((_, reject) => { setTimeout(() => reject(new Error('timeout')), 5000); }),
    ]);
    if (fast?.lat && fast?.lng) return { lat: String(fast.lat), lng: String(fast.lng) };
  } catch (e) { /* need permission or a slower read */ }

  if (prompt) {
    await new Promise((r) => { setTimeout(r, 300); });
    const perm = await ensureLocationPermission('general', { prompt: true });
    if (!perm.ok) {
      try {
        const retry = await Promise.race([
          getFastCoordsForStatus(),
          new Promise((_, reject) => { setTimeout(() => reject(new Error('timeout')), 4000); }),
        ]);
        if (retry?.lat && retry?.lng) return { lat: String(retry.lat), lng: String(retry.lng) };
      } catch (e) { /* really blocked */ }
      const stillMissing = !readCachedCoords(900000);
      if (!stillMissing) return readCachedCoords(900000);
      const opened = await promptOpenAppSettings();
      if (opened) {
        await waitForAppResume(120000);
        await ensureLocationPermission('general', { prompt: true });
      }
    }
  }

  try {
    const after = await Promise.race([
      getFastCoordsForStatus(),
      new Promise((_, reject) => { setTimeout(() => reject(new Error('timeout')), Math.min(maxWaitMs, 8000)); }),
    ]);
    if (after?.lat && after?.lng) return { lat: String(after.lat), lng: String(after.lng) };
  } catch (e) { /* fall through */ }

  return getFreshCoords({ maxWaitMs, prompt: false });
};

/** Fetch fresh GPS coords (no PIN). */
export const getFreshCoords = async ({ maxWaitMs = 15000, prompt = true } = {}) => {
  const result = await Promise.race([
    getCurrentCoordsWithPermission('general', { useCache: false, prompt }),
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

/** Call at app boot so Android uses Play Services before any GPS read. */
export const initGeolocationConfig = () => {
  const Geo = getGeolocationApi();
  if (Geo) configureGeolocation(Geo);
};

if (Platform.OS === 'android') {
  initGeolocationConfig();
}
