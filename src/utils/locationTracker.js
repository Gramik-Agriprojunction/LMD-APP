import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import constants from './constants';
import { ensureLocationPermission, getCurrentCoordsWithPermission } from './locationHelper';

const INTERVAL_MS = 5 * 60 * 1000;

let _timer = null;
let _lastSentAt = 0;
let _running = false;
let _appStateSub = null;
let _inflight = false;

const hasToken = async () => {
  if (global.token) return true;
  try {
    const t = await AsyncStorage.getItem('accessToken');
    if (t) {
      global.token = t;
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
};

export const postLocationUpdate = async () => {
  if (_inflight) return;
  if (!(await hasToken())) return;

  _inflight = true;
  try {
    const perm = await ensureLocationPermission('general');
    if (!perm.ok) {
      console.log('[locationTracker] skip — no permission');
      return;
    }
    const coords = await getCurrentCoordsWithPermission('general', { useCache: false });
    const lat = String(coords?.lat || '').trim();
    const lng = String(coords?.lng || coords?.long || '').trim();
    if (!lat || !lng) {
      console.log('[locationTracker] skip — coords unavailable');
      return;
    }

    await fetch(constants.locationUpdate, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + global.token,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-localization': 'en',
      },
      body: JSON.stringify({ lat, long: lng }),
    });

    _lastSentAt = Date.now();
  } catch (e) {
    console.log('[locationTracker] error', e?.message || e);
  } finally {
    _inflight = false;
  }
};

const tick = () => {
  if (_running) postLocationUpdate();
};

const onAppStateChange = (next) => {
  if (next === 'active' && _running && Date.now() - _lastSentAt >= INTERVAL_MS) {
    postLocationUpdate();
  }
};

export const startBackgroundLocationTracker = async () => {
  if (_running) return;
  if (!(await hasToken())) return;

  _running = true;
  postLocationUpdate();
  _timer = setInterval(tick, INTERVAL_MS);
  _appStateSub = AppState.addEventListener('change', onAppStateChange);
  console.log('[locationTracker] started — posting every 5 min');
};

export const stopBackgroundLocationTracker = () => {
  _running = false;
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  if (_appStateSub) {
    _appStateSub.remove();
    _appStateSub = null;
  }
  _lastSentAt = 0;
  console.log('[locationTracker] stopped');
};
