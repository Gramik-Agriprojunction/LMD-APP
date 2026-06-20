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

export const reverseGeocodePincode = async (lat, lng) => {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(url);
    const json = await res.json();
    const pin = String(json?.postcode || '').replace(/\D/g, '').slice(0, 6);
    return pin.length === 6 ? pin : '';
  } catch (e) {
    return '';
  }
};

export const getLocationPincode = async () => {
  const result = await getCurrentCoordsWithPermission('general');
  if (result.error === 'permission_denied') {
    return { lat: '', lng: '', pincode: '', error: 'permission_denied' };
  }
  if (!result.lat || !result.lng) {
    return { lat: '', lng: '', pincode: '', error: result.error || 'location_unavailable' };
  }
  const pincode = await reverseGeocodePincode(result.lat, result.lng);
  return { lat: result.lat, lng: result.lng, pincode };
};

export const warmUpLocation = (purpose = 'delivery') => {
  if (!isNativeGeolocationLinked()) return;
  getCurrentCoordsWithPermission(purpose, { useCache: true }).catch(() => {});
};
