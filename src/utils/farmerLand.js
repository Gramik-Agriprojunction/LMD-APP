export const INDIA_REGION = {
  latitude: 26.8467,
  longitude: 80.9462,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const EARTH_RADIUS_M = 6371008.8;
const SQM_PER_ACRE = 4046.8564224;

function toRad(deg) {
  return (Number(deg) * Math.PI) / 180;
}

export function pointDistanceMeters(a, b) {
  if (!a || !b) return Infinity;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function polygonAreaSqMeters(points) {
  if (!Array.isArray(points) || points.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const j = (i + 1) % points.length;
    const lat1 = toRad(points[i].latitude);
    const lat2 = toRad(points[j].latitude);
    const lng1 = toRad(points[i].longitude);
    const lng2 = toRad(points[j].longitude);
    total += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

export function formatAcres(acres) {
  const n = Number(acres);
  if (!Number.isFinite(n) || n <= 0) return '0 acre';
  if (n < 0.01) return `${n.toFixed(3)} acre`;
  if (n < 10) return `${n.toFixed(2)} acre`;
  return `${n.toFixed(1)} acre`;
}

export function formatLandArea(points) {
  const sqm = polygonAreaSqMeters(points);
  const acres = sqm / SQM_PER_ACRE;
  return {
    sqm,
    acres,
    acresLabel: formatAcres(acres),
    sqmLabel: sqm >= 10 ? `${Math.round(sqm)} sq m` : `${sqm.toFixed(1)} sq m`,
  };
}

export function polygonCentroid(points) {
  if (!Array.isArray(points) || !points.length) return null;
  let lat = 0;
  let lng = 0;
  points.forEach((p) => {
    lat += Number(p.latitude) || 0;
    lng += Number(p.longitude) || 0;
  });
  return { latitude: lat / points.length, longitude: lng / points.length };
}

export function numericLandId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function cropApiId(crop) {
  const n = Number(crop?.cropId ?? crop?.crop_id ?? crop?.id ?? crop?.value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function cropsForApi(list) {
  const seen = new Set();
  const out = [];
  (Array.isArray(list) ? list : []).forEach((crop) => {
    const cropId = cropApiId(crop);
    if (cropId == null || seen.has(cropId)) return;
    seen.add(cropId);
    out.push({ cropId });
  });
  return out;
}

export function plotsForApi(lands) {
  return (Array.isArray(lands) ? lands : [])
    .map((land) => {
      const coordinates = toApiCoordinates(land?.coordinates || land?.points);
      if (!coordinates.length) return null;
      const cropId = landCropId(land) ?? cropApiId(land);
      const id = numericLandId(land?.id);
      return {
        ...(id != null ? { id } : {}),
        name: String(land.name || '').trim() || 'Khet',
        acres: Number(land.acres) || 0,
        coordinates,
        ...(cropId != null ? { crop_id: cropId } : {}),
        ...(land.cropName ? { cropName: land.cropName } : {}),
        ...(landSowingDate(land) ? { sowingDate: landSowingDate(land) } : {}),
        ...(landSowingArea(land) != null ? { sowingArea: landSowingArea(land) } : {}),
      };
    })
    .filter(Boolean);
}

export function landsFromFarmer(farmer) {
  const raw = farmer?.farmer_lands || farmer?.lands || [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((land) => {
      const coordinates = toApiCoordinates(land?.coordinates || land?.points);
      if (!coordinates.length) return null;
      const cropId = landCropId(land) ?? cropApiId(land);
      const id = numericLandId(land?.id);
      return {
        id: id != null ? String(id) : land.id || `draft-${Date.now()}`,
        name: String(land.name || '').trim() || 'Khet',
        acres: Number(land.acres) || 0,
        coordinates,
        ...(cropId != null ? { crop_id: cropId, cropId } : {}),
        ...(land.cropName ? { cropName: land.cropName } : {}),
        ...(land.cropIcon ? { cropIcon: land.cropIcon } : {}),
        ...(landSowingDate(land) ? { sowingDate: landSowingDate(land) } : {}),
        ...(landSowingArea(land) != null ? { sowingArea: landSowingArea(land) } : {}),
      };
    })
    .filter(Boolean);
}

export function attachCropNamesToLands(lands, crops) {
  const list = Array.isArray(lands) ? lands : [];
  const byId = new Map();
  (Array.isArray(crops) ? crops : []).forEach((crop) => {
    const id = cropApiId(crop);
    if (id == null) return;
    byId.set(String(id), {
      name: String(crop?.name || crop?.cropName || '').trim(),
      icon: crop?.icon || crop?.image || crop?.cropIcon || null,
    });
  });
  return list.map((land) => {
    if (!land) return land;
    const hit = byId.get(String(land.cropId ?? land.crop_id));
    if (!hit) return land;
    return {
      ...land,
      cropName: land.cropName || hit.name || '',
      cropIcon: land.cropIcon || hit.icon || null,
    };
  });
}

export function hydrateCrops(list, catalog) {
  const rows = Array.isArray(list) ? list : [];
  const byId = new Map();
  (Array.isArray(catalog) ? catalog : []).forEach((crop) => {
    const id = cropApiId(crop);
    if (id != null) byId.set(String(id), crop);
  });
  return rows.map((item) => {
    const id = cropApiId(item);
    const hit = id != null ? byId.get(String(id)) : null;
    if (!hit) return item;
    return {
      ...hit,
      ...item,
      id: id ?? item.id,
      cropId: id ?? item.cropId,
      name: item.name || item.cropName || hit.name || hit.cropName,
    };
  });
}

export function unwrapCropList(json) {
  const root = json?.response?.data ?? json?.data ?? json ?? {};
  const data = root?.data ?? root;
  const list = Array.isArray(data)
    ? data
    : data?.crops || data?.items || data?.records || data?.list || [];
  if (!Array.isArray(list)) return [];
  return list
    .map((crop) => {
      const cropId = cropApiId(crop);
      const name = crop?.name || crop?.cropName || crop?.title || crop?.label || crop?.englishName || '';
      if (!name) return null;
      return {
        id: cropId ?? crop?.id,
        cropId: cropId ?? crop?.cropId ?? crop?.id,
        name,
        icon: crop?.icon || crop?.image || crop?.cropIcon || null,
      };
    })
    .filter(Boolean);
}

function unwrapFasalPayload(payload) {
  if (Array.isArray(payload)) return { selectedCrops: payload };
  const root = payload?.response?.data ?? payload?.data ?? payload ?? {};
  if (root?.data && typeof root.data === 'object' && !Array.isArray(root.data)) {
    return root.data;
  }
  return root && typeof root === 'object' ? root : {};
}

/** Crops already on the farmer (current crops) — shown as Meri fasal on the land popup. */
export function parseFarmerCropsForLand(payload) {
  const data = unwrapFasalPayload(payload);
  const list =
    data.selectedCrops ||
    data.myCrops ||
    data.crops ||
    data.items ||
    (Array.isArray(data.data) ? data.data : null) ||
    [];
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const cropId =
        cropApiId(item) ??
        cropApiId(item.crop) ??
        numericLandId(item.cropId) ??
        numericLandId(item.crop_id);
      const name = String(
        item.name || item.cropName || item.crop?.name || item.title || item.label || '',
      ).trim();
      if (!name) return null;
      const key = String(cropId ?? item.id ?? name);
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        id: key || `crop-${index}`,
        cropId: cropId ?? item.id,
        name: name || `Fasal ${index + 1}`,
        icon: item.icon || item.image || item.cropIcon || item.crop?.icon || null,
      };
    })
    .filter(Boolean);
}

/** Full crop catalog — shown as Anya fasalein on the land popup. */
export function parseCatalogCropsForLand(payload) {
  if (Array.isArray(payload)) return parseCatalogCropsForLand({ cropList: payload });
  const fromUnwrap = unwrapCropList(payload);
  if (fromUnwrap.length) {
    const seen = new Set();
    return fromUnwrap.filter((row) => {
      const key = String(row.cropId ?? row.id ?? row.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  const root = payload?.response?.data ?? payload?.data ?? payload ?? {};
  const nested =
    root?.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? root.data
      : root;
  const list = Array.isArray(root)
    ? root
    : nested.allCrops ||
      nested.availableCrops ||
      nested.cropList ||
      nested.crops ||
      nested.items ||
      nested.records ||
      (Array.isArray(nested.data) ? nested.data : null) ||
      [];
  if (!Array.isArray(list)) return [];
  return parseFarmerCropsForLand(list);
}

export function landSowingDate(land) {
  const raw = land?.sowingDate || land?.sowing_date || land?.dateOfSowing || land?.date_of_sowing || '';
  const value = String(raw).trim();
  return value || '';
}

export function landSowingArea(land) {
  const n = Number(land?.sowingArea ?? land?.sowing_area ?? land?.acres ?? land?.areaAcres);
  return Number.isFinite(n) && n > 0 ? Number(n.toFixed(4)) : null;
}

export function formatSowingDate(raw) {
  if (!raw) return '';
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function toApiSowingDate(raw) {
  if (!raw) return '';
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function landCropId(land) {
  if (!land || typeof land !== 'object') return null;
  const nested = land.crop && typeof land.crop === 'object' ? land.crop : null;
  return (
    numericLandId(land.crop_id) ??
    numericLandId(land.cropId) ??
    numericLandId(nested?.cropId ?? nested?.crop_id ?? nested?.id) ??
    numericLandId(typeof land.crop === 'number' ? land.crop : null)
  );
}

function toMapPoint(raw) {
  if (Array.isArray(raw) && raw.length >= 2) {
    const a = Number(raw[0]);
    const b = Number(raw[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const looksLikeLngLat = Math.abs(a) > 40 || (a > 60 && Math.abs(b) <= 40);
    return looksLikeLngLat ? { latitude: b, longitude: a } : { latitude: a, longitude: b };
  }
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number(raw.lat ?? raw.latitude);
  const lng = Number(raw.long ?? raw.lng ?? raw.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
}

function unwrapCoordList(raw) {
  if (raw == null) return [];
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value.trim()); } catch (e) { return []; }
  }
  if (!Array.isArray(value) || !value.length) return [];
  if (Array.isArray(value[0]) && Array.isArray(value[0][0])) value = value[0];
  const points = value.map(toMapPoint).filter(Boolean);
  if (points.length >= 2) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first.latitude === last.latitude && first.longitude === last.longitude) points.pop();
  }
  return points;
}

export function parseLandPoints(land) {
  if (!land || typeof land !== 'object') return [];
  const fromCoords = unwrapCoordList(land.coordinates);
  if (fromCoords.length) return fromCoords;
  const fromPoints = unwrapCoordList(land.points);
  if (fromPoints.length) return fromPoints;
  return unwrapCoordList(land.coords);
}

export function toApiCoordinates(points) {
  if (!Array.isArray(points)) return [];
  return points
    .map((p) => {
      const lat = Number(p?.latitude ?? p?.lat);
      const lng = Number(p?.longitude ?? p?.long ?? p?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat: Number(lat.toFixed(6)), long: Number(lng.toFixed(6)) };
    })
    .filter(Boolean);
}

const GOOGLE_PLACES_KEY = 'AIzaSyBHKcuWHldWWitVtkrXd1DF2jvwQWjw-Ck';
const INDIA_VIEWBOX = '68.1,37.1,97.4,6.5';

function mapGooglePrediction(item) {
  return {
    id: item.place_id,
    title: item.structured_formatting?.main_text || item.description || '',
    subtitle: item.structured_formatting?.secondary_text || '',
    placeId: item.place_id,
  };
}

async function searchPlacesGoogle(query) {
  const params = new URLSearchParams({
    input: query,
    key: GOOGLE_PLACES_KEY,
    components: 'country:in',
    language: 'hi',
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
  const json = await res.json();
  if (json?.status && json.status !== 'OK' && json.status !== 'ZERO_RESULTS') return [];
  return (json?.predictions || []).slice(0, 10).map(mapGooglePrediction);
}

async function searchPlacesNominatim(query) {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    countrycodes: 'in',
    limit: '12',
    viewbox: INDIA_VIEWBOX,
    bounded: '1',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      'User-Agent': 'GramikLMD/1.0 (React Native)',
      'Accept-Language': 'hi-IN,en-IN;q=0.9',
    },
  });
  const json = await res.json();
  return (Array.isArray(json) ? json : []).map((item) => ({
    id: `osm-${item.place_id}`,
    title: item.name || item.display_name?.split(',')[0] || query,
    subtitle: item.display_name || '',
    latitude: Number(item.lat),
    longitude: Number(item.lon),
  })).filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
}

export async function searchPlaces(query) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  let google = [];
  let osm = [];
  try { google = await searchPlacesGoogle(q); } catch (e) { /* fall through */ }
  try { osm = await searchPlacesNominatim(q); } catch (e) { /* fall through */ }
  const seen = new Set();
  const merged = [];
  [...google, ...osm].forEach((row) => {
    const key = String(row.placeId || row.title || '').toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(row);
  });
  return merged.slice(0, 12);
}

export async function reverseGeocodeAddress(lat, lng) {
  const latN = Number(lat);
  const lngN = Number(lng);
  if (!Number.isFinite(latN) || !Number.isFinite(lngN)) return { label: '', pincode: '' };
  try {
    const params = new URLSearchParams({
      latlng: `${latN},${lngN}`,
      key: GOOGLE_PLACES_KEY,
      language: 'en',
    });
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const json = await res.json();
    const results = Array.isArray(json?.results) ? json.results : [];
    let pincode = '';
    let label = '';
    results.forEach((result) => {
      const comps = Array.isArray(result.address_components) ? result.address_components : [];
      const pick = (...types) => {
        const hit = comps.find((c) => Array.isArray(c.types) && types.some((t) => c.types.includes(t)));
        return hit?.short_name || hit?.long_name || '';
      };
      if (!pincode) {
        const postal = String(pick('postal_code') || '').replace(/\D/g, '').slice(0, 6);
        if (postal.length === 6) pincode = postal;
      }
      if (!label) {
        label =
          pick('route') ||
          pick('sublocality_level_1', 'sublocality') ||
          pick('neighborhood') ||
          pick('locality') ||
          String(result.formatted_address || '').split(',')[0] ||
          '';
      }
    });
    return { label, pincode };
  } catch (e) {
    return { label: '', pincode: '' };
  }
}

export async function reverseGeocodeLabel(lat, lng) {
  const geo = await reverseGeocodeAddress(lat, lng);
  return geo.label || '';
}

export async function resolvePlaceLocation(place) {
  if (Number.isFinite(place?.latitude) && Number.isFinite(place?.longitude)) {
    return {
      latitude: place.latitude,
      longitude: place.longitude,
      label: place.title || place.subtitle || '',
    };
  }
  if (!place?.placeId) return null;
  const params = new URLSearchParams({
    place_id: place.placeId,
    fields: 'geometry,formatted_address,name',
    key: GOOGLE_PLACES_KEY,
    language: 'hi',
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
  const json = await res.json();
  const loc = json?.result?.geometry?.location;
  if (!loc) return null;
  return {
    latitude: Number(loc.lat),
    longitude: Number(loc.lng),
    label: json.result.name || json.result.formatted_address || place.title || '',
  };
}

export function landForMap(land) {
  if (!land || typeof land !== 'object') return null;
  const points = parseLandPoints(land);
  const coordinates = toApiCoordinates(points.length ? points : land.coordinates);
  if (!coordinates.length && numericLandId(land.id) == null) return null;
  const cropId = landCropId(land);
  return {
    id: land.id,
    name: land.name,
    acres: land.acres ?? land.areaAcres ?? land.sowingArea,
    coordinates,
    points: points.length ? points : coordinates.map((c) => ({ latitude: c.lat, longitude: c.long })),
    ...(cropId != null ? { cropId, crop_id: cropId } : {}),
    ...(land.cropName ? { cropName: land.cropName } : {}),
    ...(land.cropIcon ? { cropIcon: land.cropIcon } : {}),
    ...(landSowingDate(land) ? { sowingDate: landSowingDate(land) } : {}),
    ...(landSowingArea(land) != null ? { sowingArea: landSowingArea(land) } : {}),
  };
}
