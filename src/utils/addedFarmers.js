/**
 * Local store + API helpers for farmers added from the LMD profile flow.
 * Create / update / list all use the same payload as gramikfarmer:
 * { name, mobile, source, location, cattleCount, land, farmer_lands, crops, annualCrops }
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import constants from './constants';
import { cropsForApi, landsFromFarmer, plotsForApi } from './farmerLand';

const STORAGE_KEY = '@lmd_added_farmers';
const listeners = new Set();

const authHeaders = () => ({
  Authorization: 'Bearer ' + global.token,
  Accept: 'application/json',
  'X-localization': 'en',
  'Content-Type': 'application/json',
});

export const buildFarmerPayload = ({
  name,
  mobile,
  address = {},
  totalArea,
  hasCattle,
  animals = {},
  currentCrops = [],
  annualCrops = [],
  lands = [],
}) => {
  const cattleOn = hasCattle === 'yes' || hasCattle === true;
  const location = {
    lat: address.lat || 0,
    long: address.long || 0,
    fullAddress: String(address.address || '').trim(),
    state: address.state || '',
    district: address.district || '',
    block: address.postOffice || '',
    pin: String(address.pincode || '').trim(),
    village: String(address.village || address.address || '').trim(),
  };
  const area = Number(totalArea) || 0;
  return {
    name: String(name || '').trim(),
    mobile: String(mobile || '').replace(/\D/g, '').slice(0, 10),
    source: 'APP',
    location,
    cattleCount: {
      cow: cattleOn ? Number(animals.cow) || 0 : 0,
      buffalo: cattleOn ? Number(animals.buffalo) || 0 : 0,
      goat: cattleOn ? Number(animals.goat) || 0 : 0,
      other: 0,
    },
    land: {
      lat: location.lat,
      long: location.long,
      crop: '',
      sowingArea: area,
      area,
    },
    farmer_lands: plotsForApi(lands),
    crops: cropsForApi(currentCrops),
    annualCrops: cropsForApi(annualCrops),
  };
};

export const normalizeFarmerRecord = (raw) => {
  if (!raw || typeof raw !== 'object') return raw;
  const location = raw.location && typeof raw.location === 'object' ? raw.location : {};
  const land = raw.land && typeof raw.land === 'object' ? raw.land : {};
  const lands = landsFromFarmer(raw);
  const cattle = raw.cattleCount || {};
  const cattleTotal = ['cow', 'buffalo', 'goat', 'other'].reduce(
    (sum, key) => sum + Math.max(0, Number(cattle[key]) || 0),
    0,
  );
  return {
    ...raw,
    lands,
    farmer_lands: raw.farmer_lands || plotsForApi(lands),
    crops: Array.isArray(raw.crops) ? raw.crops : [],
    annualCrops: Array.isArray(raw.annualCrops) ? raw.annualCrops : [],
    pincode: raw.pincode || location.pin || location.pincode || '',
    address: raw.address || location.fullAddress || location.address || '',
    state: raw.state || location.state || '',
    district: raw.district || location.district || '',
    postOffice: raw.postOffice || location.block || location.postOffice || '',
    lat: raw.lat || location.lat || 0,
    long: raw.long || location.long || location.lng || 0,
    totalArea: raw.totalArea ?? land.area ?? land.sowingArea ?? '',
    hasCattle: raw.hasCattle || (cattleTotal > 0 ? 'yes' : 'no'),
  };
};

const unwrapFarmerList = (json) => {
  const d = json?.data ?? json?.response?.data ?? json ?? {};
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.farmers)) return d.farmers;
  if (Array.isArray(d?.list)) return d.list;
  if (Array.isArray(d?.data)) return d.data;
  if (Array.isArray(json?.farmers)) return json.farmers;
  return [];
};

const unwrapFarmer = (json) => {
  const d = json?.data ?? json?.response?.data ?? json ?? {};
  if (d && typeof d === 'object' && !Array.isArray(d)) {
    return d.farmer || d.data || d;
  }
  return d;
};

const apiFarmerBody = (payload, id) => ({
  name: payload.name,
  mobile: payload.mobile,
  source: payload.source || 'APP',
  location: payload.location,
  cattleCount: payload.cattleCount,
  land: payload.land,
  farmer_lands: plotsForApi(payload.farmer_lands || payload.lands),
  crops: cropsForApi(payload.crops),
  annualCrops: cropsForApi(payload.annualCrops),
  ...(id ? { id } : {}),
});

const postFarmerApi = async (url, method, payload) => {
  const res = await fetch(url, {
    method,
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.message || json?.error || json?.msg || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return unwrapFarmer(json);
};

let _cache = null;

const notify = (farmers) => {
  _cache = farmers;
  listeners.forEach((fn) => {
    try { fn(farmers); } catch (e) { /* ignore */ }
  });
};

const readAll = async () => {
  if (Array.isArray(_cache)) return _cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    _cache = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    _cache = [];
  }
  return _cache;
};

const writeAll = async (farmers) => {
  const next = Array.isArray(farmers) ? farmers : [];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  notify(next);
  return next;
};

export const subscribeAddedFarmers = (fn) => {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const farmerDisplayName = (f) =>
  f?.name || f?.farmer_name || f?.fullName || f?.full_name || 'Kisan';

export const farmerDisplayPhone = (f) =>
  String(f?.mobile || f?.phone || f?.farmer_mobile || f?.contact || '').replace(/\D/g, '');

export const farmerDisplayAddress = (f) => {
  const loc = f?.location || {};
  const parts = [
    f?.address || loc.fullAddress || loc.address || f?.village || loc.village,
    f?.postOffice || loc.block || loc.postOffice,
    f?.district || loc.district,
    f?.state || loc.state,
    f?.pincode || loc.pin || loc.pincode,
  ].map((v) => String(v || '').trim()).filter(Boolean);
  return [...new Set(parts)].join(', ');
};

export const farmerId = (f) => f?.id || f?.localId || f?.farmer_id || f?.user_id;

export const getAddedFarmers = async () => {
  const local = (await readAll()).map(normalizeFarmerRecord);
  try {
    const res = await fetch(constants.lmdFarmers, {
      method: 'GET',
      headers: authHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return local;
    const remote = unwrapFarmerList(json).map(normalizeFarmerRecord);
    const pending = local.filter((row) => row?.pendingSync);
    const byKey = new Map();
    remote.forEach((row) => {
      const key = String(farmerId(row) || farmerDisplayPhone(row) || '');
      if (key) byKey.set(key, row);
    });
    pending.forEach((row) => {
      const key = String(farmerId(row) || farmerDisplayPhone(row) || '');
      if (key && !byKey.has(key)) byKey.set(key, row);
    });
    const merged = byKey.size ? Array.from(byKey.values()) : (remote.length ? remote : local);
    await writeAll(merged);
    return merged;
  } catch (e) {
    return local;
  }
};

export const getAddedFarmerById = async (id) => {
  const list = await readAll();
  return list.find((row) => String(farmerId(row)) === String(id)) || null;
};

const newLocalId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const persistFarmer = async (payload, { id, pendingSync }) => {
  const list = await readAll();
  const now = new Date().toISOString();
  const farmer = normalizeFarmerRecord({
    ...payload,
    id,
    localId: payload?.localId || id,
    createdAt: payload?.createdAt || now,
    updatedAt: now,
    pendingSync,
  });
  const next = [farmer, ...list.filter((row) => String(farmerId(row)) !== String(farmer.id))];
  await writeAll(next);
  return farmer;
};

/** POST create-farmer, then keep a local copy for the list. */
export const createAddedFarmer = async (payload) => {
  const body = payload?.farmer_lands ? payload : buildFarmerPayload(payload);
  try {
    const server = await postFarmerApi(constants.createFarmer, 'POST', apiFarmerBody(body));
    const serverId = server?.id || server?.farmer_id || server?.userId;
    return persistFarmer({ ...body, ...server }, { id: serverId || newLocalId(), pendingSync: false });
  } catch (e) {
    if (e?.status && e.status !== 404) throw e;
    return persistFarmer(body, { id: newLocalId(), pendingSync: true });
  }
};

/** PUT update-farmer, then keep a local copy for the list. */
export const updateAddedFarmer = async (id, payload) => {
  const body = payload?.farmer_lands ? payload : buildFarmerPayload(payload);
  try {
    const server = await postFarmerApi(constants.updateFarmer, 'PUT', apiFarmerBody(body, id));
    const serverId = server?.id || server?.farmer_id || id;
    return persistFarmer({ ...body, ...server }, { id: serverId, pendingSync: false });
  } catch (e) {
    if (e?.status && e.status !== 404) throw e;
    const list = await readAll();
    const now = new Date().toISOString();
    let updated = null;
    const next = list.map((row) => {
      if (String(farmerId(row)) !== String(id)) return row;
      updated = normalizeFarmerRecord({ ...row, ...body, id: farmerId(row), updatedAt: now, pendingSync: true });
      return updated;
    });
    if (!updated) return persistFarmer(body, { id, pendingSync: true });
    await writeAll(next);
    return updated;
  }
};

export const removeAddedFarmer = async (id) => {
  const list = await readAll();
  await writeAll(list.filter((row) => String(farmerId(row)) !== String(id)));
};

export const parsePostOfficeResponse = (json) => {
  const d = json?.data ?? json?.response?.data ?? json ?? {};
  const toOffice = (o) => {
    if (typeof o === 'string') return { id: o, name: o };
    const name =
      o?.name || o?.Name || o?.post_office_name || o?.postOfficeName || o?.branch_name || o?.PostOffice || '';
    return {
      id: String(o?.id || name),
      name: String(name),
      state: o?.state || o?.State || o?.stateName || '',
      district: o?.district || o?.District || o?.districtName || '',
      pincode: String(o?.pincode || o?.pinCode || o?.pin || o?.Pincode || ''),
    };
  };
  if (Array.isArray(d)) {
    const first = d[0] || {};
    return {
      state: first.state || first.State || first.stateName || '',
      district: first.district || first.District || first.districtName || '',
      offices: d.map(toOffice).filter((o) => o.name),
    };
  }
  const raw = d.post_offices || d.postOffices || d.offices || d.list || d.branches || d.data || [];
  return {
    state: d.state || d.stateName || d.State || '',
    district: d.district || d.districtName || d.District || '',
    offices: Array.isArray(raw) ? raw.map(toOffice).filter((o) => o.name) : [],
  };
};
