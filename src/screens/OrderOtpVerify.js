import React, { Component } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Image, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, ScrollView, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OTPInputView from '@twotalltotems/react-native-otp-input';
import constants from '../utils/constants';
import Toast from 'react-native-simple-toast';
import { withV4Navigation } from '../utils/v4Compat';
import OrderCard from '../components/OrderCard';

import { STATUS } from '../utils/statusColors';
import ScreenHeader from '../components/ScreenHeader';

const BG = STATUS.ALL.bg;

// Each verification screen uses the colour of the status it transitions the
// order to — Pickup → cyan, Deliver → green, RTO → red. Pulled from the
// canonical statusColors map so it matches buttons, pills, and grid tiles.
const THEMES = {
  pickup:  { bg: STATUS.PICKUP.bg,    accent: '#FCD34D', title: 'Pickup Verify Karein',   helper: 'warehouse',  verifyLbl: 'PICKUP',         doneTitle: 'Verify Ho Gaya!',  doneSub: 'Pickup status update ho raha hai...' },
  deliver: { bg: STATUS.DELIVERED.bg, accent: '#FCD34D', title: 'Delivery Verify Karein', helper: 'farmer',     verifyLbl: 'DELIVER',        doneTitle: 'Verify Ho Gaya!',  doneSub: 'Delivery aage badh rahi hai...' },
  rto:     { bg: STATUS.RTO.bg,       accent: '#FCD34D', title: 'Wapsi Verify Karein',    helper: 'warehouse',  verifyLbl: 'WAPSI CONFIRM',  doneTitle: 'Wapas Ho Gaya!',   doneSub: 'Product wapsi mark ho rahi hai...' },
};

class OrderOtpVerify extends Component {
  constructor(props) {
    super(props);
    this.state = { otp: '', isLoading: false, verified: false };
    this.iconScale = new Animated.Value(0.5);
    this.iconFade = new Animated.Value(0);
    this.titleFade = new Animated.Value(0);
    this.titleY = new Animated.Value(20);
    this.formFade = new Animated.Value(0);
    this.formY = new Animated.Value(30);
    this.pulse = new Animated.Value(1);
    this.arrowX = new Animated.Value(0);
    this.checkScale = new Animated.Value(0);
    this.checkOpacity = new Animated.Value(0);
    this.ringScale = new Animated.Value(0.5);
    this.ringOpacity = new Animated.Value(0);
    this.ring2Scale = new Animated.Value(0.5);
    this.ring2Opacity = new Animated.Value(0);
    this.tickRotate = new Animated.Value(0);
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

  // Robust dialler — works across iOS and Android (some Android skins return
  // false from canOpenURL even when openURL succeeds).
  dial = async (phoneRaw) => {
    const phone = String(phoneRaw || '').replace(/[^\d+]/g, '');
    if (!phone) return Toast.show('No phone number available', Toast.SHORT);
    const url = `tel:${phone}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      try { await Linking.openURL(`telprompt:${phone}`); }
      catch (e2) { Toast.show('Could not open dialer', Toast.SHORT); }
    }
  };

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
  }

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

  verifyOtp = (code) => {
    const orderId = this.getOrderId();
    const otp = code || this.state.otp;
    if (!otp || otp.length < 5) { Toast.show('Please enter 5-digit OTP', Toast.SHORT); return; }
    if (this.state.isLoading) return;

    this.setState({ isLoading: true, otp });
    const body = { orderId: String(orderId), otp: otp };
    console.log('Order Verify OTP payload== ', body);

    fetch(constants.orderVerifyOtp, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + global.token, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(json => {
        console.log('Order Verify OTP response== ', JSON.stringify(json));
        if (json?.status || json?.success) {
          this.showVerifiedAnimation();
        } else {
          this.setState({ isLoading: false });
          Toast.show(json?.message || 'Invalid OTP', Toast.SHORT);
        }
      })
      .catch(e => { this.setState({ isLoading: false }); Toast.show('Something went wrong', Toast.SHORT); });
  };

  componentWillUnmount() {
    this._unmounted = true;
    if (this._navTimer) clearTimeout(this._navTimer);
  }

  showVerifiedAnimation = () => {
    this.setState({ verified: true }, () => {
      Animated.sequence([
        Animated.parallel([
          Animated.spring(this.checkScale, { toValue: 1.15, friction: 3, tension: 80, useNativeDriver: true }),
          Animated.timing(this.checkOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]),
        Animated.spring(this.checkScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
      ]).start();

      setTimeout(() => {
        Animated.parallel([
          Animated.timing(this.ringScale, { toValue: 2, duration: 800, useNativeDriver: true }),
          Animated.timing(this.ringOpacity, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]).start();
      }, 200);

      setTimeout(() => {
        Animated.parallel([
          Animated.timing(this.ring2Scale, { toValue: 2.2, duration: 900, useNativeDriver: true }),
          Animated.timing(this.ring2Opacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]).start();
      }, 500);

      this._navTimer = setTimeout(() => {
        if (!this._unmounted) this.onOtpSuccess();
      }, 2000);
    });
  };

  onOtpSuccess = () => {
    const actionType = this.getActionType();
    const order = this.getOrder();
    const orderId = this.getOrderId();
    if (actionType === 'deliver') {
      this.props.navigation.replace('DeliverToFarmer', { order: order });
    } else {
      this.updateOrderStatus(orderId, actionType);
    }
  };

  updateOrderStatus = (orderId, status) => {
    const body = { status, order_id: orderId, type: '', reason: '' };
    console.log('Update Status (post OTP) payload== ', body);

    fetch(constants.updateStatus, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + global.token, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(json => {
        console.log('Update Status (post OTP) response== ', JSON.stringify(json));
        if (this._unmounted) return;
        Toast.show(json?.message || 'Status updated', Toast.SHORT);
        this.props.navigation.goBack();
      })
      .catch(e => {
        console.log('Update Status (post OTP) error== ', e);
        if (this._unmounted) return;
        this.setState({ isLoading: false });
        Toast.show('Something went wrong', Toast.SHORT);
      });
  };

  render() {
    const actionType = this.getActionType();
    const order = this.getOrder();
    const theme = THEMES[actionType] || THEMES.pickup;
    const BG_T = theme.bg;
    const isPickup = actionType === 'pickup';
    const disabled = this.state.isLoading || this.state.otp.length < 5;
    const { verified } = this.state;

    return (
      <View style={[s.root, { backgroundColor: BG_T }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG_T} />
        <ScreenHeader bg={BG_T} title={theme.title} onBack={this.goBack} />

        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: BG_T }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {verified ? (
              <View style={s.verifiedWrap}>
                <View style={s.checkArea}>
                  <Animated.View style={[s.ring, { borderColor: '#FFF', opacity: this.ringOpacity.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }), transform: [{ scale: this.ringScale }] }]} />
                  <Animated.View style={[s.ring, { borderColor: '#FFF', opacity: this.ring2Opacity.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0] }), transform: [{ scale: this.ring2Scale }] }]} />
                  <Animated.View style={[s.checkCircle, { backgroundColor: '#FFF', shadowColor: '#000', opacity: this.checkOpacity, transform: [{ scale: this.checkScale }] }]}>
                    <Text style={[s.checkMark, { color: BG_T }]}>✓</Text>
                  </Animated.View>
                </View>
                <Animated.View style={{ opacity: this.checkOpacity, alignItems: 'center' }}>
                  <Text style={s.verifiedTitle}>{theme.doneTitle}</Text>
                  <Text style={s.verifiedSub}>{theme.doneSub}</Text>
                </Animated.View>
              </View>
            ) : (
              <>
                {/* Title + OTP */}
                <Animated.View style={[s.titleWrap, { opacity: this.iconFade, transform: [{ translateY: this.titleY }] }]}>
                  <Text style={s.title}>OTP Daalein</Text>
                  <Text style={s.subtitle}>{theme.helper === 'farmer' ? 'Farmer' : 'Warehouse'} ne jo 5-digit code diya hai, woh daalein</Text>
                </Animated.View>

                <Animated.View style={[s.formWrap, { opacity: this.titleFade, transform: [{ translateY: this.formY }] }]}>
                  <OTPInputView
                    style={s.otpView}
                    pinCount={5}
                    autoFocusOnLoad={false}
                    codeInputFieldStyle={[s.otpField, { color: BG_T }]}
                    codeInputHighlightStyle={s.otpActive}
                    onCodeFilled={(code) => {
                      this.setState({ otp: code }, () => this.verifyOtp(code));
                    }}
                  />

                  <TouchableOpacity onPress={() => this.verifyOtp()} disabled={disabled} activeOpacity={0.85}
                    style={[s.btn, { opacity: disabled ? 0.5 : 1 }]}>
                    {this.state.isLoading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={BG_T} />
                        <Text style={[s.btnT, { color: BG_T, marginLeft: 10 }]}>Verify ho raha hai...</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[s.btnT, { color: BG_T }]}>VERIFY & {theme.verifyLbl} KAREIN</Text>
                        <Animated.Image source={require('./assets/arrow.png')} style={[s.btnArrow, { tintColor: BG_T, transform: [{ translateX: this.arrowX }] }]} />
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              </>
            )}

            {/* Order details card — shared OrderCard (theme="dark" for colored bg) */}
            <Animated.View style={{ opacity: this.formFade, marginTop: 16 }}>
              <OrderCard
                order={order}
                theme="dark"
                hideFooter
                onCall={(p) => this.dial(p)}
                onWhatsApp={(p) => this.whatsapp(p)}
                onCallStore={(p) => this.dial(p)}
              />
            </Animated.View>

          </ScrollView>
        </KeyboardAvoidingView>

        <SafeAreaView edges={['bottom']} style={{ backgroundColor: BG_T }}/>
      </View>
    );
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 40 },

  // Align with the canonical screen header: 56-h row, no extra horizontal padding
  // beyond the ScrollView's 12px so the chip sits at 12 + 4 = 16px from the
  // screen edge (matches every other screen).
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0, height: 56, marginBottom: 6 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#FFF' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  backIco: { width: 17, height: 17, resizeMode: 'contain', tintColor: '#FFF' },

  infoCard: { display: 'none' },

  titleWrap: { alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 22, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 19, marginBottom: 20 },

  formWrap: { alignItems: 'center' },
  otpView: { alignSelf: 'center', width: 312, height: 65, marginBottom: 16 },
  otpField: { width: 56, height: 60, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 2, borderColor: 'transparent', color: BG, fontSize: 32, fontWeight: '800' },
  otpActive: { borderColor: '#FCD34D', borderWidth: 2.5 },

  // Width matched to the OTP row above (5 × 56 + 4 × 8 gap = 312).
  btn: { width: 312, height: 54, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  btnT: { fontSize: 15, fontWeight: '700', color: BG, letterSpacing: 0.3 },
  btnArrow: { width: 14, height: 14, resizeMode: 'contain', tintColor: BG, marginLeft: 8 },

  verifiedWrap: { alignItems: 'center', marginTop: 30, marginBottom: 20 },
  checkArea: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  ring: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 2.5, borderColor: '#16A34A' },
  checkCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center', shadowColor: '#16A34A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 3 },
  checkMark: { fontSize: 38, fontWeight: '900', color: '#FFF' },
  verifiedTitle: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 6 },
  verifiedSub: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.55)' },

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
