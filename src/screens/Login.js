import React from 'react';
import {
  View, SafeAreaView, Text, KeyboardAvoidingView, StatusBar, StyleSheet,
  TouchableOpacity, TextInput, Keyboard, ActivityIndicator, Platform, Animated, Image, ScrollView,
} from 'react-native';
import { StackActions, NavigationActions, withV4Navigation } from '../utils/v4Compat';
import constants from '../utils/constants';
import Toast from 'react-native-simple-toast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OTPInputView from '@twotalltotems/react-native-otp-input';

const BG = '#5D3FD3';

const DashboardResetAction = StackActions.reset({
  index: 0,
  actions: [NavigationActions.navigate({ routeName: 'LMDDashboard' })],
});

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
    };

    // Login screen anims
    this.truckX = new Animated.Value(-80);
    this.iconFade = new Animated.Value(0);
    this.iconScale = new Animated.Value(0.6);
    this.titleFade = new Animated.Value(0);
    this.titleY = new Animated.Value(20);
    this.formFade = new Animated.Value(0);
    this.formY = new Animated.Value(30);
    this.ring1 = new Animated.Value(0.8);
    this.ring1Op = new Animated.Value(0.3);
    this.ring2 = new Animated.Value(0.8);
    this.ring2Op = new Animated.Value(0.2);

    // OTP screen anims
    this.otpFade = new Animated.Value(0);
    this.otpY = new Animated.Value(60);
    this.otpIconScale = new Animated.Value(0.5);
    this.otpIconFade = new Animated.Value(0);
    this.otpTitleFade = new Animated.Value(0);
    this.otpTitleY = new Animated.Value(20);
    this.otpFormFade = new Animated.Value(0);
    this.otpFormY = new Animated.Value(30);
    this.otpShieldPulse = new Animated.Value(1);
  }

  async componentDidMount() {
    this.setState({ referral_code: this.props.navigation.getParam('referral_code') });
    this.animateLoginIn();
    this.startRingPulse();
  }

  animateLoginIn = () => {
    // Truck drives in
    Animated.timing(this.truckX, { toValue: 0, duration: 800, useNativeDriver: true }).start();

    // Icon appears
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(this.iconScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
        Animated.timing(this.iconFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, 300);

    // Title slides up
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(this.titleFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(this.titleY, { toValue: 0, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start();
    }, 600);

    // Form slides up
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(this.formFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(this.formY, { toValue: 0, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start();
    }, 800);
  };

  animateOtpIn = () => {
    this.otpIconScale.setValue(0.5);
    this.otpIconFade.setValue(0);
    this.otpTitleFade.setValue(0);
    this.otpTitleY.setValue(20);
    this.otpFormFade.setValue(0);
    this.otpFormY.setValue(30);

    // Icon bounces in
    Animated.parallel([
      Animated.spring(this.otpIconScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
      Animated.timing(this.otpIconFade, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Title slides up
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(this.otpTitleFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(this.otpTitleY, { toValue: 0, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start();
    }, 200);

    // OTP input slides up
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(this.otpFormFade, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(this.otpFormY, { toValue: 0, friction: 6, tension: 50, useNativeDriver: true }),
      ]).start();
    }, 400);

    // Shield pulse loop
    this.startShieldPulse();
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

  startRingPulse = () => {
    const pulse = (scale, opacity) => {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.4, duration: 1800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.8, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.3, duration: 0, useNativeDriver: true }),
        ]),
      ]).start();
    };

    const loop = () => {
      pulse(this.ring1, this.ring1Op);
      setTimeout(() => {
        pulse(this.ring2, this.ring2Op);
        setTimeout(() => loop(), 1300);
      }, 600);
    };
    loop();
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

  verifyOtp() {
    if (this.state.isLoadingOtp) return;
    const body = {
      mobile: this.state.mobile, otp: this.state.otp,
      fcm: global.fcmToken || '', os: global.os || Platform.OS,
    };
    console.log('Verify OTP API payload== ', body);
    this.setState({ isLoadingOtp: true });
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

  // =================== RENDER ===================

  renderLogin = () => {
    const { mobile, isLoading, mobileFocused } = this.state;
    const hasDigits = mobile.length > 0;

    return (
      <View>
        {/* Animated icon */}
        <View style={st.iconArea}>
          <Animated.View style={[st.ring, { transform: [{ scale: this.ring1 }], opacity: this.ring1Op }]} />
          <Animated.View style={[st.ring, st.ringBig, { transform: [{ scale: this.ring2 }], opacity: this.ring2Op }]} />
          <Animated.View style={[st.iconCircle, { opacity: this.iconFade, transform: [{ scale: this.iconScale }, { translateX: this.truckX }] }]}>
            <Image source={require('./assets/dlh.png')} style={st.iconImg} />
          </Animated.View>
        </View>

        {/* Title */}
        <Animated.View style={{ opacity: this.titleFade, transform: [{ translateY: this.titleY }] }}>
          <Text style={st.title}>Welcome to Gramik LMD</Text>
          <Text style={st.subtitle}>Enter your mobile number to get started</Text>
        </Animated.View>

        {/* Form */}
        <Animated.View style={{ opacity: this.formFade, transform: [{ translateY: this.formY }] }}>
          <View style={[st.inputBox, mobileFocused && st.inputBoxFocused]}>
            <Text style={st.prefix}>+91</Text>
            <View style={st.divider} />
            <TextInput
              placeholder="Mobile Number"
              keyboardType="numeric"
              placeholderTextColor="rgba(255,255,255,0.3)"
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
            {isLoading ? <ActivityIndicator size="small" color={BG} /> : <Text style={st.btnText}>SEND OTP</Text>}
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  };

  renderOtp = () => {
    return (
      <View>
        {/* Animated shield icon */}
        <View style={st.iconArea}>
          <Animated.View style={[st.iconCircle, st.shieldCircle, { opacity: this.otpIconFade, transform: [{ scale: this.otpIconScale }] }]}>
            <Animated.View style={{ transform: [{ scale: this.otpShieldPulse }] }}>
              <Image source={require('./assets/shield.png')} style={st.iconImg} />
            </Animated.View>
          </Animated.View>
        </View>

        {/* Title */}
        <Animated.View style={{ opacity: this.otpTitleFade, transform: [{ translateY: this.otpTitleY }] }}>
          <Text style={st.title}>Verify OTP</Text>
          <Text style={st.subtitle}>
            Enter the 5-digit code sent to{'\n'}
            <Text style={st.phoneBold}>+91 {this.state.mobile}</Text>
          </Text>
        </Animated.View>

        {/* OTP input */}
        <Animated.View style={{ opacity: this.otpFormFade, transform: [{ translateY: this.otpFormY }] }}>
          <OTPInputView
            style={st.otpView}
            pinCount={5}
            autoFocusOnLoad={true}
            codeInputFieldStyle={st.otpField}
            codeInputHighlightStyle={st.otpFieldActive}
            onCodeFilled={this.onOtpFilled}
          />

          {this.state.isLoadingOtp && (
            <View style={st.verifyingRow}>
              <ActivityIndicator size="small" color="#FFF" />
              <Text style={st.verifyingText}>Verifying...</Text>
            </View>
          )}

          <TouchableOpacity onPress={() => this.loginApi(true)} activeOpacity={0.7} style={st.linkBtn}>
            <Text style={st.linkText}>Resend OTP</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={this.goBackToMobile} activeOpacity={0.7} style={st.linkBtn}>
            <Text style={st.linkTextFaint}>Change Number</Text>
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

        <Text style={st.title}>What's your name?</Text>
        <Text style={st.subtitle}>Enter your name to continue</Text>

        <View style={[st.inputBox, nameFocused && st.inputBoxFocused]}>
          <TextInput
            autoCapitalize="sentences"
            placeholder="Enter Name"
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
          {isLoading ? <ActivityIndicator size="small" color={BG} /> : <Text style={st.btnText}>CONTINUE</Text>}
        </TouchableOpacity>
      </View>
    );
  };

  render() {
    const { show_otp, show_name } = this.state;
    return (
      <View style={st.root}>
        <StatusBar backgroundColor={BG} translucent={false} barStyle="light-content" />
        <SafeAreaView style={st.safe}>
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
        <SafeAreaView style={{ flex: 0, backgroundColor: BG }} />
      </View>
    );
  }
}

export default withV4Navigation(Login);

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1 },
  inner: { flex: 1, paddingHorizontal: 28, paddingTop: 60, paddingBottom: 30 },

  // Icon area
  iconArea: { alignItems: 'center', justifyContent: 'center', height: 130, marginBottom: 28 },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  ringBig: { width: 160, height: 160, borderRadius: 80 },
  iconCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  shieldCircle: { backgroundColor: 'rgba(255,255,255,0.12)' },
  iconImg: { width: 42, height: 42, resizeMode: 'contain', tintColor: '#FFF' },

  // Text
  title: { fontSize: 24, fontWeight: '900', color: '#FFF', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  phoneBold: { fontWeight: '800', color: '#FFF', fontSize: 15 },

  // Input
  inputBox: { width: '100%', height: 60, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 22 },
  inputBoxFocused: { borderColor: '#FFF', borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.13)' },
  prefix: { paddingLeft: 18, fontSize: 18, fontWeight: '800', color: '#FFF' },
  divider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 14 },
  mobileInput: { flex: 1, fontSize: 17, fontWeight: '600', color: '#FFF', paddingRight: 16, letterSpacing: 1 },
  mobileInputFilled: { fontSize: 22, fontWeight: '900', letterSpacing: 3 },

  // Button
  btn: { width: '100%', height: 56, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '900', color: BG, letterSpacing: 0.5 },

  // OTP
  otpView: { width: '100%', height: 80, marginBottom: 20 },
  otpField: { width: 56, height: 64, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', color: '#FFF', fontSize: 26, fontWeight: '900' },
  otpFieldActive: { borderColor: '#FFF', borderWidth: 2.5, backgroundColor: 'rgba(255,255,255,0.15)' },

  verifyingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  verifyingText: { color: '#FFF', fontSize: 13, fontWeight: '600', marginLeft: 8 },

  linkBtn: { paddingVertical: 12, alignItems: 'center' },
  linkText: { fontSize: 14, fontWeight: '700', color: '#FFF', textDecorationLine: 'underline' },
  linkTextFaint: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
});
