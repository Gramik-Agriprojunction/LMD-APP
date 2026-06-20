// DeliveryDetails.js
import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
  Image,
  ActivityIndicator,
  Linking,
  Animated,
  Dimensions,
  Modal,
  Platform,
  LayoutAnimation,
  UIManager,
  Share,
  InteractionManager,
} from 'react-native';
import { SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import ShimmerLoader from '../components/ShimmerLoader';
import constants from '../utils/constants';
import BottomSheet from '../components/BottomSheet';
import Toast from 'react-native-simple-toast';
import { NavigationEvents, withV4Navigation } from '../utils/v4Compat';
import { invalidateOrderRelated } from '../utils/dataCache';
import * as STATUS_COLORS from '../utils/statusColors';
import CachedImage from '../components/CachedImage';
import ScreenHeader from '../components/ScreenHeader';
import OrderCard from '../components/OrderCard';
import { initiateExotelCall } from '../utils/exotelCall';

const QR_SAFE_TOP = initialWindowMetrics?.insets?.top ?? (Platform.OS === 'ios' ? 47 : StatusBar.currentHeight || 0);
const QR_SAFE_BOTTOM = initialWindowMetrics?.insets?.bottom ?? 0;

const SUM_ICON_BG = '#ECFDF5';

const SUM_ICO = {
  cal: require('./assets/cal.png'),
  truck: require('./assets/truck.png'),
  box: require('./assets/cart2.png'),
  wallet: require('./assets/credit.png'),
  check: require('./assets/checked.png'),
  rupee: require('./assets/money.png'),
  cash: require('./assets/cashb.png'),
  clock: require('./assets/clock.png'),
  history: require('./assets/history.png'),
};

class DeliveryDetails extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: false,
      refreshing: false,
      details: null,
      hasError: false,

      show_pickup_confirm: false,
      popup_type: '',
      show_more_options: false,

      // cancel reasons
      reasonsLoading: false,
      cancelReasons: {}, // {key: label}
      selectedCancelReason: '',

      // reject reasons
      rejectReasonsLoading: false,
      rejectReasons: {}, // {key: label}
      selectedRejectReason: '',

      // ✅ Payment UI state (added)
      payment_type: 'cash',
      qr: '',
      qrLoading: false,
      qrFailed: false,
      qrErrorText: '',
      qrModalVisible: false,

      // Invoice download state
      invoiceDownloading: false,
      invoiceProgress: 0,

      callInitiating: false,
    };

    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    this.fadeAnim = new Animated.Value(0);
    this.slideAnim = new Animated.Value(24);
    this.pickupPulse = new Animated.Value(1);
  }

  mask = (p) => { if (!p) return ''; const s = String(p); if (s.length < 6) return s; return s.slice(0,2) + '****' + s.slice(-2); };

  startPickupPulse = () => {
    const run = () => {
      Animated.sequence([
        Animated.timing(this.pickupPulse, { toValue: 1.03, duration: 800, useNativeDriver: true }),
        Animated.timing(this.pickupPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]).start(() => run());
    };
    run();
  };

  getOrder = () => this.props?.navigation?.getParam('order', null);

  orderDataUnchanged = (prev, next) => {
    if (!prev || !next) return false;
    return (
      String(prev.order_status || '') === String(next.order_status || '')
      && String(prev.payment_status || '') === String(next.payment_status || '')
      && String(prev.payment_mode || '') === String(next.payment_mode || '')
      && String(prev.grand_total ?? '') === String(next.grand_total ?? '')
      && (prev.order_items?.length || 0) === (next.order_items?.length || 0)
    );
  };

  orderPaymentChanged = (prev, next) => {
    if (!prev || !next) return true;
    return (
      String(prev.order_status || '') !== String(next.order_status || '')
      || String(prev.payment_status || '') !== String(next.payment_status || '')
      || String(prev.payment_mode || '') !== String(next.payment_mode || '')
    );
  };

  componentDidMount() {
    const order = this.getOrder();
    const id = order?.id;

    if (id) this.deliverDetailsAPI(id);
    else console.log('DeliveryDetails: navigation order.id missing');

    this.cancelReasonsApi();
    this.rejectReasonsApi();
  }

  goBack = () => {
    const nav = this.props?.navigation;
    if (nav?.goBack) nav.goBack();
  };

  onRefresh = () => {
    const order = this.getOrder();
    const id = order?.id || this.state.details?.id;
    if (id) {
      this.setState({ refreshing: true });
      this.deliverDetailsAPI(id, { silent: true });
    }
  };

  deliverDetailsAPI = (id, { silent = false } = {}) => {
    const body = { order_id: String(id) };

    if (!silent) {
      this.setState({ isLoading: true, hasError: false });
    }
    console.log('Order Details API payload== ', body);

    fetch(constants.orderDetails, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + global.token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((json) => {
        console.log('Order Details API response== ', JSON.stringify(json));

        if (json?.status && json?.order) {
          const next = json.order;
          const prev = this.state.details;

          if (silent && prev && this.orderDataUnchanged(prev, next)) {
            if (this.state.refreshing) this.setState({ refreshing: false });
            return;
          }

          const applyDetails = () => {
            this.setState({
              isLoading: false,
              refreshing: false,
              details: next,
              disputeReasons: Array.isArray(json?.dispute_reasons) ? json.dispute_reasons : [],
            }, () => {
              const oid = next?.id;
              const needsQr = !silent || this.orderPaymentChanged(prev, next);
              if (oid && needsQr) this.getQR(oid, { silent });
            });
          };

          if (silent) {
            applyDetails();
          } else {
            this.fadeAnim.setValue(0);
            this.slideAnim.setValue(24);
            applyDetails();
            Animated.parallel([
              Animated.timing(this.fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
              Animated.timing(this.slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
            ]).start(() => this.startPickupPulse());
          }
        } else {
          this.setState({ isLoading: false, refreshing: false });
          if (!silent) {
            this.setState({ details: null, hasError: true });
            console.log('Order Details API error== ', json?.message || 'Invalid response');
          }
        }
      })
      .catch((e) => {
        console.log('Order Details API error== ', e);
        if (silent) {
          if (this.state.refreshing) this.setState({ refreshing: false });
        } else {
          this.setState({ isLoading: false, refreshing: false, details: null, hasError: true });
        }
      });
  };

  // ✅ Cancel reasons API (GET)
  cancelReasonsApi = () => {
    this.setState({ reasonsLoading: true }, () => {
      fetch(constants.cancelReasons, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + global.token,
          Accept: 'application/json',
        },
      })
        .then((response) => response.json())
        .then((responseJson) => {
          console.log('Cancel Reasons API response== ', JSON.stringify(responseJson));
          this.setState({ reasonsLoading: false });
          if (responseJson?.status) {
            this.setState({ cancelReasons: responseJson?.data || {} });
          }
        })
        .catch((error) => {
          console.log('Cancel Reasons API error== ', error);
          this.setState({ reasonsLoading: false });
        });
    });
  };

  // ✅ Reject reasons API (GET)
  rejectReasonsApi = () => {
    this.setState({ rejectReasonsLoading: true }, () => {
      fetch(constants.rejectReasons, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + global.token,
          Accept: 'application/json',
        },
      })
        .then((response) => response.json())
        .then((responseJson) => {
          console.log('Reject Reasons API response== ', JSON.stringify(responseJson));
          this.setState({ rejectReasonsLoading: false });
          if (responseJson?.status) {
            this.setState({ rejectReasons: responseJson?.data || {} });
          }
        })
        .catch((error) => {
          console.log('Reject Reasons API error== ', error);
          this.setState({ rejectReasonsLoading: false });
        });
    });
  };

  // ✅ Cancel reason list UI
  renderCancelReasons = () => {
    const { cancelReasons, selectedCancelReason, reasonsLoading } = this.state;

    if (reasonsLoading) {
      return <ActivityIndicator style={{ marginTop: 12 }} size="small" color="#5D3FD3" />;
    }

    const keys = Object.keys(cancelReasons || {});
    if (!keys.length) {
      return (
        <Text style={{ textAlign: 'center', marginTop: 12, color: '#6B7280', fontWeight: '700' }}>
          No reasons available
        </Text>
      );
    }

    return keys.map((k) => {
      const label = cancelReasons[k];
      const selected = selectedCancelReason === k;
      return (
        <TouchableOpacity
          key={k}
          activeOpacity={0.7}
          onPress={() => {
            LayoutAnimation.configureNext({
              duration: 250,
              create: { type: 'easeInEaseOut', property: 'opacity' },
              update: { type: 'spring', springDamping: 0.8 },
              delete: { type: 'easeInEaseOut', property: 'opacity' },
            });
            this.setState({ selectedCancelReason: k });
          }}
          style={[styles.reasonRow, selected && styles.reasonRowActive]}
        >
          <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
            {selected ? <View style={styles.radioInner} /> : null}
          </View>
          <Text style={[styles.reasonText, selected && styles.reasonTextActive]}>{label}</Text>
        </TouchableOpacity>
      );
    });
  };

  // ✅ Reject reason list UI
  renderRejectReasons = () => {
    const { rejectReasons, selectedRejectReason, rejectReasonsLoading } = this.state;

    if (rejectReasonsLoading) {
      return <ActivityIndicator style={{ marginTop: 12 }} size="small" color="#5D3FD3" />;
    }

    const keys = Object.keys(rejectReasons || {});
    if (!keys.length) {
      return (
        <Text style={{ textAlign: 'center', marginTop: 12, color: '#6B7280', fontWeight: '700' }}>
          No reasons available
        </Text>
      );
    }

    return keys.map((k) => {
      const label = rejectReasons[k];
      const selected = selectedRejectReason === k;
      return (
        <TouchableOpacity
          key={k}
          activeOpacity={0.7}
          onPress={() => {
            LayoutAnimation.configureNext({
              duration: 250,
              create: { type: 'easeInEaseOut', property: 'opacity' },
              update: { type: 'spring', springDamping: 0.8 },
              delete: { type: 'easeInEaseOut', property: 'opacity' },
            });
            this.setState({ selectedRejectReason: k });
          }}
          style={[styles.reasonRow, selected && styles.reasonRowActive]}
        >
          <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
            {selected ? <View style={styles.radioInner} /> : null}
          </View>
          <Text style={[styles.reasonText, selected && styles.reasonTextActive]}>{label}</Text>
        </TouchableOpacity>
      );
    });
  };

  // ---------- ACTIONS ----------
  onCall = async () => {
    if (this.state.callInitiating) return;
    const d = this.state?.details;
    const phoneRaw = d?.farmer_data?.phone;
    if (!phoneRaw) {
      Toast.show('Farmer phone nahi mila', Toast.SHORT);
      return;
    }
    const orderId = d?.order_id || d?.id;
    this.setState({ callInitiating: true });
    await initiateExotelCall({
      orderId,
      toPhone: phoneRaw,
      callType: 'farmer',
      context: 'delivery',
    });
    this.setState({ callInitiating: false });
  };

  onWhatsApp = async () => {
    const phoneRaw = this.state?.details?.farmer_data?.phone;
    if (!phoneRaw) return console.log('farmer_data.phone missing');

    const phone = String(phoneRaw).replace(/[^\d]/g, '');
    if (!phone) return console.log('Invalid phone for WhatsApp:', phoneRaw);

    const url = `whatsapp://send?phone=${phone}`;

    try {
      const can = await Linking.canOpenURL(url);
      if (can) return Linking.openURL(url);

      const waWeb = `https://wa.me/${phone}`;
      const canWeb = await Linking.canOpenURL(waWeb);
      if (canWeb) return Linking.openURL(waWeb);

      console.log('WhatsApp not available');
    } catch (e) {
      console.log('WhatsApp error:', e);
    }
  };

  onPickUp() {
    this.setState({ show_pickup_confirm: true });
  }

  toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Convert a positive integer to English words using Indian numbering (Lakh / Crore)
  amountInWords = (value) => {
    let num = Math.floor(this.toNum(value));
    if (num === 0) return 'Zero Rupees Only';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const below100 = (n) => n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    const below1000 = (n) => n < 100 ? below100(n) : ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + below100(n % 100) : '');
    let result = '';
    const crore = Math.floor(num / 10000000); num %= 10000000;
    const lakh  = Math.floor(num / 100000);   num %= 100000;
    const thou  = Math.floor(num / 1000);     num %= 1000;
    if (crore) result += below1000(crore) + ' Crore ';
    if (lakh)  result += below1000(lakh)  + ' Lakh ';
    if (thou)  result += below1000(thou)  + ' Thousand ';
    if (num)   result += below1000(num) + ' ';
    return result.trim() + ' Rupees Only';
  };

  // -------- Invoice (view / download / share) --------
  // Sample PDF used when API doesn't yet include `invoice_pdf` in the response.
  static SAMPLE_INVOICE_URL = 'https://www.orimi.com/pdf-test.pdf';

  getInvoiceUrl = () => {
    const d = this.state.details;
    // Backend returns the signed PDF link in `order_invoice`.
    // Fallback to `invoice_pdf` for older response shapes, then a sample URL.
    const fromApi = d?.order_invoice || d?.invoice_pdf;
    if (fromApi && String(fromApi).trim()) return String(fromApi).trim();
    return DeliveryDetails.SAMPLE_INVOICE_URL;
  };

  // ----- Invoice download / view / share -----
  // Lazily required so a missing native module doesn't crash the screen.
  _ensureBlobUtil = () => {
    if (!this._BlobUtil) {
      try { this._BlobUtil = require('react-native-blob-util').default || require('react-native-blob-util'); }
      catch (e) { this._BlobUtil = null; }
    }
    return this._BlobUtil;
  };

  _ensureRNShare = () => {
    if (!this._RNShare) {
      try { this._RNShare = require('react-native-share').default || require('react-native-share'); }
      catch (e) { this._RNShare = null; }
    }
    return this._RNShare;
  };

  _invoiceFilename = () => {
    const oid = this.state.details?.order_id || this.state.details?.invoice_no || this.state.details?.id || 'invoice';
    return `Invoice-${String(oid).replace(/[^\w-]/g, '_')}.pdf`;
  };

  // Show a non-blocking progress UI without rebuilding lots of state plumbing.
  _setInvoiceProgress = (p) => this.setState({ invoiceProgress: p });

  // Download to app cache. Returns local file path (sans file:// prefix) on success.
  downloadInvoiceFile = async ({ silent = false } = {}) => {
    const url = this.getInvoiceUrl();
    const BlobUtil = this._ensureBlobUtil();
    if (!BlobUtil) {
      Toast.show('Download module not available', Toast.SHORT);
      return null;
    }
    const filename = this._invoiceFilename();
    const dir = BlobUtil.fs.dirs.CacheDir;
    const path = `${dir}/${filename}`;

    if (!silent) this.setState({ invoiceDownloading: true, invoiceProgress: 0 });

    try {
      const res = await BlobUtil
        .config({ fileCache: true, path, appendExt: 'pdf' })
        .fetch('GET', url, { Accept: 'application/pdf' })
        .progress({ interval: 100 }, (received, total) => {
          const t = Number(total) || 0;
          const r = Number(received) || 0;
          const pct = t > 0 ? Math.min(1, r / t) : 0;
          this._setInvoiceProgress(pct);
        });
      const localPath = res.path();
      if (!silent) this.setState({ invoiceDownloading: false, invoiceProgress: 1 });
      return localPath;
    } catch (e) {
      console.log('Invoice download error', e);
      if (!silent) this.setState({ invoiceDownloading: false, invoiceProgress: 0 });
      Toast.show('Download failed. Please try again.', Toast.SHORT);
      return null;
    }
  };

  openLocalPdf = async (localPath) => {
    if (!localPath) return;
    const BlobUtil = this._ensureBlobUtil();
    // Strip any "file://" prefix — both native openers expect a raw FS path.
    const rawPath = localPath.replace(/^file:\/\//, '');
    try {
      if (Platform.OS === 'ios') {
        // openDocument needs the absolute file-system path; previewController
        // attaches a few frames late so the UI doesn't race the file write.
        await new Promise((res) => setTimeout(res, 80));
        await BlobUtil.ios.openDocument(rawPath);
      } else {
        await BlobUtil.android.actionViewIntent(rawPath, 'application/pdf');
      }
    } catch (e) {
      console.log('Open PDF error', e);
      // Last-ditch fallback — let the OS resolve the file URI.
      try {
        await Linking.openURL(`file://${rawPath}`);
      } catch (e2) {
        Toast.show('Could not open the invoice', Toast.SHORT);
      }
    }
  };

  viewInvoice = async () => {
    const path = await this.downloadInvoiceFile();
    if (path) {
      Toast.show('Invoice ready', Toast.SHORT);
      this.openLocalPdf(path);
    }
  };

  downloadInvoice = async () => {
    const path = await this.downloadInvoiceFile();
    if (path) {
      Toast.show('Invoice downloaded — opening…', Toast.SHORT);
      this.openLocalPdf(path);
    }
  };

  shareInvoice = async () => {
    // Download to a local file first, then hand the actual PDF (not a URL) to the share sheet.
    const path = await this.downloadInvoiceFile();
    if (!path) return;
    const Share = this._ensureRNShare();
    const oid = this.state.details?.order_id || '';
    const fileUri = Platform.OS === 'android' && !path.startsWith('file://') ? `file://${path}` : path;
    try {
      if (Share && typeof Share.open === 'function') {
        await Share.open({
          url: fileUri,
          type: 'application/pdf',
          filename: this._invoiceFilename().replace(/\.pdf$/i, ''),
          title: oid ? `Invoice #${oid}` : 'Invoice',
          subject: oid ? `Invoice #${oid}` : 'Invoice',
          failOnCancel: false,
        });
      } else {
        // Fallback to RN's Share API. On iOS this still attaches the file via `url`.
        // eslint-disable-next-line global-require
        const RNShare = require('react-native').Share;
        await RNShare.share({ url: fileUri, title: oid ? `Invoice #${oid}` : 'Invoice' });
      }
    } catch (e) {
      console.log('Share invoice error', e);
      Toast.show('Could not share the invoice', Toast.SHORT);
    }
  };

  // Canonical color palette — same colors across the whole app (see utils/statusColors.js)
  getStatusColors = (statusRaw) => {
    return { bg: STATUS_COLORS.getStatus(statusRaw).bg, text: '#FFF' };
  };

  openSurvey = () => {
    this.props?.navigation?.navigate('Survey', { order_data: this.state?.details });
  };

  orderStatusApi(status, cancelReasonKey = '') {
    const body = {
      status: status == 'deliver' ? 'delivered' : status,
      order_id: this.state.details?.id,
      type: '',
      reason: cancelReasonKey || '',
    };

    this.setState({ isLoading: true }, () => {
      console.log('Update Status API payload== ', body);

      fetch(constants.updateStatus, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + global.token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      })
        .then((response) => response.json())
        .then((responseJson) => {
          console.log('Update Status API response== ', JSON.stringify(responseJson));
          this.setState({ isLoading: false });
          Toast.show(responseJson.message, Toast.SHORT);
          if (responseJson.status) {
            // Order state changed → mark dashboard + orders caches stale so they refresh on next visit
            invalidateOrderRelated();
            this.deliverDetailsAPI(this.state.details?.id, { silent: true });
            this.setState({ show_pickup_confirm: false, selectedCancelReason: '', selectedRejectReason: '' });
          }
        })
        .catch((error) => {
          console.log('Update Status API error== ', error);
          this.setState({ isLoading: false, order_list: [] });
        });
    });
  }

  maskPhone = (phoneRaw) => {
    if (!phoneRaw) return '';

    const raw = String(phoneRaw).trim();
    const hasPlus = raw.startsWith('+');
    let digits = raw.replace(/[^\d]/g, '');

    let cc = '';
    if (hasPlus && digits.length > 10) {
      cc = digits.slice(0, digits.length - 10);
      digits = digits.slice(-10);
    }

    if (digits.length < 5) return (hasPlus ? '+' : '') + (cc ? cc : '') + '***';

    const first3 = digits.slice(0, 3);
    const last2 = digits.slice(-2);
    const masked = first3 + '*'.repeat(Math.max(0, digits.length - 5)) + last2;

    return (hasPlus ? '+' : '') + (cc ? cc : '') + masked;
  };

  // ✅ Payment helpers (added)
  isAlreadyPaid = (order) => {
    const ps = String(order?.payment_status || '').toLowerCase();
    const pm = String(order?.payment_mode || '').toLowerCase();
    return ps === 'paid' && pm && pm !== 'cod' && pm !== 'cash';
  };

  onCollectCash = () => {
    this.setState({ payment_type: 'cash' });
  };

  onScanQR = () => {
    this.setState({ payment_type: 'qr' });
    if (this.state.qr) this.setState({ qrModalVisible: true });
  };

  getQR = (id, { silent = false } = {}) => {
    if (!silent) {
      this.setState({ qrLoading: true, qrFailed: false, qrErrorText: '' });
    }

    const url = `${constants.getQR}${id}`;
    console.log('Get QR API payload== ', url);

    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + global.token,
        Accept: 'application/json',
      },
    })
      .then((r) => r.json())
      .then((json) => {
        console.log('Get QR API response== ', JSON.stringify(json));
        const qrUrl = json?.qr_image_url || '';
        console.log('qr_image_url =>', qrUrl);

        if (Platform.OS === 'ios' && qrUrl?.startsWith('http://')) {
          console.log('⚠️ iOS ATS: QR URL is HTTP. It may not load unless ATS allows it.');
        }

        if (silent && qrUrl === this.state.qr) return;

        this.setState({
          qrLoading: false,
          qr: qrUrl,
          qrFailed: !qrUrl,
          qrErrorText: !qrUrl ? 'QR url missing' : '',
        });
      })
      .catch((e) => {
        console.log('Get QR API error== ', e);
        this.setState({ qrLoading: false, qr: '', qrFailed: true, qrErrorText: String(e) });
      });
  };

  getQrImageSource = () => {
    const { qr } = this.state;
    if (!qr) return null;
    return { uri: qr };
  };

  renderQrTile = () => {
    const { qr, qrLoading, qrFailed } = this.state;
    const source = this.getQrImageSource();

    return (
      <TouchableOpacity style={styles.payTile} onPress={this.onScanQR} activeOpacity={0.9}>
        <View style={[styles.payImg, { backgroundColor: '#E8F1FF' }]}>
          {qrLoading ? <ActivityIndicator size="small" color="#5D3FD3" /> : null}

          {!qrLoading && !!qr ? (
            <Image
              source={source}
              resizeMode="cover"
              style={styles.qrThumb}
              onError={(e) => {
                const msg = JSON.stringify(e?.nativeEvent || {});
                console.log('QR THUMB onError =>', msg);
                this.setState({ qrFailed: true, qrErrorText: msg });
              }}
            />
          ) : null}

          {!qrLoading && !qr && qrFailed ? (
            <View style={{ paddingHorizontal: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#E35335', textAlign: 'center' }}>
                QR not available
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.payFooterPrimary}>
          <Text style={styles.payTileText}>Scan QR Code</Text>
        </View>
      </TouchableOpacity>
    );
  };

  componentWillUnmount() {
    if (this._focusRefreshTimer) clearTimeout(this._focusRefreshTimer);
  }

  render() {
    const { isLoading, details, hasError } = this.state;

    const rawCode = details?.order_code || '';
    const orderIdText = rawCode.includes(' ') ? rawCode.split(' ')[0] : rawCode;
    const orderDate = details?.order_date || '';
    const totalItems = this.toNum(details?.total_items);

    const farmerName = details?.farmer_data?.name || '';
    const farmerAddress = details?.farmer_data?.address || '';
    const farmerFullAddress = details?.farmer_address || {};
    const total = this.toNum(details?.grand_total);
    const items = Array.isArray(details?.order_items) ? details.order_items : [];
    const darkStore = details?.dark_store || {};

    const isPaid = this.isAlreadyPaid(details);
    const paymentMode = details?.payment_mode || '';
    const paymentStatus = details?.payment_status || '';
    const codAmount = this.toNum(details?.cod_amount);
    const qrSize = Math.min(Dimensions.get('window').width - 56, 308);
    const qrBg = '#5D3FD3';

    // Header tinted to match the current order's status (falls back to brand purple before data loads)
    const headerColor = details?.order_status ? this.getStatusColors(details.order_status).bg : '#5D3FD3';

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={headerColor} />

        <NavigationEvents
          onDidFocus={() => {
            if (!this.state.details?.id) return;
            if (this._focusRefreshTimer) clearTimeout(this._focusRefreshTimer);
            this._focusRefreshTimer = setTimeout(() => {
              this._focusRefreshTimer = null;
              InteractionManager.runAfterInteractions(() => {
                const id = this.state.details?.id || this.getOrder()?.id;
                if (id) this.deliverDetailsAPI(id, { silent: true });
              });
            }, 480);
          }}
        />

        <ScreenHeader bg={headerColor} title="Delivery Jaankari" onBack={this.goBack} />

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={this.state.refreshing} onRefresh={this.onRefresh} />}>
          {isLoading && !details ? (
            <ShimmerLoader />
          ) : null}

          {!isLoading && !details && hasError ? (
            <View style={styles.pageBox}>
              <Text style={styles.pageErrorText}>Unable to load details</Text>
            </View>
          ) : null}

          {details ? (
            <Animated.View style={{ opacity: this.fadeAnim, transform: [{ translateY: this.slideAnim }] }}>
              {/* Hero — same OrderCard used in Dashboard, TrackOrders, PenaltyOrders */}
              <OrderCard
                order={details}
                onCall={this.onCall ? () => this.onCall() : undefined}
                onWhatsApp={this.onWhatsApp ? () => this.onWhatsApp() : undefined}
                onCallStore={(p) => p && Linking.openURL(`tel:${p}`).catch(() => {})}
              />

              {/* Items */}
              <Text style={styles.ddSecTitle}>{`${totalItems || items.length || 0} Item(s)`}  <Text style={{ color: '#16A34A' }}>₹ {total}</Text></Text>
              {items.length ? (
                <View style={styles.itemsCard}>
                  {items.map((it, idx) => (
                    <View
                      key={`${it?.variant_id || it?.product_id || idx}`}
                      style={[styles.ddItemRow, idx > 0 && styles.ddItemRowDivider]}
                    >
                      {/* Product image in a soft tinted container */}
                      <View style={styles.ddItemImgWrap}>
                        {it?.image ? (
                          <CachedImage source={{ uri: it.image }} style={styles.ddProductImg} />
                        ) : (
                          <Image source={require('./assets/box.png')} style={styles.ddProductFallback} />
                        )}
                      </View>

                      {/* Name + meta pills */}
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.ddItemName} numberOfLines={2}>{String(it?.product_name || '-')}</Text>
                        <View style={styles.ddItemMeta}>
                          {it?.variation ? (
                            <View style={styles.ddItemVarPill}>
                              <Text style={styles.ddItemVar}>{it.variation}</Text>
                            </View>
                          ) : null}
                          <View style={styles.ddItemQtyPill}>
                            <Text style={styles.ddItemQty}>× {this.toNum(it?.quantity)}</Text>
                          </View>
                        </View>
                      </View>

                      {/* Price column */}
                      <View style={styles.ddItemPriceCol}>
                        <Text style={styles.ddItemPrice}>₹{this.toNum(it?.total_price || it?.price)}</Text>
                        {it?.price && this.toNum(it?.quantity) > 1 ? (
                          <Text style={styles.ddItemUnit}>₹{this.toNum(it?.price)} ea</Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.ddCard}><Text style={styles.emptyItemsText}>Koi item nahi</Text></View>
              )}

              {/* ✅ Payment & Settlement summary — every numeric/status field from the API with icons */}
              {(() => {
                const cod = this.toNum(details?.cod_amount);
                const collected = this.toNum(details?.collected_amount);
                const settleAmt = this.toNum(details?.settlement_amount);
                const settleStatus = String(details?.settlement_status || '').toLowerCase();
                const paymentPaid = String(details?.payment_status || '').toLowerCase() === 'paid';
                const settleChip = (() => {
                  if (settleStatus === 'paid' || settleStatus === 'settled' || settleStatus === 'success')
                    return { bg: '#DCFCE7', fg: '#15803D' };
                  if (settleStatus === 'disputed' || settleStatus === 'failed' || settleStatus === 'rejected')
                    return { bg: '#FEE2E2', fg: '#B91C1C' };
                  return { bg: '#FFEDD5', fg: '#C2410C' };
                })();

                const Box = ({ icon, glyph, lbl, valueText, valueColor, chipFg, chipText, full, valSmall }) => {
                  return (
                    <View style={[styles.sumBox, full && styles.sumBoxFull]}>
                      {glyph || icon ? (
                        <View style={styles.sumBoxIconWrap}>
                          {glyph ? (
                            <Text style={styles.sumBoxGlyph}>{glyph}</Text>
                          ) : (
                            <Image source={icon} style={styles.sumBoxIconImg} resizeMode="contain" />
                          )}
                        </View>
                      ) : null}
                      <View style={styles.sumBoxContent}>
                        <Text style={styles.sumBoxLbl} numberOfLines={1}>{lbl}</Text>
                        {chipText ? (
                          <Text style={[styles.sumBoxChipT, { color: chipFg }]} numberOfLines={1}>{chipText}</Text>
                        ) : (
                          <Text
                            style={[
                              valSmall ? styles.sumBoxValSm : styles.sumBoxVal,
                              valueColor && { color: valueColor },
                            ]}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                          >
                            {valueText}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                };

                return (
                  <View style={styles.summaryCard}>
                    {/* Critical alerts */}
                    {details?.penalty_text ? (
                      <View style={styles.alertBanner}>
                        <View style={styles.alertBannerBar} />
                        <View style={styles.alertBannerIconWrap}>
                          <Text style={styles.alertBannerIconChar}>!</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.alertBannerText}>{details.penalty_text}</Text>
                        </View>
                      </View>
                    ) : null}

                    {details?.dispute_date ? (
                      <View style={styles.alertBanner}>
                        <View style={styles.alertBannerBar} />
                        <View style={styles.alertBannerIconWrap}>
                          <Text style={styles.alertBannerIconChar}>!</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.alertBannerTitle}>Dispute Raised</Text>
                          <Text style={styles.alertBannerText}>{details.dispute_date}</Text>
                        </View>
                      </View>
                    ) : null}

                    <View style={[styles.summarySubSection, (details?.penalty_text || details?.dispute_date) && styles.summarySubSectionSep]}>
                      <View style={styles.summarySubHeader}>
                        <Image source={SUM_ICO.wallet} style={styles.summaryHdrIcon} resizeMode="contain" />
                        <Text style={styles.summarySubTitle}>Payment</Text>
                      </View>
                      <View style={styles.sumGrid}>
                        {details?.order_date ? (
                          <Box icon={SUM_ICO.cal} lbl="Order Date" valueText={details.order_date} valSmall />
                        ) : null}
                        {details?.delivery_date ? (
                          <Box icon={SUM_ICO.truck} lbl="Delivery Date" valueText={details.delivery_date} valSmall />
                        ) : null}
                        <Box icon={SUM_ICO.box} lbl="Total Items" valueText={String(this.toNum(details?.total_items) || items.length || 0)} />
                        <Box icon={SUM_ICO.wallet} lbl="Payment Mode" valueText={String(details?.payment_mode || '-')} />
                        <Box
                          icon={SUM_ICO.check}
                          lbl="Payment Status"
                          chipFg={paymentPaid ? '#15803D' : '#B45309'}
                          chipText={String(details?.payment_status || '-').toUpperCase()}
                        />
                        <Box icon={SUM_ICO.rupee} lbl="COD Amount" valueText={`₹ ${cod}`} />
                        <Box
                          icon={SUM_ICO.cash}
                          lbl="Collected"
                          valueText={`₹ ${collected}`}
                          valueColor={collected > 0 ? '#15803D' : '#0F172A'}
                        />
                      </View>
                    </View>

                    <View style={[styles.summarySubSection, styles.summarySubSectionSep]}>
                      <View style={styles.summarySubHeader}>
                        <Image source={SUM_ICO.clock} style={styles.summaryHdrIcon} resizeMode="contain" />
                        <Text style={styles.summarySubTitle}>Settlement</Text>
                      </View>
                      <View style={styles.sumGrid}>
                        <Box
                          icon={SUM_ICO.clock}
                          lbl="Settlement Status"
                          chipFg={settleChip.fg}
                          chipText={(details?.settlement_status || 'pending').toUpperCase()}
                        />
                        <Box
                          icon={SUM_ICO.rupee}
                          lbl="Settled Amount"
                          valueText={`₹ ${settleAmt}`}
                          valueColor={settleAmt > 0 ? '#15803D' : '#0F172A'}
                        />
                        {details?.settlement_submitted ? (
                          <Box
                            icon={SUM_ICO.cal}
                            lbl="Settled On"
                            valueText={String(details.settlement_submitted)}
                            valSmall
                          />
                        ) : null}
                        {details?.settlement_approve_reject ? (
                          <Box
                            icon={SUM_ICO.history}
                            lbl="Updated On"
                            valueText={String(details.settlement_approve_reject)}
                            valSmall
                          />
                        ) : null}
                      </View>
                    </View>

                    {/* Delivery Partner — the LMD themselves; read-only, no call button */}
                    {details?.user?.name || details?.user?.mobile ? (
                      <View style={styles.partnerCard}>
                        <View style={styles.partnerAvatar}>
                          <Text style={styles.partnerAvatarChar}>
                            {(details?.user?.name || 'U').trim().charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.partnerLbl}>Delivery Partner (Aap)</Text>
                          <Text style={styles.partnerName}>{details?.user?.name || '-'}</Text>
                          {details?.user?.mobile ? (
                            <Text style={styles.partnerPhone}>{details.user.mobile}</Text>
                          ) : null}
                        </View>
                      </View>
                    ) : null}

                    {/* Partner Contacts (PP / BSO / DSO from API) */}
                    {Array.isArray(details?.partner_contacts) && details.partner_contacts.length > 0 ? (
                      <View style={styles.contactsBlock}>
                        <Text style={styles.contactsTitle}>Madad ke Liye Sampark</Text>
                        {details.partner_contacts.map((c, i) => {
                          const roleMap = {
                            PP:  { color: '#0891B2' },
                            BSO: { color: '#7C3AED' },
                            DSO: { color: '#16A34A' },
                          };
                          const meta = roleMap[String(c?.role || '').toUpperCase()] || { color: '#475569' };
                          // Show ONLY the API-provided `role_description`. No static
                          // fallback — if the backend doesn't send it yet, the subline
                          // is omitted entirely.
                          const subline = (c?.role_description && String(c.role_description).trim()) || '';
                          return (
                            <View key={`${c?.role || ''}-${i}`} style={[styles.contactRow, i > 0 && styles.contactRowDivider]}>
                              <View style={[styles.contactRoleChip, { backgroundColor: meta.color }]}>
                                <Text style={styles.contactRoleChipT}>{String(c?.role || '').toUpperCase()}</Text>
                              </View>
                              <View style={{ flex: 1, paddingHorizontal: 10 }}>
                                <Text style={styles.contactName} numberOfLines={1}>{c?.name || '-'}</Text>
                                {!!subline && (
                                  <Text style={styles.contactRole} numberOfLines={2}>{subline}</Text>
                                )}
                              </View>
                              {c?.mobile ? (
                                <>
                                  <TouchableOpacity
                                    onPress={() => Linking.openURL(`tel:${String(c.mobile).replace(/\s+/g, '')}`).catch(() => {})}
                                    activeOpacity={0.7}
                                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                  >
                                    <Image source={require('./assets/call.png')} style={{ width: 28, height: 28, resizeMode: 'contain', tintColor: '#EA580C' }} />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => {
                                      const digits = String(c.mobile).replace(/[^\d]/g, '');
                                      Linking.openURL(`whatsapp://send?phone=${digits}`).catch(() =>
                                        Linking.openURL(`https://wa.me/${digits}`).catch(() => {}),
                                      );
                                    }}
                                    activeOpacity={0.7}
                                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                                    style={{ marginLeft: 16 }}
                                  >
                                    <Image source={require('./assets/whatsapp.png')} style={{ width: 28, height: 28, resizeMode: 'contain' }} />
                                  </TouchableOpacity>
                                </>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })()}

              {/* ✅ Invoice — view / download / share */}
              <View style={styles.invoiceCard}>
                <View style={styles.invoiceHeader}>
                  <View style={styles.invoiceHeaderIconWrap}>
                    <Text style={styles.invoiceHeaderIconChar}>₹</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invoiceHeaderTitle}>Invoice</Text>
                    <Text style={styles.invoiceHeaderSub}>
                      {this.state.invoiceDownloading
                        ? `Downloading… ${Math.round((this.state.invoiceProgress || 0) * 100)}%`
                        : 'View, download or share the bill'}
                    </Text>
                  </View>
                </View>

                {/* Inline progress bar — only visible while downloading */}
                {this.state.invoiceDownloading ? (
                  <View style={styles.invoiceProgressTrack}>
                    <View
                      style={[
                        styles.invoiceProgressFill,
                        { width: `${Math.max(4, Math.round((this.state.invoiceProgress || 0) * 100))}%` },
                      ]}
                    />
                  </View>
                ) : null}

                <View style={styles.invoiceActions}>
                  {/* View — indigo */}
                  <TouchableOpacity
                    style={[styles.invoicePill, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }, this.state.invoiceDownloading && { opacity: 0.55 }]}
                    onPress={this.viewInvoice}
                    activeOpacity={0.8}
                    disabled={this.state.invoiceDownloading}
                  >
                    <View style={[styles.invoicePillIconWrap, { backgroundColor: '#4F46E5' }]}>
                      <Text style={styles.invoicePillIconChar}>▶</Text>
                    </View>
                    <Text style={[styles.invoicePillText, { color: '#4338CA' }]}>View</Text>
                  </TouchableOpacity>

                  {/* Download — cyan */}
                  <TouchableOpacity
                    style={[styles.invoicePill, { backgroundColor: '#ECFEFF', borderColor: '#A5F3FC' }, this.state.invoiceDownloading && { opacity: 0.55 }]}
                    onPress={this.downloadInvoice}
                    activeOpacity={0.8}
                    disabled={this.state.invoiceDownloading}
                  >
                    <View style={[styles.invoicePillIconWrap, { backgroundColor: '#0891B2' }]}>
                      {this.state.invoiceDownloading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.invoicePillIconChar}>↓</Text>
                      )}
                    </View>
                    <Text style={[styles.invoicePillText, { color: '#0E7490' }]}>
                      {this.state.invoiceDownloading ? `${Math.round((this.state.invoiceProgress || 0) * 100)}%` : 'Download'}
                    </Text>
                  </TouchableOpacity>

                  {/* Share — emerald */}
                  <TouchableOpacity
                    style={[styles.invoicePill, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }, this.state.invoiceDownloading && { opacity: 0.55 }]}
                    onPress={this.shareInvoice}
                    activeOpacity={0.8}
                    disabled={this.state.invoiceDownloading}
                  >
                    <View style={[styles.invoicePillIconWrap, { backgroundColor: '#059669' }]}>
                      <Text style={styles.invoicePillIconChar}>↗</Text>
                    </View>
                    <Text style={[styles.invoicePillText, { color: '#047857' }]}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* ✅ Payment / Collect Payment (added exactly like your UI) */}
              {/* <View style={[styles.card, { padding: 12 }]}>
                {isPaid ? (
                  <>
                    <Text style={styles.receiveTitle}>Payment</Text>

                    <View style={styles.methodRow}>
                      <View style={[styles.methodIcon, { backgroundColor: '#E7FAF3' }]}>
                        <Text style={{ fontSize: 22, fontWeight: '900', color: '#0F7451' }}>✓</Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={[styles.methodTitle, { color: '#0F7451' }]}>
                          {String(paymentStatus || 'Paid').toUpperCase()}
                        </Text>

                        {!!paymentMode ? (
                          <Text style={styles.methodSub}>{paymentMode}</Text>
                        ) : (
                          <Text style={styles.methodSub}>Online</Text>
                        )}
                      </View>
                    </View>

                    <View style={{ marginTop: 6 }}>
                      <Text style={{ color: '#6B7280', fontWeight: '700', fontSize: 12 }}>
                        Amount : ₹ {total}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.receiveTitle}>Collect Payment</Text>

                    <View style={styles.methodRow}>
                      <View style={styles.methodIcon}>
                        <Image style={{ height: 30, width: 30, resizeMode: 'contain' }} source={require('./assets/crn.png')} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.methodTitle}>
                          {this.state.payment_type === 'cash' ? 'Collect Cash' : 'Scan QR Code'}
                        </Text>
                        <Text style={styles.methodSub}>{`₹ ${total}`}</Text>
                      </View>
                    </View>

                    <View style={styles.payTiles}>
                      <TouchableOpacity
                        style={[
                          styles.payTile,
                          {
                            borderWidth: this.state.payment_type == 'cash' ? 5 : 1,
                            borderColor: this.state.payment_type == 'cash' ? '#F37A20' : 'grey',
                          },
                        ]}
                        onPress={this.onCollectCash}
                        activeOpacity={0.9}
                      >
                        <View style={styles.payImg}>
                          <Image style={{ height: 80, width: 80 }} source={require('./assets/crn.png')} />
                        </View>
                        <View style={styles.payFooterPrimary}>
                          <Text style={styles.payTileText}>Collect Cash</Text>
                        </View>
                      </TouchableOpacity>

                      {this.renderQrTile()}
                    </View>
                  </>
                )}
              </View> */}

              <View style={{ height: 14 }} />
            </Animated.View>
          ) : null}
        </ScrollView>

        {/* ✅ Bottom panel — solid status color for delivered/cancelled (matches header) */}
        {(() => {
          const s = String(details?.order_status || '').toLowerCase();
          const isDelivered = s === 'delivered' || s === 'deliver';
          const isCancelled = s === 'cancelled' || s === 'canceled';
          const isRto = s === 'rto';
          const isRejected = s === 'rejected' || s === 'reject';
          // Bottom panel stays neutral white for every status — the status is
          // already conveyed by the inline status badge inside the panel and
          // by the order card above. A solid colored panel reads too heavy.
          const onDark = false;
          const panelBg = '#FFF';
          return (
            <SafeAreaView
              edges={['bottom']}
              style={[styles.bottomPanel, { backgroundColor: panelBg }]}
            >
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, onDark && { color: '#FFF' }]}>Kul Amount</Text>
                <Text style={[styles.codValue, onDark && { color: '#FFF' }]}>{`₹ ${this.toNum(details?.grand_total)}`}</Text>
              </View>
              <View style={styles.totalWordsRow}>
                <Text style={[styles.totalWords, onDark && { color: 'rgba(255,255,255,0.85)' }, { flex: 1 }]}>
                  {this.amountInWords(details?.grand_total)}
                </Text>
                {(() => {
                  // Always show a status pill next to the Grand Total — same chip
                  // shape as the OrderCard so the order's current state is visible
                  // at the bottom regardless of which CTA is rendered below.
                  if (!details?.order_status) return null;
                  const so = STATUS_COLORS.getStatus(details.order_status);
                  const glyphMap = {
                    DELIVERED: '✓',
                    CANCELLED: '✕',
                    REJECTED:  '✕',
                    RTO:       '↩',
                    PENDING:   '•',
                    RESCHEDULE: '↻',
                    PICKUP:    '◔',
                    DISPUTED:  '⚑',
                  };
                  const glyph = glyphMap[so.key] || '';
                  return (
                    <View style={[styles.statusPill, { backgroundColor: so.bg, marginLeft: 8, marginTop: 2 }]}>
                      {!!glyph && <Text style={styles.statusPillIco}>{glyph}</Text>}
                      <Text style={styles.statusPillT}>{so.label}</Text>
                    </View>
                  );
                })()}
              </View>

              {(details?.order_status === 'pending' || details?.order_status === 'reschedule') && (
                <TouchableOpacity
                  style={[styles.neutralPrimaryBtn, { backgroundColor: STATUS_COLORS.STATUS.PICKUP.bg }]}
                  onPress={() => this.props.navigation.navigate('OrderOtpVerify', { orderId: details?.id, actionType: 'pickup', order: details })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.neutralPrimaryBtnT}>Order Pickup Karein</Text>
                  <Animated.View style={{ marginLeft: 10, transform: [{ translateX: this.pickupPulse.interpolate({ inputRange: [1, 1.03], outputRange: [0, 6] }) }] }}>
                    <Image source={require('./assets/arrow.png')} style={styles.neutralPrimaryBtnIco} />
                  </Animated.View>
                </TouchableOpacity>
              )}

              {details?.order_status === 'pickup' && (
                <TouchableOpacity
                  onPress={() => this.props.navigation.navigate('OrderOtpVerify', { orderId: details?.id, actionType: 'deliver', order: details })}
                  style={[styles.neutralPrimaryBtn, { backgroundColor: STATUS_COLORS.STATUS.DELIVERED.bg }]}
                  activeOpacity={0.85}
                >
                  <Image source={require('./assets/check.png')} style={[styles.neutralPrimaryBtnIco, { width: 16, height: 16, marginRight: 8 }]} />
                  <Text style={styles.neutralPrimaryBtnT}>Order Deliver Karein</Text>
                  <Animated.Image
                    source={require('./assets/arrow.png')}
                    style={[
                      styles.neutralPrimaryBtnArrow,
                      { transform: [{ translateX: this.pickupPulse.interpolate({ inputRange: [1, 1.03], outputRange: [0, 6] }) }] },
                    ]}
                  />
                </TouchableOpacity>
              )}

              {isRto && (
                <TouchableOpacity
                  onPress={() => this.props.navigation.navigate('OrderOtpVerify', { orderId: details?.id, actionType: 'rto', order: details })}
                  style={[styles.neutralPrimaryBtn, { backgroundColor: STATUS_COLORS.STATUS.RTO.bg }]}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.neutralPrimaryBtnT, { marginRight: 8 }]}>↩</Text>
                  <Text style={styles.neutralPrimaryBtnT}>Saaman Wapsi Confirm Karein</Text>
                </TouchableOpacity>
              )}

              {s !== 'disputed' && (
                <TouchableOpacity
                  style={styles.moreOptsBtn}
                  onPress={() => this.setState({ show_more_options: true })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.moreOptsDots}>⋯</Text>
                  <Text style={styles.moreOptsT}>Aur Options</Text>
                </TouchableOpacity>
              )}
            </SafeAreaView>
          );
        })()}

        {/* QR Fullscreen Modal */}
        <Modal
          visible={this.state.qrModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => this.setState({ qrModalVisible: false })}
        >
          <View style={[styles.qrModalWrap, { backgroundColor: qrBg, paddingBottom: QR_SAFE_BOTTOM }]}>
            <View style={{ paddingTop: QR_SAFE_TOP }}>
              <View style={[styles.qrTopBar]}>
                <TouchableOpacity
                  onPress={() => this.setState({ qrModalVisible: false })}
                  activeOpacity={0.85}
                  style={styles.qrCloseBtn}
                >
                  <Text style={styles.qrCloseText}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.qrTitle} numberOfLines={1}>Scan & Pay</Text>
                <View style={styles.qrTopSpacer} />
              </View>
            </View>
            <Text style={styles.qrSubtitle}>Ask farmer to scan this QR code</Text>

            <ScrollView
              contentContainerStyle={styles.qrScroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={[styles.qrCard, { width: qrSize + 32 }]}>
                {this.state.qr ? (
                  <Image
                    source={this.getQrImageSource()}
                    resizeMode="contain"
                    style={{ width: qrSize, height: qrSize, borderRadius: 8 }}
                    onError={(e) => {
                      const msg = JSON.stringify(e?.nativeEvent || {});
                      console.log('QR MODAL onError =>', msg);
                      this.setState({ qrFailed: true, qrErrorText: msg });
                    }}
                  />
                ) : (
                  <View style={[styles.qrModalPlaceholder, { width: qrSize, height: qrSize }]}>
                    {this.state.qrLoading ? (
                      <ActivityIndicator size="large" color={qrBg} />
                    ) : (
                      <Text style={styles.qrPlaceholderT}>QR not available</Text>
                    )}
                  </View>
                )}
              </View>

              <Text style={styles.qrCardAmt}>{'₹'} {total}</Text>

              <View style={styles.qrOrderCard}>
                <View style={styles.qrOrderTop}>
                  <Text style={styles.qrOrderOid} numberOfLines={1}>#{orderIdText}</Text>
                  <View style={styles.qrPayPill}>
                    <Text style={styles.qrPayPillT}>{(paymentMode || 'COD').toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.qrOrderDivider} />
                <View style={styles.qrOrderRow}>
                  <View style={styles.qrFarmerAv}>
                    <Text style={styles.qrFarmerAvT}>{(farmerName || 'F').trim().charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.qrFarmerInfo}>
                    <Text style={styles.qrOrderName} numberOfLines={1}>{farmerName || '-'}</Text>
                  </View>
                  <View style={styles.qrItemsChip}>
                    <Text style={styles.qrItemsChipT}>{totalItems || items.length || 0} item(s)</Text>
                  </View>
                </View>
              </View>

              {!!this.state.qrErrorText ? (
                <Text style={styles.qrErrorHint} numberOfLines={2}>{this.state.qrErrorText}</Text>
              ) : null}
            </ScrollView>
          </View>
        </Modal>

        {/* BottomSheet confirm */}
        {this.state.show_pickup_confirm ? (
          <BottomSheet
            ref={r => this.bottomSheetRef = r}
            visible={this.state.show_pickup_confirm}
            onSheetClose={() => this.setState({ show_pickup_confirm: false })}
            enablePanDownToClose={true}
            onChange={(status) => (status == -1 ? this.setState({ show_pickup_confirm: false }) : '')}
          >
            <View style={styles.bsContent}>
              {/* Header */}
              <View style={styles.bsHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bsTitle, { color: this.state.popup_type == 'reject' || this.state.popup_type == 'cancel' ? '#DC2626' : '#5D3FD3' }]}>
                    {this.state.popup_type == 'pickup' ? 'Pickup' : 'Reject Delivery'} Confirmation
                  </Text>
                  <Text style={styles.bsSub}>
                    {this.state.popup_type == 'cancel' || this.state.popup_type == 'reject'
                      ? 'Select a reason to proceed'
                      : 'Confirm order pickup?'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => this.bottomSheetRef?.close()} style={styles.bsCloseBtn} activeOpacity={0.7}>
                  <Text style={styles.bsCloseX}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Reasons list */}
              {(this.state.popup_type == 'cancel' || this.state.popup_type == 'reject') ? (
                <>
                  <View style={styles.bsDivider} />
                  <ScrollView
                    style={{ maxHeight: Dimensions.get('window').height * 0.38 }}
                    bounces={false}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    {this.state.popup_type == 'cancel' ? this.renderCancelReasons() : null}
                    {this.state.popup_type == 'reject' ? this.renderRejectReasons() : null}
                  </ScrollView>
                </>
              ) : null}

              {/* Action button */}
              <View style={styles.bsDivider} />
              <View style={styles.bsBtnWrap}>
                <TouchableOpacity
                  disabled={
                    ((this.state.popup_type == 'cancel' && !this.state.selectedCancelReason) ||
                      (this.state.popup_type == 'reject' && !this.state.selectedRejectReason)) ||
                    this.state.isLoading
                  }
                  onPress={() => {
                    if (this.state.popup_type == 'cancel') this.orderStatusApi(this.state.popup_type, this.state.selectedCancelReason);
                    else if (this.state.popup_type == 'reject') this.orderStatusApi(this.state.popup_type, this.state.selectedRejectReason);
                    else this.orderStatusApi(this.state.popup_type);
                  }}
                  style={[styles.bsConfirmBtn, {
                    backgroundColor: this.state.popup_type == 'reject' || this.state.popup_type == 'cancel' ? '#DC2626' : '#5D3FD3',
                    opacity: ((this.state.popup_type == 'cancel' && !this.state.selectedCancelReason) ||
                      (this.state.popup_type == 'reject' && !this.state.selectedRejectReason)) || this.state.isLoading ? 0.35 : 1,
                  }]}
                  activeOpacity={0.85}
                >
                  {!this.state.isLoading ? (
                    <Text style={styles.bsConfirmT}>{this.state.popup_type == 'pickup' ? 'Confirm Pickup' : 'Reject Delivery'}</Text>
                  ) : (
                    <ActivityIndicator size="small" color="#FFF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </BottomSheet>
        ) : null}

        {/* More Options sheet — Cancel / Re-schedule / Mark Dispute */}
        {this.state.show_more_options ? (() => {
          const d = details || {};
          const st = String(d?.order_status || '').toLowerCase();
          const isPending = st === 'pending';
          const isReschedule = st === 'reschedule';
          const isPickedUp = st === 'pickup';
          const closeAnd = (fn) => {
            this.moreSheetRef?.close();
            // give the close animation a beat before triggering navigation/popup
            setTimeout(() => fn?.(), 220);
          };
          const actionCount =
            ((isPending || isReschedule) ? 1 : 0) +
            (isPending ? 1 : 0) +
            (st !== 'disputed' ? 1 : 0);
          const safeBottom = initialWindowMetrics?.insets?.bottom ?? 0;
          const sheetMax = Math.min(
            130 + actionCount * 72 + 56 + safeBottom,
            Math.round(Dimensions.get('window').height * 0.55),
          );
          return (
            <BottomSheet
              ref={r => (this.moreSheetRef = r)}
              visible={true}
              dynamicSize
              maxDynamicContentSize={sheetMax}
              onSheetClose={() => this.setState({ show_more_options: false })}
              enablePanDownToClose={true}
              onChange={(status) => (status == -1 ? this.setState({ show_more_options: false }) : '')}
            >
              <View style={[styles.moreSheetWrap, { paddingBottom: 12 + safeBottom }]}>
                <View style={styles.moreSheetHeadRow}>
                  <View style={styles.moreSheetHeadIco}>
                    <Text style={styles.moreSheetHeadIcoT}>⋯</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.moreSheetTitle}>Aur Options</Text>
                    <Text style={styles.moreSheetSub}>Is order ke liye action chunein</Text>
                  </View>
                </View>

                <View style={styles.moreSheetActions}>
                  {(isPending || isReschedule) ? (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[styles.moreSheetTile, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                      onPress={() => closeAnd(() =>
                        this.props.navigation.navigate('RejectDelivery', { order: d })
                      )}
                    >
                      <View style={[styles.moreSheetIcoWrap, { backgroundColor: '#FEE2E2' }]}>
                        <Text style={[styles.moreSheetIco, { color: '#DC2626' }]}>✕</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.moreSheetRowT, { color: '#B91C1C' }]}>Delivery Reject Karein</Text>
                        <Text style={styles.moreSheetRowS}>Reason ke saath delivery cancel karein</Text>
                      </View>
                      <Text style={[styles.moreSheetChev, { color: '#B91C1C' }]}>›</Text>
                    </TouchableOpacity>
                  ) : null}

                  {isPending ? (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[styles.moreSheetTile, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}
                      onPress={() => closeAnd(() =>
                        this.props.navigation.navigate('RescheduleDelivery', { order: d })
                      )}
                    >
                      <View style={[styles.moreSheetIcoWrap, { backgroundColor: '#EDE9FE' }]}>
                        <Text style={[styles.moreSheetIco, { color: '#5D3FD3' }]}>↻</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.moreSheetRowT, { color: '#5D3FD3' }]}>Re-schedule Karein</Text>
                        <Text style={styles.moreSheetRowS}>Delivery ka din badlein</Text>
                      </View>
                      <Text style={[styles.moreSheetChev, { color: '#5D3FD3' }]}>›</Text>
                    </TouchableOpacity>
                  ) : null}

                  {st !== 'disputed' ? (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      style={[styles.moreSheetTile, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
                      onPress={() => closeAnd(() =>
                        this.props.navigation.navigate('MarkDispute', { order: d, reasons: this.state.disputeReasons })
                      )}
                    >
                      <View style={[styles.moreSheetIcoWrap, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={[styles.moreSheetIco, { color: '#B45309' }]}>⚑</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.moreSheetRowT, { color: '#B45309' }]}>Dispute Lagayein</Text>
                        <Text style={styles.moreSheetRowS}>Is order par shikayat darj karein</Text>
                      </View>
                      <Text style={[styles.moreSheetChev, { color: '#B45309' }]}>›</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.moreSheetCancel}
                  onPress={() => this.moreSheetRef?.close()}
                >
                  <Text style={styles.moreSheetCancelT}>Band Karein</Text>
                </TouchableOpacity>
              </View>
            </BottomSheet>
          );
        })() : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F3F8' },

  headerWrap: { backgroundColor: '#5D3FD3' },
  headerSafe: { backgroundColor: '#5D3FD3' },
  headerRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center', marginLeft: 4 },
  backImg: { width: 17, height: 17, resizeMode: 'contain', tintColor: '#FFF' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 15, fontWeight: '600' },

  container: { paddingHorizontal: 8, paddingTop: 10, paddingBottom: 20 },

  pageBox: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  pageBoxText: { marginLeft: 10, fontSize: 12, fontWeight: '600', color: '#1E293B' },
  pageErrorText: { fontSize: 12, fontWeight: '600', color: '#64748B' },

  // Detail card styles
  ddCard: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },

  // Light-grey header band that wraps the order ID + status pill + farmer row
  // (matches the order-card pattern used in TrackOrders & LMDDashboard lists).
  ddTop: { backgroundColor: '#F1F5F9' },
  ddHero: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, paddingBottom: 6 },
  ddOid: { fontSize: 13, fontWeight: '700', color: '#5D3FD3' },
  ddDate: { fontSize: 11, fontWeight: '500', color: '#94A3B8', marginTop: 3 },
  ddChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  ddChipT: { fontSize: 9, fontWeight: '700', color: '#FFF' },

  ddPerson: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  ddAvt: { width: 36, height: 36, borderRadius: 18, resizeMode: 'cover', marginRight: 10 },
  ddName: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  ddPhone: { fontSize: 11, fontWeight: '500', color: '#94A3B8', marginTop: 2 },
  ddIco: { width: 30, height: 30, resizeMode: 'contain' },
  ddIcoOrange: { width: 30, height: 30, resizeMode: 'contain', tintColor: '#EA580C' },

  ddPayRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 12 },
  ddHeroAmt: { fontSize: 16, fontWeight: '700', color: '#16A34A' },

  ddPillGap: { marginRight: 6 },

  ddRoute: { padding: 12 },
  ddRouteRow: { flexDirection: 'row', alignItems: 'flex-start' },
  ddTl: { width: 14, alignItems: 'center', marginRight: 8, paddingTop: 3 },
  ddDot: { width: 8, height: 8, borderRadius: 4 },
  ddLine: { width: 1.5, flex: 1, minHeight: 10, backgroundColor: '#D1D5DB', marginVertical: 3 },
  ddRouteBody: { flex: 1, paddingBottom: 10 },
  ddRouteLbl: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  ddRouteTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  ddRoutePhone: { fontSize: 11, fontWeight: '500', color: '#94A3B8', marginTop: 2 },
  ddRouteAddr: { fontSize: 12, fontWeight: '500', color: '#64748B', lineHeight: 17, marginTop: 2 },

  ddInfoRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  ddInfoItem: { flex: 1 },
  ddInfoLabel: { fontSize: 11, fontWeight: '500', color: '#94A3B8', marginBottom: 4 },
  ddInfoVal: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  ddPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, alignSelf: 'flex-start', marginRight: 6 },
  ddPillT: { fontSize: 10, fontWeight: '600', color: '#FFF' },

  ddSlotRow: { paddingHorizontal: 12, paddingVertical: 8 },
  ddSlot: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, marginRight: 6, marginBottom: 4 },
  ddSlotT: { fontSize: 11, fontWeight: '500', color: '#475569' },

  ddSecTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginBottom: 8, marginTop: 6 },

  // Items card — single rounded container holding all line items, separated by an inner divider
  itemsCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    overflow: 'hidden',
  },
  ddItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12 },
  ddItemRowDivider: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  // Soft tinted container for the product image — gives the photo nicer framing
  ddItemImgWrap: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  ddProductImg: { width: 52, height: 52, resizeMode: 'contain' },
  ddProductFallback: { width: 28, height: 28, resizeMode: 'contain', tintColor: '#94A3B8' },
  ddItemName: { fontSize: 12, fontWeight: '600', color: '#1E293B', marginBottom: 6, lineHeight: 16 },
  ddItemMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  // Variation pill (e.g. "100 ML")
  ddItemVarPill: { backgroundColor: '#FFF7ED', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, marginRight: 6, borderWidth: 1, borderColor: '#FED7AA' },
  ddItemVar: { fontSize: 11, fontWeight: '600', color: '#C2410C' },
  // Quantity pill (e.g. "× 1")
  ddItemQtyPill: { backgroundColor: '#F1F5F9', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1, borderColor: '#E2E8F0' },
  ddItemQty: { fontSize: 11, fontWeight: '600', color: '#475569' },
  // Price column on the right
  ddItemPriceCol: { alignItems: 'flex-end', minWidth: 60 },
  ddItemPrice: { fontSize: 15, fontWeight: '700', color: '#16A34A' },
  ddItemUnit: { fontSize: 10, fontWeight: '500', color: '#94A3B8', marginTop: 2 },

  statusPill: { alignSelf: 'flex-start', borderRadius: 60, paddingHorizontal: 14, paddingVertical: 6 },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  orderIdLine: { fontSize: 12, fontWeight: '800', color: '#111827' },
  orderIdBold: { fontSize: 13, fontWeight: '800', color: '#F68A20' },
  smallMeta: { fontSize: 12, color: '#6B7280', fontWeight: '500', marginTop: 4 },
  orderMetaRow: { flexDirection: 'row', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF2F6' },
  orderMetaItem: { flex: 1, alignItems: 'center' },
  orderMetaLabel: { fontSize: 11, fontWeight: '500', color: '#9CA3AF', marginBottom: 4 },
  orderMetaValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  cardLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginBottom: 8 },

  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },

  farmerRow: { flexDirection: 'row', alignItems: 'center', padding: 5 },
  farmerName: { fontSize: 14, fontWeight: '700', color: '#000' },
  farmerMeta: { fontSize: 13, fontWeight: '400', lineHeight: 20, color: '#4B5563' },

  warehouseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  warehouseIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  warehouseAddress: { fontSize: 13, fontWeight: '400', lineHeight: 18, color: '#6B7280', marginTop: 2 },
  phoneMeta: { marginTop: 7, fontSize: 12, color: '#111827' },

  callIconImg: { width: 34, height: 34, resizeMode: 'contain' },
  waIconImg: { width: 34, height: 34, resizeMode: 'contain', marginLeft: 10 },

  itemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, marginTop: 20, paddingHorizontal: 4 },
  itemsTitle: { fontSize: 13, color: '#36454F', fontWeight: '500' },
  itemsTotal: { fontSize: 15, fontWeight: '700', color: '#0F7451' },

  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  itemSep: { borderTopWidth: 1, borderTopColor: '#EEF2F6' },
  itemImg: { alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  productImg: { width: 50, height: 50, borderRadius: 5, resizeMode: 'contain' },

  itemName: { flex:1,fontSize: 13, color: '#111827', fontWeight: '500', lineHeight: 20 },
  itemSub: { fontSize: 13, color: '#F37A20', fontWeight: '400', alignSelf: 'center' },
  itemPrice: { fontSize: 15, fontWeight: '600', color: '#0F7451' },
  itemQty: { fontSize: 12, color: '#000', fontWeight: '500', alignSelf: 'center' },

  bottomPanel: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 14,
    // SafeAreaView adds the platform inset on top of this value:
    //   iOS adds ~34px (home indicator) — too much; we offset it back with a negative value.
    //   Android adds ~24px (gesture nav) — already comfortable, so we keep a small positive padding.
    paddingBottom: Platform.OS === 'ios' ? -16 : 10,
    paddingTop: 10,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 0, marginTop: 2 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  codValue: { fontSize: 19, fontWeight: '800', color: '#F37A20' },
  totalWords: { fontSize: 11, fontWeight: '500', color: '#64748B', fontStyle: 'italic' },

  pickupBtn: { height: 42, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0891B2', marginTop: 6 },
  pickupBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  pickupArrow: { width: 12, height: 12, resizeMode: 'contain', tintColor: 'rgba(255,255,255,0.8)' },

  actionRow: { flexDirection: 'row', marginBottom: 0 },
  actionBtn: { flex: 1, height: 42, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  actionBtnIco: { width: 16, height: 16, resizeMode: 'contain', tintColor: '#FFF', marginRight: 8, opacity: 0.95 },
  actionBtnChar: { color: '#FFF', fontSize: 17, fontWeight: '500', marginRight: 8, includeFontPadding: false, lineHeight: 19 },
  actionBtnCharCancel: { color: '#FFF', fontSize: 16, fontWeight: '500', marginRight: 8, includeFontPadding: false, lineHeight: 18 },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // "Mark Dispute" CTA — light, subtle so it doesn't compete with primary actions.
  disputeBtn: {
    marginTop: 8,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CA8A04',
    backgroundColor: '#FEF3C7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disputeBtnOnDark: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.6)',
  },
  disputeBtnIco: { color: '#92400E', fontSize: 13, fontWeight: '800', marginRight: 6, includeFontPadding: false },
  disputeBtnT: { color: '#92400E', fontSize: 12.5, fontWeight: '700', letterSpacing: 0.3 },

  // Invoice download progress overlay
  dlOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  dlCard: { width: '100%', maxWidth: 320, backgroundColor: '#FFF', borderRadius: 16, padding: 22, alignItems: 'center' },
  dlIcoWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  dlIco: { width: 28, height: 28, resizeMode: 'contain', tintColor: '#5D3FD3' },
  dlTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  dlSub: { fontSize: 12, fontWeight: '500', color: '#64748B', marginTop: 2, marginBottom: 14 },
  dlBarWrap: { width: '100%', height: 8, borderRadius: 4, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  dlBarFill: { height: '100%', backgroundColor: '#5D3FD3', borderRadius: 4 },
  dlPct: { marginTop: 8, fontSize: 12, fontWeight: '700', color: '#5D3FD3', letterSpacing: 0.4 },

  // Compact terminal-status pill (Delivered / Cancelled / Returned) shown
  // inline to the right of the amount-in-words row, themed to match the
  // order's status color.
  totalWordsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  // Same look as the top OrderCard chip — solid status color, white text — plus a leading tick.
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusPillIco: { color: '#FFF', fontSize: 8.5, fontWeight: '900', marginRight: 4, includeFontPadding: false, lineHeight: 10 },
  statusPillT: { color: '#FFF', fontSize: 9, fontWeight: '700', letterSpacing: 0.3, includeFontPadding: false, lineHeight: 11 },

  // Neutral primary CTA (no status color) used by Pickup / Deliver / RTO buttons.
  neutralPrimaryBtn: {
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
  neutralPrimaryBtnT: { color: '#FFF', fontSize: 14.5, fontWeight: '600', letterSpacing: 0.3 },
  neutralPrimaryBtnIco: { width: 12, height: 12, resizeMode: 'contain', tintColor: 'rgba(255,255,255,0.85)' },
  neutralPrimaryBtnArrow: { width: 14, height: 14, resizeMode: 'contain', tintColor: '#FFF', marginLeft: 10 },

  // Outlined "More Options" button (kept, was already neutral).
  moreOptsBtn: { height: 44, marginTop: 8, borderRadius: 12, borderWidth: 1.2, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  moreOptsDots: { fontSize: 20, fontWeight: '700', color: '#475569', marginRight: 8, includeFontPadding: false, lineHeight: 22, textAlignVertical: 'center' },
  moreOptsT: { color: '#334155', fontSize: 13.5, fontWeight: '600', letterSpacing: 0.2, includeFontPadding: false, lineHeight: 22 },

  // More Options bottom-sheet — tile-based, taller, easier to scan.
  moreSheetWrap: { paddingHorizontal: 18, paddingTop: 4 },

  moreSheetHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  moreSheetHeadIco: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  // letterSpacing on the ⋯ glyph + lineHeight matching the chip height
  // keeps the dots vertically centered inside the round chip.
  moreSheetHeadIcoT: { fontSize: 22, fontWeight: '700', color: '#475569', includeFontPadding: false, lineHeight: 38, textAlign: 'center', textAlignVertical: 'center' },
  moreSheetTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A', letterSpacing: 0.1 },
  moreSheetSub: { fontSize: 12, fontWeight: '400', color: '#64748B', marginTop: 2 },

  moreSheetActions: { marginBottom: 4 },
  moreSheetTile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  moreSheetIcoWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  moreSheetIco: { fontSize: 16, fontWeight: '700', includeFontPadding: false, lineHeight: 18 },
  moreSheetRowT: { fontSize: 13.5, fontWeight: '600', letterSpacing: 0.1 },
  moreSheetRowS: { fontSize: 11.5, fontWeight: '500', color: '#64748B', marginTop: 2 },
  moreSheetChev: { fontSize: 22, fontWeight: '500', marginLeft: 6, marginTop: -2, includeFontPadding: false, opacity: 0.6 },

  moreSheetCancel: {
    marginTop: 10,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreSheetCancelT: { fontSize: 13.5, fontWeight: '600', color: '#475569' },

  primaryBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5D3FD3', marginBottom: 12 },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  dangerBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E35335' },
  dangerText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  emptyItemsText: { fontSize: 12, fontWeight: '700', color: '#6B7280', textAlign: 'center', paddingVertical: 10 },

  // Payment & Settlement summary card
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  summarySubSection: {
    marginBottom: 10,
  },
  summarySubSectionSep: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  summarySubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  summarySubTitle: { fontSize: 12.5, fontWeight: '700', color: '#334155' },
  summaryHdrIcon: { width: 20, height: 20, marginRight: 8, resizeMode: 'contain' },
  summaryTitle: { fontSize: 13, fontWeight: '600', color: '#1E293B' },

  // 2-column grid of stat boxes — icons shown inline without background discs.
  sumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sumBox: {
    width: '48.5%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6EBF1',
    backgroundColor: '#FAFBFC',
    paddingVertical: 9,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sumBoxFull: { width: '100%' },
  sumBoxAlignTop: { alignItems: 'flex-start' },
  sumBoxIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: SUM_ICON_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
    flexShrink: 0,
  },
  sumBoxIconImg: { width: 24, height: 24, resizeMode: 'contain' },
  sumBoxGlyph: {
    fontSize: 17,
    fontWeight: '800',
    color: '#059669',
    includeFontPadding: false,
    lineHeight: 19,
  },
  sumBoxContent: {
    flex: 1,
    alignItems: 'flex-start',
  },
  sumBoxLbl: {
    fontSize: 9.5,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  sumBoxVal: { fontSize: 12.5, fontWeight: '600', color: '#0F172A', lineHeight: 16 },
  sumBoxValSm: { fontSize: 10.5, fontWeight: '500', color: '#0F172A', lineHeight: 14 },
  sumBoxValMulti: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  sumBoxChipT: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.4 },

  // Receipt-style list rows
  psRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
  },
  // Small colored dot — quick visual accent without the heavy icon disc
  psDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  psLbl: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#475569',
  },
  psVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    maxWidth: '55%',
    textAlign: 'right',
  },
  // Status chip rendered as bold colored text (no pill) so it aligns with regular value text
  psChip: {
    fontSize: 13,
    fontWeight: '800',
    maxWidth: '55%',
    textAlign: 'right',
  },
  // Subsection header — tiny uppercase label that groups related rows
  psSubHdr: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 10,
    marginBottom: 2,
  },
  psDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginTop: 6,
  },

  // Critical alert banner (Penalty / Dispute) — stands out with a red bar + warning glyph
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 10,
    paddingHorizontal: 10,
    paddingLeft: 14,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  alertBannerBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#DC2626',
  },
  alertBannerIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  alertBannerIconChar: { color: '#FFF', fontSize: 14, fontWeight: '900', lineHeight: 16 },
  alertBannerTitle: { fontSize: 12, fontWeight: '800', color: '#991B1B', marginBottom: 2 },
  alertBannerText: { fontSize: 12, fontWeight: '500', color: '#B91C1C', lineHeight: 17 },

  // Delivery Slots — compact chip row card
  slotsCard: {
    backgroundColor: '#ECFEFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A5F3FC',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  slotsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  slotsHeaderIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  slotsHeaderIconChar: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  slotsHeaderTitle: { fontSize: 12, fontWeight: '700', color: '#0E7490' },
  slotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  slotChip: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#A5F3FC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  slotChipLbl: { fontSize: 10, fontWeight: '700', color: '#0E7490', marginBottom: 1 },
  slotChipTime: { fontSize: 11, fontWeight: '600', color: '#475569' },

  // Delivery Partner card — avatar + name + phone
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  partnerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5D3FD3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  partnerAvatarChar: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  partnerLbl: { fontSize: 10, fontWeight: '500', color: '#6B7280', marginBottom: 1 },
  partnerName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  partnerPhone: { fontSize: 12, fontWeight: '500', color: '#64748B', marginTop: 1 },

  // Support contacts (PP / BSO / DSO from API `partner_contacts`)
  contactsBlock: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6EBF1',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  contactsTitle: { fontSize: 11, fontWeight: '600', color: '#64748B', letterSpacing: 0.4, marginBottom: 6, textTransform: 'uppercase' },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  contactRowDivider: { borderTopWidth: 1, borderTopColor: '#E6EBF1' },
  contactRoleChip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, minWidth: 38, alignItems: 'center' },
  contactRoleChipT: { color: '#FFF', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  contactName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  contactRole: { fontSize: 10.5, fontWeight: '500', color: '#94A3B8', marginTop: 1 },

  // Invoice card
  invoiceCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden', // so the colored header band clips to the rounded corners
  },
  // Soft pastel indigo banner — much lighter than before, dark text for contrast
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#E0E7FF',
  },
  invoiceHeaderIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#4338CA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  invoiceHeaderIconChar: { color: '#FFF', fontSize: 18, fontWeight: '800', lineHeight: 20 },
  invoiceHeaderTitle: { fontSize: 14, fontWeight: '700', color: '#3730A3' },
  invoiceHeaderSub: { fontSize: 10, fontWeight: '500', color: '#4F46E5', marginTop: 1 },

  // Inline download progress (shown inside the Invoice card while downloading)
  invoiceProgressTrack: {
    height: 5,
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  invoiceProgressFill: {
    height: '100%',
    backgroundColor: '#0891B2',
    borderRadius: 3,
  },

  // Three horizontal pill buttons with icon + label inline
  invoiceActions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  invoicePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  invoicePillIcon: { width: 16, height: 16, resizeMode: 'contain', marginRight: 6 },
  // Small solid-colored disc on the pill — white character icon inside for guaranteed crispness
  invoicePillIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },
  invoicePillIconChar: { color: '#FFF', fontSize: 13, fontWeight: '800', lineHeight: 15 },
  invoicePillText: { fontSize: 12, fontWeight: '600' },

  // Bottom sheet
  bsContent: { paddingHorizontal: 20, paddingBottom: 20 },
  bsHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 6, paddingBottom: 2 },
  bsTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  bsSub: { fontSize: 13, fontWeight: '400', color: '#94A3B8', lineHeight: 18 },
  bsCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginLeft: 12, marginTop: 2 },
  bsCloseX: { fontSize: 16, fontWeight: '700', color: '#94A3B8' },
  bsDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
  bsBtnWrap: { alignItems: 'center', paddingTop: 4 },
  bsConfirmBtn: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, minWidth: 160 },
  bsConfirmT: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  reasonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, marginBottom: 3 },
  reasonRowActive: { backgroundColor: '#FEF2F2' },
  radioOuter: { height: 22, width: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radioOuterActive: { borderColor: '#DC2626', borderWidth: 2 },
  radioInner: { height: 12, width: 12, borderRadius: 6, backgroundColor: '#DC2626' },
  reasonText: { flex: 1, color: '#334155', fontWeight: '500', fontSize: 14 },
  reasonTextActive: { color: '#DC2626', fontWeight: '600' },

  // ✅ Payment styles (added)
  receiveTitle: { fontSize: 13, fontWeight: '700', color: '#000', marginBottom: 15 },

  methodRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  methodIcon: { width: 50, height: 50, borderRadius: 5, backgroundColor: '#E7FAF3', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  methodTitle: { fontSize: 12, fontWeight: '600', color: '#F37A20' },
  methodSub: { marginTop: 4, fontSize: 18, fontWeight: '800', color: '#0F7451' },

  payTiles: { flexDirection: 'row', justifyContent: 'space-between' },
  payTile: {
    width: (Dimensions.get('window').width - 14 * 2 - 12 * 2 - 10) / 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  payImg: { flex: 1, minHeight: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7FAF3' },
  payFooterPrimary: { height: 40, backgroundColor: '#2F7D67', alignItems: 'center', justifyContent: 'center' },
  payTileText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  qrThumb: { height: '100%', width: '100%' },

  // QR Modal
  qrModalWrap: { flex: 1 },
  qrTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 12,
  },
  qrCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCloseText: { color: '#FFF', fontSize: 16, fontWeight: '700', lineHeight: 18 },
  qrTopSpacer: { width: 40, height: 40 },
  qrTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#FFF', marginHorizontal: 8 },
  qrSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  qrScroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20, justifyContent: 'center' },
  qrCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  qrModalPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qrPlaceholderT: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
  qrCardAmt: { fontSize: 26, fontWeight: '800', color: '#FCD34D', textAlign: 'center', marginTop: 14, marginBottom: 12 },
  qrOrderCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  qrOrderTop: { flexDirection: 'row', alignItems: 'center' },
  qrOrderOid: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1E293B', marginRight: 8 },
  qrPayPill: { backgroundColor: '#EDE9FE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  qrPayPillT: { fontSize: 10, fontWeight: '700', color: '#5D3FD3', letterSpacing: 0.3 },
  qrOrderDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
  qrOrderRow: { flexDirection: 'row', alignItems: 'center' },
  qrFarmerAv: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  qrFarmerAvT: { fontSize: 15, fontWeight: '700', color: '#5D3FD3' },
  qrFarmerInfo: { flex: 1, minWidth: 0 },
  qrOrderName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  qrItemsChip: { backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8 },
  qrItemsChipT: { fontSize: 11, fontWeight: '700', color: '#D97706' },
  qrErrorHint: { marginTop: 10, fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.6)', textAlign: 'center', paddingHorizontal: 16 },
});
export default withV4Navigation(DeliveryDetails);
