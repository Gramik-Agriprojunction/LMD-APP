import React, { Component } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, Image,
  TouchableOpacity, TextInput, ActivityIndicator, Pressable,
  Animated, Platform, UIManager, LayoutAnimation, KeyboardAvoidingView, Linking, Easing,
  Dimensions, Keyboard, Modal,
} from 'react-native';
import BottomSheet from '../components/BottomSheet';
import DatePicker from 'react-native-date-picker';
import { WebView } from 'react-native-webview';
import { SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import * as Animatable from 'react-native-animatable';
import moment from 'moment';
import Toast from 'react-native-simple-toast';
import constants from '../utils/constants';
import { withV4Navigation, NavigationEvents } from '../utils/v4Compat';
import CachedImage from '../components/CachedImage';
import { S, soilIcons as I } from '../utils/soilTheme';
import { getLocationPincode } from '../utils/locationHelper';
import {
  isOnlinePayment, isUpiAppPayment, parseCreateOrderResponse, paymentConfigFromPage,
  openRazorpayCheckout, openUpiPayment, waitForAppReturn,
} from '../utils/soilPayment';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EASE = {
  duration: 220,
  create: { type: 'easeInEaseOut', property: 'opacity' },
  update: { type: 'easeInEaseOut' },
  delete: { type: 'easeInEaseOut', property: 'opacity' },
};

const W = Dimensions.get('window').width;
const H = Dimensions.get('window').height;
const SAFE_BOTTOM = initialWindowMetrics?.insets?.bottom ?? 0;
const PAD = 10;
const FOOTER_PAD = 20;
const FOOTER_ROW_H = 48;
const FOOTER_H = 52;
const FOOTER_BOTTOM = Math.max(Math.round((initialWindowMetrics?.insets?.bottom || 0) * 0.35), 6);
const PAY_GREEN = '#26BD26';
const HIT = { top: 10, bottom: 10, left: 10, right: 10 };
const BANNER_RATIO = 665 / 1024;
const BANNER_FULL = Math.round(W * Math.max(BANNER_RATIO, 0.74));
const BANNER_OVERLAP = 56;
const PKG_TOP_GAP = 20;
const CAL_PAD = 16;
const CAL_GAP = 6;
const CAL_BOX = Math.floor((W - CAL_PAD * 2 - CAL_GAP * 6) / 7);
const CAL_CELL = CAL_BOX;
const CAL_CELL_H = Math.max(CAL_BOX, 44);
const CAL_WHEEL_H = 216;
const COLLAPSE_DIST = BANNER_FULL;
const HEADER_REVEAL_START = Math.round(COLLAPSE_DIST * 0.4);
const HEADER_REVEAL_END = Math.round(COLLAPSE_DIST * 0.92);
const CONFETTI_COUNT = 48;
const CONFETTI_MS = 2000;

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MINUTE_OPTS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const PKG_SEL_BG = { BASIC: '#174A30', ADVANCE: '#1A365D' };
const CONFETTI_COLORS = ['#16A34A', '#5D3FD3', '#EA580C', '#2563EB', '#D97706', '#DC2626', '#0D9488', '#F59E0B'];

const PKG_STYLE = {
  BASIC: { color: S.GREEN, accent: S.GREEN_BG, border: '#86EFAC', fill: S.GREEN },
  ADVANCE: { color: S.BLUE, accent: S.BLUE_BG, border: '#93C5FD', fill: S.BLUE },
};

const GUARANTEE_EMOJI = ['🚚', '🔬', '📱', '🧑‍🌾'];
const TILE_BG = [S.GREEN_BG, S.AMBER_BG, S.BLUE_BG, S.P_SOFT];

const PARAM_SHORT = {
  Nitrogen: 'N', Phosphorous: 'P', Phosphorus: 'P', Potassium: 'K',
  'Organic Carbon': 'OC', 'Cation Exchange': 'CEC', Clay: 'Clay',
  pH: 'pH', EC: 'EC', Sulphur: 'S', Zinc: 'Zn', Iron: 'Fe',
  Boron: 'B', Manganese: 'Mn', Copper: 'Cu',
};
const paramShort = (name) => PARAM_SHORT[String(name || '').trim()] || String(name || '').trim().split(' ')[0];

const parseSoilResponse = (json) => {
  const data = json?.data;
  if (Array.isArray(data)) return { packages: data, page: null };
  if (data && typeof data === 'object') {
    return { packages: Array.isArray(data.packages) ? data.packages : [], page: data };
  }
  return { packages: [], page: null };
};

const parsePostOfficeResponse = (json) => {
  const d = json?.data;
  if (!d) return { state: '', district: '', offices: [] };
  const toOffice = (o) => {
    if (typeof o === 'string') return { id: o, name: o };
    const name = o?.name || o?.Name || o?.post_office_name || o?.postOfficeName || o?.branch_name || '';
    return { id: String(o?.id || name), name: String(name) };
  };
  if (Array.isArray(d)) {
    const first = d[0] || {};
    return {
      state: first.state || first.State || first.stateName || '',
      district: first.district || first.District || first.districtName || '',
      offices: d.map(toOffice).filter((o) => o.name),
    };
  }
  const raw = d.post_offices || d.postOffices || d.offices || d.list || d.branches || [];
  return {
    state: d.state || d.stateName || d.State || '',
    district: d.district || d.districtName || d.District || '',
    offices: Array.isArray(raw) ? raw.map(toOffice).filter((o) => o.name) : [],
  };
};

const activePayments = (methods) => {
  if (!Array.isArray(methods) || !methods.length) return [];
  const active = methods.filter((m) => {
    const s = String(m?.status ?? 'ACTIVE').toUpperCase();
    return s === 'ACTIVE' || s === '1' || s === 'TRUE' || s === 'ENABLED';
  });
  return active.length ? active : methods;
};

const pkgStyle = (type) => PKG_STYLE[String(type || '').toUpperCase()] || PKG_STYLE.BASIC;

const farmerName = (f) => f?.name || f?.farmer_name || f?.fullName || f?.full_name || '';
const farmerPhone = (f) => f?.mobile || f?.phone || f?.farmer_mobile || f?.contact || '';
const farmerEmail = (f) => f?.email || f?.farmer_email || '';
const farmerVillage = (f) => f?.village || f?.city || f?.district || f?.address || '';
const farmerId = (f) => f?.id || f?.farmer_id || f?.user_id;
const isValidFarmer = (f) => !!(f && (farmerId(f) || String(farmerName(f)).trim()));
const initials = (name) => String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '+';

const payShortLabel = (code, name) => {
  const c = String(code || '').toLowerCase();
  if (c === 'cash_on_delivery') return 'COD';
  if (c === 'online') return 'Online';
  if (c === 'google_pay') return 'GPay';
  if (c === 'phone_pe') return 'PhonePe';
  if (c === 'paytm') return 'PayTm';
  return String(name || 'Pay').split(' ')[0];
};

const isCod = (code) => String(code || '').toLowerCase() === 'cash_on_delivery';

const calendarCells = (viewMonth) => {
  const start = moment(viewMonth).startOf('month');
  const days = start.daysInMonth();
  const pad = start.day();
  const cells = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return cells;
};

const calGridRows = (month) => Math.ceil(calendarCells(month).length / 7);

const nearestMinute = (m) => MINUTE_OPTS.reduce((best, v) => (
  Math.abs(v - m) < Math.abs(best - m) ? v : best
), MINUTE_OPTS[0]);

const to24Hour = (hour12, ampm) => {
  let h = Number(hour12) || 12;
  const ap = String(ampm || 'AM').toUpperCase();
  if (ap === 'AM' && h === 12) return 0;
  if (ap === 'PM' && h !== 12) return h + 12;
  return h;
};

const format12 = (hour24, minute) => moment().hour(hour24).minute(minute).format('h:mm A');

const buildCalDateTime = (month, day, hour12, minute, ampm) => {
  const h24 = to24Hour(hour12, ampm);
  return moment(month).date(day).hour(h24).minute(minute).second(0).millisecond(0).toDate();
};

class PayBtnArrow extends React.Component {
  constructor(props) {
    super(props);
    this.slide = new Animated.Value(0);
    this._loop = null;
  }
  componentDidMount() {
    this._loop = Animated.loop(
      Animated.sequence([
        Animated.timing(this.slide, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(this.slide, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    this._loop.start();
  }
  componentWillUnmount() {
    this._loop?.stop();
  }
  render() {
    const tx = this.slide.interpolate({ inputRange: [0, 1], outputRange: [0, 5] });
    return (
      <Animated.Image source={I.arrow} style={[$.payBtnArrow, { transform: [{ translateX: tx }] }]} />
    );
  }
}

class CreateSoilOrder extends Component {
  constructor(props) {
    super(props);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    this.state = {
      loading: true, submitting: false, locating: false, fetchingPO: false,
      packages: [], pageData: null, paymentMethods: [], selectedPackageId: null,
      pincode: '', state: '', district: '', fullAddress: '', postOffice: '',
      postOffices: [], showPOPicker: false, lat: '', lng: '', qty: '1',
      paymentMode: 'cash_on_delivery', dateObj: tomorrow, showDatePicker: false,
      selectedFarmer: null, focusedField: null, highlightField: null, jaankariOpen: false,
      failedImgs: {}, heroImgFailed: false,
      showConfetti: false, confettiKey: 0, keyboardH: 0,
      showVideo: false, videoId: '', videoTitle: '',
      calMonth: null, calDay: null, calHour: 10, calMinute: 0, calAmPm: 'AM', calPicked: false,
      calStep: 'date',
      paymentResult: null,
      displayTotal: 0,
    };
    this.totalAnim = new Animated.Value(0);
    this._momentum = false;
    this._totalListener = null;
    this.pkgRefs = {};
    this.scrollRef = null;
    this.sheetY = 0;
    this.jaankariY = 0;
    this.fieldYs = {};
    this.sectionYs = {};
    this.sectionRefs = {};
    this.paymentY = 0;
    this.scrollY = new Animated.Value(0);
    this._kbShow = null;
    this._kbHide = null;
  }

  componentDidMount() {
    this.fetchPackages();
    this.applyFarmerFromNav();
    this._kbShow = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      this.setState({ keyboardH: e.endCoordinates.height });
      if (this.state.focusedField) this.scrollToField(this.state.focusedField);
    });
    this._kbHide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      this.setState({ keyboardH: 0 });
    });
  }

  applyFarmerFromNav = () => {
    const farmer = this.props.navigation.getParam('selectedFarmer');
    if (isValidFarmer(farmer)) {
      const curId = farmerId(this.state.selectedFarmer);
      const nextId = farmerId(farmer);
      if (String(nextId || '') !== String(curId || '')) {
        this.setState({ selectedFarmer: farmer }, () => this.sectionRefs.farmer?.pulse?.(500));
      }
      return;
    }
    if (farmer != null) {
      this.props.navigation.setParams?.({ selectedFarmer: undefined });
    }
    if (this.state.selectedFarmer && !isValidFarmer(this.state.selectedFarmer)) {
      this.setState({ selectedFarmer: null });
    }
  };

  openSelectFarmer = () => {
    if (this.state.highlightField === 'farmer') this.clearHighlight();
    if (!isValidFarmer(this.state.selectedFarmer)) {
      this.props.navigation.setParams?.({ selectedFarmer: undefined });
    }
    this.props.navigation.navigate('SelectFarmer');
  };

  scrollToField = (key) => {
    setTimeout(() => {
      const y = this.fieldYs[key];
      if (y == null || !this.scrollRef) return;
      const base = this.sectionYs.address ?? 0;
      const target = Math.max(0, (this.sheetY || 0) + base + y - 110);
      this.scrollRef.scrollTo?.({ y: target, animated: true });
    }, Platform.OS === 'ios' ? 80 : 120);
  };

  scrollToSection = (key, fieldKey) => {
    setTimeout(() => {
      let y = this.sectionYs[key];
      if (y == null && fieldKey && this.fieldYs[fieldKey] != null) {
        y = this.fieldYs[fieldKey];
      } else if (fieldKey && this.fieldYs[fieldKey] != null && key === 'address') {
        y = (y || 0) + this.fieldYs[fieldKey];
      }
      if (y == null || !this.scrollRef) return;
      const target = Math.max(0, (this.sheetY || 0) + y - 100);
      this.scrollRef.scrollTo?.({ y: target, animated: true });
    }, 100);
  };

  getMissingField = () => {
    const { selectedPackageId, selectedFarmer, pincode, state, district, fullAddress, postOffice, dateObj } = this.state;
    if (!selectedPackageId) return { key: 'package', section: 'package', message: 'Package chunein' };
    if (!isValidFarmer(selectedFarmer)) return { key: 'farmer', section: 'farmer', message: 'Farmer chunein' };
    if (pincode.length !== 6) return { key: 'pin', section: 'address', message: '6 digit PIN daalein' };
    if (!state.trim()) return { key: 'state', section: 'address', message: 'State daalein' };
    if (!district.trim()) return { key: 'district', section: 'address', message: 'District daalein' };
    if (!fullAddress.trim()) return { key: 'addr', section: 'address', message: 'Pura address daalein' };
    if (!postOffice) return { key: 'po', section: 'address', message: 'Post office chunein' };
    if (!dateObj) return { key: 'date', section: 'date', message: 'Pickup date chunein' };
    return null;
  };

  clearHighlight = () => {
    if (this._highlightTimer) clearTimeout(this._highlightTimer);
    this.setState({ highlightField: null });
  };

  validateAndFocus = () => {
    const { submitting } = this.state;
    if (submitting) return false;
    const miss = this.getMissingField();
    if (!miss) return true;
    Toast.show(miss.message, Toast.SHORT);
    const isAddrField = ['pin', 'state', 'district', 'addr', 'po'].includes(miss.key);
    this.setState({
      highlightField: miss.key,
      focusedField: isAddrField ? miss.key : null,
    }, () => {
      this.scrollToSection(miss.section, isAddrField ? miss.key : null);
      const ref = this.sectionRefs[miss.section];
      ref?.shake?.(650);
      if (this._highlightTimer) clearTimeout(this._highlightTimer);
      this._highlightTimer = setTimeout(() => this.clearHighlight(), 3200);
    });
    return false;
  };

  onFieldFocus = (key) => {
    this.clearHighlight();
    this.setState({ focusedField: key }, () => this.scrollToField(key));
  };

  goBack = () => this.props?.navigation?.goBack?.();
  authHeaders = () => ({
    Authorization: 'Bearer ' + global.token,
    Accept: 'application/json',
    'X-localization': 'en',
    'Content-Type': 'application/json',
  });

  markImgFailed = (key) => this.setState((p) => ({ failedImgs: { ...p.failedImgs, [key]: true } }));

  selectedPkg = () => this.state.packages.find((p) => String(p.id) === String(this.state.selectedPackageId)) || null;
  totalAmount = () => (Number(this.selectedPkg()?.price) || 0) * Math.max(1, Number(this.state.qty) || 1);

  animateTotal = () => {
    const target = this.totalAmount();
    if (this._totalListener) this.totalAnim.removeListener(this._totalListener);
    this.totalAnim.setValue(this.state.displayTotal);
    this._totalListener = this.totalAnim.addListener(({ value }) => {
      const next = Math.round(value);
      if (next !== this.state.displayTotal) this.setState({ displayTotal: next });
    });
    Animated.spring(this.totalAnim, { toValue: target, friction: 8, tension: 40, useNativeDriver: false }).start();
  };

  prefillLocation = async ({ silent = false } = {}) => {
    if (this.state.locating) return;
    this.setState({ locating: true });
    try {
      const { lat, lng, pincode, error } = await getLocationPincode();
      if (error === 'not_linked') {
        this.setState({ locating: false });
        if (!silent) Toast.show('App rebuild karein (npm run ios)', Toast.LONG);
        return;
      }
      if (error === 'permission_denied') {
        this.setState({ locating: false });
        if (!silent) Toast.show('Location permission allow karein', Toast.SHORT);
        return;
      }
      this.setState({ lat, lng, pincode: pincode || this.state.pincode, locating: false }, () => {
        if (pincode?.length === 6) this.fetchPostOffice(pincode, lat, lng);
        else if (!silent && !pincode) Toast.show('PIN manually daalein', Toast.SHORT);
      });
    } catch (e) {
      this.setState({ locating: false });
    }
  };

  fetchPackages = () => {
    fetch(constants.soilPackages, { method: 'GET', headers: this.authHeaders() })
      .then((r) => r.json())
      .then((json) => {
        const { packages, page } = parseSoilResponse(json);
        const payments = activePayments(page?.paymentMethods);
        this.setState({
          loading: false, packages, pageData: page, paymentMethods: payments,
          selectedPackageId: packages[0]?.id ?? null,
          paymentMode: payments.find((p) => p.code === 'cash_on_delivery')?.code || payments[0]?.code || 'cash_on_delivery',
        }, () => {
          this.animateTotal();
          this.prefillLocation({ silent: true });
        });
      })
      .catch(() => { Toast.show('Packages load nahi ho paye', Toast.SHORT); this.setState({ loading: false }); });
  };

  fetchPostOffice = (pin, lat, lng) => {
    const pincode = String(pin || this.state.pincode).trim();
    if (pincode.length !== 6) return;
    this.setState({ fetchingPO: true });
    fetch(constants.getPostOffice, {
      method: 'POST', headers: this.authHeaders(),
      body: JSON.stringify({
        pincode,
        lat: String(lat ?? this.state.lat ?? ''),
        long: String(lng ?? this.state.lng ?? ''),
      }),
    })
      .then((r) => r.json())
      .then((json) => {
        const { state, district, offices } = parsePostOfficeResponse(json);
        LayoutAnimation.configureNext(EASE);
        this.setState({
          fetchingPO: false,
          state: state || this.state.state,
          district: district || this.state.district,
          postOffices: offices,
          postOffice: offices.length === 1 ? offices[0].name : this.state.postOffice,
        });
      })
      .catch(() => { this.setState({ fetchingPO: false }); Toast.show('Post office load nahi ho paya', Toast.SHORT); });
  };

  onPincodeChange = (v) => {
    const pincode = v.replace(/\D/g, '').slice(0, 6);
    this.setState({ pincode, postOffice: '', postOffices: [], state: '', district: '' });
    if (pincode.length === 6) this.fetchPostOffice(pincode);
  };

  selectPackage = (id) => {
    if (this.state.highlightField === 'package') this.clearHighlight();
    this.setState({ selectedPackageId: id }, () => {
      this.animateTotal();
      this.pkgRefs[id]?.pulse?.(350);
    });
  };

  setQty = (v) => this.setState({ qty: v }, this.animateTotal);

  canSubmit = () => !this.getMissingField() && !this.state.submitting;

  componentWillUnmount() {
    if (this._totalListener) this.totalAnim.removeListener(this._totalListener);
    this._kbShow?.remove?.();
    this._kbHide?.remove?.();
    this._appStateSub?.remove?.();
    if (this._highlightTimer) clearTimeout(this._highlightTimer);
    if (this._payNavTimer) clearTimeout(this._payNavTimer);
  }

  buildOrderBody = (paymentId = '') => {
    const { selectedPackageId, selectedFarmer, pincode, state, district, fullAddress, postOffice, qty, paymentMode, dateObj, lat, lng } = this.state;
    return {
      payment_mode: paymentMode,
      sample_pickup_date: moment(dateObj).format('YYYY-MM-DD HH:mm:ss'),
      payment_id: paymentId || '',
      package_id: String(selectedPackageId),
      qty: String(qty),
      farmer_id: String(farmerId(selectedFarmer) || ''),
      pincode,
      state: state.trim(),
      district: district.trim(),
      address: fullAddress.trim(),
      post_office: postOffice,
      lat: String(lat || ''),
      long: String(lng || ''),
    };
  };

  navigateAfterPayment = (order, success) => {
    const orderId = order?.id;
    this.setState({ paymentResult: { success, order, orderId } });
    if (this._payNavTimer) clearTimeout(this._payNavTimer);
    this._payNavTimer = setTimeout(() => {
      if (success) this.goToOrderDetail(true);
      else this.dismissPaymentResult();
    }, success ? 1800 : 1600);
  };

  dismissPaymentResult = () => {
    if (this._payNavTimer) clearTimeout(this._payNavTimer);
    this.setState({ paymentResult: null });
  };

  onPaymentResultBack = () => {
    const { paymentResult } = this.state;
    if (this._payNavTimer) clearTimeout(this._payNavTimer);
    if (paymentResult?.success) this.goToOrderDetail(true);
    else this.dismissPaymentResult();
  };

  goToOrderDetail = (fromAuto = false) => {
    const { paymentResult } = this.state;
    const orderId = paymentResult?.orderId;
    const order = paymentResult?.order;
    this.setState({ paymentResult: null });
    if (!orderId) {
      this.props.navigation.navigate('SoilOrders');
      return;
    }
    this.props.navigation.reset({
      index: 1,
      routes: [
        { name: 'LMDDashboard' },
        { name: 'SoilOrderDetail', params: { orderId, order, fromCreate: fromAuto } },
      ],
    });
  };

  goToDashboard = () => {
    if (this._payNavTimer) clearTimeout(this._payNavTimer);
    this.setState({ paymentResult: null });
    this.props.navigation.reset({ index: 0, routes: [{ name: 'LMDDashboard' }] });
  };

  submitOrder = async () => {
    if (!this.validateAndFocus()) return;
    const { paymentMode } = this.state;
    const amount = this.totalAmount();
    this.setState({ submitting: true });

    try {
      let paymentId = '';

      if (paymentMode === 'online') {
        const cfg = paymentConfigFromPage(this.state.pageData);
        const { selectedFarmer } = this.state;
        const rz = await openRazorpayCheckout({
          key: cfg.razorpayKey,
          amount,
          name: farmerName(selectedFarmer),
          phone: farmerPhone(selectedFarmer),
          email: farmerEmail(selectedFarmer),
          description: 'Mitti Jaanch',
        });
        paymentId = rz.paymentId;
      }

      const body = this.buildOrderBody(paymentId);
      const res = await fetch(constants.createSoilOrder, {
        method: 'POST', headers: this.authHeaders(), body: JSON.stringify(body),
      });
      const json = await res.json();
      const parsed = parseCreateOrderResponse(json);

      if (!parsed.success && !parsed.orderId) {
        throw new Error(json?.message || 'Order create nahi ho paya');
      }

      if (isUpiAppPayment(paymentMode)) {
        try {
          const cfg = paymentConfigFromPage(this.state.pageData);
          const { selectedFarmer } = this.state;
          const txnRef = `SOIL${parsed.orderId || Date.now()}`;
          await openUpiPayment({
            appCode: paymentMode,
            vpa: parsed.upiVpa || cfg.upiVpa,
            name: cfg.upiName,
            payeeName: farmerName(selectedFarmer),
            phone: farmerPhone(selectedFarmer),
            amount,
            note: cfg.upiNote || `Soil Test #${parsed.orderId || ''}`,
            txnRef,
          });
          await waitForAppReturn(90000);
        } catch (upiErr) {
          this.setState({ submitting: false });
          Toast.show(upiErr?.message || 'UPI open nahi ho paya', Toast.SHORT);
          this.navigateAfterPayment(parsed.order, false);
          return;
        }
      }

      this.setState({ submitting: false });
      this.navigateAfterPayment(parsed.order, true);
    } catch (e) {
      this.setState({ submitting: false });
      const msg = e?.description || e?.message || 'Kuch galat ho gaya';
      if (String(msg).toLowerCase().includes('cancel')) {
        Toast.show('Payment cancel', Toast.SHORT);
      } else {
        Toast.show(msg, Toast.SHORT);
      }
      if (!isOnlinePayment(this.state.paymentMode)) return;
      this.navigateAfterPayment(null, false);
    }
  };

  openLink = (url) => Linking.openURL(url).catch(() => {});

  toggleJaankari = () => {
    LayoutAnimation.configureNext(EASE);
    const willOpen = !this.state.jaankariOpen;
    this.setState({ jaankariOpen: willOpen }, () => {
      if (!willOpen) return;
      setTimeout(() => {
        const y = Math.max(0, (this.sheetY || 0) + (this.jaankariY || 0) - 10);
        this.scrollRef?.scrollTo?.({ y, animated: true });
      }, 250);
    });
  };

  selectPayment = (code) => {
    const cod = isCod(code);
    this.setState({
      paymentMode: code,
      showConfetti: !cod,
      confettiKey: Date.now(),
    });
    if (!cod) setTimeout(() => this.setState({ showConfetti: false }), CONFETTI_MS);
  };

  scrollToPayment = () => {
    setTimeout(() => {
      const y = Math.max(0, (this.sheetY || 0) + (this.paymentY || 0) - 16);
      this.scrollRef?.scrollTo?.({ y, animated: true });
    }, 80);
  };

  // Snap the banner so it never rests half-collapsed (no middle state).
  snapBanner = (y) => {
    if (y <= 2 || y >= COLLAPSE_DIST - 2) return;
    const target = y < COLLAPSE_DIST * 0.5 ? 0 : COLLAPSE_DIST;
    this.scrollRef?.scrollTo?.({ y: target, animated: true });
  };

  onScrollBeginDrag = () => { this._momentum = false; };
  onMomentumScrollBegin = () => { this._momentum = true; };
  onScrollEndDrag = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    this._dragEndY = y;
    setTimeout(() => { if (!this._momentum) this.snapBanner(this._dragEndY); }, 60);
  };
  onMomentumScrollEnd = (e) => {
    this._momentum = false;
    this.snapBanner(e.nativeEvent.contentOffset.y);
  };

  renderConfetti = () => {
    if (!this.state.showConfetti) return null;
    const { confettiKey } = this.state;
    const cx = W * 0.5;

    return (
      <View style={$.confettiRoot} pointerEvents="none">
        {Array.from({ length: CONFETTI_COUNT }, (_, i) => {
          const rnd = (n) => ((i * 9301 + n * 49297) % 233280) / 233280;
          const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
          const isBurst = i % 5 !== 0;
          const size = 5 + Math.round(rnd(1) * 4);
          const spin = (rnd(2) > 0.5 ? 1 : -1) * (200 + Math.round(rnd(3) * 400));
          const delay = Math.round(rnd(4) * (isBurst ? 80 : 160));
          const sway = (rnd(5) - 0.5) * 50;

          let left;
          let burstX;
          let startY;
          if (isBurst) {
            left = cx + (rnd(6) - 0.5) * 48;
            const angle = (rnd(7) - 0.5) * 1.4;
            burstX = Math.sin(angle) * (90 + rnd(8) * W * 0.38);
            startY = -8 - Math.round(rnd(9) * 24);
          } else {
            left = Math.round(rnd(6) * (W - size * 2)) + size;
            burstX = sway;
            startY = -16 - Math.round(rnd(7) * 40);
          }

          const shape = i % 4;
          const pieceStyle = shape === 0
            ? { width: size, height: size, borderRadius: size / 2 }
            : shape === 1
              ? { width: size * 2, height: size * 0.55, borderRadius: 2 }
              : shape === 2
                ? { width: size * 0.55, height: size * 2, borderRadius: 2 }
                : { width: size * 1.1, height: size * 1.1, borderRadius: 3 };

          return (
            <Animatable.View
              key={`${confettiKey}-${i}`}
              animation={{
                0: { opacity: 0, translateY: startY, translateX: 0, rotate: '0deg', scale: 0.4 },
                0.06: { opacity: 1, translateY: startY + (isBurst ? 28 : 12), translateX: burstX * 0.18, scale: 1 },
                0.22: { translateY: startY + (isBurst ? 110 : 70) + rnd(10) * 30, translateX: burstX * 0.55, opacity: 1 },
                0.55: { translateY: H * 0.45, translateX: burstX * 0.85, opacity: 0.85, rotate: `${spin * 0.4}deg` },
                1: { opacity: 0, translateY: H + 40, translateX: burstX, rotate: `${spin}deg`, scale: 0.7 },
              }}
              duration={CONFETTI_MS}
              delay={delay}
              easing="ease-out"
              useNativeDriver
              style={{
                position: 'absolute',
                left: left - size,
                top: 0,
                backgroundColor: color,
                ...pieceStyle,
              }}
            />
          );
        })}
      </View>
    );
  };

  renderStickyHeader = () => {
    const stickyOp = this.scrollY.interpolate({
      inputRange: [HEADER_REVEAL_START, HEADER_REVEAL_END],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
    const stickyY = this.scrollY.interpolate({
      inputRange: [HEADER_REVEAL_START, HEADER_REVEAL_END],
      outputRange: [-10, 0],
      extrapolate: 'clamp',
    });
    return (
      <Animated.View style={[$.stickyHdr, { opacity: stickyOp, transform: [{ translateY: stickyY }] }]} pointerEvents="box-none">
        <SafeAreaView edges={['top']} style={$.stickySafe}>
          <View style={$.stickyRow}>
            <TouchableOpacity onPress={this.goBack} activeOpacity={0.8} hitSlop={HIT} style={$.stickyBack}>
              <Image source={I.back} style={$.stickyBackIco} />
            </TouchableOpacity>
            <View style={$.stickyProfile}>
              <View style={$.stickyAvatar}>
                <Image source={I.plant} style={$.stickyAvatarImg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={$.stickyTitle} numberOfLines={1}>मिट्टी जांच</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Animated.View>
    );
  };

  renderFixedBanner = () => {
    const { pageData, heroImgFailed } = this.state;
    const bannerUri = pageData?.banner?.image
      || pageData?.banner?.url
      || (typeof pageData?.banner === 'string' ? pageData.banner : null)
      || pageData?.banner_image
      || pageData?.hero_image;
    const showBanner = !!bannerUri && !heroImgFailed;
    const bannerH = this.scrollY.interpolate({
      inputRange: [0, COLLAPSE_DIST],
      outputRange: [BANNER_FULL, 0],
      extrapolate: 'clamp',
    });
    const bannerOp = this.scrollY.interpolate({
      inputRange: [0, COLLAPSE_DIST * 0.5, COLLAPSE_DIST],
      outputRange: [1, 0.5, 0],
      extrapolate: 'clamp',
    });
    // Pull-to-zoom on overscroll for a premium feel (iOS bounce).
    const bannerScale = this.scrollY.interpolate({
      inputRange: [-160, 0],
      outputRange: [1.18, 1],
      extrapolateLeft: 'extend',
      extrapolateRight: 'clamp',
    });

    return (
      <Animated.View style={[$.bannerFixed, { height: bannerH }]} pointerEvents="none">
        <Animated.View style={[$.bannerImgWrap, { opacity: bannerOp, transform: [{ scale: bannerScale }] }]}>
          {showBanner ? (
            <CachedImage
              source={{ uri: bannerUri }}
              style={$.bannerImgFill}
              resizeMode="cover"
              onError={() => this.setState({ heroImgFailed: true })}
            />
          ) : (
            <View style={[$.bannerImgFill, { backgroundColor: '#0d2818' }]} />
          )}
        </Animated.View>
      </Animated.View>
    );
  };

  renderFloatingBack = () => {
    const backOp = this.scrollY.interpolate({
      inputRange: [0, Math.round(COLLAPSE_DIST * 0.32)],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    return (
      <Animated.View style={[$.floatBack, { opacity: backOp }]} pointerEvents="box-none">
        <SafeAreaView edges={['top']} pointerEvents="box-none">
          <TouchableOpacity onPress={this.goBack} activeOpacity={0.85} hitSlop={HIT} style={$.backBtn}>
            <Image source={I.back} style={$.backIcoDark} />
          </TouchableOpacity>
        </SafeAreaView>
      </Animated.View>
    );
  };

  sectionCard = (icon, title, tint, body, { sub, right, delay = 0, noTint = false, style, sectionKey } = {}) => {
    const hi = sectionKey && this.state.highlightField === sectionKey;
    const addrHi = sectionKey === 'address' && ['pin', 'state', 'district', 'addr', 'po'].includes(this.state.highlightField);
    const highlighted = hi || addrHi;
    return (
      <Animatable.View
        ref={(r) => { if (sectionKey) this.sectionRefs[sectionKey] = r; }}
        onLayout={sectionKey ? (e) => { this.sectionYs[sectionKey] = e.nativeEvent.layout.y; } : undefined}
        animation="fadeInUp"
        duration={340}
        delay={delay}
        useNativeDriver
        style={[$.section, style, highlighted && $.sectionHighlight]}
      >
      <View style={$.secHead}>
        <View style={[$.secIco, { backgroundColor: tint + '1A' }]}>
          <Image source={icon} style={[$.secIcoImg, !noTint && { tintColor: tint }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={$.secTitle}>{title}</Text>
          {!!sub && <Text style={$.secSub}>{sub}</Text>}
        </View>
        {right}
      </View>
      {body}
    </Animatable.View>
    );
  };

  renderPackages = () => {
    const { packages, selectedPackageId, qty } = this.state;
    const popularId = packages.length > 1
      ? packages.reduce((best, p) => (Number(p.price) > Number(best?.price || 0) ? p : best), null)?.id
      : null;
    const minusOff = Number(qty) <= 1;
    return (
      <View style={$.gap10}>
        {packages.map((pkg) => {
          const sel = String(selectedPackageId) === String(pkg.id);
          const params = Array.isArray(pkg.parameters) ? pkg.parameters : [];
          const n = params.length;
          const isPop = String(pkg.id) === String(popularId);
          const typeKey = String(pkg.type || pkg.name || '').toUpperCase();
          const selBg = PKG_SEL_BG[typeKey] || PKG_SEL_BG.BASIC;
          const lineTotal = (Number(pkg.price) || 0) * Math.max(1, Number(qty) || 1);
          return (
            <Animatable.View key={String(pkg.id)} ref={(r) => { this.pkgRefs[pkg.id] = r; }}>
              <Pressable onPress={() => this.selectPackage(pkg.id)}
                style={({ pressed }) => [
                  $.pkgCard,
                  sel && { backgroundColor: selBg, borderColor: PAY_GREEN, borderWidth: 1.5 },
                  pressed && { opacity: 0.92 },
                ]}>
                <View style={$.pkgBody}>
                  <View style={$.pkgTopRow}>
                    <Text style={[$.pkgName, sel && $.pkgNameSel]}>{pkg.name || pkg.type}</Text>
                    {isPop && <View style={[$.popBadge, sel && $.popBadgeSel]}><Text style={$.popBadgeT}>Popular</Text></View>}
                    <View style={{ flex: 1 }} />
                    <Text style={[$.pkgPrice, sel && $.pkgPriceSel]}>₹{pkg.price || 0}</Text>
                    <View style={[$.pkgRadio, sel && $.pkgRadioOn]}>
                      {sel && <Image source={I.check} style={$.pkgCheck} />}
                    </View>
                  </View>

                  {n > 0 && (
                    <View style={$.chipRow}>
                      {params.slice(0, 6).map((p, j) => (
                        <View key={j} style={[$.paramChip, sel && $.paramChipSel]}>
                          <Text style={[$.paramChipT, sel && $.paramChipTSel]} numberOfLines={1}>{paramShort(p.name)}</Text>
                        </View>
                      ))}
                      {n > 6 && (
                        <View style={[$.paramChip, sel && $.paramChipSel]}>
                          <Text style={[$.paramChipT, sel && $.paramChipTSel]}>+{n - 6}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {sel && (
                    <View style={$.pkgQtyInCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={$.pkgQtyLblSel}>Kitne samples?</Text>
                        <Text style={$.pkgQtyHintSel}>₹{pkg.price || 0} × {qty} = ₹{lineTotal.toLocaleString('en-IN')}</Text>
                      </View>
                      <View style={$.qtyCtrl}>
                        <TouchableOpacity style={[$.qtyBtn, $.qtyBtnSel, minusOff && $.qtyBtnDim]} disabled={minusOff}
                          onPress={() => this.setQty(String(Math.max(1, Number(qty) - 1)))}>
                          <Text style={[$.qtySign, $.qtySignSel, minusOff && { opacity: 0.4 }]}>−</Text>
                        </TouchableOpacity>
                        <Animatable.Text key={qty} animation="fadeIn" duration={140} useNativeDriver style={$.qtyValSel}>{qty}</Animatable.Text>
                        <TouchableOpacity style={[$.qtyBtn, $.qtyBtnSelAdd]} onPress={() => this.setQty(String(Number(qty || 1) + 1))}>
                          <Text style={[$.qtySign, $.qtySignSel]}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </Pressable>
            </Animatable.View>
          );
        })}
      </View>
    );
  };

  renderPayments = () => {
    const { paymentMode, paymentMethods } = this.state;
    const methods = paymentMethods.length > 0
      ? paymentMethods
      : activePayments(this.state.pageData?.paymentMethods);
    const payList = methods.length > 0
      ? methods
      : [{ code: 'cash_on_delivery', name: 'Cash On Delivery', icon: null }];
    return (
      <View onLayout={(e) => { this.paymentY = e.nativeEvent.layout.y; }} style={$.payList}>
        {payList.map((m, i) => {
          const sel = paymentMode === m.code;
          return (
            <Pressable
              key={m.code || m.id}
              onPress={() => this.selectPayment(m.code)}
              style={({ pressed }) => [$.payRowItem, sel && $.payRowItemOn, pressed && { opacity: 0.9 }]}
            >
              <View style={$.payRowIco}>
                {m.icon ? (
                  <CachedImage source={{ uri: m.icon }} style={$.payRowImg} resizeMode="cover" />
                ) : (
                  <View style={$.payRowFbWrap}>
                    <Image source={isCod(m.code) ? I.truck : I.wallet} style={$.payRowFb} />
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[$.payRowName, sel && $.payRowNameOn]}>{m.name || payShortLabel(m.code, m.name)}</Text>
                {!!m.description && <Text style={$.payRowDesc} numberOfLines={1}>{m.description}</Text>}
                {!!m.discount && <Text style={$.payRowDisc}>{m.discount}</Text>}
              </View>
              <View style={[$.payRowCircle, sel && $.payRowCircleOn]}>
                {sel && <Image source={I.tick} style={$.payRowTick} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  };

  renderFarmer = () => {
    const { selectedFarmer, highlightField } = this.state;
    const farmerHi = highlightField === 'farmer';
    if (!isValidFarmer(selectedFarmer)) {
      return (
        <Pressable onPress={this.openSelectFarmer} style={({ pressed }) => [$.farmerEmpty, farmerHi && $.fieldHighlight, pressed && { opacity: 0.85 }]}>
          <View style={$.farmerAddIco}>
            <Image source={I.farmerNew} style={$.farmerAddImg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={$.farmerEmptyT}>Farmer chunein</Text>
          </View>
          <View style={$.chevPill}><Image source={I.arrow} style={$.chevPillIco} /></View>
        </Pressable>
      );
    }
    const name = farmerName(selectedFarmer);
    const phone = farmerPhone(selectedFarmer);
    const village = farmerVillage(selectedFarmer);
    return (
      <Pressable onPress={this.openSelectFarmer} style={({ pressed }) => [$.farmerCard, pressed && { opacity: 0.9 }]}>
        <View style={$.avatar}><Text style={$.avatarT}>{initials(name)}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={$.farmerName} numberOfLines={1}>{name}</Text>
          {!!phone && <Text style={$.farmerMeta}>📱 {phone}</Text>}
          {!!village && <Text style={$.farmerMeta} numberOfLines={1}>{village}</Text>}
        </View>
        <View style={$.changePill}>
          <Image source={I.edit} style={$.changeIco} />
          <Text style={$.changePillT}>Badlein</Text>
        </View>
      </Pressable>
    );
  };

  field = (label, node, key) => {
    const err = key && this.state.highlightField === key;
    return (
      <View style={$.field} onLayout={key ? (e) => { this.fieldYs[key] = e.nativeEvent.layout.y; } : undefined}>
        <Text style={[$.fieldLbl, err && $.fieldLblErr]}>{label}{err ? ' *' : ''}</Text>
        {node}
      </View>
    );
  };

  renderAddress = () => {
    const { locating, fetchingPO, pincode, state, district, fullAddress, postOffice, postOffices, showPOPicker, focusedField, highlightField } = this.state;
    const inpStyle = (n) => {
      if (highlightField === n) return $.inpError;
      if (focusedField === n) return $.inpFocus;
      return null;
    };
    const detected = !!state.trim() && !!district.trim();
    return (
      <View>
        {this.field('PIN code', (
          <View style={[$.inp, inpStyle('pin')]}>
            <Image source={I.pin} style={$.inpIco} />
            <TextInput style={$.inpTxt} value={pincode} onChangeText={this.onPincodeChange}
              onFocus={() => this.onFieldFocus('pin')} onBlur={() => this.setState({ focusedField: null })}
              placeholder="6 digit PIN daalein" placeholderTextColor={S.MUTED} keyboardType="number-pad" maxLength={6} />
            {locating || fetchingPO ? (
              <View style={$.autoBtn}><ActivityIndicator color="#FFF" size="small" /></View>
            ) : (
              <TouchableOpacity onPress={() => this.prefillLocation()} hitSlop={HIT} style={$.autoBtn} activeOpacity={0.85}>
                <Image source={I.gps} style={$.autoBtnIco} />
                <Text style={$.autoBtnTxt}>Auto</Text>
              </TouchableOpacity>
            )}
          </View>
        ), 'pin')}

        {detected && (
          <Animatable.View animation="fadeIn" duration={220} useNativeDriver style={$.detectedRow}>
            <Image source={I.check} style={$.detectedIco} />
            <Text style={$.detectedTxt} numberOfLines={1}>{district}, {state}</Text>
          </Animatable.View>
        )}

        <View style={$.row2}>
          <View style={{ flex: 1, marginRight: 10 }}>
            {this.field('State', (
              <View style={[$.inp, inpStyle('state')]}>
                <TextInput style={$.inpTxt} value={state} onChangeText={(v) => this.setState({ state: v })}
                  onFocus={() => this.onFieldFocus('state')} onBlur={() => this.setState({ focusedField: null })}
                  placeholder="State" placeholderTextColor={S.MUTED} />
              </View>
            ), 'state')}
          </View>
          <View style={{ flex: 1 }}>
            {this.field('District', (
              <View style={[$.inp, inpStyle('district')]}>
                <TextInput style={$.inpTxt} value={district} onChangeText={(v) => this.setState({ district: v })}
                  onFocus={() => this.onFieldFocus('district')} onBlur={() => this.setState({ focusedField: null })}
                  placeholder="District" placeholderTextColor={S.MUTED} />
              </View>
            ), 'district')}
          </View>
        </View>

        {this.field('Pura address', (
          <View style={[$.inp, $.inpMulti, inpStyle('addr')]}>
            <TextInput style={[$.inpTxt, $.inpMultiTxt]} value={fullAddress} onChangeText={(v) => this.setState({ fullAddress: v })}
              onFocus={() => this.onFieldFocus('addr')} onBlur={() => this.setState({ focusedField: null })}
              placeholder="Ghar, street, landmark" placeholderTextColor={S.MUTED} multiline />
          </View>
        ), 'addr')}

        {this.field('Post office', (
          <>
            <TouchableOpacity activeOpacity={0.8} style={[$.inp, inpStyle('po') || (showPOPicker && $.inpFocus)]}
              onPress={() => {
                if (highlightField === 'po') this.clearHighlight();
                if (postOffices.length === 0 && pincode.length === 6) this.fetchPostOffice(pincode);
                LayoutAnimation.configureNext(EASE);
                this.setState((p) => ({ showPOPicker: !p.showPOPicker }));
              }}>
              <Text style={[$.inpTxt, !postOffice && { color: S.MUTED }]} numberOfLines={1}>{postOffice || 'Post office chunein'}</Text>
              <Image source={I.down} style={[$.chev, showPOPicker && { transform: [{ rotate: '180deg' }] }]} />
            </TouchableOpacity>
            {showPOPicker && (
              <Animatable.View animation="fadeInDown" duration={200} useNativeDriver style={$.poList}>
                {postOffices.length === 0 ? (
                  <View style={$.poEmpty}><Text style={$.poEmptyT}>PIN daalein ya Auto dabayein</Text></View>
                ) : postOffices.map((po, i) => {
                  const sel = postOffice === po.name;
                  return (
                    <TouchableOpacity key={`${po.id}-${i}`} style={[$.poItem, i > 0 && $.poDiv, sel && $.poSel]}
                      onPress={() => { LayoutAnimation.configureNext(EASE); this.setState({ postOffice: po.name, showPOPicker: false }); }}>
                      <Text style={[$.poTxt, sel && $.poTxtSel]} numberOfLines={1}>{po.name}</Text>
                      {sel && <Image source={I.tick} style={$.poTick} />}
                    </TouchableOpacity>
                  );
                })}
              </Animatable.View>
            )}
          </>
        ), 'po')}
      </View>
    );
  };

  openCalendar = () => {
    const { dateObj } = this.state;
    const minDate = moment().add(1, 'day');
    const m = moment(dateObj).isBefore(minDate) ? minDate : moment(dateObj);
    this.setState({
      showDatePicker: true,
      calStep: 'date',
      calMonth: m.clone().startOf('month'),
      calDay: m.date(),
      calHour: Number(m.format('h')),
      calMinute: nearestMinute(m.minute()),
      calAmPm: m.format('A'),
      calPicked: true,
    });
  };

  selectCalDay = (day) => {
    LayoutAnimation.configureNext(EASE);
    this.setState({ calDay: day, calPicked: true, calStep: 'time' });
  };

  backToCalDate = () => {
    LayoutAnimation.configureNext(EASE);
    this.setState({ calStep: 'date' });
  };

  closeCalendar = () => {
    this.calSheetRef?.close?.();
  };

  onCalendarClosed = () => {
    this.setState({ showDatePicker: false, calStep: 'date' });
  };

  shiftCalMonth = (dir) => {
    this.setState((p) => ({ calMonth: moment(p.calMonth).add(dir, 'month') }));
  };

  onCalTimeWheelChange = (date) => {
    const m = moment(date);
    this.setState({
      calHour: Number(m.format('h')),
      calMinute: nearestMinute(m.minute()),
      calAmPm: m.format('A'),
    });
  };

  confirmCalendar = () => {
    const { calMonth, calDay, calHour, calMinute, calAmPm } = this.state;
    if (!calMonth || !calDay) return;
    const h24 = to24Hour(calHour, calAmPm);
    const picked = moment(calMonth).date(calDay).hour(h24).minute(calMinute).second(0).millisecond(0);
    if (picked.isBefore(moment().add(30, 'minutes'))) {
      Toast.show('Future date/time chunein', Toast.SHORT);
      return;
    }
    this.setState({ dateObj: picked.toDate() });
    this.closeCalendar();
  };

  renderCalDateStep = () => {
    const { calMonth, calDay } = this.state;
    const cells = calendarCells(calMonth);
    const today = moment().startOf('day');
    const minDay = moment().add(1, 'day').startOf('day');
    const selLbl = calDay ? moment(calMonth).date(calDay).format('ddd, DD MMM') : null;

    return (
      <View style={$.calStepBody}>
        <View style={$.calMonthRow}>
          <TouchableOpacity onPress={() => this.shiftCalMonth(-1)} style={$.calNavBtn} hitSlop={HIT}>
            <Image source={I.arrow} style={[$.calNavIco, { transform: [{ rotate: '180deg' }] }]} />
          </TouchableOpacity>
          <Text style={$.calMonthLbl}>{calMonth.format('MMMM YYYY')}</Text>
          <TouchableOpacity onPress={() => this.shiftCalMonth(1)} style={$.calNavBtn} hitSlop={HIT}>
            <Image source={I.arrow} style={$.calNavIco} />
          </TouchableOpacity>
        </View>

        <View style={$.calGridCard}>
          <View style={$.calWeekRow}>
            {WEEK_DAYS.map((d) => <Text key={d} style={$.calWeekCell}>{d}</Text>)}
          </View>
          <View style={$.calWeekDivider} />

          <View style={$.calGrid}>
            {cells.map((day, i) => {
              if (!day) return <View key={`e-${i}`} style={$.calDayWrap} />;
              const dayDate = moment(calMonth).date(day).startOf('day');
              const disabled = dayDate.isBefore(minDay);
              const isToday = dayDate.isSame(today, 'day');
              const sel = calDay === day;
              return (
                <View key={`d-${day}`} style={$.calDayWrap}>
                  <TouchableOpacity
                    disabled={disabled}
                    style={[
                      $.calDayBox,
                      !disabled && !sel && $.calDayAvail,
                      isToday && !sel && $.calDayToday,
                      sel && $.calDaySel,
                      disabled && $.calDayOff,
                    ]}
                    onPress={() => this.selectCalDay(day)}
                    activeOpacity={0.82}
                  >
                    <Text style={[$.calDayT, sel && $.calDayTSel, disabled && $.calDayTOff]}>{day}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {selLbl ? (
          <View style={$.calSelChip}>
            <Image source={I.calendar} style={$.calSelChipIco} />
            <Text style={$.calSelChipT}>{selLbl} · time agle step mein</Text>
          </View>
        ) : (
          <Text style={$.calHint}>Date par tap karein</Text>
        )}
      </View>
    );
  };

  renderCalTimeStep = () => {
    const { calDay, calMonth, calHour, calMinute, calAmPm } = this.state;
    if (!calDay || !calMonth) return null;
    const h24 = to24Hour(calHour, calAmPm);
    const dateLbl = moment(calMonth).date(calDay).format('ddd, DD MMM YYYY');
    const timeLbl = format12(h24, calMinute);
    const confirmLbl = `Confirm · ${timeLbl}`;
    const wheelDate = buildCalDateTime(calMonth, calDay, calHour, calMinute, calAmPm);
    const QUICK = [
      { label: 'Subah', sub: '10:00 AM', h: 10, m: 0, ap: 'AM' },
      { label: 'Dopahar', sub: '2:00 PM', h: 2, m: 0, ap: 'PM' },
      { label: 'Shaam', sub: '5:00 PM', h: 5, m: 0, ap: 'PM' },
    ];

    return (
      <View style={$.calTimeLayout}>
        <TouchableOpacity style={$.calDatePill} onPress={this.backToCalDate} activeOpacity={0.85}>
          <Image source={I.calendar} style={$.calDatePillIco} />
          <Text style={$.calDatePillT} numberOfLines={1}>{dateLbl}</Text>
          <Text style={$.calDatePillEdit}>Badlein</Text>
        </TouchableOpacity>

        <View style={$.calWheelCenter}>
          <DatePicker
            date={wheelDate}
            onDateChange={this.onCalTimeWheelChange}
            mode="time"
            locale="en"
            minuteInterval={5}
            theme="light"
            title={null}
            style={$.calWheelPicker}
          />
        </View>

        <View style={$.calTimeFooter}>
          <Text style={$.calTimeLbl}>Jaldi chunein</Text>
          <View style={$.calQuickRow}>
            {QUICK.map((q) => {
              const on = calHour === q.h && calMinute === q.m && calAmPm === q.ap;
              return (
                <TouchableOpacity
                  key={q.label}
                  style={[$.calQuickChip, on && $.calQuickChipOn]}
                  activeOpacity={0.85}
                  onPress={() => this.setState({ calHour: q.h, calMinute: q.m, calAmPm: q.ap })}
                >
                  <Text style={[$.calQuickChipT, on && $.calQuickChipTOn]}>{q.label}</Text>
                  <Text style={[$.calQuickChipS, on && $.calQuickChipSOn]}>{q.sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={$.calConfirm} activeOpacity={0.88} onPress={this.confirmCalendar}>
            <Text style={$.calConfirmT}>{confirmLbl}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  renderCalendarModal = () => {
    const { showDatePicker, calMonth, calStep } = this.state;
    if (!calMonth) return null;
    const isTime = calStep === 'time';
    const rows = calGridRows(calMonth);
    const dateSheetH = 210 + rows * (CAL_CELL_H + CAL_GAP) + 56 + SAFE_BOTTOM;
    const timeSheetH = 130 + 48 + CAL_WHEEL_H + 120 + 52 + 36 + SAFE_BOTTOM;
    const sheetMax = isTime
      ? Math.max(timeSheetH, Math.round(H * 0.72))
      : Math.max(Math.round(H * 0.62), Math.min(dateSheetH, Math.round(H * 0.82)));

    return (
      <BottomSheet
        ref={(r) => { this.calSheetRef = r; }}
        visible={showDatePicker}
        dynamicSize
        maxDynamicContentSize={sheetMax}
        enableContentPanningGesture={!isTime}
        onSheetClose={this.onCalendarClosed}
      >
        <View style={[$.calSheetInner, { paddingBottom: (isTime ? 36 : 24) + SAFE_BOTTOM }]}>
          <View style={$.calTopBand}>
            {isTime ? (
              <TouchableOpacity onPress={this.backToCalDate} style={$.calBackBtn} hitSlop={HIT}>
                <Image source={I.back} style={$.calBackIco} />
              </TouchableOpacity>
            ) : (
              <View style={$.calStepDot}><Text style={$.calStepDotT}>1</Text></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={$.calTitle}>{isTime ? 'Pickup time' : 'Pickup date'}</Text>
              <Text style={$.calSub}>
                {isTime ? 'Sample pickup ka time chunein' : 'Kal ya uske baad ki date chunein'}
              </Text>
            </View>
            <TouchableOpacity onPress={this.closeCalendar} style={$.calClose} hitSlop={HIT}>
              <Image source={I.close} style={$.calCloseIco} />
            </TouchableOpacity>
          </View>

          <View style={$.calStepBar}>
            <View style={[$.calStepSeg, !isTime && $.calStepSegOn]} />
            <View style={[$.calStepSeg, isTime && $.calStepSegOn]} />
          </View>

          {isTime ? this.renderCalTimeStep() : this.renderCalDateStep()}
        </View>
      </BottomSheet>
    );
  };

  renderSchedule = () => {
    const { dateObj, highlightField } = this.state;
    const dateHi = highlightField === 'date';
    return (
      <TouchableOpacity style={[$.dateCard, dateHi && $.fieldHighlight]} activeOpacity={0.85} onPress={() => { if (dateHi) this.clearHighlight(); this.openCalendar(); }}>
        <View style={[$.dateIco, { backgroundColor: S.BLUE_BG }]}>
          <Image source={I.calendar} style={$.dateIcoImg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={$.dateLbl}>{moment(dateObj).format('DD MMM YYYY')} · {moment(dateObj).format('hh:mm A')}</Text>
        </View>
        <View style={$.chevPill}><Image source={I.arrow} style={$.chevPillIco} /></View>
      </TouchableOpacity>
    );
  };

  renderJaankari = () => {
    const { pageData, packages, jaankariOpen, failedImgs } = this.state;
    if (!pageData) return null;
    const steps = pageData.scientific_steps;
    const guarantee = pageData.gramikGuarantee;
    const howTo = pageData.how_to_collect_sample;
    const video = pageData.video;
    const cta = pageData.cta;
    const support = pageData.support;

    return (
      <View style={$.section} onLayout={(e) => { this.jaankariY = e.nativeEvent.layout.y; }}>
        <TouchableOpacity style={$.jHead} activeOpacity={0.75} onPress={this.toggleJaankari}>
          <View style={[$.secIco, { backgroundColor: S.P_SOFT }]}>
            <Image source={I.help} style={[$.secIcoImg, { tintColor: S.P }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={$.secTitle}>Jaankari</Text>
          </View>
          <View style={[$.chevPill, jaankariOpen && { backgroundColor: S.P_SOFT }]}>
            <Image source={I.down} style={[$.chevPillIco, jaankariOpen && { tintColor: S.P, transform: [{ rotate: '180deg' }] }]} />
          </View>
        </TouchableOpacity>

        {jaankariOpen && (
          <Animatable.View animation="fadeIn" duration={220} useNativeDriver style={$.jBody}>
            {cta && (
              <View style={$.ctaBox}>
                {!!cta.image && !failedImgs.cta && (
                  <CachedImage source={{ uri: cta.image }} style={$.ctaImg} resizeMode="cover" onError={() => this.markImgFailed('cta')} />
                )}
                <View style={{ flex: 1 }}>
                  {!!cta.total_reports_generated && <Text style={$.ctaCount}>{cta.total_reports_generated} reports</Text>}
                  {!!cta.message && <Text style={$.ctaMsg}>{cta.message}</Text>}
                </View>
              </View>
            )}

            {Array.isArray(steps) && steps.length > 0 && (
              <View style={$.jBlock}>
                <Text style={$.blockTitle}>Process</Text>
                {steps.map((s, i) => (
                  <View key={i} style={$.stepRow}>
                    <View style={$.stepNum}><Text style={$.stepNumT}>{i + 1}</Text></View>
                    <Text style={$.stepTxt}>{s}</Text>
                  </View>
                ))}
              </View>
            )}

            {Array.isArray(guarantee) && guarantee.length > 0 && (
              <View style={$.jBlock}>
                <Text style={$.blockTitle}>Gramik guarantee</Text>
                <View style={$.guarRow}>
                  {guarantee.map((g, i) => {
                    const guarBg = TILE_BG[i % TILE_BG.length];
                    return (
                      <View key={i} style={$.guarCard}>
                        <View style={[$.guarIco, { backgroundColor: guarBg }]}>
                          {!failedImgs[`guar-${i}`] && g.image ? (
                            <CachedImage source={{ uri: g.image }} style={$.guarImg} resizeMode="cover" onError={() => this.markImgFailed(`guar-${i}`)} />
                          ) : (
                            <Text style={$.guarEmoji}>{GUARANTEE_EMOJI[i % GUARANTEE_EMOJI.length]}</Text>
                          )}
                        </View>
                        <Text style={$.guarTxt} numberOfLines={3}>{g.title}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {Array.isArray(howTo) && howTo.length > 0 && (
              <View style={$.jBlock}>
                <Text style={$.blockTitle}>Sample kaise lein</Text>
                {howTo.map((item, i) => {
                  const step = item?.step || item;
                  return (
                    <View key={i} style={$.howCard}>
                      <Text style={$.howTitle}>{i + 1}. {step.title}</Text>
                      {Array.isArray(step.description) && step.description.map((d, j) => (
                        <Text key={j} style={$.howBody}>{d}</Text>
                      ))}
                    </View>
                  );
                })}
              </View>
            )}

            {!!video?.youtube_id && this.renderVideoBlock(video)}

            {packages.length > 0 && (
              <View style={$.jBlock}>
                <Text style={$.blockTitle}>Package detail</Text>
                {packages.map((pkg) => {
                  const ps = pkgStyle(pkg.type);
                  const params = Array.isArray(pkg.parameters) ? pkg.parameters : [];
                  return (
                    <View key={pkg.id} style={[$.pkgDetail, { borderColor: ps.border }]}>
                      <View style={$.pkgDetailHead}>
                        <View style={[$.pkgTag, { backgroundColor: ps.fill }]}><Text style={$.pkgTagT}>{pkg.name || pkg.type}</Text></View>
                        <Text style={[$.pkgPrice, { color: ps.color }]}>₹{pkg.price}</Text>
                      </View>
                      {params.map((p, j) => (
                        <View key={j} style={$.paramRow}>
                          <Text style={$.paramName}>{p.name}</Text>
                          <View style={{ alignItems: 'flex-end' }}>
                            {!!p.value && <Text style={$.paramVal}>{p.value}{p.unit ? ` ${p.unit}` : ''}</Text>}
                            {!!p.range && (
                              <View style={[$.paramRange, { backgroundColor: ps.accent }]}>
                                <Text style={[$.paramRangeT, { color: ps.color }]}>{p.range}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            )}

            {support?.enabled && (
              <View style={$.supportRow}>
                {!!support.phone && (
                  <TouchableOpacity style={[$.supportBtn, { backgroundColor: S.BLUE_BG }]} onPress={() => this.openLink(`tel:${support.phone}`)}>
                    <Image source={I.call} style={[$.supportIco, { tintColor: S.BLUE }]} />
                    <Text style={[$.supportTxt, { color: S.BLUE }]}>{support.phone}</Text>
                  </TouchableOpacity>
                )}
                {!!support.whatsapp && (
                  <TouchableOpacity style={[$.supportBtn, { backgroundColor: S.GREEN_BG }]} onPress={() => this.openLink(`https://wa.me/91${support.whatsapp}`)}>
                    <Image source={I.whatsapp} style={[$.supportIco, { tintColor: S.GREEN_DARK }]} />
                    <Text style={[$.supportTxt, { color: S.GREEN_DARK }]}>WhatsApp</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Animatable.View>
        )}
      </View>
    );
  };

  renderVideoBlock = (video) => {
    const id = video.youtube_id;
    const thumb = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    return (
      <TouchableOpacity
        style={$.videoPreview}
        activeOpacity={0.9}
        onPress={() => this.setState({ showVideo: true, videoId: id, videoTitle: video.title || '' })}
      >
        <CachedImage source={{ uri: thumb }} style={$.videoThumb} resizeMode="cover" />
        <View style={$.videoOverlay} />
        <View style={$.videoPlayCenter}>
          <View style={$.videoPlayBtn}>
            <Image source={I.play} style={$.videoPlayIc} />
          </View>
        </View>
        <View style={$.videoCaption}>
          <Text style={$.videoCaptionT} numberOfLines={2}>{video.title}</Text>
          <Text style={$.videoCaptionS}>Video dekhein</Text>
        </View>
      </TouchableOpacity>
    );
  };

  renderVideoModal = () => {
    const { showVideo, videoId, videoTitle } = this.state;
    if (!videoId) return null;
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0`;
    return (
      <Modal visible={showVideo} animationType="slide" onRequestClose={() => this.setState({ showVideo: false })}>
        <View style={$.videoModal}>
          <SafeAreaView edges={['top']} style={$.videoModalHdr}>
            <Text style={$.videoModalTitle} numberOfLines={1}>{videoTitle || 'Video'}</Text>
            <TouchableOpacity onPress={() => this.setState({ showVideo: false })} style={$.videoClose} hitSlop={HIT}>
              <Image source={I.close} style={$.videoCloseIco} />
            </TouchableOpacity>
          </SafeAreaView>
          <WebView
            source={{ uri: embedUrl }}
            style={{ flex: 1, backgroundColor: '#000' }}
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
          />
        </View>
      </Modal>
    );
  };

  renderPaymentResult = () => {
    const { paymentResult } = this.state;
    if (!paymentResult) return null;
    const ok = paymentResult.success;
    const orderId = paymentResult.orderId;
    const accent = ok ? PAY_GREEN : S.RED;
    const accentBg = ok ? S.GREEN_BG : S.RED_BG;
    return (
      <Modal visible animationType="fade" statusBarTranslucent transparent onRequestClose={this.onPaymentResultBack}>
        <View style={$.payResultRoot}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
          <SafeAreaView edges={['top', 'bottom']} style={$.payResultSafe}>
            <View style={$.payResultHdr}>
              <TouchableOpacity style={$.payResultBack} onPress={this.onPaymentResultBack} hitSlop={HIT}>
                <Image source={I.back} style={$.payResultBackIco} />
              </TouchableOpacity>
              <Text style={$.payResultHdrT}>{ok ? 'Order confirm' : 'Payment failed'}</Text>
              <View style={$.payResultHdrSp} />
            </View>

            <View style={$.payResultBody}>
              <Animatable.View animation="zoomIn" duration={420} useNativeDriver style={[$.payResultCard, { borderColor: accent }]}>
                <View style={[$.payResultRing, { backgroundColor: accentBg }]}>
                  <View style={[$.payResultCircle, { backgroundColor: accent }]}>
                    <Image source={ok ? I.tick : I.close} style={$.payResultIco} />
                  </View>
                </View>
                <Text style={$.payResultTitle}>{ok ? 'Order placed!' : 'Payment failed'}</Text>
                <Text style={$.payResultSub}>
                  {ok
                    ? 'Aapka soil test order confirm ho gaya. Order detail par le ja rahe hain...'
                    : 'Payment complete nahi hui. Dubara try kar sakte hain.'}
                </Text>
                {!!orderId && (
                  <View style={$.payResultIdPill}>
                    <Text style={$.payResultId}>Order #{orderId}</Text>
                  </View>
                )}
                <View style={$.payResultRedirect}>
                  <ActivityIndicator size="small" color={accent} />
                  <Text style={[$.payResultRedirectT, { color: accent }]}>
                    {ok ? 'Order detail khul rahi hai...' : 'Wapas ja rahe hain...'}
                  </Text>
                </View>
              </Animatable.View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    );
  };

  renderFooter = () => {
    const { submitting, paymentMode, paymentMethods } = this.state;
    const total = this.state.displayTotal.toLocaleString('en-IN');
    const methods = paymentMethods.length > 0
      ? paymentMethods
      : activePayments(this.state.pageData?.paymentMethods);
    const payList = methods.length > 0
      ? methods
      : [{ code: 'cash_on_delivery', name: 'Cash On Delivery', icon: null }];
    const selPay = payList.find((x) => x.code === paymentMode) || payList[0];
    const payIcon = selPay?.icon;
    const shortLbl = payShortLabel(paymentMode, selPay?.name);
    const disc = selPay?.discount;
    const cod = isCod(paymentMode);
    const btnLabel = cod ? 'Order Karien' : `Pay ₹${total}`;

    return (
      <View style={[$.footerWrap, { paddingBottom: FOOTER_BOTTOM }]}>
        <View style={$.footerRow}>
          <TouchableOpacity style={$.payViaBox} activeOpacity={0.85} onPress={this.scrollToPayment}>
            <View style={$.payViaRow}>
              <View style={$.payViaIco}>
                {payIcon ? (
                  <CachedImage source={{ uri: payIcon }} style={$.payViaImg} resizeMode="cover" />
                ) : (
                  <Image source={cod ? I.truck : I.wallet} style={$.payViaFb} />
                )}
              </View>
              <View style={$.payViaTextCol}>
                <Text style={$.payViaLbl}>Pay via</Text>
                <Text style={$.payViaName} numberOfLines={1}>{shortLbl}</Text>
              </View>
              <Image source={I.down} style={$.payViaChev} />
            </View>
          </TouchableOpacity>

          <Pressable
            onPress={this.submitOrder}
            disabled={submitting}
            style={({ pressed }) => [$.payNowBtn, submitting && $.payBtnBusy, pressed && !submitting && { opacity: 0.9 }]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <View style={$.payNowInner}>
                <Text style={$.payNowLbl} numberOfLines={1}>{btnLabel}</Text>
                {!!disc && !cod && (
                  <View style={$.payDiscBadge}><Text style={$.payDiscBadgeT}>{disc}</Text></View>
                )}
                <PayBtnArrow />
              </View>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  render() {
    const { loading, keyboardH } = this.state;
    const scrollPad = FOOTER_H + (keyboardH > 0 ? keyboardH - 20 : 4);
    return (
      <View style={$.root}>
        <NavigationEvents onDidFocus={this.applyFarmerFromNav} />
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {loading ? (
          <View style={$.loadingWrap}>
            <ActivityIndicator color={S.GREEN} size="large" />
            <Text style={$.loadingTxt}>Mitti jaanch load ho rahi hai...</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
            >
              {this.renderFixedBanner()}
              <Animated.ScrollView
                ref={(r) => { this.scrollRef = r; }}
                style={$.scrollView}
                contentContainerStyle={[$.scroll, {
                  paddingTop: BANNER_FULL - BANNER_OVERLAP + PKG_TOP_GAP,
                  paddingBottom: scrollPad,
                }]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                scrollEventThrottle={1}
                onScrollBeginDrag={this.onScrollBeginDrag}
                onScrollEndDrag={this.onScrollEndDrag}
                onMomentumScrollBegin={this.onMomentumScrollBegin}
                onMomentumScrollEnd={this.onMomentumScrollEnd}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { y: this.scrollY } } }],
                  { useNativeDriver: false },
                )}
              >
                <View style={$.sheet} onLayout={(e) => { this.sheetY = e.nativeEvent.layout.y; }}>
                  {this.sectionCard(I.package, 'Package chunein', S.GREEN, this.renderPackages(),
                    { delay: 40, noTint: true, style: $.pkgSection, sectionKey: 'package' })}

                  {this.sectionCard(I.farmer, 'Farmer', S.P, this.renderFarmer(), { delay: 80, noTint: true, sectionKey: 'farmer' })}

                  {this.sectionCard(I.location, 'Pickup ka address', S.ORANGE, this.renderAddress(), { delay: 120, noTint: true, sectionKey: 'address' })}

                  {this.sectionCard(I.calendar, 'Pickup date', S.BLUE, this.renderSchedule(), { delay: 160, noTint: true, sectionKey: 'date' })}

                  {this.sectionCard(I.wallet, 'Payment chunein', S.TEAL, this.renderPayments(), { delay: 200, noTint: true })}

                  {this.renderJaankari()}
                </View>
              </Animated.ScrollView>
              {this.renderFloatingBack()}
              {this.renderStickyHeader()}
            </KeyboardAvoidingView>
            {this.renderConfetti()}
            {this.renderFooter()}
            {this.renderVideoModal()}
            {this.renderCalendarModal()}
            {this.renderPaymentResult()}
          </View>
        )}

      </View>
    );
  }
}

const SHADOW = {
  shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
};
const CARD_BORDER = '#E8ECF1';
const SCREEN_BG = '#edf1f7';

const $ = StyleSheet.create({
  root: { flex: 1, backgroundColor: SCREEN_BG },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: SCREEN_BG },
  loadingTxt: { marginTop: 12, fontSize: 12.5, color: S.SUB, fontWeight: '500' },
  scroll: { backgroundColor: 'transparent' },
  confettiRoot: { ...StyleSheet.absoluteFillObject, zIndex: 200, elevation: 200 },
  confettiLayer: { ...StyleSheet.absoluteFillObject },

  stickyHdr: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, elevation: 50,
    backgroundColor: S.P,
  },
  stickySafe: { backgroundColor: S.P },
  stickyRow: { height: 56, paddingHorizontal: PAD, flexDirection: 'row', alignItems: 'center' },
  stickyBack: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  stickyBackIco: { width: 15, height: 15, resizeMode: 'contain', tintColor: '#FFF' },
  stickyProfile: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10, gap: 10 },
  stickyAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stickyAvatarImg: { width: 22, height: 22, resizeMode: 'contain' },
  stickyTitle: { fontSize: 14.5, fontWeight: '600', color: '#FFF' },

  // Banner sits BELOW the scroll content so the package card can float over it.
  bannerFixed: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1, overflow: 'hidden',
    backgroundColor: '#0d2818',
  },
  bannerImgWrap: { flex: 1, width: W, overflow: 'hidden', backgroundColor: '#0d2818' },
  bannerImgFill: { width: W, height: BANNER_FULL },
  scrollView: { flex: 1, backgroundColor: 'transparent', zIndex: 2 },
  floatBack: { position: 'absolute', top: 0, left: PAD, zIndex: 6, elevation: 6 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  backIcoDark: { width: 14, height: 14, resizeMode: 'contain', tintColor: S.TXT },

  sheet: {
    backgroundColor: 'transparent',
    paddingTop: 0, paddingHorizontal: PAD, gap: 8,
  },
  pkgSection: { zIndex: 12, elevation: 10, marginTop: 10, ...SHADOW },

  section: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 11, borderWidth: 1, borderColor: CARD_BORDER },
  sectionHighlight: { borderColor: '#EF4444', borderWidth: 2, backgroundColor: '#FFF8F8' },
  fieldHighlight: { borderColor: '#EF4444', borderWidth: 2, backgroundColor: '#FFF8F8' },
  gap10: { gap: 8 },
  gap12: { gap: 8 },
  secHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  secIco: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  secIcoImg: { width: 16, height: 16, resizeMode: 'contain' },
  secTitle: { fontSize: 13.5, fontWeight: '600', color: S.TXT },
  secSub: { fontSize: 11, color: S.SUB, marginTop: 1 },

  pkgCard: { borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 14, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  pkgBody: { padding: 12 },
  pkgTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pkgName: { fontSize: 14, fontWeight: '700', color: S.TXT },
  pkgNameSel: { color: '#FFFFFF' },
  pkgPrice: { fontSize: 15, fontWeight: '700', color: S.TXT, marginRight: 8 },
  pkgPriceSel: { color: '#FFFFFF' },
  pkgRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  pkgRadioOn: { borderColor: PAY_GREEN, backgroundColor: PAY_GREEN },
  pkgCheck: { width: 11, height: 11, resizeMode: 'contain', tintColor: '#FFF' },
  popBadge: { backgroundColor: S.GREEN_DARK, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, marginLeft: 6 },
  popBadgeSel: { backgroundColor: 'rgba(255,255,255,0.22)' },
  popBadgeT: { fontSize: 8, fontWeight: '700', color: '#FFF' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 6 },
  paramChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F1F5F9' },
  paramChipSel: { backgroundColor: 'rgba(255,255,255,0.18)' },
  paramChipT: { fontSize: 10, fontWeight: '600', color: '#64748B' },
  paramChipTSel: { color: '#FFFFFF' },
  pkgQtyInCard: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)',
  },
  pkgQtyLblSel: { fontSize: 12.5, fontWeight: '600', color: '#FFFFFF' },
  pkgQtyHintSel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  qtyBtnSel: { backgroundColor: 'rgba(255,255,255,0.2)' },
  qtyBtnSelAdd: { backgroundColor: PAY_GREEN },
  qtySignSel: { color: '#FFFFFF' },
  qtyValSel: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', minWidth: 22, textAlign: 'center' },

  farmerEmpty: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D7CCF7', borderStyle: 'dashed', borderRadius: 12, padding: 11, backgroundColor: S.P_TINT },
  farmerAddIco: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginRight: 10, overflow: 'hidden' },
  farmerAddImg: { width: 38, height: 38, resizeMode: 'contain' },
  farmerEmptyT: { fontSize: 13.5, fontWeight: '600', color: S.P },
  farmerCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D7CCF7', borderRadius: 12, padding: 11, backgroundColor: S.P_TINT },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: S.P, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatarT: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  farmerName: { fontSize: 13.5, fontWeight: '600', color: S.TXT },
  farmerMeta: { fontSize: 11, color: S.SUB, marginTop: 2 },
  changePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, backgroundColor: S.P },
  changeIco: { width: 10, height: 10, resizeMode: 'contain', tintColor: '#FFF', marginRight: 4 },
  changePillT: { fontSize: 11, fontWeight: '600', color: '#FFF' },

  field: { marginBottom: 7 },
  fieldLbl: { fontSize: 11.5, fontWeight: '500', color: S.SUB, marginBottom: 5 },
  fieldLblErr: { color: '#DC2626', fontWeight: '700' },
  fieldHint: { fontSize: 10.5, fontWeight: '400', color: S.MUTED },
  row2: { flexDirection: 'row' },
  inp: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 10, backgroundColor: '#FFFFFF', paddingHorizontal: 10, minHeight: 42 },
  inpFocus: { borderColor: S.ORANGE, backgroundColor: S.ORANGE_BG },
  inpError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2', borderWidth: 2 },
  inpMulti: { alignItems: 'flex-start', paddingVertical: 7 },
  inpIco: { width: 13, height: 13, tintColor: S.MUTED, resizeMode: 'contain', marginRight: 7 },
  inpTxt: { flex: 1, fontSize: 13, color: S.TXT, paddingVertical: 9, fontWeight: '400' },
  inpMultiTxt: { height: 48, textAlignVertical: 'top', paddingTop: 2 },
  autoBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: S.ORANGE, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, minWidth: 56, justifyContent: 'center' },
  autoBtnIco: { width: 11, height: 11, tintColor: '#FFF', resizeMode: 'contain', marginRight: 4 },
  autoBtnTxt: { fontSize: 11.5, fontWeight: '600', color: '#FFF' },
  detectedRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: S.GREEN_BG, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: -2, marginBottom: 9 },
  detectedIco: { width: 10, height: 10, resizeMode: 'contain', tintColor: S.GREEN, marginRight: 4 },
  detectedTxt: { fontSize: 11, fontWeight: '500', color: S.GREEN_DARK },
  chev: { width: 11, height: 11, tintColor: S.MUTED, resizeMode: 'contain' },
  poList: { borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 10, overflow: 'hidden', marginTop: 5, backgroundColor: '#FFF' },
  poEmpty: { paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center' },
  poEmptyT: { fontSize: 11.5, color: S.MUTED },
  poItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 11 },
  poDiv: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  poSel: { backgroundColor: S.ORANGE_BG },
  poTxt: { flex: 1, fontSize: 12.5, color: S.TXT, fontWeight: '400' },
  poTxtSel: { color: S.ORANGE, fontWeight: '600' },
  poTick: { width: 12, height: 12, tintColor: S.ORANGE, marginLeft: 8, resizeMode: 'contain' },

  dateCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 12, backgroundColor: '#FFFFFF', padding: 10 },
  dateIco: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  dateIcoImg: { width: 18, height: 18, resizeMode: 'contain' },
  dateLbl: { fontSize: 13, fontWeight: '500', color: S.TXT },

  calSheetInner: { paddingHorizontal: CAL_PAD, paddingBottom: 24 },
  calTopBand: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: 10, gap: 10,
  },
  calStepDot: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: S.P,
    alignItems: 'center', justifyContent: 'center',
  },
  calStepDotT: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  calBackBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: S.P_TINT,
    alignItems: 'center', justifyContent: 'center',
  },
  calBackIco: { width: 12, height: 12, tintColor: S.P, resizeMode: 'contain' },
  calStepBar: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  calStepSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#E2E8F0' },
  calStepSegOn: { backgroundColor: S.P },
  calStepBody: { paddingBottom: 8 },
  calTitle: { fontSize: 16, fontWeight: '700', color: S.TXT },
  calSub: { fontSize: 11, color: S.SUB, marginTop: 2, lineHeight: 15 },
  calClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  calCloseIco: { width: 10, height: 10, tintColor: S.SUB, resizeMode: 'contain' },
  calHint: { fontSize: 11, color: S.MUTED, textAlign: 'center', marginTop: 12, marginBottom: 4 },
  calSelChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: S.P_TINT, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    marginTop: 12, marginBottom: 4, gap: 6, borderWidth: 1, borderColor: S.P_GLOW,
  },
  calSelChipIco: { width: 13, height: 13, tintColor: S.P, resizeMode: 'contain' },
  calSelChipT: { fontSize: 12, fontWeight: '600', color: S.P_DARK },
  calDatePill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: S.P_TINT,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12,
    borderWidth: 1, borderColor: S.P_GLOW, gap: 8,
  },
  calDatePillIco: { width: 14, height: 14, tintColor: S.P, resizeMode: 'contain' },
  calDatePillT: { flex: 1, fontSize: 12.5, fontWeight: '600', color: S.P_DARK },
  calDatePillEdit: { fontSize: 11, fontWeight: '700', color: S.P },
  calMonthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12, paddingHorizontal: 2,
  },
  calNavBtn: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: S.P_TINT,
    alignItems: 'center', justifyContent: 'center',
  },
  calNavIco: { width: 11, height: 11, tintColor: S.P, resizeMode: 'contain' },
  calMonthLbl: { fontSize: 15, fontWeight: '700', color: S.TXT },
  calGridCard: {
    borderWidth: 1, borderColor: CARD_BORDER, borderRadius: 14,
    backgroundColor: '#FFF', paddingHorizontal: 10, paddingTop: 12, paddingBottom: 12,
  },
  calWeekRow: { flexDirection: 'row', marginBottom: 10, paddingHorizontal: 1 },
  calWeekCell: { width: CAL_CELL, textAlign: 'center', fontSize: 10, fontWeight: '700', color: S.MUTED },
  calWeekDivider: { height: 1, backgroundColor: S.BORDER, marginBottom: 10 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: CAL_GAP, justifyContent: 'flex-start' },
  calDayWrap: { width: CAL_CELL, height: CAL_CELL_H },
  calDayBox: {
    width: CAL_CELL, height: CAL_CELL_H, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  calDayAvail: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: S.BORDER },
  calDaySel: { backgroundColor: S.P, borderWidth: 0, shadowColor: S.P, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 2 },
  calDayToday: { borderWidth: 1.5, borderColor: S.P, backgroundColor: S.P_TINT },
  calDayOff: { opacity: 0.35 },
  calDayT: { fontSize: 13, fontWeight: '600', color: S.TXT },
  calDayTSel: { color: '#FFF', fontWeight: '700' },
  calDayTOff: { color: S.MUTED, fontWeight: '500' },
  calTimeLayout: { minHeight: 48 + CAL_WHEEL_H + 130 + 52, paddingBottom: 4 },
  calWheelCenter: {
    alignItems: 'center', justifyContent: 'center',
    height: CAL_WHEEL_H, marginVertical: 4,
  },
  calWheelPicker: { width: W - CAL_PAD * 2, height: CAL_WHEEL_H },
  calTimeFooter: { marginTop: 4 },
  calTimeLbl: { fontSize: 11.5, fontWeight: '700', color: S.TXT, marginBottom: 8, textAlign: 'center' },
  calQuickRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  calQuickChip: {
    flex: 1, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 4,
    backgroundColor: '#FFF', borderWidth: 1, borderColor: CARD_BORDER, alignItems: 'center',
  },
  calQuickChipOn: { backgroundColor: S.P_TINT, borderColor: S.P },
  calQuickChipT: { fontSize: 10.5, fontWeight: '700', color: S.SUB },
  calQuickChipTOn: { color: S.P_DARK },
  calQuickChipS: { fontSize: 9.5, fontWeight: '600', color: S.MUTED, marginTop: 1 },
  calQuickChipSOn: { color: S.P },
  calConfirm: {
    backgroundColor: PAY_GREEN, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: PAY_GREEN, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  calConfirmT: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  qtyCtrl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 32, height: 32, borderRadius: 9, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  qtyBtnDim: { opacity: 0.45 },
  qtyBtnAdd: { backgroundColor: S.GREEN },
  qtySign: { fontSize: 17, color: S.TXT, fontWeight: '500', marginTop: -2 },
  qtySignAdd: { color: '#FFF' },
  qtyVal: { fontSize: 15, fontWeight: '600', color: S.TXT, minWidth: 22, textAlign: 'center' },

  chevPill: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  chevPillIco: { width: 10, height: 10, resizeMode: 'contain', tintColor: S.SUB },

  jHead: { flexDirection: 'row', alignItems: 'center' },
  jBody: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#EFF2F6', paddingTop: 4, paddingBottom: 8 },
  jBlock: { marginTop: 12 },
  blockTitle: { fontSize: 12, fontWeight: '600', color: S.TXT, marginBottom: 8 },
  ctaBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: S.GREEN_BG, borderRadius: 12, padding: 10, marginTop: 8, gap: 10 },
  ctaImg: { width: 40, height: 40, borderRadius: 10 },
  ctaCount: { fontSize: 14, fontWeight: '600', color: S.GREEN_DARK },
  ctaMsg: { fontSize: 11, color: S.TXT, marginTop: 2, lineHeight: 15 },
  stepRow: { flexDirection: 'row', marginBottom: 9 },
  stepNum: { width: 18, height: 18, borderRadius: 9, backgroundColor: S.TEAL, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 1 },
  stepNumT: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  stepTxt: { flex: 1, fontSize: 12, color: S.TXT, lineHeight: 17 },
  guarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  guarCard: { width: (W - FOOTER_PAD * 2 - PAD * 2 - 16) / 3, backgroundColor: '#FAFBFC', borderRadius: 11, padding: 8, borderWidth: 1, borderColor: CARD_BORDER },
  guarIco: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 6, overflow: 'hidden' },
  guarImg: { width: 34, height: 34 },
  guarEmoji: { fontSize: 16 },
  guarTxt: { fontSize: 10, fontWeight: '500', color: S.TXT, lineHeight: 13 },
  howCard: { backgroundColor: '#FAFBFC', borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: CARD_BORDER },
  howTitle: { fontSize: 12, fontWeight: '600', color: S.TXT, marginBottom: 2 },
  howBody: { fontSize: 11, color: S.SUB, lineHeight: 15, marginBottom: 2 },
  videoBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: S.RED_BG, borderRadius: 11, padding: 9, marginTop: 10 },
  videoPlay: { width: 30, height: 30, borderRadius: 15, backgroundColor: S.RED, alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  videoPlayIc: { width: 11, height: 11, tintColor: '#FFF', resizeMode: 'contain', marginLeft: 2 },
  videoTxt: { flex: 1, fontSize: 12, fontWeight: '500', color: S.TXT, lineHeight: 16 },
  pkgDetail: { borderWidth: 1, borderRadius: 11, padding: 10, marginBottom: 8, backgroundColor: '#FFF' },
  pkgDetailHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  pkgTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pkgTagT: { fontSize: 9.5, fontWeight: '700', color: '#FFF' },
  paramRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  paramName: { flex: 1, fontSize: 11.5, fontWeight: '400', color: S.SUB },
  paramVal: { fontSize: 11.5, fontWeight: '600', color: S.TXT },
  paramRange: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
  paramRangeT: { fontSize: 9, fontWeight: '600' },
  supportRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 4 },
  supportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10 },
  supportIco: { width: 13, height: 13, marginRight: 5, resizeMode: 'contain' },
  supportTxt: { fontSize: 12, fontWeight: '600' },

  footerWrap: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: FOOTER_PAD, paddingTop: 4,
    borderTopWidth: 1, borderTopColor: CARD_BORDER,
  },
  footerRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8, width: '100%', minHeight: FOOTER_ROW_H },
  payViaBox: {
    width: 112, flexShrink: 0,
    backgroundColor: '#FAFBFC', borderRadius: 11, borderWidth: 1, borderColor: CARD_BORDER,
    paddingHorizontal: 8, justifyContent: 'center', height: FOOTER_ROW_H,
  },
  payViaRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  payViaIco: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFF',
    alignItems: 'center', justifyContent: 'center', marginRight: 6, overflow: 'hidden',
    borderWidth: 1, borderColor: CARD_BORDER,
  },
  payViaImg: { width: '100%', height: '100%' },
  payViaFb: { width: 18, height: 18, tintColor: S.SUB, resizeMode: 'contain' },
  payViaTextCol: { flex: 1, minWidth: 0 },
  payViaLbl: { fontSize: 9, fontWeight: '500', color: S.SUB },
  payViaName: { fontSize: 11.5, fontWeight: '700', color: S.TXT, marginTop: 1 },
  payViaChev: { width: 9, height: 9, tintColor: S.MUTED, resizeMode: 'contain', marginLeft: 3 },
  payNowBtn: {
    flex: 1, flexGrow: 1, flexShrink: 1, minWidth: 0,
    backgroundColor: PAY_GREEN, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 10, height: FOOTER_ROW_H,
  },
  payBtnBusy: { opacity: 0.75 },
  payNowInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4 },
  payNowLbl: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.1 },
  payBtnArrow: { width: 13, height: 13, tintColor: '#FFF', resizeMode: 'contain' },
  payDiscBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3, marginLeft: 4,
  },
  payDiscBadgeT: { fontSize: 9, fontWeight: '700', color: '#FFF' },

  payResultRoot: { flex: 1, backgroundColor: SCREEN_BG },
  payResultSafe: { flex: 1 },
  payResultHdr: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, paddingVertical: 10,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: CARD_BORDER,
  },
  payResultBack: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
  },
  payResultBackIco: { width: 14, height: 14, tintColor: S.TXT, resizeMode: 'contain' },
  payResultHdrT: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: S.TXT },
  payResultHdrSp: { width: 38 },
  payResultBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingBottom: 40 },
  payResultCard: {
    width: '100%', backgroundColor: '#FFF', borderRadius: 20, padding: 24,
    alignItems: 'center', borderWidth: 1, ...SHADOW,
  },
  payResultRing: {
    width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  payResultCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  payResultIco: { width: 32, height: 32, tintColor: '#FFF', resizeMode: 'contain' },
  payResultTitle: { fontSize: 22, fontWeight: '700', color: S.TXT, marginBottom: 8, textAlign: 'center' },
  payResultSub: { fontSize: 13.5, color: S.SUB, textAlign: 'center', lineHeight: 20 },
  payResultIdPill: {
    marginTop: 14, backgroundColor: '#F8FAFC', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: CARD_BORDER,
  },
  payResultId: { fontSize: 12.5, fontWeight: '700', color: S.TXT },
  payResultRedirect: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 },
  payResultRedirectT: { fontSize: 12.5, fontWeight: '600' },

  payList: { gap: 6 },
  payRowItem: {
    flexDirection: 'row', alignItems: 'center', padding: 10,
    borderRadius: 12, borderWidth: 1, borderColor: CARD_BORDER, backgroundColor: '#FAFBFC',
  },
  payRowItemOn: { borderColor: PAY_GREEN, backgroundColor: '#F6FFF6', borderWidth: 1.5 },
  payRowIco: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: '#FFF',
    marginRight: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: CARD_BORDER,
  },
  payRowImg: { width: '100%', height: '100%' },
  payRowFbWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  payRowFb: { width: 20, height: 20, tintColor: S.SUB, resizeMode: 'contain' },
  payRowName: { fontSize: 13, fontWeight: '600', color: S.TXT },
  payRowNameOn: { color: S.GREEN_DARK },
  payRowDesc: { fontSize: 11, color: S.SUB, marginTop: 1 },
  payRowDisc: { fontSize: 10, fontWeight: '600', color: S.GREEN_DARK, marginTop: 2 },
  payRowCircle: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center', marginLeft: 8, backgroundColor: '#FFF',
  },
  payRowCircleOn: { borderColor: PAY_GREEN, backgroundColor: '#FFF' },
  payRowTick: { width: 14, height: 14, tintColor: PAY_GREEN, resizeMode: 'contain' },

  videoPreview: { borderRadius: 12, overflow: 'hidden', marginTop: 10, height: 180, backgroundColor: '#000' },
  videoThumb: { width: '100%', height: '100%' },
  videoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  videoPlayCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  videoPlayBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(220,38,38,0.92)', alignItems: 'center', justifyContent: 'center' },
  videoPlayIc: { width: 18, height: 18, tintColor: '#FFF', resizeMode: 'contain', marginLeft: 3 },
  videoCaption: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 10, backgroundColor: 'rgba(0,0,0,0.55)' },
  videoCaptionT: { fontSize: 12.5, fontWeight: '600', color: '#FFF', lineHeight: 16 },
  videoCaptionS: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  videoModal: { flex: 1, backgroundColor: '#000' },
  videoModalHdr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8, backgroundColor: '#000' },
  videoModalTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#FFF' },
  videoClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  videoCloseIco: { width: 14, height: 14, tintColor: '#FFF', resizeMode: 'contain' },
});

export default withV4Navigation(CreateSoilOrder);
