import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import WebView from 'react-native-webview';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DatePicker from 'react-native-date-picker';
import Toast from 'react-native-simple-toast';
import { overlayBottomPadding } from '../utils/safeAreaInsets';
import ScreenHeader from '../components/ScreenHeader';
import constants from '../utils/constants';
import { getCachedCoordsForApi, getLocationForForm } from '../utils/locationHelper';
import {
  formatLandArea,
  formatSowingDate,
  landCropId,
  landSowingDate,
  numericLandId,
  toApiSowingDate,
  parseCatalogCropsForLand,
  parseFarmerCropsForLand,
  parseLandPoints,
  pointDistanceMeters,
  resolvePlaceLocation,
  reverseGeocodeLabel,
  searchPlaces,
  toApiCoordinates,
} from '../utils/farmerLand';

const Icon = MaterialCommunityIcons;

const GREEN = '#5D3FD3';
const TRACE_MIN_GAP_M = 3.2;
const EMPTY_CROPS = [];

function loadGeolocation() {
  try {
    const mod = require('@react-native-community/geolocation');
    return mod?.default || mod;
  } catch (e) {
    return null;
  }
}

function validCoord(lat, lng) {
  const a = Number(lat);
  const b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && a !== 0 && b !== 0 ? { latitude: a, longitude: b } : null;
}

function buildMapHtml(lat, lng) {
  const start = validCoord(lat, lng);
  const startLat = start ? start.latitude : 22.9734;
  const startLng = start ? start.longitude : 78.6569;
  const startZoom = start ? 18 : 5;
  const meJs = start ? `setMe(${startLat}, ${startLng});` : '';
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #E8EEF2; touch-action: manipulation; }
  .leaflet-control-attribution { font-size: 9px; }
  .pin {
    width: 22px; height: 22px; border-radius: 11px;
    background: #5D3FD3; color: #fff; font: 700 11px/22px sans-serif;
    text-align: center; border: 2px solid #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,.35);
  }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
    doubleClickZoom: true,
    tapTolerance: 15
  }).setView([${startLat}, ${startLng}], ${startZoom});
  const roads = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}', {
    maxZoom: 21, subdomains: '0123', attribution: '© Google'
  });
  const hybrid = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}', {
    maxZoom: 21, subdomains: '0123', attribution: '© Google'
  });
  const voyager = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 20, attribution: '© OSM © CARTO'
  });
  hybrid.addTo(map);
  let layer = hybrid;
  let googleFailed = 0;
  hybrid.on('tileerror', function () {
    googleFailed += 1;
    if (googleFailed >= 6 && layer === hybrid) {
      map.removeLayer(hybrid);
      voyager.addTo(map);
      layer = voyager;
    }
  });
  const drawn = L.layerGroup().addTo(map);
  let meMarker = null;
  function post(payload) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }
  let tapTimer = null;
  map.on('click', function (e) {
    if (tapTimer) {
      clearTimeout(tapTimer);
      tapTimer = null;
      return;
    }
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    tapTimer = setTimeout(function () {
      tapTimer = null;
      post({ type: 'tap', latitude: lat, longitude: lng });
    }, 280);
  });
  map.on('dblclick', function () {
    if (tapTimer) {
      clearTimeout(tapTimer);
      tapTimer = null;
    }
  });
  function setTiles(kind) {
    map.removeLayer(layer);
    layer = kind === 'satellite' ? hybrid : (googleFailed >= 4 ? voyager : roads);
    layer.addTo(map);
  }
  function setMe(lat, lng) {
    if (!lat || !lng) return;
    if (meMarker) map.removeLayer(meMarker);
    meMarker = L.circleMarker([lat, lng], {
      radius: 9, color: '#FFFFFF', weight: 3, fillColor: '#5D3FD3', fillOpacity: 1
    }).addTo(map);
  }
  function fly(lat, lng, zoom) {
    try { map.invalidateSize(); } catch (e) {}
    map.setView([lat, lng], zoom || 18, { animate: true });
  }
  function render(points) {
    drawn.clearLayers();
    if (!points || !points.length) return;
    const latlngs = points.map(function (p) { return [p.latitude, p.longitude]; });
    if (latlngs.length >= 3) {
      L.polygon(latlngs, { color: '#5D3FD3', weight: 3, fillColor: '#5D3FD3', fillOpacity: 0.28 }).addTo(drawn);
    } else if (latlngs.length >= 2) {
      L.polyline(latlngs, { color: '#5D3FD3', weight: 3 }).addTo(drawn);
    }
    points.forEach(function (p, i) {
      const icon = L.divIcon({ className: '', html: '<div class="pin">' + (i + 1) + '</div>', iconSize: [22, 22], iconAnchor: [11, 11] });
      L.marker([p.latitude, p.longitude], { icon: icon }).addTo(drawn);
    });
  }
  window.setTiles = setTiles;
  window.setMe = setMe;
  window.fly = fly;
  window.render = render;
  setTimeout(function () { try { map.invalidateSize(); } catch (e) {} }, 250);
  ${meJs}
  post({ type: 'ready' });
</script>
</body>
</html>`;
}

function shortCropName(name) {
  if (!name) return '';
  const trimmed = String(name).trim();
  return trimmed.split('(')[0].trim() || trimmed;
}

function CropOption({ crop, selected, last, onPress }) {
  const on = selected;
  return (
    <TouchableOpacity
      style={[styles.modalCropRow, on && styles.modalCropRowOn, last && { borderBottomWidth: 0 }]}
      onPress={onPress}
      activeOpacity={0.86}
    >
      {crop.icon ? (
        <Image source={{ uri: crop.icon }} style={styles.modalCropIcon} />
      ) : (
        <Icon name="sprout" size={16} color={on ? GREEN : '#91A09A'} />
      )}
      <Text style={[styles.modalCropName, on && styles.modalCropNameOn]} numberOfLines={1}>
        {shortCropName(crop.name)}
      </Text>
      {on ? <Icon name="check" size={16} color={GREEN} /> : null}
    </TouchableOpacity>
  );
}

export default function AddLand({ navigation, route }) {
  const footerPad = overlayBottomPadding(12);
  const editLand = route?.params?.land || null;
  const pickIndex = route?.params?.landIndex;
  const incomingCrops = Array.isArray(route?.params?.crops) ? route.params.crops : EMPTY_CROPS;
  const incomingCatalog = Array.isArray(route?.params?.catalogCrops) ? route.params.catalogCrops : EMPTY_CROPS;
  const initialPoints = useMemo(() => parseLandPoints(editLand), [editLand]);
  const routeCoords = useMemo(() => {
    const fromRoute = validCoord(
      route?.params?.lat ?? route?.params?.latitude,
      route?.params?.lng ?? route?.params?.long ?? route?.params?.longitude,
    );
    if (fromRoute) return fromRoute;
    const cached = getCachedCoordsForApi(900000);
    return validCoord(cached?.lat, cached?.lng ?? cached?.long);
  }, [route?.params]);
  const [startCoords, setStartCoords] = useState(routeCoords);
  const mapHtml = useMemo(
    () => buildMapHtml(routeCoords?.latitude, routeCoords?.longitude),
    [routeCoords?.latitude, routeCoords?.longitude],
  );

  const webRef = useRef(null);
  const watchId = useRef(null);
  const lastGps = useRef(null);
  const readyRef = useRef(false);
  const pendingFly = useRef(routeCoords);
  const locatingRef = useRef(false);
  const pickingRef = useRef(false);
  const hasFixRef = useRef(Boolean(routeCoords));
  const startCoordsRef = useRef(routeCoords);
  const queryRef = useRef('');

  const [points, setPoints] = useState(initialPoints);
  const [mode, setMode] = useState('tap');
  const [tracing, setTracing] = useState(false);
  const [locating, setLocating] = useState(!routeCoords && !initialPoints.length);
  const [mapType, setMapType] = useState('satellite');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [landName, setLandName] = useState(editLand?.name || '');
  const [farmerCrops, setFarmerCrops] = useState(() => parseFarmerCropsForLand(incomingCrops));
  const [otherCrops, setOtherCrops] = useState(() => parseCatalogCropsForLand(incomingCatalog));
  const [cropsLoading, setCropsLoading] = useState(!incomingCatalog.length);
  const [selectedCropId, setSelectedCropId] = useState(() => landCropId(editLand) ?? numericLandId(route?.params?.cropId));
  const [cropOpen, setCropOpen] = useState(false);
  const [sowingDate, setSowingDate] = useState(() => {
    const raw = landSowingDate(editLand);
    const parsed = raw ? new Date(raw) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  });
  const [dateOpen, setDateOpen] = useState(false);
  const [traceHint, setTraceHint] = useState('');

  const area = useMemo(() => formatLandArea(points), [points]);
  const canSave = points.length >= 3 && area.acres > 0;
  const otherCropOptions = useMemo(() => {
    const mine = new Set(farmerCrops.map((c) => String(c.cropId ?? c.id)));
    return otherCrops.filter((c) => !mine.has(String(c.cropId ?? c.id)));
  }, [farmerCrops, otherCrops]);
  const selectedCrop = useMemo(
    () =>
      farmerCrops.find((c) => String(c.cropId ?? c.id) === String(selectedCropId)) ||
      otherCrops.find((c) => String(c.cropId ?? c.id) === String(selectedCropId)) ||
      null,
    [farmerCrops, otherCrops, selectedCropId],
  );

  useEffect(() => {
    const mine = parseFarmerCropsForLand(incomingCrops);
    if (mine.length) setFarmerCrops(mine);
  }, [incomingCrops]);

  useEffect(() => {
    let alive = true;
    const seeded = parseCatalogCropsForLand(incomingCatalog);
    if (seeded.length) {
      setOtherCrops(seeded);
      setCropsLoading(false);
    } else {
      setCropsLoading(true);
    }
    fetch(constants.cropList, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + global.token,
        Accept: 'application/json',
        'X-localization': 'en',
      },
    })
      .then((res) => res.json())
      .then((json) => {
        if (!alive) return;
        const rows = parseCatalogCropsForLand(json);
        if (rows.length) setOtherCrops(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setCropsLoading(false);
      });
    return () => { alive = false; };
  }, [incomingCatalog]);

  useEffect(() => {
    if (selectedCropId != null) return;
    const suggested = landCropId(editLand) ?? numericLandId(route?.params?.cropId);
    const all = farmerCrops.concat(otherCrops);
    if (suggested != null && all.some((c) => String(c.cropId ?? c.id) === String(suggested))) {
      setSelectedCropId(suggested);
      return;
    }
    if (farmerCrops.length === 1 && farmerCrops[0].cropId != null) {
      setSelectedCropId(farmerCrops[0].cropId);
    }
  }, [editLand, farmerCrops, otherCrops, route?.params?.cropId, selectedCropId]);

  const inject = useCallback((js) => {
    webRef.current?.injectJavaScript(`${js}; true;`);
  }, []);

  const flyTo = useCallback((coords, zoom = 18) => {
    if (!coords) return;
    const lat = Number(coords.latitude ?? coords.lat);
    const lng = Number(coords.longitude ?? coords.lng ?? coords.long);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) return;
    pendingFly.current = { latitude: lat, longitude: lng };
    const js = `window.setMe && window.setMe(${lat}, ${lng}); window.fly && window.fly(${lat}, ${lng}, ${zoom})`;
    if (readyRef.current) inject(js);
    setTimeout(() => {
      if (readyRef.current) inject(js);
    }, 400);
  }, [inject]);

  useEffect(() => {
    if (!readyRef.current) return;
    inject(`window.render && window.render(${JSON.stringify(points)})`);
  }, [inject, points]);

  const addPoint = useCallback((coord, source = 'tap') => {
    if (!coord) return;
    const next = { latitude: Number(coord.latitude), longitude: Number(coord.longitude), source };
    if (!Number.isFinite(next.latitude) || !Number.isFinite(next.longitude)) return;
    setPoints((prev) => {
      const last = prev[prev.length - 1];
      if (last && pointDistanceMeters(last, next) < (source === 'gps' ? TRACE_MIN_GAP_M : 1.2)) return prev;
      return [...prev, next];
    });
  }, []);

  const fillPlaceName = useCallback(async (point) => {
    if (!point) return;
    const label = await reverseGeocodeLabel(point.latitude, point.longitude);
    if (label) {
      setQuery((prev) => (prev.trim() ? prev : label));
      if (!queryRef.current.trim()) queryRef.current = label;
    }
  }, []);

  const applyFix = useCallback((coords, { label = true } = {}) => {
    const point = validCoord(
      coords?.lat ?? coords?.latitude,
      coords?.lng ?? coords?.long ?? coords?.longitude,
    );
    if (!point) return null;
    hasFixRef.current = true;
    startCoordsRef.current = point;
    setStartCoords(point);
    setLocating(false);
    flyTo(point, 18);
    if (label) fillPlaceName(point);
    return point;
  }, [fillPlaceName, flyTo]);

  const fetchMyLocation = useCallback(async ({ silent, force } = {}) => {
    const known = validCoord(
      startCoordsRef.current?.latitude,
      startCoordsRef.current?.longitude,
    ) || validCoord(
      getCachedCoordsForApi(900000)?.lat,
      getCachedCoordsForApi(900000)?.lng,
    );

    if (known && !force) {
      applyFix(known, { label: !queryRef.current.trim() });
      getLocationForForm({ maxWaitMs: 8000, prompt: false }).then((live) => {
        const next = validCoord(live?.lat, live?.lng);
        if (next) applyFix(next, { label: false });
      }).catch(() => {});
      return known;
    }

    if (locatingRef.current && !force) return known;
    locatingRef.current = true;
    if (!known || force) setLocating(true);
    try {
      if (known && !force) applyFix(known);

      const live = await getLocationForForm({ maxWaitMs: 12000, prompt: !known });
      const next = applyFix(live);
      if (next) return next;

      if (!known && (live?.error === 'permission_denied' || live?.error === 'permission_blocked') && !silent) {
        Toast.show('Location permission allow karein — map zoom ke liye zaroori hai', Toast.SHORT);
      } else if (!known && !silent) {
        Toast.show('Location nahi mila', Toast.SHORT);
      }
      return known;
    } finally {
      locatingRef.current = false;
      setLocating(false);
    }
  }, [applyFix]);

  const stopTracing = useCallback(() => {
    const Geo = loadGeolocation();
    if (watchId.current != null && Geo?.clearWatch) {
      Geo.clearWatch(watchId.current);
      watchId.current = null;
    }
    setTracing(false);
    setTraceHint('');
  }, []);

  const startTracing = useCallback(async () => {
    const Geo = loadGeolocation();
    if (!Geo?.watchPosition) {
      Toast.show('GPS tracing available nahi hai', Toast.SHORT);
      return;
    }
    setMode('trace');
    setTracing(true);
    setTraceHint('Khet ke kinare chaliye');
    const here = await fetchMyLocation({ silent: true });
    if (here) {
      lastGps.current = here;
      addPoint(here, 'gps');
    }
    watchId.current = Geo.watchPosition(
      (pos) => {
        const coord = {
          latitude: Number(pos?.coords?.latitude),
          longitude: Number(pos?.coords?.longitude),
        };
        if (!Number.isFinite(coord.latitude) || !Number.isFinite(coord.longitude)) return;
        const last = lastGps.current;
        if (last && pointDistanceMeters(last, coord) < TRACE_MIN_GAP_M) return;
        lastGps.current = coord;
        addPoint(coord, 'gps');
        setTraceHint('Seema ban rahi hai — kinare par chalte rahiye.');
        flyTo(coord);
      },
      () => setTraceHint('GPS signal toot gaya. Thodi der ruk kar try karein.'),
      { enableHighAccuracy: true, distanceFilter: 3, interval: 1800, fastestInterval: 900 },
    );
  }, [addPoint, fetchMyLocation, flyTo]);

  useEffect(() => () => stopTracing(), [stopTracing]);

  useEffect(() => {
    if (initialPoints.length) {
      setLocating(false);
      return undefined;
    }
    if (routeCoords) {
      applyFix(routeCoords);
    }
    let alive = true;
    fetchMyLocation({ silent: true, force: !routeCoords }).then((coords) => {
      if (!alive) return;
      if (coords) applyFix(coords, { label: !queryRef.current.trim() });
    });
    const failSafe = setTimeout(() => {
      if (alive) setLocating(false);
    }, 8000);
    return () => { alive = false; clearTimeout(failSafe); };
  }, [applyFix, fetchMyLocation, initialPoints.length, routeCoords]);

  const searchTimer = useRef(null);
  const onQueryChange = (text) => {
    setQuery(text);
    queryRef.current = text;
    if (pickingRef.current) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = text.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      if (pickingRef.current) {
        setSearching(false);
        return;
      }
      try {
        const rows = await searchPlaces(q);
        if (!pickingRef.current) setSuggestions(rows);
      } catch (e) {
        if (!pickingRef.current) setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const pickSuggestion = async (item) => {
    pickingRef.current = true;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    Keyboard.dismiss();
    setSearching(false);
    setSuggestions([]);
    setQuery(item.title);
    queryRef.current = item.title;
    try {
      const loc = await resolvePlaceLocation(item);
      if (loc) flyTo(loc, 17);
      else Toast.show('Yeh jagah map par nahi mili', Toast.SHORT);
    } finally {
      setTimeout(() => { pickingRef.current = false; }, 600);
    }
  };

  const onWebMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data || '{}');
      if (data.type === 'ready') {
        readyRef.current = true;
        inject(`window.setTiles && window.setTiles('satellite'); window.render && window.render(${JSON.stringify(points)})`);
        if (points.length) {
          flyTo(points[0], points.length >= 3 ? 17 : 18);
          if (pendingFly.current || routeCoords) {
            const me = pendingFly.current || routeCoords;
            const lat = Number(me.latitude ?? me.lat);
            const lng = Number(me.longitude ?? me.lng ?? me.long);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              inject(`window.setMe && window.setMe(${lat}, ${lng})`);
            }
          }
          return;
        }
        const start = pendingFly.current || startCoordsRef.current || routeCoords;
        if (start) flyTo(start, 18);
        if (!hasFixRef.current && !start) fetchMyLocation({ silent: true });
        return;
      }
      if (data.type === 'tap' && mode === 'tap' && !tracing) {
        addPoint(data, 'tap');
      }
    } catch (e) { /* ignore */ }
  };

  const saveLand = () => {
    if (!canSave) {
      Toast.show('Kam se kam 3 point lagao, phir khet save hoga', Toast.SHORT);
      return;
    }
    const name = landName.trim() || 'Mera khet';
    const acres = Number(Number(area.acres).toFixed(4));
    const coordinates = toApiCoordinates(points);
    const cropId = numericLandId(selectedCrop?.cropId ?? selectedCrop?.id ?? selectedCropId);
    const idx = Number.parseInt(pickIndex, 10);
    const existingId = numericLandId(editLand?.id);
    const pickedLand = {
      name,
      acres,
      coordinates,
      index: Number.isFinite(idx) ? idx : undefined,
      ...(existingId != null ? { id: existingId } : {}),
      ...(cropId != null
        ? {
          crop_id: cropId,
          cropId,
          cropName: selectedCrop?.name || selectedCrop?.cropName || '',
          cropIcon: selectedCrop?.icon || '',
        }
        : {}),
      sowingDate: toApiSowingDate(sowingDate),
      sowingArea: acres,
    };
    setSaveOpen(false);
    const state = navigation.getState();
    const prev = state?.routes?.[state.index - 1];
    if (prev?.key) {
      navigation.dispatch({
        ...CommonActions.setParams({ pickedLand }),
        source: prev.key,
      });
      navigation.goBack();
      return;
    }
    navigation.navigate({ name: 'AddFarmer', params: { pickedLand }, merge: true });
  };

  const sheetHint = tracing
    ? (traceHint || 'Khet ke kinare chaliye')
    : mode === 'trace'
      ? 'Tracing shuru karke khet ke kinare chaliye.'
      : 'Khet ke kone par tap karein. Kam se kam 3 point.';

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={GREEN} />
      <WebView
        ref={webRef}
        source={{ html: mapHtml, baseUrl: 'https://www.google.com' }}
        style={StyleSheet.absoluteFill}
        onMessage={onWebMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        mixedContentMode="always"
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
        onLoadEnd={() => {
          setTimeout(() => {
            readyRef.current = true;
            inject("window.setTiles && window.setTiles('satellite')");
            const start = pendingFly.current || startCoordsRef.current || routeCoords;
            if (start) flyTo(start, 18);
          }, 200);
        }}
      />

      <View style={styles.topOverlay} pointerEvents="box-none">
        <ScreenHeader
          bg={GREEN}
          title="Khet ka naksha"
          kicker={tracing ? 'Khet ke kinare chaliye' : 'Seema banao'}
          onBack={() => navigation.goBack()}
          right={(
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => {
                const next = mapType === 'standard' ? 'satellite' : 'standard';
                setMapType(next);
                inject(`window.setTiles && window.setTiles('${next}')`);
              }}
              activeOpacity={0.88}
            >
              <Icon name={mapType === 'standard' ? 'earth' : 'map-outline'} size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        />
        <View style={styles.headerSearch}>
          <View style={styles.searchBar}>
            <Icon name="magnify" size={18} color="#91A09A" />
            <TextInput
              value={query}
              onChangeText={onQueryChange}
              placeholder="Gaon, khet ya sheher dhundhein"
              placeholderTextColor="#91A09A"
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searching ? <ActivityIndicator size="small" color={GREEN} /> : null}
            {query ? (
              <TouchableOpacity onPress={() => {
                pickingRef.current = false;
                queryRef.current = '';
                setQuery('');
                setSuggestions([]);
                setSearching(false);
              }}>
                <Icon name="close-circle" size={18} color="#91A09A" />
              </TouchableOpacity>
            ) : null}
          </View>
          {locating && !startCoords ? <Text style={styles.locatingLine}>Aapka location aa raha hai…</Text> : null}
        </View>
        {suggestions.length ? (
          <ScrollView
            style={styles.suggestBox}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            keyboardDismissMode="none"
          >
            {suggestions.map((item, idx) => (
              <Pressable
                key={item.id || `${item.title}-${idx}`}
                style={[styles.suggestRow, idx === suggestions.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => pickSuggestion(item)}
              >
                <View style={styles.suggestIcon}>
                  <Icon name="map-marker" size={15} color={GREEN} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestTitle} numberOfLines={1}>{item.title}</Text>
                  {item.subtitle ? <Text style={styles.suggestSub} numberOfLines={1}>{item.subtitle}</Text> : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <TouchableOpacity
        style={[styles.myLocBtn, { bottom: 236 + footerPad }]}
        onPress={() => fetchMyLocation({ silent: false, force: true })}
        activeOpacity={0.9}
      >
        {locating ? <ActivityIndicator size="small" color={GREEN} /> : <Icon name="crosshairs-gps" size={20} color={GREEN} />}
      </TouchableOpacity>

      <View style={[styles.sheet, { paddingBottom: footerPad }]}>
        <View style={styles.sheetHandle} />
        {tracing ? (
          <View style={styles.traceBanner}>
            <View style={styles.traceDot} />
            <Text style={styles.traceBannerTxt}>{sheetHint}</Text>
          </View>
        ) : (
          <Text style={styles.helpLine}>{sheetHint}</Text>
        )}
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{points.length}</Text>
            <Text style={styles.statLbl}>point</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statVal}>{area.acresLabel.replace(' acre', '')}</Text>
            <Text style={styles.statLbl}>acre</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={[styles.stat, { flex: 1.2 }]}>
            <Text style={styles.statVal} numberOfLines={1}>{area.sqm ? area.sqmLabel : '—'}</Text>
            <Text style={styles.statLbl}>kshetra</Text>
          </View>
        </View>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeChip, mode === 'tap' && !tracing && styles.modeChipOn]}
            onPress={() => { if (tracing) stopTracing(); setMode('tap'); }}
          >
            <Icon name="hand-back-left" size={16} color={mode === 'tap' && !tracing ? '#FFF' : GREEN} />
            <Text style={[styles.modeChipTxt, mode === 'tap' && !tracing && styles.modeChipTxtOn]}>Point dabao</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeChip, (mode === 'trace' || tracing) && styles.modeChipWalk]}
            onPress={() => { if (!tracing) startTracing(); }}
          >
            <Icon name="walk" size={16} color={mode === 'trace' || tracing ? '#FFF' : '#F58A11'} />
            <Text style={[styles.modeChipTxt, (mode === 'trace' || tracing) && styles.modeChipTxtOn]}>Chalte hue</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.actionRow}>
          {tracing ? (
            <TouchableOpacity style={styles.stopBtn} onPress={stopTracing}>
              <Icon name="stop-circle" size={20} color="#FFF" />
              <Text style={styles.stopBtnTxt}>Ruk jao</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => setPoints((p) => p.slice(0, -1))} disabled={!points.length}>
                <Icon name="undo" size={16} color={points.length ? '#17251F' : '#91A09A'} />
                <Text style={[styles.ghostBtnTxt, !points.length && { color: '#91A09A' }]}>Pichla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => { stopTracing(); setPoints([]); }} disabled={!points.length}>
                <Icon name="trash-can-outline" size={16} color={points.length ? '#E53935' : '#91A09A'} />
                <Text style={[styles.ghostBtnTxt, { color: points.length ? '#E53935' : '#91A09A' }]}>Saaf</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, !canSave && styles.saveBtnOff]}
                onPress={() => {
                  if (!canSave) {
                    Toast.show('Kam se kam 3 point lagao, phir khet save hoga', Toast.SHORT);
                    return;
                  }
                  stopTracing();
                  setSaveOpen(true);
                }}
              >
                <Icon name="check-circle" size={18} color="#FFF" />
                <Text style={styles.saveBtnTxt}>{editLand ? 'Badlav save' : 'Khet save karo'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <Modal visible={saveOpen} transparent animationType="fade" onRequestClose={() => setSaveOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => { setCropOpen(false); setSaveOpen(false); }} />
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator={false}>
              <View style={styles.modalHead}>
                <View style={styles.modalIcon}>
                  <Icon name="vector-polygon" size={20} color={GREEN} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Khet save karein</Text>
                  <Text style={styles.modalSub}>
                    {points.length} point
                    {selectedCrop ? ` · ${shortCropName(selectedCrop.name)}` : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.modalGroup}>
                <View style={styles.modalField}>
                  <Text style={styles.modalFieldLbl}>Khet ka naam</Text>
                  <TextInput
                    value={landName}
                    onChangeText={setLandName}
                    placeholder="Jaise: Pichla khet, Aam bagh"
                    placeholderTextColor="#91A09A"
                    style={styles.modalInput}
                    onFocus={() => setCropOpen(false)}
                  />
                </View>

                <View style={styles.modalDivider} />

                <TouchableOpacity
                  style={styles.modalField}
                  onPress={() => { Keyboard.dismiss(); setCropOpen((o) => !o); }}
                  activeOpacity={0.88}
                >
                  <Text style={styles.modalFieldLbl}>Is khet ki fasal</Text>
                  <View style={styles.modalFieldRow}>
                    {selectedCrop?.icon ? (
                      <Image source={{ uri: selectedCrop.icon }} style={styles.modalCropIcon} />
                    ) : (
                      <Icon name="sprout" size={18} color={selectedCrop ? GREEN : '#91A09A'} />
                    )}
                    <Text style={[styles.modalValue, !selectedCrop && styles.modalPlaceholder]} numberOfLines={1}>
                      {selectedCrop
                        ? shortCropName(selectedCrop.name)
                        : cropsLoading
                          ? 'Fasal aa rahi hai…'
                          : 'Fasal chunein'}
                    </Text>
                    {cropsLoading ? (
                      <ActivityIndicator size="small" color={GREEN} />
                    ) : (
                      <Icon name={cropOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#91A09A" />
                    )}
                  </View>
                </TouchableOpacity>

                {cropOpen ? (
                  <View style={styles.modalCropList}>
                    {farmerCrops.length || otherCropOptions.length ? (
                      <ScrollView
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled
                        bounces={false}
                        style={styles.modalCropScroll}
                      >
                        {farmerCrops.length ? (
                          <>
                            <Text style={styles.modalCropSection}>Meri fasal</Text>
                            {farmerCrops.map((crop, idx) => (
                              <CropOption
                                key={`mine-${crop.id}`}
                                crop={crop}
                                selected={String(crop.cropId ?? crop.id) === String(selectedCropId)}
                                last={!otherCropOptions.length && idx === farmerCrops.length - 1}
                                onPress={() => {
                                  setSelectedCropId(crop.cropId ?? crop.id);
                                  setCropOpen(false);
                                }}
                              />
                            ))}
                          </>
                        ) : null}
                        {otherCropOptions.length ? (
                          <>
                            <Text style={[styles.modalCropSection, farmerCrops.length ? styles.modalCropSectionNext : null]}>
                              Anya fasalein
                            </Text>
                            {otherCropOptions.map((crop, idx) => (
                              <CropOption
                                key={`all-${crop.id}`}
                                crop={crop}
                                selected={String(crop.cropId ?? crop.id) === String(selectedCropId)}
                                last={idx === otherCropOptions.length - 1}
                                onPress={() => {
                                  setSelectedCropId(crop.cropId ?? crop.id);
                                  setCropOpen(false);
                                }}
                              />
                            ))}
                          </>
                        ) : null}
                      </ScrollView>
                    ) : (
                      <Text style={styles.modalCropEmpty}>
                        {cropsLoading
                          ? 'Fasal list aa rahi hai…'
                          : 'Abhi koi fasal list nahi mili. Thodi der baad try karein.'}
                      </Text>
                    )}
                  </View>
                ) : null}

                <View style={styles.modalDivider} />

                <TouchableOpacity
                  style={styles.modalField}
                  onPress={() => {
                    Keyboard.dismiss();
                    setCropOpen(false);
                    setDateOpen(true);
                  }}
                  activeOpacity={0.88}
                >
                  <Text style={styles.modalFieldLbl}>Boai ki date</Text>
                  <View style={styles.modalFieldRow}>
                    <View style={styles.modalDateIcon}>
                      <Icon name="calendar" size={16} color={GREEN} />
                    </View>
                    <Text style={styles.modalValue}>{formatSowingDate(sowingDate) || 'Date chunein'}</Text>
                    <Icon name="chevron-right" size={18} color="#91A09A" />
                  </View>
                </TouchableOpacity>

                <View style={styles.modalDivider} />

                <View style={[styles.modalField, styles.modalAreaField]}>
                  <Text style={styles.modalFieldLbl}>Selected area</Text>
                  <View style={styles.modalFieldRow}>
                    <View style={styles.modalDateIcon}>
                      <Icon name="vector-square" size={16} color={GREEN} />
                    </View>
                    <Text style={styles.modalAreaVal}>{area.acresLabel}</Text>
                    <Text style={styles.modalAreaSqm}>{area.sqm ? area.sqmLabel : '—'}</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.modalSave} onPress={saveLand}>
                <Text style={styles.modalSaveTxt}>Save kar do</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setCropOpen(false); setSaveOpen(false); }}>
                <Text style={styles.modalCancel}>Baad mein</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <DatePicker
        modal
        open={dateOpen}
        date={sowingDate}
        mode="date"
        maximumDate={new Date()}
        title="Boai ki date"
        confirmText="OK"
        cancelText="Cancel"
        onConfirm={(next) => {
          setDateOpen(false);
          setSowingDate(next);
        }}
        onCancel={() => setDateOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#EDE9FE' },
  topOverlay: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 4 },
  headerSearch: { backgroundColor: GREEN, paddingHorizontal: 12, paddingBottom: 12 },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center',
  },
  searchBar: {
    height: 42, borderRadius: 12, backgroundColor: '#FFF',
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: '#17251F', fontSize: 14, paddingVertical: 0 },
  locatingLine: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 8 },
  suggestBox: {
    marginHorizontal: 12, marginTop: 6, backgroundColor: '#FFF', borderRadius: 14,
    overflow: 'hidden', borderWidth: 1, borderColor: '#E2EAE4', maxHeight: 240, zIndex: 6,
  },
  suggestRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8EFEB',
  },
  suggestIcon: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: '#F5F3FF',
    alignItems: 'center', justifyContent: 'center',
  },
  suggestTitle: { color: '#17251F', fontSize: 13, fontWeight: '600' },
  suggestSub: { color: '#607069', fontSize: 11, marginTop: 1 },
  myLocBtn: {
    position: 'absolute', right: 14, width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 14, paddingTop: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: -3 } },
      android: { elevation: 12 },
    }),
  },
  sheetHandle: {
    alignSelf: 'center', width: 44, height: 4, borderRadius: 99, backgroundColor: '#D4E2DA', marginBottom: 8,
  },
  helpLine: { color: '#607069', fontSize: 12, marginBottom: 8 },
  traceBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF6E8',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8,
  },
  traceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F58A11' },
  traceBannerTxt: { flex: 1, color: '#8A5C24', fontSize: 12, fontWeight: '600' },
  statRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { color: '#17251F', fontSize: 16, fontWeight: '800' },
  statLbl: { color: '#91A09A', fontSize: 11, marginTop: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: '#E2EAE4' },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  modeChip: {
    flex: 1, height: 38, borderRadius: 11, borderWidth: 1, borderColor: '#DDD6FE',
    backgroundColor: '#F5F3FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  modeChipOn: { backgroundColor: GREEN, borderColor: GREEN },
  modeChipWalk: { backgroundColor: '#F58A11', borderColor: '#F58A11' },
  modeChipTxt: { color: GREEN, fontSize: 13, fontWeight: '600' },
  modeChipTxtOn: { color: '#FFF' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ghostBtn: {
    height: 42, paddingHorizontal: 10, borderRadius: 11, borderWidth: 1, borderColor: '#E2EAE4',
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  ghostBtnTxt: { color: '#17251F', fontSize: 12, fontWeight: '600' },
  saveBtn: {
    flex: 1, height: 42, borderRadius: 11, backgroundColor: GREEN,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  saveBtnOff: { opacity: 0.45 },
  saveBtnTxt: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  stopBtn: {
    flex: 1, height: 42, borderRadius: 11, backgroundColor: '#E53935',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  stopBtnTxt: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: {
    backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 22,
  },
  modalHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 99, backgroundColor: '#D8D6E8', marginBottom: 12,
  },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  modalIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#F5F3FF',
    alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#17251F' },
  modalSub: { color: '#607069', fontSize: 12, marginTop: 2 },
  modalGroup: {
    borderWidth: 1, borderColor: '#E4E0F5', borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#FFF', marginBottom: 16,
  },
  modalField: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FFF' },
  modalFieldLbl: {
    color: '#8B849C', fontSize: 11, fontWeight: '700', letterSpacing: 0.2, marginBottom: 6,
  },
  modalInput: {
    padding: 0, margin: 0, color: '#17251F', fontSize: 15, fontWeight: '600', minHeight: 22,
  },
  modalFieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalValue: { flex: 1, color: '#17251F', fontSize: 15, fontWeight: '600' },
  modalPlaceholder: { color: '#91A09A', fontWeight: '500' },
  modalDateIcon: {
    width: 26, height: 26, borderRadius: 8, backgroundColor: '#F5F3FF',
    alignItems: 'center', justifyContent: 'center',
  },
  modalDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E8E4F4', marginLeft: 14 },
  modalAreaField: { backgroundColor: '#F7F5FF' },
  modalAreaVal: { flex: 1, color: '#17251F', fontSize: 16, fontWeight: '800' },
  modalAreaSqm: { color: GREEN, fontSize: 12, fontWeight: '700' },
  modalCropIcon: { width: 22, height: 22, borderRadius: 11 },
  modalCropList: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8E4F4', backgroundColor: '#FAFAFC',
  },
  modalCropScroll: { maxHeight: 200 },
  modalCropSection: {
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6,
    color: '#8B849C', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  modalCropSectionNext: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8E4F4',
  },
  modalCropRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EDEAF6',
  },
  modalCropRowOn: { backgroundColor: '#F5F3FF' },
  modalCropName: { flex: 1, color: '#17251F', fontSize: 14 },
  modalCropNameOn: { color: GREEN, fontWeight: '700' },
  modalCropEmpty: { color: '#91A09A', fontSize: 12, paddingVertical: 12, paddingHorizontal: 14, textAlign: 'center' },
  modalSave: {
    height: 48, borderRadius: 14, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center',
  },
  modalSaveTxt: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  modalCancel: { textAlign: 'center', color: '#607069', fontSize: 13, marginTop: 12, fontWeight: '600' },
});
