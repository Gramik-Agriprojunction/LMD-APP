import React, { Component } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar,
  Image, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, ScrollView, Linking,
} from 'react-native';
import OTPInputView from '@twotalltotems/react-native-otp-input';
import constants from '../utils/constants';
import Toast from 'react-native-simple-toast';
import { withV4Navigation } from '../utils/v4Compat';

const BG = '#5D3FD3';

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
    const isPickup = actionType === 'pickup';
    const disabled = this.state.isLoading || this.state.otp.length < 5;
    const { verified } = this.state;

    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <SafeAreaView style={{ backgroundColor: BG }} />

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* Header row */}
            <View style={s.topRow}>
              <TouchableOpacity onPress={this.goBack} style={s.backBtn} activeOpacity={0.7}>
                <Image source={require('./assets/back.png')} style={s.backIco} />
              </TouchableOpacity>
              <Text style={s.topTitle}>{isPickup ? 'Pickup Verification' : 'Delivery Verification'}</Text>
              <View style={{ width: 38 }} />
            </View>

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
                  <Text style={s.verifiedTitle}>Verified!</Text>
                  <Text style={s.verifiedSub}>{isPickup ? 'Updating pickup status...' : 'Proceeding to delivery...'}</Text>
                </Animated.View>
              </View>
            ) : (
              <>
                {/* Title + OTP */}
                <Animated.View style={[s.titleWrap, { opacity: this.iconFade, transform: [{ translateY: this.titleY }] }]}>
                  <Text style={s.title}>Enter OTP</Text>
                  <Text style={s.subtitle}>Enter the 5-digit code shared by the {isPickup ? 'warehouse' : 'farmer'}</Text>
                </Animated.View>

                <Animated.View style={[s.formWrap, { opacity: this.titleFade, transform: [{ translateY: this.formY }] }]}>
                  <OTPInputView
                    style={s.otpView}
                    pinCount={5}
                    autoFocusOnLoad={false}
                    codeInputFieldStyle={s.otpField}
                    codeInputHighlightStyle={s.otpActive}
                    onCodeFilled={(code) => {
                      this.setState({ otp: code }, () => this.verifyOtp(code));
                    }}
                  />

                  <TouchableOpacity onPress={() => this.verifyOtp()} disabled={disabled} activeOpacity={0.85}
                    style={[s.btn, { opacity: disabled ? 0.5 : 1 }]}>
                    {this.state.isLoading ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={BG} />
                        <Text style={[s.btnT, { marginLeft: 10 }]}>Verifying...</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={s.btnT}>VERIFY & {isPickup ? 'PICKUP' : 'DELIVER'}</Text>
                        <Animated.Image source={require('./assets/arrow.png')} style={[s.btnArrow, { transform: [{ translateX: this.arrowX }] }]} />
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              </>
            )}

            {/* Order details card — below verify */}
            <Animated.View style={[s.orderCard, { opacity: this.formFade }]}>
              {/* Header */}
              <View style={s.orderHead}>
                <Text style={s.orderOid}>#{order?.order_id || (order?.order_code ? order.order_code.split(' ')[0] : '')}</Text>
                <Text style={s.orderAmt}>₹{order?.amount || order?.grand_total || 0}</Text>
              </View>

              {/* Farmer */}
              <View style={s.orderPerson}>
                <Image source={require('./assets/farmer.png')} style={s.orderAvt} />
                <View style={{ flex: 1 }}>
                  <Text style={s.orderName}>{order?.farmer_name || order?.farmer_data?.name || '-'}</Text>
                  <Text style={s.orderPhone}>{order?.farmer_mobile || order?.farmer_data?.phone || ''}</Text>
                </View>
                <TouchableOpacity onPress={() => { const p = order?.farmer_mobile || order?.farmer_data?.phone; if(p) Linking.openURL(`tel:${String(p).replace(/\s+/g,'')}`).catch(()=>{}); }} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                  <Image source={require('./assets/call.png')} style={s.orderCallIco} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { const p = order?.farmer_mobile || order?.farmer_data?.phone; if(p) { const c = String(p).replace(/[^\d]/g,''); Linking.openURL(`https://wa.me/${c}`).catch(()=>{}); } }} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}} style={{ marginLeft: 12 }}>
                  <Image source={require('./assets/whatsapp.png')} style={s.orderIco} />
                </TouchableOpacity>
              </View>

              {/* Route */}
              <View style={s.orderRoute}>
                <View style={s.orderRouteR}>
                  <View style={s.orderTl}><View style={[s.orderDot, { backgroundColor: '#86EFAC' }]} /><View style={s.orderLine} /></View>
                  <View style={s.orderRBody}>
                    <Text style={[s.orderRLbl, { color: '#86EFAC' }]}>Pickup</Text>
                    <Text style={s.orderRTitle}>{order?.dark_store?.name || '-'}</Text>
                    {order?.dark_store?.mobile ? <Text style={s.orderRSub}>{order.dark_store.mobile}</Text> : null}
                    <Text style={s.orderRSub}>{order?.dark_store?.location || `${order?.dark_store?.city || ''}${order?.dark_store?.pincode ? `, ${order.dark_store.pincode}` : ''}`}</Text>
                  </View>
                </View>
                <View style={s.orderRouteR}>
                  <View style={s.orderTl}><View style={[s.orderDot, { backgroundColor: '#FCA5A5' }]} /></View>
                  <View style={[s.orderRBody, { paddingBottom: 0 }]}>
                    <Text style={[s.orderRLbl, { color: '#FCA5A5' }]}>Drop</Text>
                    <Text style={s.orderRSub}>
                      {order?.farmer_address?.address || order?.farmer_data?.address || order?.shipping_address || '-'}
                      {order?.farmer_address?.block ? `, ${order.farmer_address.block}` : ''}
                      {order?.farmer_address?.city ? `, ${order.farmer_address.city}` : ''}
                      {order?.farmer_address?.state ? `, ${order.farmer_address.state}` : ''}
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>

          </ScrollView>
        </KeyboardAvoidingView>

        <SafeAreaView style={{ backgroundColor: BG }} />
      </View>
    );
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },

  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#FFF' },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  backIco: { width: 17, height: 17, resizeMode: 'contain', tintColor: '#FFF' },

  infoCard: { display: 'none' },

  titleWrap: { alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 22, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 19, marginBottom: 20 },

  formWrap: { alignItems: 'center' },
  otpView: { width: '100%', height: 65, marginBottom: 16 },
  otpField: { width: 56, height: 60, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 2, borderColor: 'transparent', color: BG, fontSize: 32, fontWeight: '800' },
  otpActive: { borderColor: '#FCD34D', borderWidth: 2.5 },

  btn: { width: '100%', height: 54, borderRadius: 14, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  btnT: { fontSize: 15, fontWeight: '800', color: BG, letterSpacing: 0.3 },
  btnArrow: { width: 14, height: 14, resizeMode: 'contain', tintColor: BG, marginLeft: 8 },

  verifiedWrap: { alignItems: 'center', marginTop: 30, marginBottom: 20 },
  checkArea: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  ring: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 2.5, borderColor: '#16A34A' },
  checkCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center', shadowColor: '#16A34A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 10 },
  checkMark: { fontSize: 38, fontWeight: '900', color: '#FFF' },
  verifiedTitle: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 6 },
  verifiedSub: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.55)' },

  // Order card (white on purple)
  orderCard: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, marginTop: 20, overflow: 'hidden' },
  orderHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, paddingBottom: 8 },
  orderOid: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  orderAmt: { fontSize: 16, fontWeight: '700', color: '#FCD34D' },
  orderPerson: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  orderAvt: { width: 24, height: 24, borderRadius: 12, resizeMode: 'cover', marginRight: 8 },
  orderName: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  orderPhone: { fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  orderIco: { width: 30, height: 30, resizeMode: 'contain' },
  orderCallIco: { width: 30, height: 30, resizeMode: 'contain', tintColor: '#F97316' },
  orderRoute: { paddingHorizontal: 12, paddingVertical: 10 },
  orderRouteR: { flexDirection: 'row', alignItems: 'flex-start' },
  orderTl: { width: 14, alignItems: 'center', marginRight: 8, paddingTop: 3 },
  orderDot: { width: 8, height: 8, borderRadius: 4 },
  orderLine: { width: 1.5, flex: 1, minHeight: 8, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 3 },
  orderRBody: { flex: 1, paddingBottom: 10 },
  orderRLbl: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginBottom: 3 },
  orderRTitle: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  orderRSub: { fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.55)', lineHeight: 17, marginTop: 1 },
});

export default withV4Navigation(OrderOtpVerify);
