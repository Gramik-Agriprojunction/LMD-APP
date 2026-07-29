// CashSettlement.js
// ✅ Preserves your current design (hero + pills + cards)
// ✅ No dummy/static data
// ✅ Banks vertical list; upload + preview ONLY for selected bank
// ✅ UPI: Pay Now + Upload Screenshot + preview
// ✅ Submit: constants.submitSettlement (order_ids[], type, bank_list_id) + sends ONLY relevant proof

import React, { Component } from 'react';
import { withV4Navigation } from "../utils/v4Compat";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  ScrollView,
  Platform,
  Modal,
  ActivityIndicator,
  Linking,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import constants from '../utils/constants';
import Toast from 'react-native-simple-toast';
import { invalidateSettlementRelated } from '../utils/dataCache';
let ImageCropPicker = null;
try { ImageCropPicker = require('react-native-image-crop-picker').default || require('react-native-image-crop-picker'); } catch(e) { console.log('ImageCropPicker not available'); }
import moment from 'moment';
import { requestCameraOrPrompt } from '../utils/cameraHelper';
import SettlementQrModal from '../components/SettlementQrModal';
import SettlementPaymentSuccessModal from '../components/SettlementPaymentSuccessModal';


const THEME = {
  green: '#5D3FD3',
  greenDark: '#5D3FD3',
  greenPill: '#5D3FD3',
  bg: '#F0F3F8',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#1E293B',
  subText: '#64748B',
  orange: '#F37A20',
  soft: '#EEF2FF',
  pillBg: '#EEF2FF',
  pillBorder: '#C7D2FE',
  radioBorder: '#CBD5E1',
  grayDot: '#36454F',
};


class CashSettlement extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      submitting: false,

      // ✅ checkSettle response
      checkData: null,
      apiOrders: null,
      banks: [],
      selectedBankId: null,

      // ✅ type selection
      selectedType: 'upi', // 'upi' | 'bank'
      proofMethod: 'upi_screenshot', // 'upi_screenshot' | 'qr'

      // upload flow
      pickerVisible: false,
      confirmVisible: false,
      pickingFor: null, // 'upi' | 'bank'
      upiImage: null, // { uri, type, name }
      bankImage: null, // { uri, type, name }

      settlementQrUrl: '',
      settlementQrLoading: false,
      settlementQrFailed: false,
      settlementQrModalVisible: false,
      settlementQrTotal: null,
      settlementQrGenerating: false,
      settlementQrId: null,
      settlementRecordId: null,
      settlementQrReceivingPayment: false,
      settlementPaymentSuccessVisible: false,
      settlementPaymentSuccessAmount: '',
      settlementPaymentSuccessOrders: [],
      settlementPaymentSuccessTitle: 'Payment Received',
    };
  }

  componentDidMount() {
    this.checkSettleApi();
  }

  wait = (ms) => new Promise((r) => setTimeout(r, ms));
pickLock = false;

  // navigation
  getSettlement = () => this.props?.navigation?.getParam?.('settlement', null);
  getSelectedOrders = () => this.props?.navigation?.getParam?.('selectedOrders', []);
  getSelectedOrderItems = () => this.props?.navigation?.getParam?.('selectedOrderItems', []);

  goBack = () => {
    const nav = this.props?.navigation;
    if (nav?.goBack) nav.goBack();
  };

  // helpers
  toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  money = (v) => {
    if (v === undefined || v === null || v === '') return '';
    const s = String(v);
    return s.endsWith('.00') ? s.replace('.00', '') : s;
  };

  isPaymentSettled = () => {
    const ps = String(this.state.checkData?.payment_status || '').toLowerCase();
    return ps === 'success' || ps === 'paid' || ps === 'settled';
  };

  formatDate = (iso) => {
    if (!iso) return '';
    const m = moment(iso);
    if (!m.isValid()) return '';
    return m.format('DD MMMM, YYYY');
  };

  formatTime = (iso) => {
    if (!iso) return '';
    const m = moment(iso);
    if (!m.isValid()) return '';
    return m.format('hh:mm A');
  };

  // ✅ checkSettle API (POST)
  checkSettleApi = () => {
    const orderIds = Array.isArray(this.getSelectedOrders()) ? this.getSelectedOrders() : [];

    // If coming from history screen, there may be settlement param and no selectedOrders.
    // In that case, we can't call checkSettle (needs order_ids). UI will show only what settlement param has.
    if (!orderIds.length) {
      return;
    }

    const body = { order_ids: orderIds.map((id) => String(id)) };

    this.setState({ loading: true }, () => {
      fetch(constants.checkSettle, {
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
            console.log("Check Settle API response== ", JSON.stringify(json))
          const dataObj = json?.data && typeof json.data === 'object' ? json.data : null;
          const bankList = this.normalizeBankList(dataObj);
          const apiOrders = Array.isArray(dataObj?.orders)
            ? dataObj.orders
            : Array.isArray(dataObj?.order_list)
              ? dataObj.order_list
              : Array.isArray(dataObj?.list)
                ? dataObj.list
                : null;

          this.setState({
            loading: false,
            checkData: dataObj,
            banks: bankList,
            apiOrders,
            selectedBankId: bankList?.[0]?.id ?? null,
          });

          const settled = String(dataObj?.payment_status || '').toLowerCase();
          if (settled === 'success' && json?.message) {
            Toast.show(String(json.message), Toast.SHORT);
          }
        })
        .catch((e) => {
          this.setState({ loading: false });
          Toast.show(e?.message || String(e), Toast.SHORT);
        });
    });
  };

  getOrderIdsForApi = () => {
    const fromNav = Array.isArray(this.getSelectedOrders()) ? this.getSelectedOrders() : [];
    const fromItems = (this.getSelectedOrderItems() || [])
      .map((it) => it?.order_id ?? it?.id)
      .filter((v) => v !== undefined && v !== null && v !== '');

    const raw = fromItems.length ? fromItems : fromNav;
    const ids = raw
      .map((id) => Number(id))
      .filter((n) => Number.isFinite(n));

    if (ids.length) return ids;
    return fromNav.map((id) => Number(id)).filter((n) => Number.isFinite(n));
  };

  extractSettlementQrUrl = (json) => {
    const d = json?.data;
    if (typeof d === 'string' && /^https?:\/\//i.test(d.trim())) return d.trim();
    if (typeof json?.qr_image_url === 'string') return json.qr_image_url.trim();
    if (d && typeof d === 'object') {
      const u =
        d.qr_image_url ||
        d.qr_url ||
        d.qr ||
        d.image_url ||
        d.url ||
        '';
      if (u) return String(u).trim();
    }
    return '';
  };

  toDisplayImageUri = (pathOrUrl) => {
    if (!pathOrUrl) return '';
    if (/^https?:\/\//i.test(String(pathOrUrl))) return String(pathOrUrl).trim();
    const s = String(pathOrUrl).trim();
    if (s.startsWith('file://')) return s;
    return `file://${s}`;
  };

  prefetchSettlementQrImage = (remoteUrl) => {
    let BlobUtil = null;
    try {
      BlobUtil = require('react-native-blob-util').default || require('react-native-blob-util');
    } catch (e) {
      BlobUtil = null;
    }

    if (BlobUtil) {
      const ext = /\.jpe?g/i.test(remoteUrl) ? 'jpg' : 'png';
      const path = `${BlobUtil.fs.dirs.CacheDir}/settlement-qr-${Date.now()}.${ext}`;
      return BlobUtil.config({ fileCache: true, path })
        .fetch('GET', remoteUrl)
        .then((res) => this.toDisplayImageUri(res.path()));
    }

    return Image.prefetch(remoteUrl).then(() => String(remoteUrl).trim());
  };

  showSettlementPaymentSuccess = ({ amount, orders, title, toastMessage } = {}) => {
    const list = Array.isArray(orders) && orders.length ? orders : this.getDisplayOrders();
    const amountStr =
      this.money(amount) ||
      this.money(this.state.settlementQrTotal) ||
      this.money(this.state.checkData?.total_amount);

    invalidateSettlementRelated();

    this.setState({
      settlementQrModalVisible: false,
      settlementQrLoading: false,
      settlementQrFailed: false,
      settlementQrUrl: '',
      settlementQrTotal: null,
      settlementQrId: null,
      settlementRecordId: null,
      settlementQrReceivingPayment: false,
      settlementPaymentSuccessVisible: true,
      settlementPaymentSuccessAmount: amountStr,
      settlementPaymentSuccessOrders: list,
      settlementPaymentSuccessTitle: title || 'Payment Received',
    });

    if (toastMessage) Toast.show(String(toastMessage), Toast.SHORT);
  };

  generateSettlementQr = () => {
    if (this._settlementQrInFlight) return;

    const orderIds = this.getOrderIdsForApi();
    if (!orderIds.length) {
      Toast.show('Order IDs nahi mile', Toast.SHORT);
      return;
    }

    this._settlementQrInFlight = true;

    this.setState({
      settlementQrLoading: true,
      settlementQrFailed: false,
      settlementQrUrl: '',
      settlementQrTotal: null,
      settlementQrModalVisible: false,
      settlementQrGenerating: true,
      proofMethod: 'qr',
      selectedType: 'upi',
      upiImage: null,
    });

    const body = { order_ids: orderIds };
    console.log('Settlement QR API payload== ', JSON.stringify(body));

    fetch(constants.settlementQr, {
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
        console.log('Settlement QR API response== ', JSON.stringify(json));
        const data =
          json?.data && typeof json.data === 'object' && !Array.isArray(json.data) ? json.data : null;
        const qrUrl = this.extractSettlementQrUrl(json);
        const ok = !!json?.status && !!qrUrl;
        const amountRaw = data?.amount ?? json?.amount;
        const qrTotal = amountRaw != null ? this.money(amountRaw) : null;
        const recordId = data?.id ?? json?.id;
        const qrId = data?.qr_id ?? json?.qr_id;
        const settlementRecordId =
          recordId != null && Number.isFinite(Number(recordId)) ? Number(recordId) : null;
        const payStatus = String(data?.status || '').toLowerCase();

        if (payStatus === 'success' && !ok) {
          if (json?.message) Toast.show(String(json.message), Toast.SHORT);
          this.setState({
            settlementQrModalVisible: false,
            settlementQrLoading: false,
            settlementQrFailed: false,
            settlementQrUrl: '',
            settlementRecordId: null,
          });
          return null;
        }

        if (json?.message && !ok) Toast.show(String(json.message), Toast.SHORT);

        if (!ok) {
          this.setState({
            settlementQrModalVisible: false,
            settlementQrLoading: false,
            settlementQrFailed: true,
            settlementQrUrl: '',
            settlementRecordId: null,
          });
          if (!json?.message) Toast.show('QR url missing', Toast.SHORT);
          return null;
        }

        this.setState({
          settlementQrModalVisible: true,
          settlementQrLoading: true,
        });

        return this.prefetchSettlementQrImage(qrUrl)
          .then((displayUri) => {
            this.setState({
              settlementQrLoading: false,
              settlementQrFailed: false,
              settlementQrUrl: displayUri || this.toDisplayImageUri(qrUrl),
              settlementQrTotal: qrTotal,
              settlementQrId: qrId ? String(qrId) : null,
              settlementRecordId,
              proofMethod: 'qr',
              selectedType: 'upi',
              upiImage: null,
            });
          })
          .catch(() => {
            this.setState({
              settlementQrLoading: false,
              settlementQrFailed: false,
              settlementQrUrl: this.toDisplayImageUri(qrUrl),
              settlementQrTotal: qrTotal,
              settlementQrId: qrId ? String(qrId) : null,
              settlementRecordId,
              proofMethod: 'qr',
              selectedType: 'upi',
              upiImage: null,
            });
          });
      })
      .catch((e) => {
        console.log('Settlement QR API error== ', e);
        this.setState({
          settlementQrLoading: false,
          settlementQrFailed: true,
          settlementQrUrl: '',
        });
        Toast.show(e?.message || String(e), Toast.SHORT);
      })
      .finally(() => {
        this._settlementQrInFlight = false;
        this.setState({ settlementQrGenerating: false });
      });
  };

  closeSettlementQrModal = () => {
    this.setState({
      settlementQrModalVisible: false,
      settlementQrLoading: false,
      settlementQrFailed: false,
      settlementQrUrl: '',
      settlementQrTotal: null,
      settlementQrId: null,
      settlementRecordId: null,
      settlementQrReceivingPayment: false,
    });
  };

  receiveSettlementPayment = () => {
    const { settlementRecordId } = this.state;
    if (!settlementRecordId) {
      Toast.show('Settlement ID missing', Toast.SHORT);
      return;
    }
    if (this._settlementReceiveInFlight) return;

    this._settlementReceiveInFlight = true;
    this.setState({ settlementQrReceivingPayment: true });

    const body = { id: settlementRecordId };
    console.log('Settlement QR Payment Success API payload== ', JSON.stringify(body));

    fetch(constants.settlementQrPaymentSuccess, {
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
        console.log('Settlement QR Payment Success API response== ', JSON.stringify(json));
        const payStatus = String(json?.data?.status || '').toLowerCase();
        const isSuccess = payStatus === 'success';

        if (isSuccess) {
          const amountRaw = json?.data?.amount ?? json?.data?.received_amount ?? this.state.settlementQrTotal;
          this.showSettlementPaymentSuccess({
            amount: amountRaw,
            title: 'Payment Received',
            toastMessage: json?.status ? null : json?.message,
          });
          return;
        }

        if (json?.message) Toast.show(String(json.message), Toast.SHORT);
      })
      .catch((e) => {
        console.log('Settlement QR Payment Success API error== ', e);
        Toast.show(e?.message || String(e), Toast.SHORT);
      })
      .finally(() => {
        this._settlementReceiveInFlight = false;
        this.setState({ settlementQrReceivingPayment: false });
      });
  };

  finishSettlementPaymentSuccess = () => {
    if (this._paymentSuccessClosing) return;
    this._paymentSuccessClosing = true;
    const onComplete = this.props.navigation.getParam?.('onSettlementComplete');
    this.setState({ settlementPaymentSuccessVisible: false }, () => {
      this._paymentSuccessClosing = false;
      invalidateSettlementRelated();
      this.goBack();
      if (typeof onComplete === 'function') {
        setTimeout(() => onComplete(), 50);
      }
    });
  };

  setProofMethod = (method) => {
    if (method !== 'upi_screenshot' && method !== 'qr') return;
    this.setState((prev) => {
      if (prev.proofMethod === method) return null;
      const next = {
        proofMethod: method,
        selectedType: method === 'upi_screenshot' ? 'upi' : 'upi',
      };
      if (method === 'upi_screenshot') {
        next.settlementQrUrl = '';
        next.settlementQrId = null;
        next.settlementRecordId = null;
        next.settlementQrFailed = false;
        next.settlementQrModalVisible = false;
        next.settlementQrLoading = false;
      } else {
        next.upiImage = null;
      }
      return next;
    });
  };

  renderProofMethodRow = (method, title, subtitle) => {
    const selected = this.state.proofMethod === method;
    return (
      <TouchableOpacity
        key={method}
        activeOpacity={0.9}
        onPress={() => this.setProofMethod(method)}
        style={[styles.proofOptionRow, selected ? styles.proofOptionRowOn : null]}
      >
        <View style={[styles.radio, selected ? styles.radioOn : null]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.proofOptionTitle}>{title}</Text>
          {!!subtitle ? <Text style={styles.proofOptionSub}>{subtitle}</Text> : null}
        </View>
        {method === 'qr' && this.state.settlementQrId ? (
          <View style={styles.uploadedBadge}>
            <Text style={styles.uploadedBadgeT}>QR ready</Text>
          </View>
        ) : null}
        {method === 'upi_screenshot' && this.state.upiImage?.uri ? (
          <View style={styles.uploadedBadge}>
            <Text style={styles.uploadedBadgeT}>Uploaded</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  // --------- Upload UI flow ----------
  openPicker = (forType) => {
    this.setState({
      pickerVisible: true,
      pickingFor: forType,
      selectedType: forType === 'upi' ? 'upi' : 'bank',
    }, () => {
      console.log('Open picker for:', forType);
    });
  };

  closePicker = () => this.setState({ pickerVisible: false });

  cancelConfirm = () => this.setState({ confirmVisible: false, pickingFor: null,pickerVisible : false });

 pickImage = async (source) => {
  if (this.pickLock) return;
  this.pickLock = true;

  if (!ImageCropPicker) {
    this.pickLock = false;
    this.setState({ pickerVisible: false });
    Toast.show('Image picker not available on this device', Toast.SHORT);
    return;
  }

  const pickingForNow = this.state.pickingFor;

  this.setState({ pickerVisible: false }, async () => {
    try {
      await this.wait(Platform.OS === 'ios' ? 700 : 300);

      try { if (ImageCropPicker.clean) await ImageCropPicker.clean(); } catch (e) {}

      if (source === 'camera') {
        const allowed = await requestCameraOrPrompt();
        if (!allowed) return;
      }

      const opts = { mediaType: 'photo', cropping: false, compressImageQuality: 0.85, forceJpg: true };
      let img = null;

      try {
        img = source === 'camera' ? await ImageCropPicker.openCamera(opts) : await ImageCropPicker.openPicker(opts);
      } catch (pickErr) {
        const msg = String(pickErr?.message || '').toLowerCase();
        if (!msg.includes('cancel')) Toast.show(pickErr?.message || 'Unable to pick image', Toast.SHORT);
        return;
      }

      if (!img?.path) return;

      const file = {
        uri: img.path,
        type: img?.mime || 'image/jpeg',
        name: img?.filename || `${source}_${Date.now()}.jpg`,
      };

      if (pickingForNow === 'upi') {
        this.setState({
          upiImage: file,
          confirmVisible: true,
          proofMethod: 'upi_screenshot',
          selectedType: 'upi',
          settlementQrId: null,
          settlementQrUrl: '',
        });
      }
      if (pickingForNow === 'bank') this.setState({ bankImage: file, confirmVisible: true });
    } catch (e) {
      console.log('pickImage error:', e);
      Toast.show('Something went wrong', Toast.SHORT);
    } finally {
      setTimeout(() => { this.pickLock = false; }, Platform.OS === 'ios' ? 800 : 400);
    }
  });
};

  // ✅ UPI Pay Now (requires API key: checkSettle.data.upi_vpa)
  onPayNow = async () => {
    const { checkData } = this.state;

    const pa = String(checkData?.upi_vpa || '').trim(); // REQUIRED from API
    const pn = String(checkData?.upi_name || 'Gramik').trim(); // optional
    const tn = String(checkData?.upi_note || 'Cash Settlement').trim(); // optional
    const amt = this.money(checkData?.total_amount);

    if (!pa || !amt) {
      Toast.show('UPI payment details not available', Toast.SHORT);
      return;
    }

    this.setState({ selectedType: 'upi', proofMethod: 'upi_screenshot', settlementQrId: null, settlementQrUrl: '' });

    const url =
      `upi://pay?pa=${encodeURIComponent(pa)}` +
      `&pn=${encodeURIComponent(pn)}` +
      `&am=${encodeURIComponent(String(amt))}` +
      `&cu=INR` +
      `&tn=${encodeURIComponent(tn)}`;

    try {
      await Linking.openURL(url);
    } catch (e) {
      Toast.show('Unable to open UPI app', Toast.SHORT);
    }
  };

  // ✅ Submit using submitSettlement API
  onSubmit = () => {
    const orderIds = Array.isArray(this.getSelectedOrders()) ? this.getSelectedOrders() : [];
    const { proofMethod, selectedType, selectedBankId, upiImage, bankImage, settlementQrId } = this.state;

    if (!orderIds.length) {
      Toast.show('Order ids missing', Toast.SHORT);
      return;
    }

    if (proofMethod === 'upi_screenshot') {
      const banks = this.getDisplayBanks();
      if (banks.length && !selectedBankId) {
        Toast.show('Please select bank', Toast.SHORT);
        return;
      }
      if (!upiImage?.uri) {
        Toast.show('Please upload UPI screenshot', Toast.SHORT);
        return;
      }
    } else if (proofMethod === 'qr') {
      if (!settlementQrId) {
        Toast.show('Pehle Generate QR karein', Toast.SHORT);
        return;
      }
    } else {
      Toast.show('Payment method select karein', Toast.SHORT);
      return;
    }

    if (selectedType === 'bank') {
      if (!selectedBankId) {
        Toast.show('Please select bank', Toast.SHORT);
        return;
      }
      if (!bankImage?.uri) {
        Toast.show('Please upload bank receipt', Toast.SHORT);
        return;
      }
    }

    const fd = new FormData();
    orderIds.forEach((id, i) => fd.append(`order_ids[${i}]`, String(id)));
    fd.append('type', proofMethod === 'qr' ? 'upi' : selectedType);

    if (proofMethod === 'qr') {
      fd.append('qr_id', String(settlementQrId));
    }

    if (selectedType === 'bank') fd.append('bank_list_id', String(selectedBankId));

    if (proofMethod === 'upi_screenshot' && selectedType === 'upi') {
      fd.append('reciept', { uri: upiImage.uri, type: upiImage.type, name: upiImage.name });
    }
    if (selectedType === 'bank') {
      fd.append('reciept', { uri: bankImage.uri, type: bankImage.type, name: bankImage.name });
    }

    console.log('Submit Settlement API payload== ', JSON.stringify(fd));

    this.setState({ submitting: true }, () => {
      fetch(constants.submitSettlement, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + global.token,
          Accept: 'application/json',
        },
        body: fd,
      })
        .then((r) => r.json())
        .then((json) => {
          Toast.show(json?.message, Toast.SHORT);
          if (json.status) {
            invalidateSettlementRelated();
            this.setState({ submitting: false, confirmVisible: false, pickingFor: null });
            this.props.navigation.navigate('SettlementHistory');
          } else {
            this.setState({ submitting: false });
          }
        })
        .catch((e) => {
          this.setState({ submitting: false });
          Toast.show(e?.message || String(e), Toast.SHORT);
        });
    });
  };

  onCallSupport = () => {
    const phone = this.getSupportPhone();
    if (!phone) {
      Toast.show('Support number not available', Toast.SHORT);
      return;
    }
    const url = `tel:${String(phone).replace(/\s/g, '')}`;
    Linking.openURL(url).catch(() => Toast.show('Unable to call', Toast.SHORT));
  };

  onWhatsAppSupport = () => {
    const phone = this.getSupportPhone();
    if (!phone) {
      Toast.show('Support number not available', Toast.SHORT);
      return;
    }
    const digits = String(phone).replace(/[^\d]/g, '');
    if (!digits) {
      Toast.show('Support number not available', Toast.SHORT);
      return;
    }
    const url = `https://wa.me/${digits}`;
    Linking.openURL(url).catch(() => Toast.show('Unable to open WhatsApp', Toast.SHORT));
  };

  getSupportPhone = () => {
    const s = this.getSettlement();
    const { checkData } = this.state;
    return String(
      checkData?.support_phone ||
        s?.support_phone ||
        s?.lmd_phone ||
        s?.phone ||
        checkData?.helpline ||
        '',
    ).trim();
  };

  normalizeBankList = (dataObj) => {
    if (!dataObj || typeof dataObj !== 'object') return [];

    const fromList =
      (Array.isArray(dataObj['bank-list']) && dataObj['bank-list']) ||
      (Array.isArray(dataObj.bank_list) && dataObj.bank_list) ||
      (Array.isArray(dataObj.banks) && dataObj.banks) ||
      null;

    if (fromList?.length) return fromList;

    const single =
      (dataObj.bank && typeof dataObj.bank === 'object' ? dataObj.bank : null) ||
      (dataObj.selected_bank && typeof dataObj.selected_bank === 'object' ? dataObj.selected_bank : null) ||
      (dataObj.default_bank && typeof dataObj.default_bank === 'object' ? dataObj.default_bank : null);

    if (single) return [single];

    const bankName = String(dataObj.bank_name || dataObj.bankName || '').trim();
    const acc = String(dataObj.account_no || dataObj.account_number || dataObj.account || '').trim();
    const ifsc = String(dataObj.ifsc_code || dataObj.ifsc || '').trim();
    const branch = String(dataObj.branch || dataObj.bank_branch || '').trim();
    const holder = String(dataObj.account_holder || dataObj.beneficiary_name || dataObj.holder_name || '').trim();

    if (bankName || acc || ifsc) {
      return [{
        id: 'check-settle-bank',
        bank_name: bankName,
        account_no: acc,
        ifsc_code: ifsc,
        branch,
        account_holder: holder,
        address: String(dataObj.bank_address || dataObj.address || '').trim(),
      }];
    }

    return [];
  };

  getDisplayBanks = () => {
    const { banks, checkData } = this.state;
    if (Array.isArray(banks) && banks.length) return banks;
    return this.normalizeBankList(checkData);
  };

  renderBankRow = (b) => {
    const selected = String(this.state.selectedBankId) === String(b?.id);
    const bankName = String(b?.bank_name || b?.name || '').trim();
    const acc = String(b?.account_no || '').trim();
    const ifsc = String(b?.ifsc_code || '').trim();
    const address = String(b?.address || '').trim();

    if (!bankName && !acc && !ifsc) return null;

    return (
      <TouchableOpacity
        key={String(b?.id)}
        activeOpacity={0.9}
        onPress={() => this.setState({ selectedBankId: b?.id })}
        style={[styles.bankPickRow, selected ? styles.bankPickRowOn : null]}
      >
        <View style={[styles.radio, selected ? styles.radioOn : null]}>{selected ? <View style={styles.radioDot} /> : null}</View>

        <View style={{ flex: 1 }}>
          {!!bankName ? <Text style={styles.bankPickTitle}>{bankName}</Text> : null}
          {!!acc ? <Text style={styles.bankPickSub}>{`A/C: ${acc}`}</Text> : null}
          {!!ifsc ? <Text style={styles.bankPickSub}>{`IFSC: ${ifsc}`}</Text> : null}
          {!!address ? <Text style={styles.bankPickSub}>{address}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  };

  getDisplayOrders = () => {
    const { apiOrders } = this.state;
    if (Array.isArray(apiOrders) && apiOrders.length) return apiOrders;
    const passed = this.getSelectedOrderItems();
    return Array.isArray(passed) ? passed : [];
  };

  orderCode = (o) => {
    if (o?.order_code) return String(o.order_code).split(/\s+/)[0];
    if (o?.order_id != null) return String(o.order_id);
    return '-';
  };

  maskPhone = (p) => {
    if (!p) return '';
    const s = String(p);
    if (s.length < 6) return s;
    return s.slice(0, 2) + '****' + s.slice(-2);
  };

  renderOrderRow = (o, idx) => {
    const code = this.orderCode(o);
    const farmer = String(o?.farmer_name || o?.farmer?.name || '').trim();
    const phone = String(o?.farmer_mobile || o?.farmer?.phone || o?.farmer?.mobile || '').trim();
    const amount = this.money(o?.amount ?? o?.order_amount);
    const mode = String(o?.payment_mode || 'COD').toUpperCase();
    const isPaid = String(o?.payment_status || '').toLowerCase() === 'paid';
    const status = isPaid ? 'Paid' : 'Unpaid';

    return (
      <View key={`${code}-${idx}`} style={styles.orderCard}>
        <View style={styles.orderCardTop}>
          <View style={styles.orderAvtRing}>
            <Image
              source={require('./assets/farmernew.png')}
              style={styles.orderAvt}
              resizeMode="contain"
            />
          </View>

          <View style={styles.orderMain}>
            <View style={styles.orderTitleRow}>
              <Text style={styles.orderFarmer} numberOfLines={1}>{farmer || '-'}</Text>
              <Text style={styles.orderAmt}>₹{amount || '0'}</Text>
            </View>
            <Text style={styles.orderMeta} numberOfLines={1}>
              #{code}{!!phone ? ` · ${this.maskPhone(phone)}` : ''}
            </Text>
            <View style={styles.orderFoot}>
              <View style={styles.orderPill}><Text style={styles.orderPillT}>{mode}</Text></View>
              <View style={[styles.orderPill, isPaid ? styles.orderPillPaid : styles.orderPillUnpaid]}>
                <Text style={[styles.orderPillT, isPaid ? styles.orderPillTPaid : styles.orderPillTUnpaid]}>{status}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  render() {
    const s = this.getSettlement();
    const orderIds = Array.isArray(this.getSelectedOrders()) ? this.getSelectedOrders() : [];

    const { loading, submitting, checkData, banks, pickerVisible, confirmVisible, pickingFor, upiImage, bankImage,
      settlementQrModalVisible, settlementQrLoading, settlementQrFailed, settlementQrUrl, settlementQrTotal,
      settlementQrGenerating, settlementQrReceivingPayment,
      settlementPaymentSuccessVisible, settlementPaymentSuccessAmount, settlementPaymentSuccessOrders,
      settlementPaymentSuccessTitle,
    } = this.state;

    const amountStr = this.money(checkData?.total_amount) || this.money(s?.amount) || '';

    const orderCount =
      this.toNum(checkData?.total_order_count) ||
      this.toNum(s?.total_order_count) ||
      (orderIds.length ? orderIds.length : 0);

    const displayOrders = this.getDisplayOrders();
    const previewUri = pickingFor === 'upi' ? upiImage?.uri : pickingFor === 'bank' ? bankImage?.uri : null;
    const supportPhone = this.getSupportPhone();
    const upiVpa = String(checkData?.upi_vpa || '').trim();
    const displayBanks = this.getDisplayBanks();
    const paymentSettled = this.isPaymentSettled();

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.green} />

        {/* Header */}
        <View style={styles.headerWrap}>
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={this.goBack} style={styles.headerIconBtn} activeOpacity={0.85}>
                <Image style={styles.backImg} source={require('./assets/back.png')} />
              </TouchableOpacity>
              <Text style={styles.headerTitle} numberOfLines={1}>Cash Settlement</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {!!supportPhone ? (
                  <TouchableOpacity onPress={this.onCallSupport} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Image source={require('./assets/call.png')} style={{ width: 28, height: 28, resizeMode: 'contain' }} />
                  </TouchableOpacity>
                ) : (
                  <View style={{ width: 42 }} />
                )}
              </View>
            </View>
          </SafeAreaView>
        </View>

        <View style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {loading ? <ActivityIndicator size="large" color={THEME.green} style={{ marginTop: 40 }} /> : (
              <>
                {/* Amount hero */}
                {paymentSettled ? (
                  <View style={styles.heroStack}>
                    <View style={[styles.heroCard, styles.heroCardJoinedTop]}>
                      <View style={styles.heroRow}>
                        <View style={styles.heroLeft}>
                          <Text style={styles.heroLabel}>Settlement Amount</Text>
                          <Text style={styles.heroSub}>{orderCount || 0} order(s) selected</Text>
                          <View style={styles.heroSettledPill}>
                            <Text style={styles.heroSettledPillT}>✓ Payment received & settled</Text>
                          </View>
                        </View>
                        <View style={styles.heroRight}>
                          <Text style={styles.heroAmt}>{'₹'}{amountStr || '0'}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.settledBanner}>
                      <View style={styles.settledBannerIconWrap}>
                        <Text style={styles.settledBannerTick}>✓</Text>
                      </View>
                      <View style={styles.settledBannerTextCol}>
                        <Text style={styles.settledBannerTitle}>Payment received & settled</Text>
                        <Text style={styles.settledBannerSub}>
                          Is order ka payment ho chuka hai. Dubara settle karne ki zaroorat nahi hai.
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.heroCard}>
                    <View style={styles.heroRow}>
                      <View style={styles.heroLeft}>
                        <Text style={styles.heroLabel}>Settlement Amount</Text>
                        <Text style={styles.heroSub}>{orderCount || 0} order(s) selected</Text>
                        <Text style={styles.heroHint} numberOfLines={2}>
                          UPI screenshot ya QR se payment proof dein
                        </Text>
                      </View>
                      <View style={styles.heroRight}>
                        <Text style={styles.heroAmt}>{'₹'}{amountStr || '0'}</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Selected orders */}
                {displayOrders.length > 0 ? (
                  <View style={styles.ordersSection}>
                    <View style={styles.ordersSectionHead}>
                      <Text style={styles.ordersSectionTitle}>Selected Orders</Text>
                      <View style={styles.orderCountBadge}>
                        <Text style={styles.orderCountBadgeT}>{displayOrders.length}</Text>
                      </View>
                    </View>
                    {displayOrders.map((o, idx) => this.renderOrderRow(o, idx))}
                  </View>
                ) : null}

                {/* Support */}
                {!!supportPhone ? (
                  <View style={styles.supportCard}>
                    <View style={styles.supportMain}>
                      <Text style={styles.supportTitle}>Support</Text>
                      <Text style={styles.supportPhone}>{supportPhone}</Text>
                    </View>
                    <View style={styles.supportActions}>
                      <TouchableOpacity
                        style={styles.supportBtnCall}
                        onPress={this.onCallSupport}
                        activeOpacity={0.85}
                      >
                        <Image source={require('./assets/call.png')} style={styles.supportBtnIco} />
                        <Text style={styles.supportBtnCallT}>Call</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.supportBtnWa}
                        onPress={this.onWhatsAppSupport}
                        activeOpacity={0.85}
                      >
                        <Image source={require('./assets/whatsapp.png')} style={styles.supportBtnIco} />
                        <Text style={styles.supportBtnWaT}>WhatsApp</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Payment method</Text>
                  <Text style={styles.sectionSub}>Sirf ek option select karein</Text>
                  {this.renderProofMethodRow(
                    'upi_screenshot',
                    'UPI Screenshot',
                    'Pay karke payment screenshot upload karein',
                  )}
                  {this.renderProofMethodRow(
                    'qr',
                    'Generate QR',
                    'QR scan karke UPI payment karein',
                  )}
                </View>

                {this.state.proofMethod === 'upi_screenshot' ? (
                  <>
                    <View style={styles.sectionCard}>
                      <Text style={styles.sectionTitle}>Bank details</Text>
                      <Text style={styles.sectionSub}>
                        Bank select karein, pay karein, phir payment screenshot upload karein
                      </Text>

                      {displayBanks.length ? (
                        displayBanks.map((b) => this.renderBankRow(b))
                      ) : (
                        <View style={styles.bankDetailEmpty}>
                          <Text style={styles.bankDetailEmptyT}>
                            Bank details abhi load nahi hue. Thodi der baad dubara try karein ya support se sampark karein.
                          </Text>
                        </View>
                      )}

                      {!!upiVpa ? (
                        <View style={styles.upiInlineBox}>
                          <Text style={styles.infoLbl}>UPI VPA</Text>
                          <Text style={styles.infoVal}>{upiVpa}</Text>
                          {!!checkData?.upi_name ? (
                            <>
                              <Text style={[styles.infoLbl, { marginTop: 10 }]}>UPI name</Text>
                              <Text style={styles.infoVal}>{checkData.upi_name}</Text>
                            </>
                          ) : null}
                          <TouchableOpacity style={styles.payNowBtn} onPress={this.onPayNow} activeOpacity={0.85}>
                            <Text style={styles.uploadBtnText}>Pay Now · ₹{amountStr || '0'}</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.sectionCard}>
                      <View style={styles.sectionHead}>
                        <Text style={styles.sectionTitle}>UPI Screenshot</Text>
                        {!!upiImage?.uri ? (
                          <View style={styles.uploadedBadge}>
                            <Text style={styles.uploadedBadgeT}>Uploaded</Text>
                          </View>
                        ) : null}
                      </View>

                      {!!upiImage?.uri ? (
                        <Image source={{ uri: upiImage.uri }} style={styles.previewImgInline} resizeMode="cover" />
                      ) : null}

                      <TouchableOpacity
                        style={styles.uploadBtn}
                        onPress={() => {
                          this.setProofMethod('upi_screenshot');
                          this.openPicker('upi');
                        }}
                        activeOpacity={0.85}
                      >
                        <Image style={styles.camIcon} source={require('./assets/cam.png')} />
                        <Text style={styles.uploadBtnText}>
                          {upiImage?.uri ? 'Re-upload' : 'Upload UPI Screenshot'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : null}

                <View style={{ height: 120 }} />
              </>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footerWrap}>
            {this.state.proofMethod === 'qr' ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  this.setProofMethod('qr');
                  this.generateSettlementQr();
                }}
                style={[
                  styles.footerGenerateQrBtn,
                  settlementQrGenerating ? { opacity: 0.6 } : null,
                ]}
                disabled={settlementQrGenerating}
              >
                {settlementQrGenerating && !settlementQrModalVisible ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.footerGenerateQrText}>
                    Generate QR{amountStr ? ` · ₹${amountStr}` : ''}
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <>
                <Text style={styles.noteText}>Verification by Gramik Finance team takes up to 24 hours</Text>
                <TouchableOpacity activeOpacity={0.85} onPress={this.onSubmit} style={[styles.submitBtn, submitting ? { opacity: 0.6 } : null]} disabled={submitting}>
                  {!submitting ? <Text style={styles.submitText}>Submit for Verification</Text> : <ActivityIndicator size="small" color="#FFF" />}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Picker Modal */}
        <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={this.closePicker}>
  <View style={styles.modalBackdrop}>
    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={this.closePicker} />

    <View style={styles.modalCard}>
      <Text style={styles.modalTitle}>
        {this.state.pickingFor === 'bank' ? 'Upload Bank Receipt' : 'Upload UPI Screenshot'}
      </Text>

      <TouchableOpacity activeOpacity={0.9} onPress={() => this.pickImage('camera')} style={styles.modalBtn}>
        <Text style={styles.modalBtnText}>Camera</Text>
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.9} onPress={() => this.pickImage('gallery')} style={styles.modalBtn}>
        <Text style={styles.modalBtnText}>Gallery</Text>
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.9} onPress={this.closePicker} style={styles.modalCancelBtn}>
        <Text style={styles.modalCancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>

        {/* Confirm Modal */}
        <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={this.cancelConfirm}>
          <TouchableOpacity activeOpacity={1} onPress={this.cancelConfirm} style={styles.modalBackdrop}>
            <TouchableOpacity activeOpacity={1} style={styles.confirmCard}>
              <Text style={styles.modalTitle}>Confirm Upload</Text>

              {!!previewUri ? <Image source={{ uri: previewUri }} style={styles.previewImg} resizeMode="contain" /> : null}

              <TouchableOpacity activeOpacity={0.9} onPress={() => this.setState({ confirmVisible: false, pickingFor: null })} style={styles.confirmBtn}>
                <Text style={styles.confirmBtnText}>Looks Good</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.9} onPress={this.cancelConfirm} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        <SettlementQrModal
          visible={settlementQrModalVisible}
          uri={settlementQrUrl}
          loading={settlementQrLoading}
          failed={settlementQrFailed}
          total={settlementQrTotal || amountStr}
          receiveLoading={settlementQrReceivingPayment}
          onClose={this.closeSettlementQrModal}
          onRetry={this.generateSettlementQr}
          onReceivePayment={this.receiveSettlementPayment}
        />

        <SettlementPaymentSuccessModal
          visible={settlementPaymentSuccessVisible}
          amount={settlementPaymentSuccessAmount || amountStr}
          orders={settlementPaymentSuccessOrders}
          title={settlementPaymentSuccessTitle}
          onDone={this.finishSettlementPaymentSuccess}
        />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.bg },

  // Header
  headerWrap: { backgroundColor: THEME.green },
  headerSafe: { backgroundColor: THEME.green },
  headerRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  backImg: { width: 17, height: 17, resizeMode: 'contain', tintColor: '#FFF' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 15, fontWeight: '800' },

  bodySafe: { flex: 1, backgroundColor: THEME.bg },
  scrollContent: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 170 },

  // Hero card
  heroCard: {
    backgroundColor: '#5D3FD3',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  heroStack: {
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#86EFAC',
    backgroundColor: '#DCFCE7',
  },
  heroCardJoinedTop: {
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLeft: {
    flex: 1,
    paddingRight: 12,
    minWidth: 0,
  },
  heroRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroLabel: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.55)' },
  heroAmt: { fontSize: 24, fontWeight: '700', color: '#FFF', letterSpacing: -0.3 },
  heroSub: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.72)', marginTop: 4 },
  heroHint: { fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.45)', marginTop: 8, lineHeight: 15 },
  heroSettledPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(187,247,208,0.75)',
  },
  heroSettledPillT: {
    color: '#BBF7D0',
    fontSize: 11,
    fontWeight: '600',
  },
  settledBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: '#DCFCE7',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(22,163,74,0.25)',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  settledBannerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  settledBannerTick: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: -1,
  },
  settledBannerTextCol: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 2,
  },
  settledBannerTitle: {
    color: '#15803D',
    fontSize: 15,
    fontWeight: '700',
  },
  settledBannerSub: {
    marginTop: 6,
    color: '#166534',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },

  ordersSection: { marginTop: 10 },
  ordersSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  ordersSectionTitle: { fontSize: 14, fontWeight: '700', color: THEME.text, flex: 1 },

  orderCard: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: THEME.green,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  orderCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  orderMain: { flex: 1, minWidth: 0, marginLeft: 10 },
  orderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  orderAvtRing: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  orderAvt: { width: 28, height: 28 },
  orderFarmer: { fontSize: 14, fontWeight: '700', color: THEME.text, flex: 1 },
  orderMeta: { fontSize: 11, fontWeight: '600', color: THEME.subText, marginTop: 3 },
  orderAmt: { fontSize: 15, fontWeight: '800', color: '#16A34A', flexShrink: 0 },
  orderFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  orderPill: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  orderPillUnpaid: { backgroundColor: '#FFEDD5', borderColor: '#FDBA74' },
  orderPillPaid: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
  orderPillT: { fontSize: 9, fontWeight: '700', color: '#475569' },
  orderPillTUnpaid: { color: '#C2410C' },
  orderPillTPaid: { color: '#15803D' },
  orderCountBadge: {
    backgroundColor: '#EDE9FE',
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderCountBadgeT: { fontSize: 11, fontWeight: '800', color: THEME.green },

  infoCard: {
    marginTop: 10,
    backgroundColor: THEME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  infoLbl: { fontSize: 12, fontWeight: '500', color: THEME.subText },
  infoVal: { fontSize: 13, fontWeight: '700', color: THEME.text },

  supportCard: {
    marginTop: 10,
    backgroundColor: THEME.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  supportMain: { flex: 1, minWidth: 0 },
  supportTitle: { fontSize: 12, fontWeight: '500', color: THEME.subText },
  supportPhone: { marginTop: 4, fontSize: 15, fontWeight: '700', color: THEME.text },
  supportActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  supportBtnCall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  supportBtnWa: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  supportBtnIco: { width: 16, height: 16, resizeMode: 'contain', marginRight: 5 },
  supportBtnCallT: { fontSize: 12, fontWeight: '600', color: '#4338CA' },
  supportBtnWaT: { fontSize: 12, fontWeight: '600', color: '#047857' },

  collectionPill: {
    marginTop: 10,
    backgroundColor: '#E9EFEA',
    borderWidth: 1,
    borderColor: '#D8E6DE',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  collectionText: { fontSize: 13, fontWeight: '700', color: THEME.text },
  collectionStrong: { fontWeight: '900', color: THEME.text },
  collectionDot: { color: THEME.orange, fontWeight: '900' },

  lmdPill: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
  },
  lmdAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  lmdAvatarImg: { width: 30, height: 30, resizeMode: 'cover' },
  lmdText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },
  lmdPhone: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '400', marginLeft: 6 },

  sectionCard: {
    marginTop: 10,
    backgroundColor: THEME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: THEME.text },
  sectionSub: { fontSize: 11, fontWeight: '500', color: THEME.subText, marginBottom: 10, marginTop: -2 },
  proofOptionRow: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: '#fff',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  proofOptionRowOn: { borderColor: THEME.greenDark, backgroundColor: THEME.soft },
  proofOptionTitle: { fontSize: 13, fontWeight: '700', color: THEME.text },
  proofOptionSub: { marginTop: 4, fontSize: 11, fontWeight: '500', color: THEME.subText, lineHeight: 15 },
  uploadedBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  uploadedBadgeT: { fontSize: 10, fontWeight: '700', color: '#16A34A' },
  uploadBtn: { height: 44, borderRadius: 10, backgroundColor: '#16A34A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  uploadBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  innerCard: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#F7FAFB',
    borderWidth: 1,
    borderColor: '#EEF2F6',
    padding: 12,
  },
  innerTopRow: { flexDirection: 'row', alignItems: 'center' },
  innerTitle: { flex: 1, fontSize: 12, fontWeight: '500', color: '#000' },
  innerAmt: { fontSize: 16, fontWeight: '800', color: '#16A34A' },
  tickImg: { width: 22, height: 22, resizeMode: 'contain',marginLeft:10 },

  bigUploadBtn: {
    backgroundColor: '#5D3FD3',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent:'center'
  },
  camIcon: { width: 18, height: 18, resizeMode: 'contain', tintColor: '#fff', marginRight: 5},
  bigUploadText: { color: '#fff', fontSize: 12, fontWeight: '500' },

  previewImgInline: {
    width: '100%',
    height: Math.min(220, Dimensions.get('window').width * 0.55),
    borderRadius: 10,
    backgroundColor: THEME.bg,
    marginTop: 10,
  },

  // Bank list row
  bankPickRow: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: '#fff',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  bankPickRowOn: { borderColor: THEME.greenDark, backgroundColor: THEME.soft },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: THEME.radioBorder,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: THEME.greenDark },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: THEME.greenDark },
  bankPickTitle: { fontSize: 13, fontWeight: '700', color: THEME.text },
  bankPickSub: { marginTop: 5, fontSize: 11, fontWeight: '600', color: THEME.subText },
  bankDetailCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bankDetailName: { fontSize: 14, fontWeight: '700', color: THEME.text },
  bankDetailLine: { marginTop: 6, fontSize: 12, fontWeight: '500', color: THEME.subText, lineHeight: 17 },
  bankDetailEmpty: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  bankDetailEmptyT: { fontSize: 12, fontWeight: '500', color: '#9A3412', lineHeight: 17 },
  upiInlineBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.border,
  },
  payNowBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },

  smallUploadBtn: {
    marginTop: 12,
    height: 42,
    borderRadius: 12,
    backgroundColor: THEME.greenDark,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  smallUploadText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  receiptBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: '#fff',
    padding: 10,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptTitle: { fontSize: 13, fontWeight: '900', color: THEME.text, marginBottom: 8 },
  receiptImg: { width: '100%', height: 90, borderRadius: 10, backgroundColor: THEME.bg },
  receiptPlaceholder: { fontSize: 12, fontWeight: '600', color: THEME.subText, textAlign: 'center' },

  noteText: { fontSize: 11, fontWeight: '400', color: '#94A3B8', textAlign: 'center', marginBottom: 8 },

  // Footer
  footerWrap: {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: '#FFF',
  paddingHorizontal: 14,
  paddingTop: 10,
  paddingBottom: 34,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: -3 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
},
  submitBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F37A20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  footerGenerateQrBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerGenerateQrText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
  },
  confirmCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 14,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#5D3FD3', textAlign: 'center', marginBottom: 14 },
  modalBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  modalBtnText: { fontSize: 14, fontWeight: '700', color: '#5D3FD3' },
  modalCancelBtn: { paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: 13, fontWeight: '800', color: THEME.text },

  previewImg: {
    width: '100%',
    height: Math.min(260, Dimensions.get('window').width * 0.65),
    borderRadius: 12,
    backgroundColor: THEME.bg,
    marginBottom: 12,
  },
  confirmBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: THEME.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    width:'80%',
    alignSelf:'center'
  },
  confirmBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
export default withV4Navigation(CashSettlement);
