import { NativeModules, Platform, PermissionsAndroid } from 'react-native';

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

const getCurrentCoordsWithFallback = () => new Promise((resolve, reject) => {
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
    const cached = readCachedCoords(600000);
    if (cached) return cached;
    return { lat: '', lng: '', error: perm.error || 'permission_denied' };
  }

  try {
    if (Platform.OS === 'ios') {
      await new Promise((r) => setTimeout(r, 400));
    }
    const { lat, lng } = await getCurrentCoordsWithFallback();
    return { lat: String(lat), lng: String(lng) };
  } catch (e) {
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
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const reverseGeocodeNominatim = async (lat, lng) => {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json&addressdetails=1`;
  const json = await fetchJsonWithTimeout(url, {
    headers: { 'User-Agent': 'GramikLMD/1.0 (React Native)' },
  });
  return normalizePincode(json?.address?.postcode);
};

const reverseGeocodeBigDataCloud = async (lat, lng) => {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
  const json = await fetchJsonWithTimeout(url);
  return normalizePincode(json?.postcode);
};

export const reverseGeocodePincode = async (lat, lng) => {
  const latN = Number(lat);
  const lngN = Number(lng);
  if (!Number.isFinite(latN) || !Number.isFinite(lngN)) return '';

  // Nominatim returns Indian pincodes reliably; BigDataCloud often leaves postcode empty.
  const fromNominatim = await reverseGeocodeNominatim(latN, lngN);
  if (fromNominatim) return fromNominatim;

  const fromBdc = await reverseGeocodeBigDataCloud(latN, lngN);
  return fromBdc || '';
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

export const warmUpLocation = (purpose = 'delivery') => {
  if (!isNativeGeolocationLinked()) return;
  getCurrentCoordsWithPermission(purpose, { useCache: true }).catch(() => {});
};
