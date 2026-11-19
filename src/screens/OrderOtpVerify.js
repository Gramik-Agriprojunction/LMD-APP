import React, { Component } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Image, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, ScrollView, Linking,
  InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeBottomEdges, overlayBottomPadding } from '../utils/safeAreaInsets';
import OTPInputView from '@twotalltotems/react-native-otp-input';
import constants from '../utils/constants';
import Toast from 'react-native-simple-toast';
import Clipboard from '@react-native-clipboard/clipboard';
import { withV4Navigation, NavigationEvents } from '../utils/v4Compat';
import { invalidateOrderRelated } from '../utils/dataCache';
import { prefetchVerifyLocation, resolveCoordsForStatusUpdate, requestStatusLocationAccess, coordsForStatusApi, appendCoordsToFormData } from '../utils/locationHelper';
import OrderCard from '../components/OrderCard';
import CollectPaymentCard from '../components/CollectPaymentCard';
import BottomSheet from '../components/BottomSheet';
import VerifySuccessCheck from '../components/VerifySuccessCheck';
import ProofImageViewer from '../components/ProofImageViewer';
import OtpQrCode from '../components/OtpQrCode';

import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { HEADER } from '../theme/headerColors';
import { callFarmerExotel, dialDirect } from '../utils/exotelCall';
import { requestCameraOrPrompt } from '../utils/cameraHelper';

let ImageCropPicker = null;
try {
  ImageCropPicker = require('react-native-image-crop-picker').default || require('react-native-image-crop-picker');
} catch (e) {
  console.log('ImageCropPicker not available');
}

const BRAND = HEADER.brand;
const PAGE_BG = '#EDE9FE';
const MAX_PROOF = 6;
const PROOF_GAP = 6;
const PROOF_THUMB = 68;
const OVERLAY_BOTTOM = overlayBottomPadding();
const SECTION_GAP = 10;
/** Pickup / RTO QR window — always 30 seconds. */
const OTP_QR_TTL_SEC = 30;
const OTP_QR_TTL_MS = OTP_QR_TTL_SEC * 1000;

const apiPaymentType = (type) => (type === 'upi' || type === 'qr' ? 'upi' : 'cash');

// Soft purple page + brand header — matches Delivery Jaankari / app chrome.
const THEMES = {
  pickup:  { bg: PAGE_BG, accent: BRAND, title: 'Pickup Verify Karein',   helper: 'darkstore', verifyLbl: 'PICKUP',         doneTitle: 'Verify Ho Gaya!',  doneSub: 'Pickup status update ho raha hai...' },
  deliver: { bg: PAGE_BG, accent: BRAND, title: 'Delivery Verify Karein', helper: 'farmer',    verifyLbl: 'DELIVER',        doneTitle: 'Verify Ho Gaya!',  doneSub: 'Delivery confirm ho gayi...' },
  rto:     { bg: PAGE_BG, accent: BRAND, title: 'Wapsi Verify Karein',    helper: 'darkstore', verifyLbl: 'WAPSI CONFIRM',  doneTitle: 'Wapas Ho Gaya!',   doneSub: 'Product wapsi mark ho rahi hai...' },
};

class OrderOtpVerify extends Component {
  constructor(props) {
    super(props);
    this.state = {
      otp: '',
      isLoading: false,
      verified: false,
      deliveryProofs: [],
      proofConfirmVisible: false,
      pendingProof: null,
      previewUri: null,
      payment_type: 'cash',
      orderData: null,
      hintOtp: '',
      // DB `verify_otp` — do not name this `verifyOtp` (clashes with submit method)
      darkStoreOtpVerified: false,
      otpExpireAt: null,
      otpSecondsLeft: 0,
      isRefreshingOtp: false,
    };
    this.pickLock = false;
    this._otpTick = null;
    this._verifyPoll = null;
    this.iconScale = new Animated.Value(0.5);
    this.iconFade = new Animated.Value(0);
    this.titleFade = new Animated.Value(0);
    this.titleY = new Animated.Value(20);
    this.formFade = new Animated.Value(0);
    this.formY = new Animated.Value(30);
    this.pulse = new Animated.Value(1);
    this.arrowX = new Animated.Value(0);
  }

  getOrderId = () => this.props?.navigation?.getParam('orderId', null);
  getActionType = () => this.props?.navigation?.getParam('actionType', 'pickup');
  getOrder = () => this.state.orderData || this.props?.navigation?.getParam('order', null);

  extractHintOtp = (actionType, order) => {
    if (!order) return '';
    if (actionType === 'pickup') {
      return String(order.pickup_otp ?? order.pickupOtp ?? '').trim();
    }
    if (actionType === 'deliver') {
      return String(order.deliver_otp ?? order.deliverOtp ?? order.otp ?? '').trim();
    }
    if (actionType === 'rto') {
      return String(order.rto_return_otp ?? order.return_otp ?? order.returnOtp ?? '').trim();
    }
    return '';
  };

  hintOtpLabel = (actionType) => {
    if (actionType === 'pickup') return 'Dark Store OTP';
    if (actionType === 'deliver') return 'Farmer OTP';
    return 'Return OTP';
  };

  parseOtpExpireAt = (order) => {
    if (!order) return null;
    const raw = order.otp_expire_at ?? order.otpExpireAt ?? null;
    if (!raw) return null;
    const ms = new Date(raw).getTime();
    if (!Number.isFinite(ms)) return null;
    // Guard timezone skew: QR window is never more than 30s from now
    const left = ms - Date.now();
    if (left > OTP_QR_TTL_MS) return Date.now() + OTP_QR_TTL_MS;
    return ms;
  };

  parseVerifyOtp = (order) => {
    if (!order) return false;
    const v = order.verify_otp ?? order.verifyOtp;
    return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true';
  };

  applyOtpMeta = (order, otpOverride) => {
    const actionType = this.getActionType();
    const otp =
      otpOverride != null
        ? String(otpOverride).trim()
        : this.extractHintOtp(actionType, order);
    const otpExpireAt = this.parseOtpExpireAt(order);
    const darkStoreOtpVerified = this.parseVerifyOtp(order);
    this.setState(
      {
        orderData: order || this.state.orderData,
        hintOtp: otp || this.state.hintOtp,
        darkStoreOtpVerified,
        otpExpireAt,
      },
      () => this.syncOtpCountdown(),
    );
  };

  syncOtpCountdown = () => {
    const { otpExpireAt } = this.state;
    if (!otpExpireAt) {
      this.setState({ otpSecondsLeft: 0 });
      return;
    }
    const left = Math.max(
      0,
      Math.min(OTP_QR_TTL_SEC, Math.ceil((otpExpireAt - Date.now()) / 1000)),
    );
    this.setState({ otpSecondsLeft: left });
  };

  startOtpTicker = () => {
    if (this._otpTick) clearInterval(this._otpTick);
    this.syncOtpCountdown();
    this._otpTick = setInterval(() => {
      if (this._unmounted) return;
      this.syncOtpCountdown();
    }, 1000);
  };

  startVerifyOtpPoll = () => {
    const actionType = this.getActionType();
    if (actionType !== 'pickup' && actionType !== 'rto') return;
    if (this._verifyPoll) clearInterval(this._verifyPoll);
    this.pollOrderVerifyFlag();
    this._verifyPoll = setInterval(() => {
      if (this._unmounted || this.state.verified) return;
      if (this.state.darkStoreOtpVerified) return;
      this.pollOrderVerifyFlag();
    }, 2000);
  };

  pollOrderVerifyFlag = () => {
    const orderId = this.getOrderId();
    if (!orderId) return;
    fetch(constants.orderDetails, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + global.token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ order_id: String(orderId) }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (!json?.status || !json?.order) return;
        const darkStoreOtpVerified = this.parseVerifyOtp(json.order);
        if (darkStoreOtpVerified !== this.state.darkStoreOtpVerified) {
          this.setState({
            orderData: json.order,
            darkStoreOtpVerified,
            hintOtp: this.extractHintOtp(this.getActionType(), json.order) || this.state.hintOtp,
            otpExpireAt: this.parseOtpExpireAt(json.order),
          }, () => this.syncOtpCountdown());
        }
      })
      .catch(() => {});
  };

  loadOrderDetails = () => {
    const orderId = this.getOrderId();
    const actionType = this.getActionType();
    const fromNav = this.props?.navigation?.getParam('order', null);
    const navOtp = this.extractHintOtp(actionType, fromNav);
    if (fromNav && navOtp) {
      this.applyOtpMeta(fromNav, navOtp);
    }
    if (!orderId) return;
    fetch(constants.orderDetails, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + global.token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ order_id: String(orderId) }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (!json?.status || !json?.order) return;
        this.applyOtpMeta(json.order);
        const alreadyVerified = this.parseVerifyOtp(json.order);
        // Every swipe into pickup/RTO verify → new random OTP (unless dark store already verified)
        if (
          !alreadyVerified &&
          (actionType === 'pickup' || actionType === 'rto')
        ) {
          this.refreshOrderOtp(false);
        }
      })
      .catch(() => {});
  };

  refreshOrderOtp = (showToast = true) => {
    const orderId = this.getOrderId();
    const actionType = this.getActionType();
    if (!orderId || (actionType !== 'pickup' && actionType !== 'rto')) return;
    if (this.state.isRefreshingOtp) return;

    this.setState({ isRefreshingOtp: true });
    fetch(constants.refreshOrderOtp, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + global.token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        order_id: String(orderId),
        action_type: actionType,
      }),
    })
      .then((r) => r.json())
      .then((json) => {
        const payload = json?.data || json;
        const ok = json?.success === true || json?.status === true || !!payload?.otp;
        if (!ok) {
          Toast.show(json?.message || json?.msg || 'OTP refresh fail', Toast.SHORT);
          return;
        }
        const otp = String(payload.otp || '').trim();
        // Always start a fresh 30s window on the device (avoid TZ skew from DB timestamps)
        const expireAt = Date.now() + OTP_QR_TTL_MS;
        const nextOrder = {
          ...(this.state.orderData || {}),
          verify_otp: false,
          otp_expire_at: new Date(expireAt).toISOString(),
          ...(actionType === 'rto'
            ? { rto_return_otp: otp, return_otp: otp, returnOtp: otp }
            : { pickup_otp: otp, pickupOtp: otp }),
        };
        this.setState(
          {
            orderData: nextOrder,
            hintOtp: otp,
            darkStoreOtpVerified: false,
            otpExpireAt: expireAt,
            otpSecondsLeft: OTP_QR_TTL_SEC,
          },
          () => this.syncOtpCountdown(),
        );
        if (showToast) Toast.show('Naya OTP / QR ready', Toast.SHORT);
      })
      .catch(() => {
        Toast.show('OTP refresh fail', Toast.SHORT);
      })
      .finally(() => {
        if (!this._unmounted) this.setState({ isRefreshingOtp: false });
      });
  };

  copyHintOtp = () => {
    const { hintOtp } = this.state;
    if (!hintOtp) return;
    Clipboard.setString(hintOtp);
    Toast.show('OTP copy ho gaya', Toast.SHORT);
  };
  goBack = () => { if (this.props?.navigation?.goBack) this.props.navigation.goBack(); };

  mask = (p) => {
    if (!p) return '';
    const s = String(p);
    if (s.length < 6) return s;
    return s.slice(0, 2) + '****' + s.slice(-2);
  };

  callFarmer = (phone, orderId) => callFarmerExotel({
    orderId: orderId || this.getOrderId(),
    toPhone: phone,
    context: 'delivery',
  });
  dial = async (phoneRaw) => dialDirect(phoneRaw);

  // Robust WhatsApp — try native scheme first, then wa.me, then api.whatsapp.com.
  whatsapp = async (phoneRaw) => {
    const phone = String(phoneRaw || '').replace(/[^\d]/g, '');
    if (!phone) return Toast.show('No phone number available', Toast.SHORT);
    const tryUrls = [
      `whatsapp://send?phone=${phone}`,
      `https://wa.me/${phone}`,
      `https://api.whatsapp.com/send?phone=${phone}`,
    ];
    for (const u of tryUrls) {
      try { await Linking.openURL(u); return; } catch (e) { /* try next */ }
    }
    Toast.show('WhatsApp is not available', Toast.SHORT);
  };

  componentDidMount() {
    Animated.parallel([
      Animated.spring(this.iconScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
      Animated.timing(this.iconFade, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(this.titleFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(this.titleY, { toValue: 0, friction: 6, useNativeDriver: true }),
      ]).start();
    }, 200);

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(this.formFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(this.formY, { toValue: 0, friction: 6, useNativeDriver: true }),
      ]).start();
    }, 400);

    this.startPulse();
    this.loadOrderDetails();
    this.startOtpTicker();
    this.startVerifyOtpPoll();
  }

  startLocationPrefetch = () => {
    if (this._locationPrefetchStarted) return;
    this._locationPrefetchStarted = true;
    requestStatusLocationAccess('delivery').then(() => {
      prefetchVerifyLocation((coords) => {
        this._verifyCoords = coords;
      });
    });
  };

  startPulse = () => {
    const run = () => {
      Animated.sequence([
        Animated.timing(this.pulse, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(this.pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]).start(() => run());
    };
    run();

    const arrowLoop = () => {
      Animated.sequence([
        Animated.timing(this.arrowX, { toValue: 6, duration: 800, useNativeDriver: true }),
        Animated.timing(this.arrowX, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]).start(() => arrowLoop());
    };
    arrowLoop();
  };

  openProofCamera = () => {
    if (this.state.deliveryProofs.length >= MAX_PROOF) {
      Toast.show(`Maximum ${MAX_PROOF} photos allowed`, Toast.SHORT);
      return;
    }
    if (!ImageCropPicker) {
      Toast.show('Camera not available on this device', Toast.SHORT);
      return;
    }
    if (this.pickLock) return;
    this.captureProofFromCamera();
  };

  captureProofFromCamera = async () => {
    if (this.pickLock || !ImageCropPicker) return;
    this.pickLock = true;

    try {
      const allowed = await requestCameraOrPrompt();
      if (!allowed) return;

      try { if (ImageCropPicker.clean) await ImageCropPicker.clean(); } catch (e) { /* ignore */ }

      const img = await ImageCropPicker.openCamera({
        mediaType: 'photo',
        cropping: false,
        compressImageQuality: 0.85,
        forceJpg: true,
      });

      if (!img?.path) return;

      this.setState({
        pendingProof: this.toProofFile(img, 'camera', 0),
        proofConfirmVisible: true,
      });
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      if (!msg.includes('cancel')) Toast.show(e?.message || 'Unable to open camera', Toast.SHORT);
    } finally {
      setTimeout(() => { this.pickLock = false; }, Platform.OS === 'ios' ? 700 : 350);
    }
  };

  usePendingProof = () => {
    const { pendingProof, deliveryProofs } = this.state;
    if (!pendingProof) return;
    this.setState({
      deliveryProofs: [...deliveryProofs, pendingProof].slice(0, MAX_PROOF),
      pendingProof: null,
      proofConfirmVisible: false,
    });
  };

  retakeProofPhoto = () => {
    this.setState({ proofConfirmVisible: false, pendingProof: null }, () => {
      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => this.captureProofFromCamera(), Platform.OS === 'ios' ? 700 : 350);
      });
    });
  };

  closeProofConfirm = () => {
    this.setState({ proofConfirmVisible: false, pendingProof: null });
  };

  toProofFile = (img, source, index) => ({
    uri: img.path,
    type: img?.mime || 'image/jpeg',
    name: img?.filename || `${source}_${Date.now()}_${index}.jpg`,
  });

  removeProof = (index) => {
    this.setState((prev) => ({
      deliveryProofs: prev.deliveryProofs.filter((_, i) => i !== index),
    }));
  };

  openProofPreview = (uri) => {
    this.setState({ previewUri: uri });
  };

  closeProofPreview = () => {
    this.setState({ previewUri: null });
  };

  resolveStatus = (actionType) => (actionType === 'deliver' ? 'delivered' : actionType);

  submitStatusUpdate = (orderId, actionType, otp, coords = {}) => {
    const status = this.resolveStatus(actionType);
    const url = constants.updateStatus;
    const isDeliver = actionType === 'deliver';
    const { lat, long } = coordsForStatusApi(coords);
    const paymentType = isDeliver ? apiPaymentType(this.state.payment_type || 'cash') : '';

    if (isDeliver) {
      const { deliveryProofs } = this.state;
      const fd = new FormData();
      fd.append('status', status);
      fd.append('order_id[]', String(orderId));
      fd.append('otp', String(otp));
      fd.append('type', paymentType);
      fd.append('reason', '');
      appendCoordsToFormData(fd, coords);
      deliveryProofs.forEach((file) => {
        fd.append('delivery_proof[]', {
          uri: file.uri,
          type: file.type,
          name: file.name,
        });
      });

      return fetch(url, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + global.token,
          Accept: 'application/json',
        },
        body: fd,
      });
    }

    const body = {
      status,
      order_id: [String(orderId)],
      otp: String(otp),
      type: paymentType,
      reason: '',
      lat,
      long,
    };

    return fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + global.token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
  };

  verifyOtp = async (code) => {
    const orderId = this.getOrderId();
    const otp = code || this.state.otp;
    const actionType = this.getActionType();
    const isDeliver = actionType === 'deliver';
    const hasOtp = otp && otp.length >= 5;
    const hasProof = this.state.deliveryProofs.length > 0;

    if (isDeliver) {
      if (!hasOtp && !hasProof) {
        Toast.show('OTP daalein ya kam se kam 1 delivery proof photo upload karein', Toast.SHORT);
        return;
      }
    } else if (!hasOtp) {
      Toast.show('Please enter 5-digit OTP', Toast.SHORT);
      return;
    }
    if (this.state.isLoading) return;
    if (!orderId) {
      Toast.show('Order id missing', Toast.SHORT);
      return;
    }

    const otpPayload = hasOtp ? otp : '';
    this.setState({ isLoading: true, otp: otpPayload });

    const { lat, long } = await resolveCoordsForStatusUpdate(this._verifyCoords);
    const coords = { lat, lng: long };

    console.log('[Verify] calling Update Status API', {
      orderId,
      actionType,
      lat,
      long,
      type: apiPaymentType(this.state.payment_type),
    });

    this.submitStatusUpdate(orderId, actionType, otpPayload, coords)
      .then((r) => r.json())
      .then((json) => {
        if (json?.status || json?.success) {
          invalidateOrderRelated();
          this._statusMessage = json?.message || '';
          this.showVerifiedAnimation();
        } else {
          this.setState({ isLoading: false });
          Toast.show(json?.message || 'Unable to verify', Toast.SHORT);
        }
      })
      .catch(() => {
        this.setState({ isLoading: false });
        Toast.show('Something went wrong', Toast.SHORT);
      });
  };

  componentWillUnmount() {
    this._unmounted = true;
    if (this._navTimer) clearTimeout(this._navTimer);
    if (this._otpTick) clearInterval(this._otpTick);
    if (this._verifyPoll) clearInterval(this._verifyPoll);
  }

  showVerifiedAnimation = () => {
    this.setState({ verified: true }, () => {
      this._navTimer = setTimeout(() => {
        if (!this._unmounted) this.onOtpSuccess();
      }, 2200);
    });
  };

  onOtpSuccess = () => {
    const actionType = this.getActionType();
    const order = this.getOrder();
    const msg = this._statusMessage || 'Status updated';

    if (actionType === 'deliver') {
      Toast.show(msg, Toast.SHORT);
      this.props.navigation.goBack();
    } else {
      Toast.show(msg, Toast.SHORT);
      this.props.navigation.goBack();
    }
  };

  renderProofSection = () => {
    const { deliveryProofs } = this.state;
    const canAdd = deliveryProofs.length < MAX_PROOF;

    return (
      <View style={s.proofSection}>
        <View style={s.proofHead}>
          <View style={s.proofHeadIco}>
            <Image source={require('./assets/cam2.png')} style={s.proofHeadIcoImg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.proofTitle}>Delivery Proof</Text>
            <Text style={s.proofSub}>Photo upload karein · max {MAX_PROOF}</Text>
          </View>
          <View style={s.proofCountPill}>
            <Text style={s.proofCountT}>{deliveryProofs.length} / {MAX_PROOF}</Text>
          </View>
        </View>

        <View style={s.proofBody}>
          <View style={s.proofGrid}>
            {deliveryProofs.map((file, index) => (
              <View key={`${file.uri}-${index}`} style={[s.proofThumbWrap, { width: PROOF_THUMB, height: PROOF_THUMB }]}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => this.openProofPreview(file.uri)} style={s.proofThumbBtn}>
                  <Image source={{ uri: file.uri }} style={s.proofThumb} resizeMode="cover" />
                </TouchableOpacity>
                <TouchableOpacity style={s.proofRemove} onPress={() => this.removeProof(index)} activeOpacity={0.85}>
                  <Text style={s.proofRemoveT}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}

            {canAdd ? (
              <TouchableOpacity
                style={[s.proofAdd, { width: PROOF_THUMB, height: PROOF_THUMB }]}
                onPress={this.openProofCamera}
                activeOpacity={0.85}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View style={s.proofAddInner}>
                  <Image source={require('./assets/cam.png')} style={s.proofAddIco} />
                  <Text style={s.proofAddT}>Photo</Text>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>

          {deliveryProofs.length ? (
            <Text style={s.proofHint}>Preview dekhne ke liye photo par tap karein</Text>
          ) : null}
        </View>
      </View>
    );
  };

  renderProofConfirmSheet = () => {
    const { proofConfirmVisible, pendingProof } = this.state;
    if (!proofConfirmVisible || !pendingProof) return null;

    return (
      <BottomSheet
        visible
        dynamicSize
        maxDynamicContentSize={420 + OVERLAY_BOTTOM}
        onSheetClose={this.closeProofConfirm}
        enablePanDownToClose
        onChange={(idx) => { if (idx === -1) this.closeProofConfirm(); }}
      >
        <View style={[s.confirmWrap, { paddingBottom: 12 + OVERLAY_BOTTOM }]}>
          <Text style={s.confirmTitle}>Delivery Proof</Text>
          <Text style={s.confirmSub}>Kya yeh photo sahi hai?</Text>

          <Image source={{ uri: pendingProof.uri }} style={s.confirmPreview} resizeMode="cover" />

          <TouchableOpacity activeOpacity={0.88} style={s.confirmRetake} onPress={this.retakeProofPhoto}>
            <Text style={s.confirmRetakeT}>Re-Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.88} style={s.confirmUse} onPress={this.usePendingProof}>
            <Text style={s.confirmUseT}>Use Photo</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    );
  };

  render() {
    const actionType = this.getActionType();
    const order = this.getOrder();
    const {
      hintOtp, verified, deliveryProofs, isLoading, otp,
      darkStoreOtpVerified, otpSecondsLeft, isRefreshingOtp,
    } = this.state;
    const theme = THEMES[actionType] || THEMES.pickup;
    const isDeliver = actionType === 'deliver';
    const isPickup = actionType === 'pickup';
    const isRto = actionType === 'rto';
    const hideOtpEntryAndVerify = isPickup || isRto;
    // Pickup + RTO: same as old OTP submit → lmd/update_order_status (pickup / rto → RTO_DELIVERED)
    const showAcknowledge = (isPickup || isRto) && !verified;
    const otpExpired = (isPickup || isRto) && otpSecondsLeft <= 0;
    const hasOtp = String(otp || '').length >= 5;
    const hasProof = deliveryProofs.length > 0;
    const disabled = isLoading || (isDeliver ? (!hasOtp && !hasProof) : !hasOtp);
    // Gate ONLY on DB verify_otp — do not block after countdown hits 0 once verified
    const ackDisabled =
      isLoading ||
      !darkStoreOtpVerified ||
      !hintOtp ||
      String(hintOtp).trim().length < 5;
    const showBottomBar = (!verified && !hideOtpEntryAndVerify) || showAcknowledge;

    return (
      <View style={[s.root, { backgroundColor: PAGE_BG }]}>
        <StatusBar barStyle="light-content" backgroundColor={HEADER.brand} />
        <NavigationEvents onDidFocus={this.startLocationPrefetch} />
        <ScreenHeader bg={HEADER.brand} title={theme.title} onBack={this.goBack} />

        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: PAGE_BG }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {verified ? (
            <View style={s.successLayer} pointerEvents="none">
              <VerifySuccessCheck
                visible
                title={theme.doneTitle}
                subtitle={theme.doneSub}
                circleBg={BRAND}
                tickColor="#FFF"
                ringColor="rgba(93,63,211,0.25)"
              />
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={[
              s.scroll,
              !verified && showBottomBar && { paddingBottom: 72 + (Platform.OS === 'android' ? 0 : OVERLAY_BOTTOM) },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            clipToPadding={false}
          >

            {!verified ? (
              <>
                {/* Title + OTP */}
                <Animated.View style={[s.titleWrap, { opacity: this.iconFade, transform: [{ translateY: this.titleY }] }]}>
                  <Text style={s.title}>OTP Daalein</Text>
                  <Text style={s.subtitle}>
                    {isDeliver
                      ? 'OTP daalein ya delivery proof ki photo upload karein'
                      : isPickup
                        ? 'Dark Store ko yeh OTP bataein aur items pick karein'
                        : 'Dark Store ko yeh OTP bataein'}
                  </Text>
                </Animated.View>

                {hintOtp ? (
                  <>
                    <TouchableOpacity activeOpacity={0.88} onPress={this.copyHintOtp} style={s.otpShowCard}>
                      <Text style={s.otpShowLbl}>{this.hintOtpLabel(actionType)}</Text>
                      <Text style={s.otpShowVal}>{hintOtp}</Text>
                      <View style={s.otpShowCopyRow}>
                        <MaterialCommunityIcons name="content-copy" size={15} color={BRAND} />
                        <Text style={s.otpShowCopy}>Copy</Text>
                      </View>
                    </TouchableOpacity>
                    <OtpQrCode value={hintOtp} forFarmer={actionType === 'deliver'} />
                    {(isPickup || isRto) ? (
                      <View style={s.otpTimerWrap}>
                        {!otpExpired ? (
                          <Text style={s.otpTimerText}>
                            OTP expire in {String(otpSecondsLeft).padStart(2, '0')}s
                          </Text>
                        ) : !darkStoreOtpVerified ? (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => this.refreshOrderOtp(true)}
                            disabled={isRefreshingOtp}
                            style={[s.reloadQrBtn, isRefreshingOtp && { opacity: 0.6 }]}
                          >
                            {isRefreshingOtp ? (
                              <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                              <>
                                <MaterialCommunityIcons name="qrcode-scan" size={16} color="#FFF" style={{ marginRight: 8 }} />
                                <Text style={s.reloadQrBtnT}>Reload QR</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : (
                          <Text style={s.otpTimerText}>OTP verified</Text>
                        )}
                        {!darkStoreOtpVerified ? (
                          <Text style={s.verifyWaitHint}>
                            Dark Store OTP verify kare — phir Acknowledge enable hoga
                          </Text>
                        ) : (
                          <Text style={s.verifyReadyHint}>Dark Store verify ho gaya — Acknowledge ready</Text>
                        )}
                      </View>
                    ) : null}
                  </>
                ) : null}

                <Animated.View style={[s.formWrap, { opacity: this.titleFade, transform: [{ translateY: this.formY }] }]}>
                  {!hideOtpEntryAndVerify ? (
                    <OTPInputView
                      style={s.otpView}
                      pinCount={5}
                      autoFocusOnLoad={false}
                      codeInputFieldStyle={s.otpField}
                      codeInputHighlightStyle={s.otpActive}
                      onCodeChanged={(code) => this.setState({ otp: code })}
                      onCodeFilled={(code) => {
                        this.setState({ otp: code }, () => this.verifyOtp(code));
                      }}
                    />
                  ) : null}

                  {isDeliver ? (
                    <>
                      <Text style={s.orDivider}>YA</Text>
                      <View style={[s.proofWrap, s.sectionCard]}>{this.renderProofSection()}</View>
                      <View style={[s.proofWrap, s.sectionCard]}>
                        <CollectPaymentCard
                          order={order}
                          variant="light"
                          paymentType={this.state.payment_type}
                          onChange={(payment_type) => this.setState({ payment_type })}
                        />
                      </View>
                    </>
                  ) : null}
                </Animated.View>
              </>
            ) : null}

            <Animated.View style={{ opacity: this.formFade, marginTop: isDeliver ? SECTION_GAP : 16 }}>
              <OrderCard
                order={order}
                theme="light"
                hideFooter
                onCall={(p, id) => this.callFarmer(p, id)}
                onWhatsApp={(p) => this.whatsapp(p)}
                onCallStore={(p) => this.dial(p)}
              />
            </Animated.View>

          </ScrollView>

          {showAcknowledge ? (
            <View style={[s.bottomBar, { paddingBottom: Platform.OS === 'android' ? 6 : (OVERLAY_BOTTOM || 6) }]}>
              <TouchableOpacity
                onPress={() => this.verifyOtp(String(hintOtp || '').trim())}
                disabled={ackDisabled}
                activeOpacity={0.85}
                style={[s.btn, { opacity: ackDisabled ? 0.5 : 1 }]}
              >
                {isLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text style={[s.btnT, { marginLeft: 10 }]}>
                      {isRto ? 'RTO confirm ho raha hai...' : 'Pickup confirm ho raha hai...'}
                    </Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="check-decagram" size={18} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={s.btnT}>Acknowledge</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ) : !verified && !hideOtpEntryAndVerify ? (
            <View style={[s.bottomBar, { paddingBottom: Platform.OS === 'android' ? 6 : (OVERLAY_BOTTOM || 6) }]}>
              <TouchableOpacity onPress={() => this.verifyOtp()} disabled={disabled} activeOpacity={0.85}
                style={[s.btn, { opacity: disabled ? 0.5 : 1 }]}>
                {this.state.isLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text style={[s.btnT, isDeliver && s.btnTDeliver, { marginLeft: 10 }]}>Verify ho raha hai...</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[s.btnT, isDeliver && s.btnTDeliver]}>
                      {isDeliver ? 'Delivery Verify Karien' : `VERIFY & ${theme.verifyLbl} KAREIN`}
                    </Text>
                    <Animated.Image source={require('./assets/arrow.png')} style={[s.btnArrow, { transform: [{ translateX: this.arrowX }] }]} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <SafeAreaView edges={safeBottomEdges()} style={{ backgroundColor: PAGE_BG }} />
          )}
        </KeyboardAvoidingView>

        {this.renderProofConfirmSheet()}

        <ProofImageViewer
          visible={!!this.state.previewUri}
          uri={this.state.previewUri}
          onClose={this.closeProofPreview}
        />
      </View>
    );
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: PAGE_BG },
  scroll: { flexGrow: 1, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 24 },
  successLayer: { overflow: 'visible', zIndex: 2 },

  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0, height: 56, marginBottom: 6 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#0F172A' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(93,63,211,0.12)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  backIco: { width: 17, height: 17, resizeMode: 'contain', tintColor: BRAND },

  infoCard: { display: 'none' },

  titleWrap: { alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, fontWeight: '400', color: '#64748B', textAlign: 'center', lineHeight: 19, marginBottom: 10 },

  otpShowCard: {
    alignSelf: 'center',
    width: 312,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1.5,
    borderColor: 'rgba(93,63,211,0.28)',
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  otpShowLbl: { fontSize: 12, fontWeight: '600', color: '#5B21B6', marginBottom: 4 },
  otpShowVal: { fontSize: 28, fontWeight: '900', color: BRAND, letterSpacing: 6 },
  otpShowCopyRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(93,63,211,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  otpShowCopy: { fontSize: 12, fontWeight: '700', color: BRAND },
  otpTimerWrap: {
    alignSelf: 'center',
    width: 312,
    alignItems: 'center',
    marginBottom: 10,
  },
  otpTimerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 6,
  },
  reloadQrBtn: {
    minWidth: 160,
    height: 40,
    borderRadius: 12,
    backgroundColor: BRAND,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  reloadQrBtnT: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  verifyWaitHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
  verifyReadyHint: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
    textAlign: 'center',
    lineHeight: 16,
  },

  formWrap: { alignItems: 'center' },
  otpView: { alignSelf: 'center', width: 312, height: 65, marginBottom: 0 },
  otpField: {
    width: 56,
    height: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(93,63,211,0.22)',
    color: BRAND,
    fontSize: 32,
    fontWeight: '800',
  },
  otpActive: { borderColor: BRAND, borderWidth: 2 },

  orDivider: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textAlign: 'center',
    marginVertical: 10,
    letterSpacing: 1.2,
  },

  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: 'center',
    backgroundColor: PAGE_BG,
    borderTopWidth: 1,
    borderTopColor: 'rgba(93,63,211,0.12)',
  },
  btn: {
    width: 312,
    height: 54,
    borderRadius: 14,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnT: { fontSize: 15, fontWeight: '700', color: '#FFF', letterSpacing: 0.3 },
  btnTDeliver: { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  btnArrow: { width: 14, height: 14, resizeMode: 'contain', tintColor: '#FFF', marginLeft: 8 },

  proofWrap: { alignSelf: 'stretch', width: '100%' },
  sectionCard: { marginTop: SECTION_GAP },
  proofSection: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  proofHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(93,63,211,0.06)',
  },
  proofHeadIco: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(93,63,211,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  proofHeadIcoImg: { width: 18, height: 18, resizeMode: 'contain', tintColor: BRAND },
  proofBody: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 },
  proofTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  proofSub: { fontSize: 10, fontWeight: '400', color: '#64748B', marginTop: 1 },
  proofCountPill: {
    backgroundColor: 'rgba(93,63,211,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(93,63,211,0.2)',
  },
  proofCountT: { fontSize: 10, fontWeight: '700', color: BRAND, letterSpacing: 0.3 },
  proofGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -PROOF_GAP / 2 },
  proofThumbWrap: { margin: PROOF_GAP / 2, position: 'relative' },
  proofThumbBtn: { flex: 1, borderRadius: 8, overflow: 'hidden' },
  proofThumb: { width: '100%', height: '100%', borderRadius: 8, backgroundColor: '#E2E8F0' },
  proofRemove: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFF',
    zIndex: 2,
  },
  proofRemoveT: { color: '#FFF', fontSize: 9, fontWeight: '800', lineHeight: 11 },
  proofAdd: {
    margin: PROOF_GAP / 2,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(93,63,211,0.28)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(93,63,211,0.04)',
    overflow: 'hidden',
  },
  proofAddInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  proofAddIco: { width: 20, height: 20, resizeMode: 'contain', tintColor: BRAND, marginBottom: 2 },
  proofAddT: { fontSize: 10, fontWeight: '600', color: BRAND },
  proofHint: { fontSize: 9, fontWeight: '500', color: '#94A3B8', marginTop: 6, textAlign: 'center' },

  confirmWrap: { paddingHorizontal: 18, paddingTop: 4 },
  confirmTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  confirmSub: { fontSize: 12, fontWeight: '400', color: '#64748B', textAlign: 'center', marginTop: 4, marginBottom: 14 },
  confirmPreview: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    marginBottom: 14,
  },
  confirmRetake: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  confirmRetakeT: { fontSize: 14, fontWeight: '600', color: '#475569' },
  confirmUse: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND,
  },
  confirmUseT: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  orderCard: { backgroundColor: '#FFFFFF', borderRadius: 12, marginTop: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(15,23,42,0.08)' },
  orderHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingBottom: 8 },
  orderOid: { fontSize: 14, fontWeight: '700', color: BRAND },
  orderAmt: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  orderPerson: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(15,23,42,0.08)' },
  orderAvt: { width: 28, height: 28, borderRadius: 14, resizeMode: 'cover', marginRight: 8 },
  orderName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  orderPhone: { fontSize: 11.5, fontWeight: '500', color: '#64748B', marginTop: 1 },
  orderIco: { width: 30, height: 30, resizeMode: 'contain' },
  orderCallIco: { width: 30, height: 30, resizeMode: 'contain', tintColor: '#F97316' },
  contactBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  contactIcoCall: { width: 30, height: 30, resizeMode: 'contain', tintColor: '#F97316' },
  contactIcoWa: { width: 30, height: 30, resizeMode: 'contain' },
  dsCallBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  dsCallIco: { width: 30, height: 30, resizeMode: 'contain', tintColor: '#F97316' },
  orderRoute: { paddingHorizontal: 12, paddingVertical: 10 },
  orderRouteR: { flexDirection: 'row', alignItems: 'flex-start' },
  orderTl: { width: 14, alignItems: 'center', marginRight: 8, paddingTop: 3 },
  orderDot: { width: 8, height: 8, borderRadius: 4 },
  orderLine: { width: 1.5, flex: 1, minHeight: 8, backgroundColor: 'rgba(15,23,42,0.12)', marginVertical: 3 },
  orderRBody: { flex: 1, paddingBottom: 10 },
  orderRLbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 },
  orderRTitle: { fontSize: 13.5, fontWeight: '700', color: '#0F172A' },
  orderRSub: { fontSize: 12, fontWeight: '500', color: '#64748B', lineHeight: 17, marginTop: 1 },
});

export default withV4Navigation(OrderOtpVerify);
