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
import { withV4Navigation, NavigationEvents } from '../utils/v4Compat';
import { invalidateOrderRelated } from '../utils/dataCache';
import { prefetchVerifyLocation, getCachedCoordsForApi, coordsForStatusApi, appendCoordsToFormData } from '../utils/locationHelper';
import OrderCard from '../components/OrderCard';
import CollectPaymentCard from '../components/CollectPaymentCard';
import BottomSheet from '../components/BottomSheet';
import VerifySuccessCheck from '../components/VerifySuccessCheck';
import ProofImageViewer from '../components/ProofImageViewer';

import { STATUS } from '../utils/statusColors';
import ScreenHeader from '../components/ScreenHeader';
import { callFarmerExotel, dialDirect } from '../utils/exotelCall';

let ImageCropPicker = null;
try {
  ImageCropPicker = require('react-native-image-crop-picker').default || require('react-native-image-crop-picker');
} catch (e) {
  console.log('ImageCropPicker not available');
}

const BG = STATUS.ALL.bg;
const MAX_PROOF = 6;
const PROOF_GAP = 6;
const PROOF_THUMB = 68;
const OVERLAY_BOTTOM = overlayBottomPadding();
const SECTION_GAP = 10;

const apiPaymentType = (type) => (type === 'upi' || type === 'qr' ? 'upi' : 'cash');

// Each verification screen uses the colour of the status it transitions the
// order to — Pickup → cyan, Deliver → green, RTO → red. Pulled from the
// canonical statusColors map so it matches buttons, pills, and grid tiles.
const THEMES = {
  pickup:  { bg: STATUS.PICKUP.bg,    accent: '#FCD34D', title: 'Pickup Verify Karein',   helper: 'warehouse',  verifyLbl: 'PICKUP',         doneTitle: 'Verify Ho Gaya!',  doneSub: 'Pickup status update ho raha hai...' },
  deliver: { bg: STATUS.DELIVERED.bg, accent: '#FCD34D', title: 'Delivery Verify Karein', helper: 'farmer',     verifyLbl: 'DELIVER',        doneTitle: 'Verify Ho Gaya!',  doneSub: 'Delivery confirm ho gayi...' },
  rto:     { bg: STATUS.RTO.bg,       accent: '#FCD34D', title: 'Wapsi Verify Karein',    helper: 'warehouse',  verifyLbl: 'WAPSI CONFIRM',  doneTitle: 'Wapas Ho Gaya!',   doneSub: 'Product wapsi mark ho rahi hai...' },
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
    };
    this.pickLock = false;
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
  getOrder = () => this.props?.navigation?.getParam('order', null);
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
    this.startLocationPrefetch();
  }

  startLocationPrefetch = () => {
    console.log('[Verify] prefetching location on screen open');
    prefetchVerifyLocation((coords) => {
      this._verifyCoords = coords;
      console.log('[Verify] location ready', coords);
    });
  };

  getReadyCoords = () => {
    if (this._verifyCoords?.lat != null && this._verifyCoords?.lng != null) {
      return this._verifyCoords;
    }
    const cached = getCachedCoordsForApi();
    if (cached.lat != null && cached.lng != null) {
      this._verifyCoords = cached;
      return cached;
    }
    return { lat: null, lng: null };
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

  verifyOtp = (code) => {
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
    const coords = this.getReadyCoords();
    const apiCoords = coordsForStatusApi(coords);
    this.setState({ isLoading: true, otp: otpPayload });

    console.log('[Verify] calling Update Status API (no GPS wait)', {
      orderId,
      actionType,
      lat: apiCoords.lat,
      long: apiCoords.long,
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
    const theme = THEMES[actionType] || THEMES.pickup;
    const BG_T = theme.bg;
    const isDeliver = actionType === 'deliver';
    const { verified, deliveryProofs } = this.state;
    const hasOtp = this.state.otp.length >= 5;
    const hasProof = deliveryProofs.length > 0;
    const disabled = this.state.isLoading || (isDeliver ? (!hasOtp && !hasProof) : !hasOtp);

    return (
      <View style={[s.root, { backgroundColor: BG_T }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG_T} />
        <NavigationEvents onDidFocus={this.startLocationPrefetch} />
        <ScreenHeader bg={BG_T} title={theme.title} onBack={this.goBack} />

        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: BG_T }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {verified ? (
            <View style={s.successLayer} pointerEvents="none">
              <VerifySuccessCheck
                visible
                title={theme.doneTitle}
                subtitle={theme.doneSub}
                circleBg="#FFF"
                tickColor={BG_T}
                ringColor="rgba(255,255,255,0.85)"
              />
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={[s.scroll, !verified && { paddingBottom: 72 + (Platform.OS === 'android' ? 0 : OVERLAY_BOTTOM) }]}
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
                      : `${theme.helper === 'farmer' ? 'Farmer' : 'Warehouse'} ne jo 5-digit code diya hai, woh daalein`}
                  </Text>
                </Animated.View>

                <Animated.View style={[s.formWrap, { opacity: this.titleFade, transform: [{ translateY: this.formY }] }]}>
                  <OTPInputView
                    style={s.otpView}
                    pinCount={5}
                    autoFocusOnLoad={false}
                    codeInputFieldStyle={[s.otpField, { color: BG_T }]}
                    codeInputHighlightStyle={s.otpActive}
                    onCodeChanged={(code) => this.setState({ otp: code })}
                    onCodeFilled={(code) => {
                      this.setState({ otp: code }, () => this.verifyOtp(code));
                    }}
                  />

                  {isDeliver ? (
                    <>
                      <Text style={s.orDivider}>YA</Text>
                      <View style={[s.proofWrap, s.sectionCard]}>{this.renderProofSection()}</View>
                      <View style={[s.proofWrap, s.sectionCard]}>
                        <CollectPaymentCard
                          order={order}
                          variant="dark"
                          paymentType={this.state.payment_type}
                          onChange={(payment_type) => this.setState({ payment_type })}
                        />
                      </View>
                    </>
                  ) : null}
                </Animated.View>
              </>
            ) : null}

            {/* Order details card — shared OrderCard (theme="dark" for colored bg) */}
            <Animated.View style={{ opacity: this.formFade, marginTop: isDeliver ? SECTION_GAP : 16 }}>
              <OrderCard
                order={order}
                theme="dark"
                hideFooter
                onCall={(p, id) => this.callFarmer(p, id)}
                onWhatsApp={(p) => this.whatsapp(p)}
                onCallStore={(p) => this.dial(p)}
              />
            </Animated.View>

          </ScrollView>

          {!verified ? (
            <View style={[s.bottomBar, { backgroundColor: BG_T, paddingBottom: Platform.OS === 'android' ? 6 : (OVERLAY_BOTTOM || 6) }]}>
              <TouchableOpacity onPress={() => this.verifyOtp()} disabled={disabled} activeOpacity={0.85}
                style={[s.btn, { opacity: disabled ? 0.5 : 1 }]}>
                {this.state.isLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={BG_T} />
                    <Text style={[s.btnT, isDeliver && s.btnTDeliver, { color: BG_T, marginLeft: 10 }]}>Verify ho raha hai...</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[s.btnT, isDeliver && s.btnTDeliver, { color: BG_T }]}>
                      {isDeliver ? 'Delivery Verify Karien' : `VERIFY & ${theme.verifyLbl} KAREIN`}
                    </Text>
                    <Animated.Image source={require('./assets/arrow.png')} style={[s.btnArrow, { tintColor: BG_T, transform: [{ translateX: this.arrowX }] }]} />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <SafeAreaView edges={safeBottomEdges()} style={{ backgroundColor: BG_T }} />
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
  root: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 24 },
  successLayer: { overflow: 'visible', zIndex: 2 },

  // Align with the canonical screen header: 56-h row, no extra horizontal padding
  // beyond the ScrollView's 12px so the chip sits at 12 + 4 = 16px from the
  // screen edge (matches every other screen).
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0, height: 56, marginBottom: 6 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#FFF' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  backIco: { width: 17, height: 17, resizeMode: 'contain', tintColor: '#FFF' },

  infoCard: { display: 'none' },

  titleWrap: { alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 19, marginBottom: 10 },

  formWrap: { alignItems: 'center' },
  otpView: { alignSelf: 'center', width: 312, height: 65, marginBottom: 0 },
  otpField: { width: 56, height: 60, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 2, borderColor: 'transparent', color: BG, fontSize: 32, fontWeight: '800' },
  otpActive: { borderColor: '#FCD34D', borderWidth: 2.5 },

  orDivider: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginVertical: 10,
    letterSpacing: 1.2,
  },

  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 6,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },

  // Width matched to the OTP row above (5 × 56 + 4 × 8 gap = 312).
  btn: { width: 312, height: 54, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  btnT: { fontSize: 15, fontWeight: '700', color: BG, letterSpacing: 0.3 },
  btnTDeliver: { fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },
  btnArrow: { width: 14, height: 14, resizeMode: 'contain', tintColor: BG, marginLeft: 8 },

  proofWrap: { alignSelf: 'stretch', width: '100%' },
  sectionCard: { marginTop: SECTION_GAP },
  proofSection: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  proofHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  proofHeadIco: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(252,211,77,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  proofHeadIcoImg: { width: 18, height: 18, resizeMode: 'contain', tintColor: '#FCD34D' },
  proofBody: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 },
  proofTitle: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  proofSub: { fontSize: 10, fontWeight: '400', color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  proofCountPill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  proofCountT: { fontSize: 10, fontWeight: '700', color: '#FCD34D', letterSpacing: 0.3 },
  proofGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -PROOF_GAP / 2 },
  proofThumbWrap: { margin: PROOF_GAP / 2, position: 'relative' },
  proofThumbBtn: { flex: 1, borderRadius: 8, overflow: 'hidden' },
  proofThumb: { width: '100%', height: '100%', borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.2)' },
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
    borderColor: 'rgba(255,255,255,0.28)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  proofAddInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  proofAddIco: { width: 20, height: 20, resizeMode: 'contain', tintColor: '#FFF', marginBottom: 2 },
  proofAddT: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  proofHint: { fontSize: 9, fontWeight: '500', color: 'rgba(255,255,255,0.45)', marginTop: 6, textAlign: 'center' },

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
    backgroundColor: '#16A34A',
  },
  confirmUseT: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Order card (white on purple)
  orderCard: { backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 12, marginTop: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  orderHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingBottom: 8 },
  orderOid: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  orderAmt: { fontSize: 16, fontWeight: '700', color: '#FCD34D' },
  orderPerson: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.14)' },
  orderAvt: { width: 28, height: 28, borderRadius: 14, resizeMode: 'cover', marginRight: 8 },
  orderName: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  orderPhone: { fontSize: 11.5, fontWeight: '500', color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  orderIco: { width: 30, height: 30, resizeMode: 'contain' },
  orderCallIco: { width: 30, height: 30, resizeMode: 'contain', tintColor: '#F97316' },
  contactBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  contactIcoCall: { width: 30, height: 30, resizeMode: 'contain', tintColor: '#F97316' },
  contactIcoWa: { width: 30, height: 30, resizeMode: 'contain' },
  // Pickup darkstore call button — matches the orange call style used elsewhere.
  dsCallBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  dsCallIco: { width: 30, height: 30, resizeMode: 'contain', tintColor: '#F97316' },
  orderRoute: { paddingHorizontal: 12, paddingVertical: 10 },
  orderRouteR: { flexDirection: 'row', alignItems: 'flex-start' },
  orderTl: { width: 14, alignItems: 'center', marginRight: 8, paddingTop: 3 },
  orderDot: { width: 8, height: 8, borderRadius: 4 },
  orderLine: { width: 1.5, flex: 1, minHeight: 8, backgroundColor: 'rgba(255,255,255,0.35)', marginVertical: 3 },
  orderRBody: { flex: 1, paddingBottom: 10 },
  orderRLbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 },
  orderRTitle: { fontSize: 13.5, fontWeight: '700', color: '#FFF' },
  orderRSub: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.88)', lineHeight: 17, marginTop: 1 },
});

export default withV4Navigation(OrderOtpVerify);
