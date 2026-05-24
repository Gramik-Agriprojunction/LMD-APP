// Survey.js
import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Platform,
  Image,
  Modal,
  Animated,
  RefreshControl,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ImagePicker from 'react-native-image-crop-picker';
import Toast from 'react-native-simple-toast';
import ShimmerLoader from '../components/ShimmerLoader';
import constants from '../utils/constants';
import { StackActions, NavigationActions, withV4Navigation } from '../utils/v4Compat';
import CachedImage from '../components/CachedImage';

class ActionSheet extends React.Component {
  state = { visible: false };
  show = () => this.setState({ visible: true });
  hide = () => this.setState({ visible: false });
  onSelect = (idx) => {
    this.hide();
    if (typeof this.props.onPress === 'function') this.props.onPress(idx);
  };
  render() {
    const { title, options = [], cancelButtonIndex } = this.props;
    return (
      <Modal visible={this.state.visible} transparent animationType="fade" onRequestClose={this.hide}>
        <TouchableOpacity activeOpacity={1} onPress={this.hide} style={asStyles.backdrop}>
          <View style={asStyles.card}>
            {title ? <Text style={asStyles.title}>{title}</Text> : null}
            {options.map((label, idx) => (
              <TouchableOpacity
                key={`${label}-${idx}`}
                onPress={() => this.onSelect(idx)}
                style={[asStyles.btn, idx === cancelButtonIndex ? asStyles.cancelBtn : null]}
                activeOpacity={0.85}
              >
                <Text style={[asStyles.btnText, idx === cancelButtonIndex ? asStyles.cancelText : null]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    );
  }
}

const asStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#FFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingVertical: 8, paddingHorizontal: 12, paddingBottom: 24 },
  title: { textAlign: 'center', fontWeight: '700', color: '#6B7280', paddingVertical: 12 },
  btn: { paddingVertical: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EEF2F6' },
  btnText: { fontSize: 15, color: '#111827', fontWeight: '600' },
  cancelBtn: { marginTop: 6, borderTopWidth: 0, backgroundColor: '#F3F5F7', borderRadius: 10 },
  cancelText: { color: '#D64545', fontWeight: '700' },
});

const { width: W } = Dimensions.get('window');

const THEME = {
  primary: '#5D3FD3',
  green: '#16A34A',
  orange: '#F37A20',
  bg: '#F0F3F8',
  card: '#FFFFFF',
  soft: '#F1F5F9',
  border: '#E2E8F0',
  text: '#1E293B',
  subText: '#64748B',
  muted: '#94A3B8',
  danger: '#DC2626',
};

/** ---------- Small UI components ---------- */
const Section = ({ title, children }) => (
  <View style={styles.card}>
    <View style={styles.cardHead}>
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const Chip = ({ label, active, onPress }) => (
  <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={[styles.chip, active ? styles.chipOn : null]}>
    <Text style={[styles.chipText, active ? styles.chipTextOn : null]} numberOfLines={1}>
      {label}
    </Text>
  </TouchableOpacity>
);

const Header = ({ farmer, onBack, initials, maskPhone }) => (
  <View style={styles.headerWrap}>
    <SafeAreaView edges={['top']} style={styles.headerSafe}>
      <View style={styles.headerRowNew}>
        <TouchableOpacity onPress={onBack} style={styles.headerBackBtn} activeOpacity={0.85}>
          <Image source={require('./assets/back.png')} style={styles.backImg} resizeMode="contain" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Farmer Survey</Text>

        <View style={{ width: 42 }} />
      </View>
    </SafeAreaView>
  </View>
);

const SeasonCropRow = ({ item, onChangeAcres, onChangeStage, onRemove }) => (
  <View style={styles.cropRow}>
    <View style={styles.cropLeft}>
      <View style={styles.cropIconWrap}>
        <Text style={styles.cropEmoji}>{item?.icon || '🌾'}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.cropName} numberOfLines={1}>
          {item?.label || 'Crop'}
        </Text>

        <View style={styles.cropInlineFields}>
          <TextInput
            value={String(item?.acres || '')}
            onChangeText={onChangeAcres}
            placeholder="Acres"
            placeholderTextColor={THEME.muted}
            keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
            style={styles.cropMiniInput}
          />

          <TextInput
            value={String(item?.stage || '')}
            onChangeText={onChangeStage}
            placeholder="Stage"
            placeholderTextColor={THEME.muted}
            style={[styles.cropMiniInput, { flex: 1, marginLeft: 8 }]}
          />
        </View>
      </View>
    </View>

    <TouchableOpacity onPress={onRemove} style={styles.iconBtn} activeOpacity={0.85}>
      <Text style={[styles.iconBtnTxt, { color: THEME.danger }]}>✕</Text>
    </TouchableOpacity>
  </View>
);

/** ---------- Main Screen ---------- */
class Survey extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: false,
      isSubmitting: false,
      refreshing: false,

      // order from param
      order_id: null,
      order_code: '',
      payment: 0,
      orderItems: [],

      farmer: { id: null, name: '-', phone: '', image: null },

      // GET options (4 crop sections)
      currentCropOptions: [],
      rabiCropOptions: [],
      kharifCropOptions: [],
      zaidCropOptions: [],

      selectedCurrentCropIds: [],
      selectedRabiCropIds: [],
      selectedKharifCropIds: [],
      selectedZaidCropIds: [],

      currentCrops: [],
      rabiCrops: [],
      kharifCrops: [],
      zaidCrops: [],

      problems: [],
      selectedProblemLabel: null, // send as string[]

      fodderOptions: [],
      expenseOptions: [],
      selectedFodder: [], // send as string[]
      selectedExpense: [], // send as string[]

      cattle: { cows: '', buffalo: '', milk_litre: '' },

      problemPhoto: null,
      problemPhotoPreview: null,
    };

    this.actionSheetRef = null;

    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    this.fadeAnim = new Animated.Value(0);
    this.slideAnim = new Animated.Value(30);
  }

  appendArrayOfStrings = (fd, key, arr) => {
  (arr || []).forEach((val, i) => {
    fd.append(`${key}[${i}]`, String(val));
  });
};

appendArrayOfObjects = (fd, key, arr) => {
  (arr || []).forEach((obj, i) => {
    if (!obj) return;
    if (obj.id !== undefined) fd.append(`${key}[${i}][id]`, String(obj.id));
    if (obj.acre !== undefined && obj.acre !== null) fd.append(`${key}[${i}][acre]`, String(obj.acre));
    else fd.append(`${key}[${i}][acre]`, '');
    if (obj.stage !== undefined && obj.stage !== null) fd.append(`${key}[${i}][stage]`, String(obj.stage));
    else fd.append(`${key}[${i}][stage]`, '');
  });
};

goToDashboardAndReset = () => {
  const nav = this.props?.navigation;
  if (!nav?.dispatch) return nav?.navigate?.('LMDDashboard');

  nav.dispatch(
    StackActions.reset({
      index: 0,
      actions: [NavigationActions.navigate({ routeName: 'LMDDashboard' })],
    })
  );
};

  componentDidMount() {
    const paramOrderData =
      this.props?.navigation?.getParam
        ? this.props.navigation.getParam('order_data', null) ||
          this.props.navigation.getParam('data', null) ||
          this.props.navigation.getParam('order', null)
        : this.props?.route?.params?.order_data ??
          this.props?.route?.params?.data ??
          this.props?.route?.params?.order ??
          null;

    // ✅ YOUR CASE: paramOrderData = { order: {...} }
    const orderObj = paramOrderData?.order ? paramOrderData.order : paramOrderData;

    const order_id = orderObj?.id ?? null;

    const farmerData = orderObj?.farmer_data || {};
    const farmer = {
      id: farmerData?.id ?? null,
      name: farmerData?.name ?? '-',
      phone: farmerData?.phone ?? '',
      image: farmerData?.image || farmerData?.image_url || null,
    };

    const payment = Number(orderObj?.grand_total ?? 0);
    const order_code = String(orderObj?.order_code ?? '');

    const items = Array.isArray(orderObj?.order_items) ? orderObj.order_items : [];

    const orderItems = items.map((x, idx) => ({
      key: String(x?.product_id ?? x?.id ?? idx),
      image: x?.image || x?.product_image || x?.photo || null,
      name: x?.product_name || x?.name || '-',
      variant: x?.variation || x?.variant || '',
      qty: x?.quantity ?? x?.qty ?? 0,
      amount: x?.price ?? 0,
      total_price: x?.total_price ?? null,
    }));

    this.setState(
      {
        order_id,
        order_code,
        farmer,
        payment,
        orderItems,
      },
      () => {
        if (order_id) this.loadSurvey();
      }
    );
  }

  goBack = () => {
    if (this.props?.navigation?.goBack) this.props.navigation.goBack();
  };

  money = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '₹ 0';
    return `₹ ${n.toLocaleString('en-IN')}`;
  };

  maskPhone = (phone) => {
    const s = String(phone || '').trim();
    if (!s) return '';
    const digits = s.replace(/\D/g, '');
    if (digits.length <= 4) return s;
    return `•••• •••• ${digits.slice(-4)}`;
  };

  initials = (name) => {
    const n = String(name || '').trim();
    if (!n) return 'F';
    const parts = n.split(/\s+/).filter(Boolean);
    const a = (parts[0] || '').charAt(0);
    const b = (parts[1] || '').charAt(0);
    return (a + b).toUpperCase() || 'F';
  };

  animateSelection = () => {
    LayoutAnimation.configureNext({
      duration: 250,
      create: { type: 'easeInEaseOut', property: 'opacity' },
      update: { type: 'spring', springDamping: 0.85 },
      delete: { type: 'easeInEaseOut', property: 'opacity' },
    });
  };

  toggleString = (key, label) => {
    this.animateSelection();
    const list = this.state[key] || [];
    const v = String(label);
    const has = list.includes(v);
    const next = has ? list.filter((x) => x !== v) : [...list, v];
    this.setState({ [key]: next });
  };

  toggleSeasonCrop = (idsKey, rowsKey, optionItem) => {
    this.animateSelection();
    const id = String(optionItem.id);
    const currentIds = this.state[idsKey] || [];
    const has = currentIds.includes(id);

    const nextIds = has ? currentIds.filter((x) => x !== id) : [...currentIds, id];

    let nextRows = this.state[rowsKey] || [];
    if (has) nextRows = nextRows.filter((x) => String(x.id) !== id);
    else nextRows = [...nextRows, { id, label: optionItem.label, acres: '', stage: '' }];

    this.setState({ [idsKey]: nextIds, [rowsKey]: nextRows });
  };

  openPhotoSheet = () => {
    if (this.actionSheetRef?.show) this.actionSheetRef.show();
  };

  onPhotoActionPress = async (index) => {
    try {
      if (index === 2) return;

      const common = {
        cropping: true,
        includeBase64: false,
        compressImageQuality: 0.85,
        mediaType: 'photo',
        forceJpg: true,
      };

      let img = null;
      if (index === 0) img = await ImagePicker.openCamera(common);
      if (index === 1) img = await ImagePicker.openPicker(common);
      if (!img?.path) return;

      const uri =
        Platform.OS === 'android'
          ? img.path
          : img.path.startsWith('file://')
          ? img.path
          : `file://${img.path}`;

      this.setState({
        problemPhoto: { uri, type: img?.mime || 'image/jpeg', name: `problem_${Date.now()}.jpg` },
        problemPhotoPreview: uri,
      });
    } catch (e) {}
  };

  clearPhoto = () => {
    this.setState({ problemPhoto: null, problemPhotoPreview: null });
  };

  loadSurvey = async () => {
    this.setState({ isLoading: true });

    try {
      let url = constants?.farmerSurveyForm;
      const orderId = this.state?.order_id;

      if (url && orderId) {
        const oid = encodeURIComponent(String(orderId));
        if (String(url).includes('{order_id}')) url = String(url).replace('{order_id}', oid);
        else url = String(url).endsWith('/') ? `${url}${oid}` : `${url}/${oid}`;
      }

      if (!url) {
        this.setState({ isLoading: false });
        return;
      }
      
      console.log("Load Survey API payload== ",url)

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'X-localization': 'en',
          Authorization: 'Bearer ' + (global.token || ''),
          Accept: 'application/json',
        },
      });

      const json = await res.json();

      console.log('Load Survey API response== ', JSON.stringify(json));

      if (!json?.status) {
        this.setState({ isLoading: false });
        Toast.show(json?.message || 'Unable to load survey form', Toast.LONG);
        return;
      }

      const d = json?.data || {};

      const mapCrop = (x, idx) => ({
        id: String(x?.id ?? x?.crop_id ?? idx),
        label: String(x?.name || x?.crop || 'Crop'),
        subLabel: x?.hindi_name ? String(x.hindi_name) : '',
        icon: '🌾',
      });

      // ✅ CURRENT CROPS (API GET response will contain this)
        const currentCropOptions = (
          Array.isArray(d?.current_crop) ? d.current_crop :
          Array.isArray(d?.current_crops) ? d.current_crops :
          Array.isArray(d?.crop) ? d.crop :
          Array.isArray(d?.crops) ? d.crops :
          []
        ).map(mapCrop);

      const rabiCropOptions = (Array.isArray(d?.rabi_season) ? d.rabi_season : []).map(mapCrop);
      const kharifCropOptions = (Array.isArray(d?.kharif_season) ? d.kharif_season : []).map(mapCrop);
      const zaidCropOptions = (Array.isArray(d?.zaid_season) ? d.zaid_season : Array.isArray(d?.zaid_season) ? d.zaid_season : []).map(mapCrop);

      const selectedCurrentCropIds = Array.isArray(d?.selected_current_crop_ids)
        ? d.selected_current_crop_ids.map(String)
        : Array.isArray(d?.selected_current_crop)
        ? d.selected_current_crop.map(String)
        : [];

      const selectedRabiCropIds = Array.isArray(d?.selected_rabi_crop_ids) ? d.selected_rabi_crop_ids.map(String) : [];
      const selectedKharifCropIds = Array.isArray(d?.selected_kharif_crop_ids) ? d.selected_kharif_crop_ids.map(String) : [];
      const selectedZaidCropIds = Array.isArray(d?.selected_zaid_crop_ids) ? d.selected_zaid_crop_ids.map(String) : [];

      const buildRows = (ids, options) =>
        (ids || [])
          .map((cid) => {
            const found = options.find((c) => String(c.id) === String(cid));
            return found ? { id: String(found.id), label: found.label, acres: '', stage: '', icon: '🌾' } : null;
          })
          .filter(Boolean);

      const currentCrops = buildRows(selectedCurrentCropIds, currentCropOptions);
      const rabiCrops = buildRows(selectedRabiCropIds, rabiCropOptions);
      const kharifCrops = buildRows(selectedKharifCropIds, kharifCropOptions);
      const zaidCrops = buildRows(selectedZaidCropIds, zaidCropOptions);

      const problems = Array.isArray(d?.crop_problems)
        ? d.crop_problems.map((x, idx) => ({
            id: String(x?.id ?? x?.name ?? x ?? idx),
            label: String(x?.name || x || 'Problem'),
          }))
        : [];

      const selectedProblemLabel = d?.selected_problem_label || d?.selected_problem || problems?.[0]?.label || null;

      const fodderOptions = Array.isArray(d?.today_fodder)
        ? d.today_fodder.map((x, idx) => ({
            id: String(x?.id ?? x?.name ?? x ?? idx),
            label: String(x?.name || x || 'Fodder'),
          }))
        : [];

      const expenseOptions = Array.isArray(d?.next_expense)
        ? d.next_expense.map((x, idx) => ({
            id: String(x?.id ?? x?.name ?? x ?? idx),
            label: String(x?.name || x || 'Expense'),
          }))
        : [];

      const selectedFodder = Array.isArray(d?.selected_fodder) ? d.selected_fodder.map(String) : [];
      const selectedExpense = Array.isArray(d?.selected_expense) ? d.selected_expense.map(String) : [];

      const cattle = {
        cows: d?.cows != null ? String(d.cows) : '',
        buffalo: d?.buffalo != null ? String(d.buffalo) : '',
        milk_litre: d?.milk_litre != null ? String(d.milk_litre) : '',
      };

      const apiFarmer = d?.farmer_data;
      const updatedFarmer = apiFarmer ? {
        id: apiFarmer?.id ?? this.state.farmer.id,
        name: apiFarmer?.name ?? this.state.farmer.name,
        phone: apiFarmer?.phone ?? this.state.farmer.phone,
        image: apiFarmer?.image || this.state.farmer.image,
      } : this.state.farmer;

      const apiItems = Array.isArray(d?.order_details) ? d.order_details : null;
      const updatedItems = apiItems ? apiItems.map((x, idx) => ({
        key: String(x?.product_id ?? x?.id ?? idx),
        image: x?.product?.photos || x?.image || null,
        name: x?.product?.name || x?.product_name || '-',
        variant: x?.variation || x?.variant || '',
        qty: x?.quantity ?? x?.qty ?? 0,
        amount: x?.price ?? 0,
        total_price: x?.total ?? x?.total_price ?? null,
      })) : this.state.orderItems;

      const grandTotal = d?.grand_total ?? this.state.payment;

      this.setState({
        isLoading: false,
        refreshing: false,

        farmer: updatedFarmer,
        orderItems: updatedItems,
        payment: grandTotal,

        currentCropOptions,
        rabiCropOptions,
        kharifCropOptions,
        zaidCropOptions,

        selectedCurrentCropIds,
        selectedRabiCropIds,
        selectedKharifCropIds,
        selectedZaidCropIds,

        currentCrops,
        rabiCrops,
        kharifCrops,
        zaidCrops,

        problems,
        selectedProblemLabel,

        fodderOptions,
        expenseOptions,
        selectedFodder,
        selectedExpense,

        cattle,
      }, () => {
        this.fadeAnim.setValue(0);
        this.slideAnim.setValue(30);
        Animated.parallel([
          Animated.timing(this.fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(this.slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();
      });
    } catch (e) {
      console.log('Load Survey API error== ', e);
      this.setState({ isLoading: false, refreshing: false });
      Toast.show(e?.message || String(e), Toast.SHORT);
    }
  };

  buildSubmitBody = () => {
    const s = this.state;

    const toCropObjects = (rows) =>
      (rows || [])
        .map((x) => {
          const idNum = Number(x?.id);
          if (!Number.isFinite(idNum)) return null;

          const acreNum = x?.acres === '' || x?.acres == null ? null : Number(x.acres);

          return {
            id: idNum,
            acre: Number.isFinite(acreNum) ? acreNum : null,
            stage: String(x?.stage ?? '').trim(),
          };
        })
        .filter(Boolean);

    return {
      id: s.order_id ? Number(s.order_id) : null,

      current_crop: toCropObjects(s.currentCrops),
      rabi_season: toCropObjects(s.rabiCrops),
      kharif_season: toCropObjects(s.kharifCrops),
      zaid_season: toCropObjects(s.zaidCrops),

      crop_problems: s.selectedProblemLabel ? [String(s.selectedProblemLabel)] : [],

      cows: s.cattle?.cows === '' ? null : Number(s.cattle.cows),
      buffalo: s.cattle?.buffalo === '' ? null : Number(s.cattle.buffalo),
      milk_litre: s.cattle?.milk_litre === '' ? null : Number(s.cattle.milk_litre),

      today_fodder: (s.selectedFodder || []).map(String),
      next_expense: (s.selectedExpense || []).map(String),
    };
  };

  submit = async () => {
    if (this.state.isSubmitting) return;

    const url = constants?.fillSurvey || null;
    if (!url) {
      Toast.show('Missing API: constants.fillSurvey', Toast.LONG);
      return;
    }

    try {
      this.setState({ isSubmitting: true });

      const body = this.buildSubmitBody();

      let headers = {
        'X-localization': 'en',
        Authorization: 'Bearer ' + (global.token || ''),
        Accept: 'application/json',
      };

      let requestBody = null;

    if (this.state.problemPhoto?.uri) {
  const fd = new FormData();

  // normal fields
  fd.append('id', body?.id == null ? '' : String(body.id));
  fd.append('cows', body?.cows == null ? '' : String(body.cows));
  fd.append('buffalo', body?.buffalo == null ? '' : String(body.buffalo));
  fd.append('milk_litre', body?.milk_litre == null ? '' : String(body.milk_litre));

  // arrays of objects (crops)
  this.appendArrayOfObjects(fd, 'current_crop', body.current_crop);
  this.appendArrayOfObjects(fd, 'rabi_season', body.rabi_season);
  this.appendArrayOfObjects(fd, 'kharif_season', body.kharif_season);
  this.appendArrayOfObjects(fd, 'zaid_season', body.zaid_season);

  // arrays of strings
  this.appendArrayOfStrings(fd, 'crop_problems', body.crop_problems);
  this.appendArrayOfStrings(fd, 'today_fodder', body.today_fodder);
  this.appendArrayOfStrings(fd, 'next_expense', body.next_expense);

  fd.append('problem_photo', {
    uri: this.state.problemPhoto.uri,
    type: this.state.problemPhoto.type || 'image/jpeg',
    name: this.state.problemPhoto.name || `problem_${Date.now()}.jpg`,
  });

  requestBody = fd;
} else {
  headers = { ...headers, 'Content-Type': 'application/json' };
  requestBody = JSON.stringify(body);
}

      // ✅ keep your logs
      console.log('Submit Survey API payload== ', body);

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: requestBody,
      });

      const json = await res.json();

      // ✅ keep your logs
      console.log('Submit Survey API response== ', JSON.stringify(json));

      this.setState({ isSubmitting: false });

     if (json?.status) {
  Toast.show(json?.message || 'Survey submitted', Toast.SHORT);

      this.goToDashboardAndReset();   // ✅ stack clear, back disabled
    } else {
      Toast.show(json?.message || 'Unable to submit survey', Toast.SHORT);
    }
    } catch (e) {
      console.log('Submit Survey API error== ', e);
      this.setState({ isSubmitting: false });
      Toast.show(e?.message || String(e), Toast.SHORT);
    }
  };

  onRefresh = () => {
    if (this.state.order_id) {
      this.setState({ refreshing: true });
      this.loadSurvey();
    }
  };

  renderSeason = (title, options, selectedIds, rows, idsKey, rowsKey) => (
    <Section title={title}>
      <View style={styles.chipRow}>
        {(options || []).map((c) => {
          const label = c.subLabel ? `${c.label} (${c.subLabel})` : c.label;
          return (
            <Chip
              key={c.id}
              label={label}
              active={(selectedIds || []).includes(String(c.id))}
              onPress={() => this.toggleSeasonCrop(idsKey, rowsKey, c)}
            />
          );
        })}
      </View>

      <View style={{ marginTop: 10 }}>
        {(rows || []).length ? (
          (rows || []).map((item) => (
            <SeasonCropRow
              key={item.id}
              item={item}
              onChangeAcres={(t) => {
                const next = (this.state[rowsKey] || []).map((x) =>
                  String(x.id) === String(item.id) ? { ...x, acres: t } : x
                );
                this.setState({ [rowsKey]: next });
              }}
              onChangeStage={(t) => {
                const next = (this.state[rowsKey] || []).map((x) =>
                  String(x.id) === String(item.id) ? { ...x, stage: t } : x
                );
                this.setState({ [rowsKey]: next });
              }}
              onRemove={() => {
                this.animateSelection();
                const id = String(item.id);
                const nextIds = (this.state[idsKey] || []).filter((x) => String(x) !== id);
                const nextRows = (this.state[rowsKey] || []).filter((x) => String(x.id) !== id);
                this.setState({ [idsKey]: nextIds, [rowsKey]: nextRows });
              }}
            />
          ))
        ) : (
          <Text style={styles.emptyTxt}>No crop selected</Text>
        )}
      </View>
    </Section>
  );

  renderOrderCard = () => {
    const s = this.state;
    const rawCode = String(s.order_code || '');
    const orderIdText = rawCode.includes(' ') ? rawCode.split(' ')[0] : rawCode;

    const total =
      Number(s.payment || 0) ||
      (s.orderItems || []).reduce((sum, x) => {
        const qty = Number(x.qty) || 0;
        const amt = Number(x.amount) || 0;
        return sum + (qty > 0 ? qty * amt : amt);
      }, 0);

    return (
      <>
        {/* Farmer info card */}
        <View style={styles.topCard}>
          <View style={styles.orderFarmerRow}>
            <View style={styles.orderAvatar}>
              {s.farmer?.image ? (
                <CachedImage source={{ uri: String(s.farmer.image) }} style={styles.orderAvatarImg} />
              ) : (
                <Text style={styles.orderAvatarTxt}>{this.initials(s.farmer?.name)}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderFarmerName} numberOfLines={1}>{s.farmer?.name || '-'}</Text>
              <Text style={styles.orderFarmerPhone} numberOfLines={1}>{this.maskPhone(s.farmer?.phone)}</Text>
            </View>
            <View style={styles.orderTotalPill}>
              <Text style={styles.orderTotalLbl}>Grand Total</Text>
              <Text style={styles.orderTotalVal}>{this.money(total)}</Text>
            </View>
          </View>
        </View>

        {/* Order items card */}
        <View style={styles.topCard}>
          <View style={styles.orderHead}>
            <Text style={styles.orderTitle}>Order #{orderIdText || s.order_id || '-'}</Text>
          </View>

          {(s.orderItems || []).length ? (
            <View style={{ marginTop: 8 }}>
              {(s.orderItems || []).map((it, idx) => (
                <View key={it.key} style={[styles.itemRow, idx === 0 && { borderTopWidth: 0, paddingTop: 0, marginTop: 0 }]}>
                  <View style={styles.itemLeft}>
                    {it.image ? <CachedImage source={{ uri: String(it.image) }} style={styles.itemImg} resizeMode="cover" /> : <View style={styles.itemImgPlaceholder} />}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                      {!!it.variant ? <Text style={styles.itemVariant} numberOfLines={1}>{it.variant}</Text> : null}
                    </View>
                  </View>
                  <Text style={styles.itemQty}>×{String(it.qty ?? 0)}</Text>
                  <Text style={styles.itemAmt}>{this.money(it.total_price || (Number(it.qty || 0) * Number(it.amount || 0)))}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyTxt, { marginTop: 8 }]}>No order items</Text>
          )}
        </View>
      </>
    );
  };

  render() {
    const s = this.state;

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.primary} />

        <Header farmer={s.farmer} onBack={this.goBack} initials={this.initials} maskPhone={this.maskPhone} />

        {s.isLoading && !s.refreshing ? (
          <View style={styles.scroll}><ShimmerLoader /></View>
        ) : (
          <>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={!!s.refreshing} onRefresh={this.onRefresh} />}
            >
              <Animated.View style={{ opacity: this.fadeAnim, transform: [{ translateY: this.slideAnim }] }}>
                {this.renderOrderCard()}

                {this.renderSeason('Current Crops', s.currentCropOptions, s.selectedCurrentCropIds, s.currentCrops, 'selectedCurrentCropIds', 'currentCrops')}
                {this.renderSeason('Rabi Season Crops', s.rabiCropOptions, s.selectedRabiCropIds, s.rabiCrops, 'selectedRabiCropIds', 'rabiCrops')}
                {this.renderSeason('Kharif Season Crops', s.kharifCropOptions, s.selectedKharifCropIds, s.kharifCrops, 'selectedKharifCropIds', 'kharifCrops')}
                {this.renderSeason('Zaid Season Crops', s.zaidCropOptions, s.selectedZaidCropIds, s.zaidCrops, 'selectedZaidCropIds', 'zaidCrops')}

                <Section title="Crop Problems">
                  <View style={styles.chipRow}>
                    {(s.problems || []).map((p) => (
                      <Chip
                        key={p.id}
                        label={p.label}
                        active={String(p.label) === String(s.selectedProblemLabel)}
                        onPress={() => {
                          this.animateSelection();
                          this.setState({ selectedProblemLabel: String(p.label) === String(s.selectedProblemLabel) ? null : String(p.label) });
                        }}
                      />
                    ))}
                  </View>

                  {s.selectedProblemLabel ? (
                    <View style={styles.problemBar}>
                      <View style={styles.problemPill}>
                        <Text style={styles.problemLbl} numberOfLines={1}>{s.selectedProblemLabel}</Text>
                      </View>
                      <TouchableOpacity activeOpacity={0.85} onPress={this.openPhotoSheet} style={styles.uploadBtn}>
                        <Text style={styles.uploadTxt}>Upload Photo</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {s.problemPhotoPreview ? (
                    <View style={styles.photoPreview}>
                      <Image source={{ uri: s.problemPhotoPreview }} style={styles.photoImg} resizeMode="cover" />
                      <TouchableOpacity onPress={this.clearPhoto} style={styles.photoRemove} activeOpacity={0.85}>
                        <Text style={styles.photoRemoveTxt}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </Section>

                <Section title="Cattle Details">
                  <View style={styles.cattleRow}>
                    <View style={styles.cattleBox}>
                      <Text style={styles.cattleLbl}>Cows</Text>
                      <TextInput
                        value={String(s.cattle?.cows ?? '')}
                        onChangeText={(t) => this.setState({ cattle: { ...this.state.cattle, cows: t } })}
                        placeholder="0"
                        placeholderTextColor={THEME.muted}
                        keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                        style={styles.cattleInput}
                      />
                    </View>
                    <View style={styles.cattleBox}>
                      <Text style={styles.cattleLbl}>Buffalo</Text>
                      <TextInput
                        value={String(s.cattle?.buffalo ?? '')}
                        onChangeText={(t) => this.setState({ cattle: { ...this.state.cattle, buffalo: t } })}
                        placeholder="0"
                        placeholderTextColor={THEME.muted}
                        keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                        style={styles.cattleInput}
                      />
                    </View>
                    <View style={[styles.cattleBox, styles.cattleBoxLast]}>
                      <Text style={styles.cattleLbl}>Milk (L)</Text>
                      <TextInput
                        value={String(s.cattle?.milk_litre ?? '')}
                        onChangeText={(t) => this.setState({ cattle: { ...this.state.cattle, milk_litre: t } })}
                        placeholder="0"
                        placeholderTextColor={THEME.muted}
                        keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                        style={styles.cattleInput}
                      />
                    </View>
                  </View>
                </Section>

                <Section title="Today's Fodder">
                  <View style={styles.chipRow}>
                    {(s.fodderOptions || []).map((f) => (
                      <Chip key={f.id} label={f.label} active={(s.selectedFodder || []).includes(String(f.label))} onPress={() => this.toggleString('selectedFodder', String(f.label))} />
                    ))}
                  </View>
                </Section>

                <Section title="Next Expense">
                  <View style={styles.chipRow}>
                    {(s.expenseOptions || []).map((e) => (
                      <Chip key={e.id} label={e.label} active={(s.selectedExpense || []).includes(String(e.label))} onPress={() => this.toggleString('selectedExpense', String(e.label))} />
                    ))}
                  </View>
                </Section>
              </Animated.View>
            </ScrollView>

            <View style={styles.bottomBar}>
              <View style={styles.bottomBarInner}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={this.submit}
                  style={[styles.submitBtn, s.isSubmitting ? { opacity: 0.6 } : null]}
                  disabled={s.isSubmitting}
                >
                  {s.isSubmitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.submitTxt}>Submit Survey</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        <ActionSheet
          ref={(o) => (this.actionSheetRef = o)}
          title={'Upload Photo'}
          options={['Camera', 'Gallery', 'Cancel']}
          cancelButtonIndex={2}
          onPress={this.onPhotoActionPress}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.bg },

  headerWrap: { backgroundColor: THEME.primary },
  headerSafe: { backgroundColor: THEME.primary },
  headerRowNew: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headerBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  backImg: { width: 17, height: 17, tintColor: '#fff', resizeMode: 'contain' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#FFF', fontSize: 15, fontWeight: '600' },

  scroll: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 120 },

  topCard: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
    marginBottom: 8,
  },

  orderHead: { marginBottom: 4 },
  orderTitle: { color: THEME.primary, fontSize: 14, fontWeight: '700' },

  orderTotalPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(93,63,211,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(93,63,211,0.15)',
    alignItems: 'flex-end',
  },
  orderTotalLbl: { color: THEME.subText, fontSize: 9, fontWeight: '600' },
  orderTotalVal: { color: THEME.primary, fontSize: 16, fontWeight: '800', marginTop: 2 },

  orderFarmerRow: { flexDirection: 'row', alignItems: 'center' },
  orderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(93,63,211,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(93,63,211,0.15)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  orderAvatarImg: { width: 40, height: 40 },
  orderAvatarTxt: { color: THEME.primary, fontSize: 14, fontWeight: '800' },
  orderFarmerName: { color: THEME.text, fontSize: 14, fontWeight: '600' },
  orderFarmerPhone: { marginTop: 1, color: THEME.muted, fontSize: 12, fontWeight: '400' },

  itemRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  itemName: { color: THEME.text, fontSize: 13, fontWeight: '600' },
  itemVariant: { marginTop: 2, color: THEME.muted, fontSize: 11, fontWeight: '500' },
  itemQty: { color: THEME.subText, fontSize: 13, fontWeight: '600', width: 36, textAlign: 'center' },
  itemAmt: { color: THEME.green, fontSize: 14, fontWeight: '700', width: 70, textAlign: 'right' },

  card: {
    backgroundColor: THEME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
    marginBottom: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardHeadLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
  cardHeadEmoji: { fontSize: 16, marginRight: 8 },
  cardTitle: { color: THEME.text, fontSize: 14, fontWeight: '700' },

  cropRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: THEME.soft,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  cropLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  cropIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cropEmoji: { fontSize: 16 },
  cropName: { color: THEME.text, fontSize: 13, fontWeight: '600' },

  cropInlineFields: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  cropMiniInput: {
    height: 34,
    width: 80,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: THEME.border,
    paddingHorizontal: 8,
    color: THEME.text,
    fontSize: 12,
    fontWeight: '600',
  },

  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    alignSelf: 'center',
    marginTop: 16,
  },
  iconBtnTxt: { fontSize: 13, fontWeight: '900', color: THEME.danger },

  emptyTxt: { color: THEME.muted, fontSize: 12, fontWeight: '500', paddingVertical: 6 },

  chipRow: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: THEME.soft,
    borderWidth: 1,
    borderColor: THEME.border,
    marginRight: 6,
    marginBottom: 6,
  },
  chipOn: { backgroundColor: 'rgba(93,63,211,0.1)', borderColor: THEME.primary },
  chipText: { color: THEME.text, fontSize: 13, fontWeight: '500' },
  chipTextOn: { color: THEME.primary, fontWeight: '700' },

  problemBar: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  problemPill: {
    flex: 1,
    backgroundColor: 'rgba(93,63,211,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(93,63,211,0.15)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 10,
  },
  problemLbl: { color: THEME.primary, fontSize: 13, fontWeight: '600' },

  uploadBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },

  photoPreview: {
    marginTop: 10,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.soft,
  },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveTxt: { color: '#fff', fontSize: 13, fontWeight: '900' },

  cattleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  cattleBox: {
    flex: 1,
    backgroundColor: THEME.soft,
    borderRadius: 10,
    padding: 10,
    marginRight: 6,
  },
  cattleBoxLast: { marginRight: 0 },
  cattleLbl: { color: THEME.subText, fontSize: 11, fontWeight: '600' },
  cattleInput: {
    marginTop: 4,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: THEME.border,
    paddingHorizontal: 10,
    color: THEME.text,
    fontSize: 13,
    fontWeight: '700',
  },

  submitBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },

  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bottomBarInner: {
    paddingHorizontal: 14,
    paddingBottom: 30,
    paddingTop: 10,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  itemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  itemImg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: THEME.soft,
  },
  itemImgPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: THEME.soft,
    borderWidth: 1,
    borderColor: THEME.border,
  },
});

export default withV4Navigation(Survey);
