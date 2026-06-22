import React from 'react';
import {
  View, Text, KeyboardAvoidingView, StatusBar, StyleSheet,
  TouchableOpacity, TextInput, Keyboard, ActivityIndicator, Platform, Animated, Image, ScrollView, Easing, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeBottomEdges } from '../utils/safeAreaInsets';
import { StackActions, NavigationActions, withV4Navigation } from '../utils/v4Compat';
import constants from '../utils/constants';
import Toast from 'react-native-simple-toast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OTPInputView from '@twotalltotems/react-native-otp-input';
import { getFcmToken, refreshFcmToken } from '../utils/pushNotifications';

const BG = '#5D3FD3';
const ACCENT = '#FF8A3D';
const ACCENT_DARK = '#E26A1A';

const DashboardResetAction = StackActions.reset({
  index: 0,
  actions: [NavigationActions.navigate({ routeName: 'LMDDashboard' })],
});

const { width: SCREEN_W } = Dimensions.get('window');

const SCREEN_PAD = 28; // matches inner.paddingHorizontal
const CIRCLE_SIZE = 46;
const TRACKER_W = SCREEN_W - SCREEN_PAD * 2;
const END_WRAP_W = CIRCLE_SIZE + 14;
const ROUTE_W = TRACKER_W - END_WRAP_W * 2;
const VAN_W = 32; // matches splash van
const VAN_TRAVEL = ROUTE_W - VAN_W;
const ROUTE_AMP = 22; // same amplitude as splash
const ROUTE_HEIGHT = ROUTE_AMP * 2 + 30;
const NUM_DOTS = 22;

// Symmetric arch route point (single peak in the middle — both sides have equal height)
const getRoutePoint = (t) => ({
  x: t * ROUTE_W,
  y: -Math.sin(t * Math.PI) * ROUTE_AMP,
});

// Pre-computed van path with many keyframes for buttery-smooth curve following
const VAN_STEPS = 41;
const VAN_INPUT = [];
const VAN_X_OUT = [];
const VAN_Y_OUT = [];
for (let i = 0; i < VAN_STEPS; i++) {
  const t = i / (VAN_STEPS - 1);
  VAN_INPUT.push(t);
  VAN_X_OUT.push(t * VAN_TRAVEL);
  VAN_Y_OUT.push(-Math.sin(t * Math.PI) * ROUTE_AMP);
}

class Login extends React.Component {
  constructor() {
    super();
    this.state = {
      mobile: '',
      isLoading: false,
      show_otp: false,
      otp: '',
      isLoadingOtp: false,
      is_registered: false,
      show_name: false,
      name: '',
      referral_code: '',
      mobileFocused: false,
      nameFocused: false,
      resendIn: 0,
    };

    // Hero anims
    this.heroFade = new Animated.Value(0);
    this.leftScale = new Animated.Value(0);
    this.rightScale = new Animated.Value(0);
    this.bikeProgress = new Animated.Value(0);
    this.bikeOp = new Animated.Value(0);
    this.wheelSpin = new Animated.Value(0);
    this.tickValue = new Animated.Value(0);
    this.vanBounce = new Animated.Value(0);
    this.pulseRing = new Animated.Value(0.8);
    this.pulseOp = new Animated.Value(0);

    // Page entry anims
    this.titleFade = new Animated.Value(0);
    this.titleY = new Animated.Value(20);
    this.formFade = new Animated.Value(0);
    this.formY = new Animated.Value(30);

    // OTP screen anims
    this.otpIconScale = new Animated.Value(0.5);
    this.otpIconFade = new Animated.Value(0);
    this.otpTitleFade = new Animated.Value(0);
    this.otpTitleY = new Animated.Value(20);
    this.otpFormFade = new Animated.Value(0);
    this.otpFormY = new Animated.Value(30);
    this.otpShieldPulse = new Animated.Value(1);
    this.otpHaloScale = new Animated.Value(1);
    this.otpHaloOpacity = new Animated.Value(0.4);
    this.otpVerifyFade = new Animated.Value(0);
    this.otpVerifyY = new Animated.Value(20);
  }

  componentWillUnmount() {
    if (this._resendTimer) { clearInterval(this._resendTimer); this._resendTimer = null; }
  }

  async componentDidMount() {
    this.setState({ referral_code: this.props.navigation.getParam('referral_code') });
    this.animateLoginIn();
    this.startWheelSpin();
    this.startVanBounce();
    this.startPulse();
    this.startBikeLoop();
  }

  animateLoginIn = () => {
    Animated.timing(this.heroFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    Animated.stagger(140, [
      Animated.spring(this.leftScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.spring(this.rightScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(this.titleFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(this.titleY, { toValue: 0, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start();
    }, 300);

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(this.formFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(this.formY, { toValue: 0, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start();
    }, 500);
  };

  startBikeLoop = () => {
    this.bikeOp.setValue(1);
    this.bikeProgress.setValue(0);
    this.tickValue.setValue(0);
    const journey = () => {
      Animated.sequence([
        // Van rides darkstore → kisaan (very slow, sinusoidal ease for buttery smoothness)
        Animated.timing(this.bikeProgress, {
          toValue: 1, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
        // Tick pops in on kisaan
        Animated.spring(this.tickValue, {
          toValue: 1, friction: 5, tension: 120, useNativeDriver: true,
        }),
        // Hold the delivered state
        Animated.delay(600),
        // Van + tick fade out together
        Animated.parallel([
          Animated.timing(this.bikeOp, {
            toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true,
          }),
          Animated.timing(this.tickValue, {
            toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        // Teleport invisibly back to darkstore, then fade in
        this.bikeProgress.setValue(0);
        Animated.sequence([
          Animated.delay(160),
          Animated.timing(this.bikeOp, {
            toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true,
          }),
        ]).start(() => journey());
      });
    };
    setTimeout(journey, 300);
  };

  startWheelSpin = () => {
    const spin = () => {
      this.wheelSpin.setValue(0);
      Animated.timing(this.wheelSpin, {
        toValue: 1, duration: 550, easing: Easing.linear, useNativeDriver: true,
      }).start(() => spin());
    };
    spin();
  };

  startVanBounce = () => {
    const loop = () => {
      Animated.sequence([
        Animated.timing(this.vanBounce, { toValue: -2, duration: 120, useNativeDriver: true }),
        Animated.timing(this.vanBounce, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.delay(200),
      ]).start(() => loop());
    };
    loop();
  };

  startPulse = () => {
    const loop = () => {
      this.pulseRing.setValue(0.8);
      this.pulseOp.setValue(0);
      Animated.parallel([
        Animated.timing(this.pulseRing, { toValue: 2.2, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(this.pulseOp, { toValue: 0.4, duration: 200, useNativeDriver: true }),
          Animated.timing(this.pulseOp, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ]),
      ]).start(() => loop());
    };
    loop();
  };

  animateOtpIn = () => {
    this.otpIconScale.setValue(0.5);
    this.otpIconFade.setValue(0);
    this.otpTitleFade.setValue(0);
    this.otpTitleY.setValue(20);
    this.otpFormFade.setValue(0);
    this.otpFormY.setValue(30);
    this.otpVerifyFade.setValue(0);
    this.otpVerifyY.setValue(20);

    Animated.parallel([
      Animated.spring(this.otpIconScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
      Animated.timing(this.otpIconFade, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(this.otpTitleFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(this.otpTitleY, { toValue: 0, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start();
    }, 200);

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(this.otpFormFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(this.otpFormY, { toValue: 0, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start();
    }, 400);

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(this.otpVerifyFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(this.otpVerifyY, { toValue: 0, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start();
    }, 600);

    this.startShieldPulse();
    this.startHaloPulse();
    this.startResendCountdown();
  };

  startShieldPulse = () => {
    const pulse = () => {
      Animated.sequence([
        Animated.timing(this.otpShieldPulse, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(this.otpShieldPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]).start(() => pulse());
    };
    pulse();
  };

  startHaloPulse = () => {
    const run = () => {
      this.otpHaloScale.setValue(1);
      this.otpHaloOpacity.setValue(0.45);
      Animated.parallel([
        Animated.timing(this.otpHaloScale, { toValue: 1.6, duration: 1600, useNativeDriver: true }),
        Animated.timing(this.otpHaloOpacity, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ]).start(() => run());
    };
    run();
  };

  startResendCountdown = () => {
    if (this._resendTimer) clearInterval(this._resendTimer);
    this.setState({ resendIn: 30 });
    this._resendTimer = setInterval(() => {
      this.setState((p) => {
        if (p.resendIn <= 1) {
          if (this._resendTimer) { clearInterval(this._resendTimer); this._resendTimer = null; }
          return { resendIn: 0 };
        }
        return { resendIn: p.resendIn - 1 };
      });
    }, 1000);
  };

  handleResendOtp = () => {
    if (this.state.resendIn > 0 || this.state.isLoading) return;
    this.setState({ otp: '' });
    this.loginApi(true);
    this.startResendCountdown();
  };

  onMobileChange = (text) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    this.setState({ mobile: cleaned }, () => {
      if (cleaned.length === 10 && !this.state.isLoading) {
        Keyboard.dismiss();
        this.loginApi(true);
      }
    });
  };

  loginApi(type) {
    if (this.state.isLoading) return;
    const body = {
      mobile: this.state.mobile, type: type,
      name: this.state.name, referral_code: this.state.referral_code || '',
    };
    console.log('Login API payload== ', body);
    this.setState({ isLoading: true });
    fetch(constants.login, {
      headers: { 'X-localization': 'en', 'Content-Type': 'application/json', Accept: 'application/json' },
      method: 'POST', body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((json) => {
        this.setState({ isLoading: false });
        console.log('Login API response== ', json);
        Toast.show(json.message, Toast.SHORT);
        if (json.status) {
          this.setState({ is_registered: json.is_registered });
          if (type) {
            this.setState({ show_otp: true }, () => this.animateOtpIn());
          } else {
            setTimeout(() => this.props.navigation.dispatch(DashboardResetAction), 150);
          }
        }
      })
      .catch((e) => { this.setState({ isLoading: false }); console.log('Login API error== ', e); });
  }

  async verifyOtp() {
    if (this.state.isLoadingOtp) return;
    this.setState({ isLoadingOtp: true });

    // Make sure we have an FCM token before submitting; refresh if missing.
    let pnsToken = getFcmToken();
    if (!pnsToken) {
      try { pnsToken = await refreshFcmToken(); } catch (e) {}
    }
    console.log('Verify OTP FCM token==', pnsToken || '(empty)');

    const body = {
      mobile: this.state.mobile, otp: this.state.otp,
      pnsToken: pnsToken || '', deviceType: global.os || Platform.OS,
    };
    console.log('Verify OTP API payload== ', body);
    fetch(constants.verifyOtp, {
      headers: { 'X-localization': 'en', 'Content-Type': 'application/json', Accept: 'application/json' },
      method: 'POST', body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((json) => {
        this.setState({ isLoadingOtp: false });
        console.log('Verify OTP API response== ', json);
        Toast.show(json.message, Toast.SHORT);
        if (json.status) {
          this.setState({ show_otp: false }, () => {
            global.token = json.token; global.userType = json.user_type;
            this._storeData(json);
            if (this.state.is_registered) { Keyboard.dismiss(); this.props.navigation.dispatch(DashboardResetAction); }
            else { this.setState({ show_name: true }); }
          });
        }
      })
      .catch((e) => { this.setState({ isLoadingOtp: false }); console.log('Verify OTP API error== ', e); });
  }

  _storeData = async (r) => {
    try {
      await AsyncStorage.setItem('accessToken', r?.token);
      await AsyncStorage.setItem('userType', r?.user_type);
      await AsyncStorage.setItem('referral_code', r?.referral_code?.toString() || '');
    } catch (e) {}
  };

  onOtpFilled = (code) => {
    this.setState({ otp: code }, () => this.verifyOtp());
  };

  goBackToMobile = () => {
    this.setState({ show_otp: false, otp: '' });
  };

  // =================== DARKSTORE → BIKE → KISAAN TRACKER ===================

  renderTracker = () => {
    // 25-keyframe interpolation makes the van follow the true sine curve smoothly
    // (instead of straight-line segments between 5 keyframes)
    const vanX = this.bikeProgress.interpolate({
      inputRange: VAN_INPUT, outputRange: VAN_X_OUT,
    });
    const vanY = this.bikeProgress.interpolate({
      inputRange: VAN_INPUT, outputRange: VAN_Y_OUT,
    });

    // Build route dot positions
    const routePoints = [];
    for (let i = 0; i < NUM_DOTS; i++) {
      routePoints.push(getRoutePoint(i / (NUM_DOTS - 1)));
    }

    return (
      <Animated.View style={[st.tracker, { opacity: this.heroFade }]}>
        {/* Left: Darkstore */}
        <Animated.View style={[st.endWrap, { transform: [{ scale: this.leftScale }] }]}>
          <View style={[st.endCircle, st.endCircleLeft]}>
            <Image source={require('./assets/t3.png')} style={st.endIconLogo} />
          </View>
          <Text style={st.endLabel}>Darkstore</Text>
        </Animated.View>

        {/* Middle: wavy dotted route + bike following the curve */}
        <View style={st.routeArea}>
          {/* Sine-curve dots */}
          {routePoints.map((pt, i) => {
            const t = i / (NUM_DOTS - 1);
            const op = this.bikeProgress.interpolate({
              inputRange: [
                Math.max(0, t - 0.08),
                t,
                Math.min(1, t + 0.05),
                1,
              ],
              outputRange: [0.3, 1, 1, 1],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[
                  st.routeDot,
                  {
                    left: pt.x - 3,
                    top: ROUTE_HEIGHT / 2 + pt.y - 3,
                    opacity: op,
                  },
                ]}
              />
            );
          })}

          {/* Van (splash design, follows the curve) */}
          <Animated.View
            style={[
              st.van,
              {
                opacity: this.bikeOp,
                transform: [
                  { translateX: vanX },
                  { translateY: vanY },
                ],
              },
            ]}
          >
            <View style={st.vanCargo}>
              <View style={st.vanCargoStripe} />
            </View>
            <View style={st.vanCab}>
              <View style={st.vanWindow} />
            </View>
            <View style={[st.vanW, { left: 2 }]} />
            <View style={[st.vanW, { right: 2 }]} />
          </Animated.View>
        </View>

        {/* Right: Kisaan */}
        <Animated.View style={[st.endWrap, { transform: [{ scale: this.rightScale }] }]}>
          <View style={st.kisaanWrap}>
            {/* Continuous pulse ring (same as splash) */}
            <Animated.View
              style={[
                st.pulseCircle,
                {
                  opacity: this.pulseOp,
                  transform: [{ scale: this.pulseRing }],
                },
              ]}
            />
            <View style={st.endCircle}>
              <Image source={require('./assets/farmer.png')} style={st.endIconFarmer} />
              {/* Delivered tick badge (pops in when van arrives) */}
              <Animated.View
                style={[
                  st.tickBadge,
                  {
                    opacity: this.tickValue,
                    transform: [{ scale: this.tickValue }],
                  },
                ]}
              >
                <Text style={st.tickText}>✓</Text>
              </Animated.View>
            </View>
          </View>
          <Text style={st.endLabel}>Kisaan</Text>
        </Animated.View>
      </Animated.View>
    );
  };

  renderLogin = () => {
    const { mobile, isLoading, mobileFocused } = this.state;
    const hasDigits = mobile.length > 0;

    return (
      <View>
        <View style={st.iconArea}>{this.renderTracker()}</View>

        <Animated.View style={{ opacity: this.titleFade, transform: [{ translateY: this.titleY }] }}>
          <View style={st.titleRow}>
            <Text style={st.titleGramik}>Gramik</Text>
            <Text style={st.titleLMD}> LMD</Text>
          </View>
          <Text style={st.subtitle}>Apna mobile number daalein, OTP bhejenge</Text>
        </Animated.View>

        <Animated.View style={{ opacity: this.formFade, transform: [{ translateY: this.formY }] }}>
          <View style={[st.inputBox, mobileFocused && st.inputBoxFocused]}>
            <Image source={require('./assets/india.png')} style={st.flagImg} />
            <Text style={st.prefix}>+91</Text>
            <View style={st.divider} />
            <TextInput
              placeholder="Mobile Number"
              keyboardType="numeric"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={[st.mobileInput, hasDigits && st.mobileInputFilled]}
              maxLength={10}
              onChangeText={this.onMobileChange}
              value={mobile}
              editable={!isLoading}
              onFocus={() => this.setState({ mobileFocused: true })}
              onBlur={() => this.setState({ mobileFocused: false })}
            />
            {isLoading && <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 14 }} />}
          </View>

          <TouchableOpacity
            onPress={() => this.loginApi(true)}
            disabled={mobile.length < 10 || isLoading}
            activeOpacity={0.85}
            style={[st.btn, { opacity: mobile.length < 10 || isLoading ? 0.4 : 1 }]}
          >
            {isLoading ? <ActivityIndicator size="small" color={BG} /> : <Text style={st.btnText}>OTP BHEJEIN</Text>}
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  renderOtp = () => {
    const { mobile, otp, isLoadingOtp, resendIn } = this.state;
    const canVerify = otp && otp.length === 5 && !isLoadingOtp;
    const canResend = resendIn === 0;
    return (
      <View>
        {/* Shield icon with animated halo behind it */}
        <View style={st.iconArea}>
          <Animated.View
            pointerEvents="none"
            style={[
              st.shieldHalo,
              { opacity: this.otpHaloOpacity, transform: [{ scale: this.otpHaloScale }] },
            ]}
          />
          <Animated.View style={[st.iconCircle, st.shieldCircle, { opacity: this.otpIconFade, transform: [{ scale: this.otpIconScale }] }]}>
            <Animated.View style={{ transform: [{ scale: this.otpShieldPulse }] }}>
              <Image source={require('./assets/shield.png')} style={st.iconImg} />
            </Animated.View>
          </Animated.View>
        </View>

        {/* Title + subtitle */}
        <Animated.View style={{ opacity: this.otpTitleFade, transform: [{ translateY: this.otpTitleY }] }}>
          <Text style={st.title}>OTP Verify Karein</Text>
          <Text style={st.subtitle}>5-digit code daalein jo bheja gaya</Text>

          {/* Phone badge pill */}
          <View style={st.phonePill}>
            <Image source={require('./assets/india.png')} style={st.phonePillFlag} />
            <Text style={st.phonePillNum}>+91 {mobile}</Text>
          </View>
        </Animated.View>

        {/* OTP cells */}
        <Animated.View style={{ opacity: this.otpFormFade, transform: [{ translateY: this.otpFormY }] }}>
          <OTPInputView
            style={st.otpView}
            pinCount={5}
            autoFocusOnLoad={true}
            codeInputFieldStyle={st.otpField}
            codeInputHighlightStyle={st.otpFieldActive}
            onCodeChanged={(code) => this.setState({ otp: code })}
            onCodeFilled={this.onOtpFilled}
          />
        </Animated.View>

        {/* Verify CTA */}
        <Animated.View style={{ opacity: this.otpVerifyFade, transform: [{ translateY: this.otpVerifyY }] }}>
          <TouchableOpacity
            onPress={() => this.verifyOtp()}
            disabled={!canVerify}
            activeOpacity={0.85}
            style={[st.verifyBtn, !canVerify && { opacity: 0.45 }]}
          >
            {isLoadingOtp ? (
              <ActivityIndicator size="small" color={BG} />
            ) : (
              <View style={st.verifyBtnInner}>
                <Text style={st.verifyBtnText}>VERIFY OTP</Text>
                <Text style={st.verifyBtnArr}>›</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Resend with countdown */}
          <View style={st.resendRow}>
            {canResend ? (
              <TouchableOpacity onPress={this.handleResendOtp} activeOpacity={0.7} style={st.resendBtn}>
                <Text style={st.resendIco}>↻</Text>
                <Text style={st.resendLink}>OTP Dobara Bhejein</Text>
              </TouchableOpacity>
            ) : (
              <Text style={st.resendCountdown}>
                Resend OTP in <Text style={st.resendCountdownBold}>{resendIn}s</Text>
              </Text>
            )}
          </View>

          {/* Change number */}
          <TouchableOpacity onPress={this.goBackToMobile} activeOpacity={0.7} style={st.changeNumBtn}>
            <Text style={st.changeNumIco}>‹</Text>
            <Text style={st.changeNumText}>Number Badlein</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  renderName = () => {
    const { name, isLoading, nameFocused } = this.state;
    return (
      <View>
        <View style={st.iconArea}>
          <View style={st.iconCircle}>
            <Image source={require('./assets/farmer.png')} style={[st.iconImg, { tintColor: undefined }]} />
          </View>
        </View>

        <Text style={st.title}>Aapka naam kya hai?</Text>
        <Text style={st.subtitle}>Apna naam daalein, aage badhne ke liye</Text>

        <View style={[st.inputBox, nameFocused && st.inputBoxFocused]}>
          <TextInput
            autoCapitalize="sentences"
            placeholder="Naam Daalein"
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={[st.mobileInput, { paddingLeft: 18, fontSize: 17, fontWeight: '600' }]}
            onChangeText={(t) => this.setState({ name: t })}
            value={name}
            onFocus={() => this.setState({ nameFocused: true })}
            onBlur={() => this.setState({ nameFocused: false })}
          />
        </View>

        <TouchableOpacity
          onPress={() => { Keyboard.dismiss(); this.loginApi(false); }}
          disabled={!name.trim() || isLoading}
          activeOpacity={0.85}
          style={[st.btn, { opacity: !name.trim() || isLoading ? 0.4 : 1 }]}
        >
          {isLoading ? <ActivityIndicator size="small" color={BG} /> : <Text style={st.btnText}>AAGE BADHEIN</Text>}
        </TouchableOpacity>
      </View>
    );
  };

  render() {
    const { show_otp, show_name } = this.state;
    return (
      <View style={st.root}>
        <StatusBar backgroundColor={BG} translucent={false} barStyle="light-content" />
        <SafeAreaView edges={['top']} style={st.safe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <TouchableOpacity activeOpacity={1} onPress={Keyboard.dismiss} style={st.inner}>
                {!show_otp && !show_name && this.renderLogin()}
                {show_otp && this.renderOtp()}
                {show_name && this.renderName()}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
        <SafeAreaView edges={safeBottomEdges()} style={{ flex: 0, backgroundColor: BG }}/>
      </View>
    );
  }
}

export default withV4Navigation(Login);

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'android' ? 70 : 30,
    paddingBottom: 30,
  },

  // Hero
  iconArea: { alignItems: 'center', justifyContent: 'center', minHeight: 130, marginBottom: 6 },

  tracker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Endpoint (Darkstore / Kisaan)
  endWrap: { alignItems: 'center', width: CIRCLE_SIZE + 14 },
  endCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 2,
  },
  endCircleLeft: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  endIconLogo: { width: 26, height: 30, resizeMode: 'contain' },
  endIconFarmer: { width: CIRCLE_SIZE - 4, height: CIRCLE_SIZE - 4, resizeMode: 'contain', borderRadius: (CIRCLE_SIZE - 4) / 2 },
  endLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },

  // Middle route (wavy curve area)
  routeArea: {
    width: ROUTE_W,
    height: ROUTE_HEIGHT,
    marginTop: -11, // shift up so the route's y=0 baseline lines up with the circle centers
    position: 'relative',
  },
  routeDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT,
  },

  // Van (splash design)
  van: {
    position: 'absolute',
    left: 0,
    top: ROUTE_HEIGHT / 2 - 10, // van is ~14h, center it on route baseline (a bit lower for wheel offset)
    flexDirection: 'row',
    alignItems: 'flex-end',
    zIndex: 8,
  },
  vanCargo: { width: 22, height: 14, backgroundColor: ACCENT, borderRadius: 2.5, overflow: 'hidden' },
  vanCargoStripe: { position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, backgroundColor: ACCENT_DARK },
  vanCab: { width: 11, height: 11, backgroundColor: '#E8E0FF', borderTopRightRadius: 5, borderBottomRightRadius: 1.5, marginLeft: -1.5, overflow: 'hidden' },
  vanWindow: { width: 6, height: 5, backgroundColor: '#A5B4FC', borderRadius: 1, marginTop: 2, marginLeft: 3 },
  vanW: { position: 'absolute', bottom: -3, width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },

  // Pulse ring around Kisaan circle
  kisaanWrap: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCircle: {
    position: 'absolute',
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    borderColor: '#10B981',
  },

  // Delivered tick (overlays top-right of Kisaan circle, shifted out to avoid overlapping the icon)
  tickBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  tickText: { color: '#FFF', fontSize: 12, fontWeight: '900', lineHeight: 14 },

  // OTP/name circles
  iconCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  shieldCircle: { backgroundColor: 'rgba(255,255,255,0.12)' },
  iconImg: { width: 42, height: 42, resizeMode: 'contain', tintColor: '#FFF' },

  // Text
  title: { fontSize: 24, fontWeight: '900', color: '#FFF', textAlign: 'center', marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  titleGramik: { fontSize: 34, fontWeight: '900', color: '#FFF', letterSpacing: 0.5 },
  titleLMD: { fontSize: 34, fontWeight: '900', color: ACCENT, letterSpacing: 1 },
  subtitle: { fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 22, marginBottom: 14 },
  phoneBold: { fontWeight: '800', color: '#FFF', fontSize: 15 },

  // Input
  inputBox: { width: '100%', height: 60, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 22 },
  inputBoxFocused: { borderColor: '#FFF', borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.13)' },
  flagImg: { width: 20, height: 20, resizeMode: 'contain', marginLeft: 12 },
  prefix: { paddingLeft: 6, fontSize: 15, fontWeight: '800', color: '#FFF' },
  divider: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 8 },
  mobileInput: {
    flex: 1,
    paddingTop: 0,
    paddingBottom: 0,
    paddingRight: 12,
    height: 30,
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1.2,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  // No font size/weight change once filled — keeps baseline locked to the prefix.
  mobileInputFilled: {},

  // Button
  btn: { width: '100%', height: 56, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '900', color: BG, letterSpacing: 0.5 },

  // OTP
  otpView: { width: '100%', height: 72, marginBottom: 20 },
  otpField: { width: 56, height: 64, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)', color: '#FFF', fontSize: 26, fontWeight: '800' },
  otpFieldActive: { borderColor: '#FFF', borderWidth: 2.5, backgroundColor: 'rgba(255,255,255,0.16)' },

  verifyingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  verifyingText: { color: '#FFF', fontSize: 13, fontWeight: '600', marginLeft: 8 },

  linkBtn: { paddingVertical: 12, alignItems: 'center' },
  linkText: { fontSize: 14, fontWeight: '700', color: '#FFF', textDecorationLine: 'underline' },
  linkTextFaint: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },

  // Pulsing halo behind the shield icon
  shieldHalo: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  // Phone badge pill below the subtitle on the OTP screen
  phonePill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginBottom: 26,
  },
  phonePillFlag: { width: 18, height: 18, resizeMode: 'contain', marginRight: 8 },
  phonePillNum: { color: '#FFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  // Primary Verify CTA
  verifyBtn: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  verifyBtnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  verifyBtnText: { fontSize: 15, fontWeight: '900', color: BG, letterSpacing: 0.6 },
  verifyBtnArr: { fontSize: 22, fontWeight: '900', color: BG, marginLeft: 8, marginTop: -3, includeFontPadding: false, lineHeight: 24 },

  // Resend row
  resendRow: { alignItems: 'center', marginTop: 18, marginBottom: 6, minHeight: 28, justifyContent: 'center' },
  resendBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8 },
  resendIco: { color: '#FFF', fontSize: 15, fontWeight: '900', marginRight: 6 },
  resendLink: { fontSize: 14, fontWeight: '700', color: '#FFF', textDecorationLine: 'underline' },
  resendCountdown: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.65)' },
  resendCountdownBold: { color: '#FFF', fontWeight: '800' },

  // Change number link
  changeNumBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginTop: 4 },
  changeNumIco: { color: 'rgba(255,255,255,0.55)', fontSize: 18, fontWeight: '700', marginRight: 4, marginTop: -2, includeFontPadding: false },
  changeNumText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
});
