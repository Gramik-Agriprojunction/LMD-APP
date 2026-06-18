import { NativeModules, Platform, PermissionsAndroid } from 'react-native';

let _geoApi = undefined;

const probeGeolocation = () => {
  try {
    const mod = require('@react-native-community/geolocation');
    const Geo = mod?.default || mod;
    // Accessing any method throws if native module is not linked (Proxy guard).
    if (typeof Geo?.getCurrentPosition === 'function') return Geo;
    return null;
  } catch (e) {
    return null;
  }
};

const getGeolocationApi = () => {
  if (_geoApi !== undefined) return _geoApi;
  // Fast path: skip require when legacy bridge module is absent (non-turbo builds).
  const turboOn = global.__turboModuleProxy != null;
  if (!turboOn && !NativeModules.RNCGeolocation) {
    _geoApi = null;
    return null;
  }
  _geoApi = probeGeolocation();
  return _geoApi;
};

export const isGeolocationAvailable = () => !!getGeolocationApi();

export const requestLocationPermission = async () => {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location permission',
        message: 'PIN code auto-fill ke liye location chahiye',
        buttonPositive: 'Allow',
        buttonNegative: 'Cancel',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
};

export const getCurrentCoords = () => new Promise((resolve, reject) => {
  const Geo = getGeolocationApi();
  if (!Geo) {
    reject(new Error('Geolocation native module not linked'));
    return;
  }
  try {
    Geo.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  } catch (e) {
    reject(e);
  }
});

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
  if (!isGeolocationAvailable()) {
    return { lat: '', lng: '', pincode: '', error: 'not_linked' };
  }
  try {
    const ok = await requestLocationPermission();
    if (!ok) return { lat: '', lng: '', pincode: '', error: 'permission_denied' };
    const { lat, lng } = await getCurrentCoords();
    const pincode = await reverseGeocodePincode(lat, lng);
    return { lat: String(lat), lng: String(lng), pincode };
  } catch (e) {
    return { lat: '', lng: '', pincode: '', error: String(e?.message || e) };
  }
};
