import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-simple-toast';
import ScreenHeader from '../components/ScreenHeader';
import BottomSheet from '../components/BottomSheet';
import constants from '../utils/constants';
import { overlayBottomPadding } from '../utils/safeAreaInsets';
import {
  getCachedCoordsForApi,
  getCachedPrefetchedPincode,
  getLocationForForm,
  lookupPincodeFromCoords,
  prefetchSoilOrderPincode,
} from '../utils/locationHelper';
import {
  buildFarmerPayload,
  createAddedFarmer,
  parsePostOfficeResponse,
  updateAddedFarmer,
} from '../utils/addedFarmers';
import {
  attachCropNamesToLands,
  cropApiId,
  formatAcres,
  formatSowingDate,
  hydrateCrops,
  landForMap,
  landsFromFarmer,
  numericLandId,
  reverseGeocodeAddress,
  unwrapCropList,
} from '../utils/farmerLand';

const GREEN = '#5D3FD3';
const GREEN_DARK = '#4C32B8';
const PAY_GREEN = '#5D3FD3';
const ORANGE = '#F58A11';
const BROWN = '#835B4B';
const PEACH = '#FFF0E8';
const PEACH_BORDER = '#FFD6C7';
const BRAND_ORANGE = '#F26F3F';
const TXT = '#17251F';
const SUB = '#607069';
const MUTED = '#91A09A';
const BORDER = '#CED9D3';
const DIVIDER = '#E2EAE4';
const SOFT_GREEN = '#F5F3FF';
const SHEET_MAX = Math.round(Dimensions.get('window').height * 0.7);

const FALLBACK_CROPS = [
  { id: 'wheat', name: 'Wheat ( गेहूं )' },
  { id: 'paddy', name: 'Paddy ( धान )' },
  { id: 'maize', name: 'Maize ( मक्का )' },
  { id: 'mustard', name: 'Mustard ( सरसों )' },
  { id: 'chilli', name: 'Chilli ( मिर्च )' },
  { id: 'tomato', name: 'Tomato ( टमाटर )' },
  { id: 'sugarcane', name: 'Sugarcane ( गन्ना )' },
  { id: 'potato', name: 'Potato ( आलू )' },
  { id: 'onion', name: 'Onion ( प्याज )' },
  { id: 'cotton', name: 'Cotton ( कपास )' },
];

const ANIMALS = [
  { key: 'cow', label: 'Cow', icon: 'cow' },
  { key: 'buffalo', label: 'Buffalo', icon: 'cow' },
  { key: 'goat', label: 'Goat', icon: 'sheep' },
];

const cropName = (crop) => crop?.name || crop?.cropName || crop?.title || crop?.label || 'Crop';
const cropKey = (crop) => String(cropApiId(crop) ?? crop?.id ?? crop?.cropId ?? crop?.value ?? cropName(crop));

function cropEmoji(crop) {
  const name = cropName(crop).toLowerCase();
  if (name.includes('wheat') || name.includes('gehu') || name.includes('paddy') || name.includes('maize')) return '🌾';
  if (name.includes('mustard')) return '🌼';
  if (name.includes('tomato')) return '🍅';
  if (name.includes('chilli')) return '🌶';
  if (name.includes('potato')) return '🥔';
  if (name.includes('onion')) return '🧅';
  if (name.includes('cotton')) return '🤍';
  if (name.includes('sugar')) return '🎋';
  return '🌱';
}

function SectionHead({ icon, title, color = GREEN }) {
  return (
    <View style={styles.sectionHeadWrap}>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionIcon, { backgroundColor: color }]}>
          <MaterialCommunityIcons name={icon} size={16} color="#FFFFFF" />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionDivider} />
    </View>
  );
}

function Field({ icon, value, onChangeText, placeholder, keyboardType, rightLabel }) {
  return (
    <View style={[styles.fieldWrap, styles.fieldWrapSingle]}>
      <View style={styles.fieldInputRow}>
        <MaterialCommunityIcons name={icon} size={16} color={SUB} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={MUTED}
          keyboardType={keyboardType}
          style={styles.fieldInput}
        />
        {rightLabel ? <Text style={styles.unitPill}>{rightLabel}</Text> : null}
      </View>
    </View>
  );
}

function Choice({ label, selected, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <MaterialCommunityIcons
        name={selected ? 'check-circle' : 'circle-outline'}
        size={18}
        color={selected ? '#FFFFFF' : SUB}
      />
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function AnimalCount({ animal, value, onChange }) {
  const has = value > 0;
  return (
    <View style={[styles.animalRow, has && styles.animalRowOn]}>
      <View style={[styles.animalIconChip, has && styles.animalIconChipOn]}>
        <MaterialCommunityIcons name={animal.icon} size={17} color={has ? GREEN : '#9AA8A1'} />
      </View>
      <Text style={styles.animalLabel}>{animal.label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          activeOpacity={0.82}
          disabled={value <= 0}
          style={[styles.stepBtn, value <= 0 && styles.stepBtnOff]}
          onPress={() => onChange(Math.max(0, value - 1))}
        >
          <MaterialCommunityIcons name="minus" size={15} color={value <= 0 ? '#AFC0B8' : '#FFFFFF'} />
        </TouchableOpacity>
        <Text style={styles.stepValue}>{value}</Text>
        <TouchableOpacity activeOpacity={0.82} style={[styles.stepBtn, styles.stepAdd]} onPress={() => onChange(value + 1)}>
          <MaterialCommunityIcons name="plus" size={15} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CropChip({ crop, onRemove }) {
  return (
    <View style={styles.cropChip}>
      <Text style={styles.cropEmoji}>{cropEmoji(crop)}</Text>
      <Text style={styles.cropChipText} numberOfLines={1}>{cropName(crop)}</Text>
      <TouchableOpacity activeOpacity={0.8} style={styles.chipClose} onPress={onRemove}>
        <MaterialCommunityIcons name="close" size={12} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

function LandPlots({ lands, onAdd, onOpen, onRemove }) {
  return (
    <View style={styles.landBlock}>
      <Text style={styles.cropSelectLabel}>Khet ki seema (map)</Text>
      {lands.length ? (
        <View style={styles.landList}>
          {lands.map((land, index) => (
            <View key={land.id || `${land.name}-${index}`} style={styles.landRow}>
              <TouchableOpacity style={styles.landRowMain} onPress={() => onOpen(land, index)} activeOpacity={0.86}>
                <View style={styles.landRowIcon}>
                  <MaterialCommunityIcons name="map-outline" size={16} color={GREEN} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.landRowName} numberOfLines={1}>{land.name}</Text>
                  <Text style={styles.landRowMeta} numberOfLines={1}>
                    {formatAcres(land.acres || land.sowingArea)}
                    {land.cropName ? ` · ${land.cropName}` : ''}
                    {land.sowingDate ? ` · ${formatSowingDate(land.sowingDate)}` : ''}
                    {land.coordinates?.length ? ` · ${land.coordinates.length} point` : ''}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={16} color={MUTED} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.landRemove}
                onPress={() => onRemove(index)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={16} color="#E53935" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.landHint}>Map par khet ki seema banao — kam se kam 3 point.</Text>
      )}
      <TouchableOpacity style={styles.landAdd} onPress={onAdd} activeOpacity={0.88}>
        <MaterialCommunityIcons name="plus-circle-outline" size={18} color={GREEN} />
        <Text style={styles.landAddTxt}>{lands.length ? 'Aur khet jodein' : 'Khet ka naksha banao'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function CropSelect({ icon, label, placeholder, selected, onOpen, onRemove }) {
  return (
    <View style={styles.cropSelectBlock}>
      <Text style={styles.cropSelectLabel}>{label}</Text>
      <TouchableOpacity activeOpacity={0.86} style={styles.cropSelect} onPress={onOpen}>
        <MaterialCommunityIcons name={icon} size={18} color={SUB} />
        <Text style={[styles.cropSelectText, !selected.length && styles.placeholderText]} numberOfLines={1}>
          {selected.length ? selected.map(cropName).join(', ') : placeholder}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={18} color={SUB} />
      </TouchableOpacity>
      {selected.length ? (
        <View style={styles.chipWrap}>
          {selected.map((crop) => (
            <CropChip key={cropKey(crop)} crop={crop} onRemove={() => onRemove(crop)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function seedAddress(editFarmer) {
  const cachedPin = getCachedPrefetchedPincode();
  const cachedCoords = getCachedCoordsForApi(900000);
  const existingPin = String(editFarmer?.pincode || editFarmer?.location?.pin || '').replace(/\D/g, '').slice(0, 6);
  const lat = editFarmer?.lat || editFarmer?.location?.lat || cachedPin?.lat || cachedCoords?.lat || '';
  const lng = editFarmer?.long || editFarmer?.location?.long || cachedPin?.lng || cachedCoords?.lng || '';
  return {
    pincode: existingPin || cachedPin?.pincode || '',
    address: editFarmer?.address || editFarmer?.location?.fullAddress || '',
    state: editFarmer?.state || editFarmer?.location?.state || '',
    district: editFarmer?.district || editFarmer?.location?.district || '',
    postOffice: editFarmer?.postOffice || editFarmer?.location?.block || '',
    lat: lat ? String(lat) : '',
    long: lng ? String(lng) : '',
  };
}

function BoxedField({ icon, label, filled, children, onPress, style }) {
  const Inner = (
    <View style={[styles.boxedField, style]}>
      <View style={styles.boxedHeader}>
        <View style={[styles.boxedIcon, filled && styles.boxedIconFilled]}>
          <MaterialCommunityIcons name={icon} size={14} color="#FFFFFF" />
        </View>
        <Text style={styles.boxedLabel}>{label}</Text>
        {children?.headerRight}
      </View>
      {children?.body}
    </View>
  );
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
        {Inner}
      </TouchableOpacity>
    );
  }
  return Inner;
}

export default function AddFarmer({ navigation, route }) {
  const editFarmer = route?.params?.farmer || null;
  const isEdit = Boolean(editFarmer?.id || route?.params?.mode === 'edit');
  const footerPad = overlayBottomPadding(12);

  const [form, setForm] = useState({
    name: editFarmer?.name || '',
    mobile: String(editFarmer?.mobile || '').replace(/\D/g, '').slice(0, 10),
    totalArea: editFarmer?.totalArea != null ? String(editFarmer.totalArea) : '',
    hasCattle: editFarmer?.hasCattle || '',
  });
  const [address, setAddress] = useState(() => seedAddress(editFarmer));
  const cattle = editFarmer?.cattleCount || {};
  const [animals, setAnimals] = useState({
    cow: Math.max(0, Number(cattle.cow) || (editFarmer ? 0 : 1)),
    buffalo: Math.max(0, Number(cattle.buffalo) || (editFarmer ? 0 : 1)),
    goat: Math.max(0, Number(cattle.goat) || (editFarmer ? 0 : 1)),
  });
  const [currentCrops, setCurrentCrops] = useState(editFarmer?.crops || []);
  const [annualCrops, setAnnualCrops] = useState(editFarmer?.annualCrops || []);
  const [lands, setLands] = useState(() => landsFromFarmer(editFarmer));
  const [crops, setCrops] = useState(FALLBACK_CROPS);
  const [cropSheet, setCropSheet] = useState(null);
  const [cropSearch, setCropSearch] = useState('');
  const [showPO, setShowPO] = useState(false);
  const [postOffices, setPostOffices] = useState([]);
  const [pinLoading, setPinLoading] = useState(false);
  const [locating, setLocating] = useState(() => !isEdit || String(address.pincode || '').length !== 6);
  const [submitting, setSubmitting] = useState(false);
  const lastFetchedPin = useRef('');
  const addressRef = useRef(address);
  addressRef.current = address;

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const patchAddress = (patch) => setAddress((prev) => ({ ...prev, ...patch }));

  const authHeaders = () => ({
    Authorization: 'Bearer ' + global.token,
    Accept: 'application/json',
    'X-localization': 'en',
    'Content-Type': 'application/json',
  });

  const queryPostOffice = useCallback(async (pincode, lat, lng) => {
    const pin = String(pincode || '').trim();
    const res = await fetch(constants.getPostOffice, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        pincode: pin,
        lat: String(lat ?? addressRef.current.lat ?? ''),
        long: String(lng ?? addressRef.current.long ?? ''),
      }),
    });
    const json = await res.json();
    return parsePostOfficeResponse(json);
  }, []);

  const fetchPostOffice = useCallback(async (pin, lat, lng) => {
    const pincode = String(pin || '').replace(/\D/g, '').slice(0, 6);
    if (pincode.length !== 6) return;
    if (lastFetchedPin.current === pincode && postOffices.length) return;
    setPinLoading(true);
    try {
      const parsed = await queryPostOffice(pincode, lat, lng);
      lastFetchedPin.current = pincode;
      setPostOffices(parsed.offices || []);
      setAddress((prev) => ({
        ...prev,
        state: parsed.state || prev.state,
        district: parsed.district || prev.district,
        postOffice: prev.postOffice || parsed.offices?.[0]?.name || '',
      }));
    } catch (e) {
      lastFetchedPin.current = '';
      Toast.show('Post office load nahi ho paya', Toast.SHORT);
    } finally {
      setPinLoading(false);
    }
  }, [postOffices.length, queryPostOffice]);

  useEffect(() => {
    const pin = String(address.pincode || '').replace(/\D/g, '');
    if (pin.length === 6) {
      fetchPostOffice(pin, address.lat, address.long);
    } else {
      lastFetchedPin.current = '';
      setPostOffices([]);
    }
  }, [address.pincode, address.lat, address.long, fetchPostOffice]);

  const onPinChange = (text) => {
    const pincode = text.replace(/\D/g, '').slice(0, 6);
    lastFetchedPin.current = '';
    setAddress((prev) => ({
      ...prev,
      pincode,
      postOffice: '',
      state: pincode.length === 6 ? prev.state : '',
      district: pincode.length === 6 ? prev.district : '',
    }));
    setPostOffices([]);
  };

  const locatingRef = useRef(false);
  const locateAndPrefill = useCallback(async ({ silent = false } = {}) => {
    if (locatingRef.current) return;
    locatingRef.current = true;
    setLocating(true);
    const applyPin = (pincode, lat, lng) => {
      if (!pincode || String(pincode).length !== 6) return false;
      lastFetchedPin.current = '';
      setAddress((prev) => ({
        ...prev,
        pincode,
        lat: lat || prev.lat,
        long: lng || prev.long,
        postOffice: prev.postOffice && String(prev.pincode) === String(pincode) ? prev.postOffice : '',
      }));
      setLocating(false);
      return true;
    };
    try {
      const cached = getCachedPrefetchedPincode();
      if (cached?.pincode?.length === 6) {
        applyPin(cached.pincode, cached.lat, cached.lng);
      }

      const coords = await getLocationForForm({ maxWaitMs: 12000, prompt: true });
      if (coords.error === 'permission_denied' || coords.error === 'permission_blocked') {
        Toast.show('Location permission allow karein — PIN auto-fill ke liye zaroori hai', Toast.SHORT);
      }
      const lat = coords?.lat || cached?.lat || addressRef.current.lat;
      const lng = coords?.lng || cached?.lng || addressRef.current.long;
      if (!lat || !lng) {
        if (!silent && !String(addressRef.current.pincode || '').length) {
          Toast.show('PIN manually daalein', Toast.SHORT);
        }
        return;
      }

      setAddress((prev) => ({ ...prev, lat, long: lng }));

      const geo = await Promise.race([
        reverseGeocodeAddress(lat, lng),
        new Promise((resolve) => { setTimeout(() => resolve({ label: '', pincode: '' }), 6000); }),
      ]);
      const fromGoogle = String(geo?.pincode || '').replace(/\D/g, '').slice(0, 6);
      const fromLookup = fromGoogle.length === 6
        ? fromGoogle
        : await Promise.race([
          lookupPincodeFromCoords(lat, lng),
          new Promise((resolve) => { setTimeout(() => resolve(''), 7000); }),
        ]);
      if (fromLookup) {
        applyPin(fromLookup, lat, lng);
        return;
      }
      if (!silent && !String(addressRef.current.pincode || '').length) {
        Toast.show('PIN code nahi mila. Manually daalein.', Toast.SHORT);
      }
    } catch (e) {
      if (!silent) Toast.show('Location load nahi ho payi', Toast.SHORT);
    } finally {
      locatingRef.current = false;
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    prefetchSoilOrderPincode();
    if (isEdit && String(editFarmer?.pincode || editFarmer?.location?.pin || '').length === 6) {
      setLocating(false);
      return undefined;
    }
    locateAndPrefill({ silent: false });
    return undefined;
    // Auto-fill PIN from current location when opening a new farmer form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
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
        const rows = unwrapCropList(json);
        if (!rows.length) return;
        setCrops(rows);
        setCurrentCrops((prev) => hydrateCrops(prev, rows));
        setAnnualCrops((prev) => hydrateCrops(prev, rows));
        setLands((prev) => attachCropNamesToLands(prev, rows));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const selectedForSheet = cropSheet === 'annual' ? annualCrops : currentCrops;
  const setSelectedForSheet = (next) => {
    if (cropSheet === 'annual') setAnnualCrops(next);
    else setCurrentCrops(next);
  };

  const toggleCrop = (crop) => {
    const key = cropKey(crop);
    const selected = selectedForSheet;
    const exists = selected.some((item) => cropKey(item) === key);
    setSelectedForSheet(exists ? selected.filter((item) => cropKey(item) !== key) : [...selected, crop]);
  };

  const removeCrop = (type, crop) => {
    const key = cropKey(crop);
    if (type === 'annual') setAnnualCrops((prev) => prev.filter((item) => cropKey(item) !== key));
    else setCurrentCrops((prev) => prev.filter((item) => cropKey(item) !== key));
  };

  const openLandMap = (land, index) => {
    const mapped = land ? landForMap(land) : null;
    const cached = getCachedCoordsForApi(900000);
    const lat = address.lat || cached?.lat || '';
    const lng = address.long || cached?.lng || cached?.long || '';
    const params = {
      returnTo: 'AddFarmer',
      landIndex: Number.isInteger(index) ? index : undefined,
      crops: currentCrops,
      catalogCrops: crops,
      land: mapped || undefined,
      lat,
      lng,
      latitude: lat,
      longitude: lng,
      pincode: address.pincode,
    };
    if (typeof navigation.push === 'function') navigation.push('AddLand', params);
    else navigation.navigate('AddLand', params);
  };

  const removeLand = (index) => setLands((prev) => prev.filter((_, i) => i !== index));

  useEffect(() => {
    const picked = route?.params?.pickedLand;
    if (!picked?.coordinates?.length) return;
    setLands((prev) => {
      const next = [...prev];
      const idx = Number(picked.index);
      const existingId =
        numericLandId(picked.id) ??
        (Number.isInteger(idx) ? numericLandId(next[idx]?.id) : null);
      const plot = {
        id: existingId != null ? String(existingId) : `draft-${Date.now()}`,
        name: String(picked.name || '').trim() || `Khet ${next.length + 1}`,
        acres: Number(picked.acres) || 0,
        coordinates: picked.coordinates,
        crop_id: picked.crop_id ?? picked.cropId,
        cropId: picked.cropId ?? picked.crop_id,
        cropName: picked.cropName || '',
        cropIcon: picked.cropIcon || '',
        sowingDate: picked.sowingDate || '',
        sowingArea: Number(picked.sowingArea ?? picked.acres) || 0,
      };
      if (Number.isInteger(idx) && idx >= 0 && idx < next.length) next[idx] = plot;
      else next.push(plot);
      return next;
    });
    navigation.setParams({ pickedLand: undefined });
  }, [navigation, route?.params?.pickedLand]);

  const filteredCrops = useMemo(() => {
    const q = cropSearch.trim().toLowerCase();
    if (!q) return crops;
    return crops.filter((crop) => cropName(crop).toLowerCase().includes(q));
  }, [crops, cropSearch]);

  const pinIs6 = String(address.pincode || '').length === 6;

  const submit = async () => {
    const name = form.name.trim();
    const mobile = form.mobile.trim();
    if (!name || mobile.length !== 10) {
      Toast.show('Full name aur 10 digit mobile zaroori hai', Toast.SHORT);
      return;
    }
    setSubmitting(true);
    try {
      const withCropNames = (selected, rows) => rows.map((row) => {
        const hit = selected.find((crop) => cropApiId(crop) === row.cropId);
        const label = hit ? cropName(hit) : '';
        return label ? { ...row, name: label, cropName: label } : row;
      });
      const payload = buildFarmerPayload({
        name,
        mobile,
        address,
        totalArea: form.totalArea,
        hasCattle: form.hasCattle,
        animals,
        currentCrops,
        annualCrops,
        lands,
      });
      payload.crops = withCropNames(currentCrops, payload.crops);
      payload.annualCrops = withCropNames(annualCrops, payload.annualCrops);
      if (isEdit && editFarmer?.id) {
        await updateAddedFarmer(editFarmer.id, payload);
        Toast.show('Farmer update ho gaya', Toast.SHORT);
      } else {
        await createAddedFarmer(payload);
        Toast.show('Farmer add ho gaya', Toast.SHORT);
      }
      setTimeout(() => navigation.goBack(), 400);
    } catch (e) {
      Toast.show(e?.message || 'Farmer save nahi ho saka', Toast.SHORT);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#5D3FD3" />
      <ScreenHeader
        bg="#5D3FD3"
        title={isEdit ? 'Kisan update karein' : 'Naya Kisan jodein'}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: 88 + footerPad }]}
        >
          <View style={styles.sectionCard}>
            <SectionHead icon="account" title="Basic" />
            <Field
              icon="account-outline"
              value={form.name}
              onChangeText={(text) => setField('name', text)}
              placeholder="Full name *"
            />
            <Field
              icon="phone-outline"
              value={form.mobile}
              onChangeText={(text) => setField('mobile', text.replace(/\D/g, '').slice(0, 10))}
              placeholder="Mobile *"
              keyboardType="phone-pad"
            />

            <BoxedField icon="email" label="PIN code" filled={pinIs6} style={{ marginTop: 0 }}>
              {{
                headerRight: (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={locating}
                    style={[styles.locButton, locating && { opacity: 0.85 }]}
                    onPress={() => locateAndPrefill({ silent: false })}
                  >
                    {locating ? (
                      <ActivityIndicator size="small" color={GREEN} />
                    ) : (
                      <MaterialCommunityIcons name="navigation" size={11} color={GREEN} />
                    )}
                    <Text style={styles.locButtonText}>{locating ? 'Dhoond rahe' : 'Location'}</Text>
                  </TouchableOpacity>
                ),
                body: (
                  <TextInput
                    value={address.pincode}
                    onChangeText={onPinChange}
                    placeholder="PIN code dalein"
                    placeholderTextColor={MUTED}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={styles.boxedInput}
                  />
                ),
              }}
            </BoxedField>
            <Text style={styles.helper}>Enter a 6-digit PIN code to prefill address details.</Text>

            {pinIs6 ? (
              <>
                <BoxedField icon="home" label="Pura address (gaon / landmark)" filled={Boolean(address.address?.trim())} style={{ marginTop: 6 }}>
                  {{
                    body: (
                      <TextInput
                        value={address.address}
                        onChangeText={(t) => patchAddress({ address: t })}
                        placeholder="Village / landmark likhein"
                        placeholderTextColor={MUTED}
                        style={[styles.boxedInput, styles.addressInput]}
                        multiline
                      />
                    ),
                  }}
                </BoxedField>

                <View style={styles.twoCol}>
                  <View style={styles.colField}>
                    <View style={styles.boxedHeader}>
                      <View style={[styles.boxedIcon, Boolean(address.state) && styles.boxedIconFilled]}>
                        <MaterialCommunityIcons name="map" size={14} color="#FFFFFF" />
                      </View>
                      <Text style={styles.boxedLabel}>Rajya</Text>
                    </View>
                    <TextInput
                      value={address.state}
                      onChangeText={(t) => patchAddress({ state: t })}
                      placeholder="Rajya"
                      placeholderTextColor={MUTED}
                      style={styles.colInput}
                    />
                  </View>
                  <View style={styles.colField}>
                    <View style={styles.boxedHeader}>
                      <View style={[styles.boxedIcon, Boolean(address.district) && styles.boxedIconFilled]}>
                        <MaterialCommunityIcons name="office-building" size={14} color="#FFFFFF" />
                      </View>
                      <Text style={styles.boxedLabel}>Zila</Text>
                    </View>
                    <TextInput
                      value={address.district}
                      onChangeText={(t) => patchAddress({ district: t })}
                      placeholder="Zila"
                      placeholderTextColor={MUTED}
                      style={styles.colInput}
                    />
                  </View>
                </View>

                <BoxedField
                  icon="mailbox"
                  label="Post office"
                  filled={Boolean(address.postOffice)}
                  style={{ marginTop: 6 }}
                  onPress={() => {
                    if (!postOffices.length) fetchPostOffice(address.pincode, address.lat, address.long);
                    setShowPO(true);
                  }}
                >
                  {{
                    body: (
                      <View style={styles.selectRow}>
                        <Text style={[styles.boxedInput, { color: address.postOffice ? TXT : MUTED, flex: 1 }]} numberOfLines={1}>
                          {pinLoading ? 'Post office load ho rahe...' : (address.postOffice || 'Post office chunein')}
                        </Text>
                        {pinLoading ? (
                          <ActivityIndicator size="small" color={GREEN} />
                        ) : (
                          <MaterialCommunityIcons name="chevron-down" size={18} color={MUTED} />
                        )}
                      </View>
                    ),
                  }}
                </BoxedField>
              </>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <SectionHead icon="cow" title="Cattle Info" color={BROWN} />
            <Text style={styles.question}>Do you have cattle?</Text>
            <View style={styles.choiceRow}>
              <Choice label="Yes" selected={form.hasCattle === 'yes'} onPress={() => setField('hasCattle', 'yes')} />
              <Choice label="No" selected={form.hasCattle === 'no'} onPress={() => setField('hasCattle', 'no')} />
            </View>
            {form.hasCattle === 'yes' ? (
              <View style={styles.animalsWrap}>
                {ANIMALS.map((animal) => (
                  <AnimalCount
                    key={animal.key}
                    animal={animal}
                    value={animals[animal.key]}
                    onChange={(count) => setAnimals((prev) => ({ ...prev, [animal.key]: count }))}
                  />
                ))}
              </View>
            ) : null}
          </View>

          <View style={[styles.sectionCard, styles.sectionCardLast]}>
            <SectionHead icon="image-filter-hdr" title="Crops & Land" color={GREEN} />
            <Text style={styles.cropSelectLabel}>Total Area (acres)</Text>
            <Field
              icon="arrow-expand-all"
              value={form.totalArea}
              onChangeText={(text) => setField('totalArea', text.replace(/[^0-9.]/g, ''))}
              placeholder="Enter total area"
              keyboardType="decimal-pad"
              rightLabel="acres"
            />
            <CropSelect
              icon="sprout"
              label="Current Sown Crops"
              placeholder="Fasal chunein"
              selected={currentCrops}
              onOpen={() => { setCropSearch(''); setCropSheet('current'); }}
              onRemove={(crop) => removeCrop('current', crop)}
            />
            <CropSelect
              icon="calendar-month-outline"
              label="Annual Sown Crops"
              placeholder="Saal ki fasalein chunein"
              selected={annualCrops}
              onOpen={() => { setCropSearch(''); setCropSheet('annual'); }}
              onRemove={(crop) => removeCrop('annual', crop)}
            />
            <LandPlots
              lands={lands}
              onAdd={() => openLandMap()}
              onOpen={openLandMap}
              onRemove={removeLand}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomBar, { paddingBottom: footerPad }]}>
        <TouchableOpacity
          activeOpacity={0.9}
          disabled={submitting}
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={submit}
        >
          {!submitting && <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />}
          <Text style={styles.submitText}>
            {submitting ? (isEdit ? 'Updating...' : 'Adding...') : (isEdit ? 'Kisan update karein' : 'Kisan jodein')}
          </Text>
        </TouchableOpacity>
      </View>

      {showPO ? (
        <BottomSheet
          visible
          dynamicSize
          maxDynamicContentSize={SHEET_MAX}
          enablePanDownToClose
          onSheetClose={() => setShowPO(false)}
        >
          <View style={styles.poSheetPad}>
            <View style={styles.sheetHead}>
              <View style={styles.sheetHeadIcon}>
                <MaterialCommunityIcons name="email-open" size={20} color={BRAND_ORANGE} />
              </View>
              <View style={styles.sheetHeadCopy}>
                <Text style={styles.sheetTitle}>Post office chunein</Text>
                <Text style={styles.sheetSub} numberOfLines={2}>
                  PIN code {address.pincode} ke liye available post office
                </Text>
              </View>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setShowPO(false)}>
                <MaterialCommunityIcons name="close" size={19} color={BRAND_ORANGE} />
              </TouchableOpacity>
            </View>

            {pinLoading ? (
              <ActivityIndicator color={GREEN} style={{ marginVertical: 28 }} />
            ) : postOffices.length ? (
              postOffices.map((po) => {
                const selected = address.postOffice === po.name;
                const locLine = [po.district || address.district, po.state || address.state, po.pincode || address.pincode]
                  .filter(Boolean)
                  .join(', ');
                return (
                  <TouchableOpacity
                    key={po.id}
                    activeOpacity={0.85}
                    style={[styles.poRow, selected && styles.poRowSelected]}
                    onPress={() => {
                      patchAddress({ postOffice: po.name, state: po.state || address.state, district: po.district || address.district });
                      setShowPO(false);
                    }}
                  >
                    <View style={[styles.poIcon, selected && styles.poIconSelected]}>
                      <MaterialCommunityIcons name={selected ? 'check' : 'office-building-outline'} size={17} color={selected ? '#FFFFFF' : BRAND_ORANGE} />
                    </View>
                    <View style={styles.poCopy}>
                      <Text style={styles.poName} numberOfLines={1}>{po.name}</Text>
                      <Text style={styles.poSub} numberOfLines={1}>{locLine}</Text>
                    </View>
                    <View style={[styles.poAction, selected && styles.poActionSelected]}>
                      <MaterialCommunityIcons name={selected ? 'check' : 'chevron-right'} size={17} color={selected ? '#FFFFFF' : SUB} />
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={styles.poEmpty}>Is PIN code par post office nahi mila.</Text>
            )}
          </View>
        </BottomSheet>
      ) : null}

      {cropSheet ? (
        <BottomSheet
          visible
          dynamicSize
          maxDynamicContentSize={SHEET_MAX}
          enablePanDownToClose
          onSheetClose={() => setCropSheet(null)}
        >
          <View style={styles.poSheetPad}>
            <View style={styles.cropSheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>
                  {cropSheet === 'annual' ? 'Saal ki fasalein chunein' : 'Abhi boi hui fasal chunein'}
                </Text>
                <Text style={styles.sheetSub}>
                  {selectedForSheet.length ? `${selectedForSheet.length} fasal chuni gayi` : 'Ek ya zyada fasal chunein'}
                </Text>
              </View>
              <TouchableOpacity style={styles.cropSheetClose} onPress={() => setCropSheet(null)}>
                <MaterialCommunityIcons name="close" size={18} color={SUB} />
              </TouchableOpacity>
            </View>

            <View style={styles.sheetSearch}>
              <MaterialCommunityIcons name="magnify" size={16} color={GREEN} />
              <TextInput
                value={cropSearch}
                onChangeText={setCropSearch}
                placeholder="Fasal khojein..."
                placeholderTextColor={MUTED}
                style={styles.sheetSearchInput}
                returnKeyType="search"
              />
              {cropSearch ? (
                <TouchableOpacity onPress={() => setCropSearch('')}>
                  <MaterialCommunityIcons name="close-circle" size={16} color="#9AA8A1" />
                </TouchableOpacity>
              ) : null}
            </View>

            {filteredCrops.map((crop) => {
              const checked = selectedForSheet.some((item) => cropKey(item) === cropKey(crop));
              return (
                <TouchableOpacity
                  key={cropKey(crop)}
                  activeOpacity={0.85}
                  style={[styles.cropRow, checked && styles.cropRowOn]}
                  onPress={() => toggleCrop(crop)}
                >
                  <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
                    {checked ? <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" /> : null}
                  </View>
                  <View style={[styles.cropThumb, checked && styles.cropThumbOn]}>
                    <Text style={styles.cropRowEmoji}>{cropEmoji(crop)}</Text>
                  </View>
                  <Text style={[styles.cropRowText, checked && styles.cropRowTextOn]} numberOfLines={1}>
                    {cropName(crop)}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity activeOpacity={0.9} style={styles.doneBtn} onPress={() => setCropSheet(null)}>
              <Text style={styles.doneText}>
                {selectedForSheet.length ? `Done (${selectedForSheet.length})` : 'Done'}
              </Text>
            </TouchableOpacity>
          </View>
        </BottomSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#E8ECF4' },
  flex: { flex: 1 },
  content: { paddingHorizontal: 10, paddingTop: 8, gap: 8 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: DIVIDER,
  },
  sectionCardLast: { marginBottom: 12 },
  sectionHeadWrap: { marginBottom: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: DIVIDER, marginTop: 8 },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { color: TXT, fontSize: 14.5, fontWeight: '600' },
  fieldWrap: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: '#FCFDFD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  fieldWrapSingle: { minHeight: 44, justifyContent: 'center', paddingVertical: 4 },
  fieldInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldInput: {
    flex: 1,
    minHeight: 22,
    paddingVertical: 0,
    color: TXT,
    fontSize: 14,
  },
  unitPill: {
    backgroundColor: SOFT_GREEN,
    color: GREEN,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '700',
    overflow: 'hidden',
  },
  boxedField: {
    backgroundColor: '#F7F9F7',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 6,
    borderWidth: 1,
    borderColor: '#E2EAE4',
    marginBottom: 0,
  },
  boxedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  boxedIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxedIconFilled: { backgroundColor: BRAND_ORANGE },
  boxedLabel: { flexShrink: 1, color: SUB, fontWeight: '500', fontSize: 13 },
  boxedInput: {
    marginTop: 4,
    color: TXT,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 3,
  },
  addressInput: { minHeight: 42, paddingTop: 7, textAlignVertical: 'top' },
  selectRow: { flexDirection: 'row', alignItems: 'center' },
  helper: { color: SUB, fontSize: 11, lineHeight: 15, marginTop: 4, marginBottom: 6 },
  locButton: {
    marginLeft: 'auto',
    minHeight: 27,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locButtonText: { color: GREEN, fontSize: 10, fontWeight: '600' },
  twoCol: { flexDirection: 'row', gap: 6, marginTop: 6 },
  colField: {
    flex: 1,
    backgroundColor: '#F7F9F7',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 7,
    borderWidth: 1,
    borderColor: '#E2EAE4',
  },
  colInput: { marginTop: 6, color: TXT, fontSize: 15, paddingVertical: 0 },
  question: { color: TXT, fontSize: 13.5, fontWeight: '700', marginBottom: 7 },
  choiceRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  choice: {
    flex: 1,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  choiceSelected: { backgroundColor: GREEN, borderColor: GREEN },
  choiceText: { color: SUB, fontSize: 13.5, fontWeight: '600' },
  choiceTextSelected: { color: '#FFFFFF' },
  animalsWrap: { gap: 7, marginTop: 8 },
  animalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FBFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAF1ED',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  animalRowOn: { backgroundColor: SOFT_GREEN, borderColor: '#DDD6FE' },
  animalIconChip: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EFF4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  animalIconChipOn: { backgroundColor: '#FFFFFF' },
  animalLabel: { flex: 1, color: TXT, fontSize: 13, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepAdd: { backgroundColor: GREEN },
  stepBtnOff: { backgroundColor: '#E7ECE9' },
  stepValue: { minWidth: 18, textAlign: 'center', color: TXT, fontSize: 14.5, fontWeight: '700' },
  pickerRoot: { flex: 1, justifyContent: 'flex-end' },
  pickerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.45)' },
  pickerCard: {
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  pickerHandle: {
    alignSelf: 'center',
    width: 50,
    height: 5,
    borderRadius: 99,
    backgroundColor: '#D4E2DA',
    marginTop: 10,
    marginBottom: 4,
  },
  pickerScroll: { paddingBottom: 28 },
  landBlock: { marginTop: 8, marginBottom: 2 },
  landHint: { color: MUTED, fontSize: 11.5, marginBottom: 6 },
  landList: { gap: 6, marginBottom: 6 },
  landRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    paddingLeft: 4,
    paddingRight: 6,
    minHeight: 46,
  },
  landRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingLeft: 8,
    minWidth: 0,
  },
  landRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  landRowName: { color: TXT, fontSize: 14, fontWeight: '600' },
  landRowMeta: { color: MUTED, fontSize: 12, marginTop: 1 },
  landRemove: { padding: 8 },
  landAdd: {
    height: 40,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#DDD6FE',
    borderStyle: 'dashed',
    backgroundColor: '#F5F3FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  landAddTxt: { color: GREEN, fontSize: 13.5, fontWeight: '600' },
  cropSelectBlock: { marginTop: 8 },
  cropSelectLabel: { color: SUB, fontSize: 12, fontWeight: '500', marginBottom: 5 },
  cropSelect: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FCFDFD',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  cropSelectText: { flex: 1, color: TXT, fontSize: 14 },
  placeholderText: { color: MUTED },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  cropChip: {
    maxWidth: '48%',
    minHeight: 30,
    borderRadius: 15,
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 8,
    paddingRight: 5,
  },
  cropEmoji: { fontSize: 14 },
  cropChipText: { flexShrink: 1, color: '#4C32B8', fontSize: 12, fontWeight: '600' },
  chipClose: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#91A09A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 22,
    paddingTop: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  submitBtn: {
    flexDirection: 'row',
    gap: 6,
    height: 46,
    borderRadius: 10,
    backgroundColor: PAY_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.62 },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  poSheetPad: { paddingHorizontal: 18, paddingBottom: 20 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingBottom: 12 },
  sheetHeadIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PEACH,
    borderWidth: 1,
    borderColor: PEACH_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeadCopy: { flex: 1, minWidth: 0 },
  sheetTitle: { fontSize: 16, color: TXT, fontWeight: '700' },
  sheetSub: { color: SUB, fontSize: 12, lineHeight: 18, marginTop: 1 },
  sheetClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PEACH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 76,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FBFDFB',
    borderRadius: 17,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#DDEAE2',
  },
  poRowSelected: { backgroundColor: '#FFF6F1', borderColor: BRAND_ORANGE },
  poIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: PEACH,
    borderWidth: 1,
    borderColor: PEACH_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  poIconSelected: { backgroundColor: BRAND_ORANGE, borderColor: BRAND_ORANGE },
  poCopy: { flex: 1, minWidth: 0 },
  poAction: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF5F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  poActionSelected: { backgroundColor: BRAND_ORANGE },
  poName: { color: TXT, fontWeight: '600', fontSize: 14 },
  poSub: { color: SUB, fontSize: 12, lineHeight: 18, marginTop: 3 },
  poEmpty: { padding: 16, color: SUB, textAlign: 'center' },
  cropSheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  cropSheetClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSearch: {
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F2F6F4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  sheetSearchInput: { flex: 1, color: TXT, fontSize: 14, paddingVertical: 0 },
  cropRow: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8EFEB',
    backgroundColor: '#FAFCFB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
  },
  cropRowOn: { backgroundColor: SOFT_GREEN, borderColor: '#DDD6FE' },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.4,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkBoxOn: { backgroundColor: GREEN, borderColor: GREEN },
  cropThumb: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EEF4F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cropThumbOn: { backgroundColor: '#FFFFFF' },
  cropRowEmoji: { fontSize: 15, textAlign: 'center' },
  cropRowText: { flex: 1, color: TXT, fontSize: 14 },
  cropRowTextOn: { color: GREEN_DARK, fontWeight: '600' },
  doneBtn: {
    height: 46,
    borderRadius: 10,
    backgroundColor: PAY_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  doneText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
