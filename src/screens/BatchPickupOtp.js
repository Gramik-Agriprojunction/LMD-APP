import React, { Component } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Image, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OTPInputView from '@twotalltotems/react-native-otp-input';
import constants from '../utils/constants';
import Toast from 'react-native-simple-toast';
import { withV4Navigation } from '../utils/v4Compat';
import ScreenHeader from '../components/ScreenHeader';
import { STATUS } from '../utils/statusColors';

// Bulk pickup → use the canonical PICKUP status colour so the screen reads
// as part of the pickup flow (same cyan as the status chip / Pickup tile).
const BG = STATUS.PICKUP.bg;
const OTP_ROW_W = 312; // 5 × 56 + 4 × 8 gap — matches OrderOtpVerify

class BatchPickupOtp extends Component {
  constructor(props) {
    super(props);
    this.state = { otp: '', isLoading: false, verified: false };
    this.iconFade = new Animated.Value(0);
    this.titleFade = new Animated.Value(0);
    this.titleY = new Animated.Value(20);
    this.formFade = new Animated.Value(0);
    this.formY = new Animated.Value(30);
    this.arrowX = new Animated.Value(0);
    this.checkScale = new Animated.Value(0);
    this.checkOpacity = new Animated.Value(0);
    this.ringScale = new Animated.Value(0.5);
    this.ringOpacity = new Animated.Value(0);
    this.ring2Scale = new Animated.Value(0.5);
    this.ring2Opacity = new Animated.Value(0);
  }

  getOrderIds = () => {
    const ids = this.props?.navigation?.getParam('orderIds', []);
    return Array.isArray(ids) ? ids : [];
  };
  getOrders = () => {
    const list = this.props?.navigation?.getParam('orders', []);
    return Array.isArray(list) ? list : [];
  };
  getOnDone = () => this.props?.navigation?.getParam('onDone', null);

  toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  goBack = () => { if (this.props?.navigation?.goBack) this.props.navigation.goBack(); };

  componentDidMount() {
    Animated.timing(this.iconFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(this.titleFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(this.titleY, { toValue: 0, friction: 6, useNativeDriver: true }),
      ]).start();
    }, 150);
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(this.formFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(this.formY, { toValue: 0, friction: 6, useNativeDriver: true }),
      ]).start();
    }, 300);

    const arrowLoop = () => {
      Animated.sequence([
        Animated.timing(this.arrowX, { toValue: 6, duration: 800, useNativeDriver: true }),
        Animated.timing(this.arrowX, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]).start(() => arrowLoop());
    };
    arrowLoop();
  }

  componentWillUnmount() {
    this._unmounted = true;
    if (this._navTimer) clearTimeout(this._navTimer);
  }

  submit = (code) => {
    const orderIds = this.getOrderIds();
    const otp = code || this.state.otp;
    if (!otp || otp.length < 5) { Toast.show('Please enter 5-digit OTP', Toast.SHORT); return; }
    if (this.state.isLoading) return;
    if (!orderIds.length) { Toast.show('No orders selected', Toast.SHORT); return; }

    this.setState({ isLoading: true, otp });

    fetch(constants.bulkPickupOtpVerify, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + global.token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ orderIds, otp }),
    })
      .then(r => r.json())
      .then(json => {
        if (this._unmounted) return;
        if (json?.status || json?.success) {
          if (json?.message) Toast.show(String(json.message), Toast.SHORT);
          this.showVerifiedAnimation();
        } else {
          this.setState({ isLoading: false });
          Toast.show(json?.message || 'Invalid OTP', Toast.SHORT);
        }
      })
      .catch(() => {
        if (this._unmounted) return;
        this.setState({ isLoading: false });
        Toast.show('Something went wrong', Toast.SHORT);
      });
  };

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
        if (this._unmounted) return;
        const onDone = this.getOnDone();
        if (typeof onDone === 'function') onDone();
        this.props.navigation.goBack();
      }, 1600);
    });
  };

  render() {
    const orderIds = this.getOrderIds();
    const orders = this.getOrders();
    const count = orderIds.length;
    const total = orders.reduce((sum, o) => sum + this.toNum(o?.amount), 0);
    const disabled = this.state.isLoading || this.state.otp.length < 5;
    const { verified } = this.state;

    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />

        <ScreenHeader bg={BG} title="Multiple Orders Pickup Karein" onBack={this.goBack} />

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {verified ? (
              <View style={s.verifiedWrap}>
                <View style={s.checkArea}>
                  <Animated.View style={[s.ring, { opacity: this.ringOpacity.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }), transform: [{ scale: this.ringScale }] }]} />
                  <Animated.View style={[s.ring, { opacity: this.ring2Opacity.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0] }), transform: [{ scale: this.ring2Scale }] }]} />
                  <Animated.View style={[s.checkCircle, { opacity: this.checkOpacity, transform: [{ scale: this.checkScale }] }]}>
                    <Text style={s.checkMark}>✓</Text>
                  </Animated.View>
                </View>
                <Animated.View style={{ opacity: this.checkOpacity, alignItems: 'center' }}>
                  <Text style={s.verifiedTitle}>Pickup Ho Gaya!</Text>
                  <Text style={s.verifiedSub}>Order status update ho raha hai...</Text>
                </Animated.View>
              </View>
            ) : (
              <>
                <Animated.View style={[s.titleWrap, { opacity: this.iconFade, transform: [{ translateY: this.titleY }] }]}>
                  <Text style={s.title}>OTP Daalein</Text>
                  <Text style={s.subtitle}>Warehouse ne jo 5-digit code diya hai, woh daalein</Text>
                </Animated.View>

                {/* OTP input + verify button (above the orders card) */}
                <Animated.View style={[s.formWrap, { opacity: this.formFade, transform: [{ translateY: this.formY }] }]}>
                  <OTPInputView
                    style={s.otpView}
                    pinCount={5}
                    autoFocusOnLoad={false}
                    codeInputFieldStyle={s.otpField}
                    codeInputHighlightStyle={s.otpActive}
                    onCodeFilled={(code) => {
                      this.setState({ otp: code }, () => this.submit(code));
                    }}
                  />

                  <TouchableOpacity onPress={() => this.submit()} disabled={disabled} activeOpacity={0.85}
                    style={[s.btn, { opacity: disabled ? 0.5 : 1 }]}>
                    {this.state.isLoading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={BG} />
                        <Text style={[s.btnT, { marginLeft: 10 }]}>Update ho raha hai...</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={s.btnT}>VERIFY & PICKUP KAREIN</Text>
                        <Animated.Image source={require('./assets/arrow.png')} style={[s.btnArrow, { transform: [{ translateX: this.arrowX }] }]} />
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>

                {/* Selected orders summary + list (below the OTP) */}
                <Animated.View style={[s.summaryCard, { opacity: this.titleFade, marginTop: 18, marginBottom: 0 }]}>
                  <View style={s.summaryHead}>
                    <View style={s.countBadge}>
                      <Text style={s.countBadgeT}>{count}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.countLbl}>Selected Orders</Text>
                      <Text style={s.countSub}>Picked Up mark ho jaayenge</Text>
                    </View>
                    {total > 0 && (
                      <View style={s.totalChip}>
                        <Text style={s.totalChipLbl}>Total</Text>
                        <Text style={s.totalChipVal}>₹{this.toNum(total)}</Text>
                      </View>
                    )}
                  </View>

                  {orders.length > 0 && (
                    <View style={s.orderList}>
                      {orders.slice(0, 5).map((o, i) => (
                        <View key={`${o?.id || i}`} style={[s.orderItem, i === orders.slice(0, 5).length - 1 && { borderBottomWidth: 0 }]}>
                          <View style={s.orderDot} />
                          <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={s.orderOid} numberOfLines={1}>#{o?.order_id || '-'}</Text>
                            <Text style={s.orderFarmer} numberOfLines={1}>{o?.farmer_name || '-'}</Text>
                          </View>
                          <Text style={s.orderAmt}>₹{this.toNum(o?.amount)}</Text>
                        </View>
                      ))}
                      {orders.length > 5 && (
                        <Text style={s.moreT}>+ {orders.length - 5} more</Text>
                      )}
                    </View>
                  )}
                </Animated.View>
              </>
            )}

          </ScrollView>
        </KeyboardAvoidingView>

        <SafeAreaView edges={['bottom']} style={{ backgroundColor: BG }} />
      </View>
    );
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#FFF' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  backIco: { width: 17, height: 17, resizeMode: 'contain', tintColor: '#FFF' },

  titleWrap: { alignItems: 'center', marginBottom: 6, marginTop: 4 },
  title: { fontSize: 22, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 19, marginBottom: 20 },

  // Summary card (count + order list)
  summaryCard: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  summaryHead: { flexDirection: 'row', alignItems: 'center' },
  countBadge: { minWidth: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, marginRight: 12 },
  countBadgeT: { fontSize: 16, fontWeight: '800', color: BG },
  countLbl: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  countSub: { fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  totalChip: { alignItems: 'flex-end', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  totalChipLbl: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.4 },
  totalChipVal: { fontSize: 13, fontWeight: '800', color: '#FFF', marginTop: 1 },

  // Order rows
  orderList: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  orderItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  orderDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FCD34D' },
  orderOid: { fontSize: 11.5, fontWeight: '700', color: '#FFF' },
  orderFarmer: { fontSize: 10.5, fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  orderAmt: { fontSize: 12, fontWeight: '800', color: '#FCD34D' },
  moreT: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 6 },

  formWrap: { alignItems: 'center' },
  otpView: { alignSelf: 'center', width: OTP_ROW_W, height: 65, marginBottom: 16 },
  otpField: {
    width: 56, height: 60, borderRadius: 12,
    backgroundColor: '#FFF', borderWidth: 2, borderColor: 'transparent',
    color: BG, fontSize: 32, fontWeight: '800',
  },
  otpActive: { borderColor: '#FCD34D', borderWidth: 2.5 },

  btn: { width: OTP_ROW_W, height: 54, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  btnT: { fontSize: 15, fontWeight: '800', color: BG, letterSpacing: 0.3 },
  btnArrow: { width: 14, height: 14, resizeMode: 'contain', tintColor: BG, marginLeft: 8 },

  verifiedWrap: { alignItems: 'center', marginTop: 40, marginBottom: 20 },
  checkArea: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  ring: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 2.5, borderColor: '#16A34A' },
  checkCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center', shadowColor: '#16A34A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 3 },
  checkMark: { fontSize: 38, fontWeight: '900', color: '#FFF' },
  verifiedTitle: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 6 },
  verifiedSub: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.6)' },
});

export default withV4Navigation(BatchPickupOtp);
