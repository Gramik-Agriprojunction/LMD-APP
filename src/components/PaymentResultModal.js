import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Animated, Easing, StatusBar, ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';
import { S } from '../utils/soilTheme';

const ANIM_BUFFER_MS = 420;
const NAV_EXTRA_MS = 2000;
const EXIT_MS = 280;

const THEMES = {
  success: {
    bg: '#ECFDF5',
    blob1: 'rgba(34,197,94,0.18)',
    blob2: 'rgba(16,185,129,0.12)',
    icon: '#22C55E',
    iconGlow: 'rgba(34,197,94,0.25)',
    ring: 'rgba(34,197,94,0.45)',
    title: '#14532D',
    subtitle: '#166534',
    btn: '#16A34A',
    btnShadow: '#15803D',
    secondary: '#15803D',
    accent: { main: '#16A34A', soft: '#DCFCE7' },
    particleColor: '#86EFAC',
    statusBar: 'dark-content',
  },
  fail: {
    bg: '#FFF1F2',
    blob1: 'rgba(248,113,113,0.2)',
    blob2: 'rgba(252,165,165,0.15)',
    icon: '#EF4444',
    iconGlow: 'rgba(239,68,68,0.22)',
    ring: 'rgba(239,68,68,0.4)',
    title: '#991B1B',
    subtitle: '#B91C1C',
    btn: '#DC2626',
    btnShadow: '#B91C1C',
    secondary: '#BE123C',
    accent: { main: '#EF4444', soft: '#FEE2E2' },
    particleColor: '#FCA5A5',
    statusBar: 'dark-content',
  },
};

const SUCCESS_PARTICLES = [
  { top: 6, left: 14, size: 9, delay: 200, shape: 'circle' },
  { top: 18, right: 10, size: 7, delay: 340, shape: 'circle' },
  { top: 50, left: 2, size: 6, delay: 420, shape: 'plus' },
  { top: 2, right: 44, size: 10, delay: 280, shape: 'plus' },
  { bottom: 14, right: 16, size: 8, delay: 380, shape: 'circle' },
];

const FAIL_PARTICLES = [
  { top: 10, left: 18, size: 8, delay: 200, shape: 'circle' },
  { top: 4, right: 16, size: 10, delay: 300, shape: 'tri' },
  { top: 46, right: 6, size: 7, delay: 400, shape: 'circle' },
  { bottom: 16, left: 12, size: 7, delay: 360, shape: 'tri' },
];

function calcAnimEndMs(rowCount) {
  const lastRowEnd = 480 + Math.max(0, rowCount - 1) * 70 + 360;
  const cardEnd = 380 + 480;
  const actionsEnd = 600 + 420;
  const heroEnd = 720;
  return Math.max(lastRowEnd, cardEnd, actionsEnd, heroEnd) + ANIM_BUFFER_MS + NAV_EXTRA_MS;
}

function FloatingParticle({ particle, index, color }) {
  const op = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(particle.delay),
      Animated.parallel([
        Animated.spring(op, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(drift, { toValue: 1, duration: 1500 + index * 160, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(drift, { toValue: 0, duration: 1500 + index * 160, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
        ),
        Animated.loop(
          Animated.timing(spin, { toValue: 1, duration: 4000 + index * 300, easing: Easing.linear, useNativeDriver: true }),
        ),
      ]),
    ]).start();
  }, [op, drift, spin, particle.delay, index]);

  const translateY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const { size, shape } = particle;

  return (
    <Animated.View
      style={[
        st.particle,
        {
          width: size, height: size,
          top: particle.top, bottom: particle.bottom,
          left: particle.left, right: particle.right,
          opacity: op, transform: [{ translateY }, { rotate }],
          backgroundColor: shape === 'circle' ? color : 'transparent',
          borderRadius: shape === 'circle' ? size / 2 : 0,
        },
      ]}
    >
      {shape === 'plus' && <MaterialCommunityIcons name="plus" size={size} color={color} />}
      {shape === 'tri' && <MaterialCommunityIcons name="triangle-small-up" size={size + 3} color={color} />}
    </Animated.View>
  );
}

function HeroIcon({ success, theme }) {
  const scale = useRef(new Animated.Value(0)).current;
  const mark = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const particles = success ? SUCCESS_PARTICLES : FAIL_PARTICLES;

  useEffect(() => {
    const main = Animated.sequence([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 70, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(mark, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }),
        Animated.timing(ring, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]);

    main.start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();

    if (!success) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shake, { toValue: 1, duration: 70, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -1, duration: 70, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0, duration: 70, useNativeDriver: true }),
          Animated.delay(2400),
        ]),
      ).start();
    }
  }, [scale, mark, glow, ring, shake, success]);

  const markScale = mark.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.35] });
  const ringOp = ring.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.6, 0] });
  const shakeX = shake.interpolate({ inputRange: [-1, 0, 1], outputRange: [-4, 0, 4] });

  return (
    <View style={st.heroIconWrap}>
      {particles.map((p, i) => (
        <FloatingParticle key={`p-${i}`} particle={p} index={i} color={theme.particleColor} />
      ))}
      <Animated.View style={[st.heroRing, { borderColor: theme.ring, opacity: ringOp, transform: [{ scale: ringScale }] }]} />
      <Animated.View style={[st.heroGlow, { backgroundColor: theme.iconGlow, transform: [{ scale: glowScale }] }]} />
      <Animated.View style={[st.heroCircle, { backgroundColor: theme.icon, transform: [{ scale }, { translateX: shakeX }] }]}>
        <Animated.View style={{ transform: [{ scale: markScale }], opacity: mark }}>
          <MaterialCommunityIcons name={success ? 'check-bold' : 'close-thick'} size={40} color="#FFF" />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function DetailRow({ label, value, icon, accent, index }) {
  if (!value) return null;
  return (
    <Animatable.View
      animation="fadeInRight"
      delay={480 + index * 70}
      duration={360}
      useNativeDriver
      style={st.detailRow}
    >
      <View style={[st.detailIco, { backgroundColor: accent.soft }]}>
        <MaterialCommunityIcons name={icon} size={16} color={accent.main} />
      </View>
      <Text style={st.detailLbl}>{label}</Text>
      <Text style={st.detailVal} numberOfLines={2}>{value}</Text>
    </Animatable.View>
  );
}

function PaymentDetailsCard({ summary, orderId, accent }) {
  const amount = summary?.amount != null
    ? `₹${Number(summary.amount).toLocaleString('en-IN')}`
    : null;

  const rows = [
    { label: 'Farmer', value: summary?.farmer, icon: 'account-outline' },
    { label: 'Package', value: summary?.package, icon: 'leaf' },
    { label: 'Amount', value: amount, icon: 'currency-inr' },
    { label: 'Payment', value: summary?.payment, icon: 'credit-card-outline' },
    { label: 'Order ID', value: orderId ? `#${orderId}` : null, icon: 'identifier' },
    { label: 'Pickup', value: summary?.pickupDate, icon: 'calendar-clock' },
  ].filter((r) => r.value);

  return (
    <Animatable.View animation="zoomIn" delay={380} duration={480} useNativeDriver style={st.detailsCard}>
      <View style={st.detailsHdr}>
        <MaterialCommunityIcons name="clipboard-text-outline" size={18} color={accent.main} />
        <Text style={st.detailsTitle}>Order Details</Text>
      </View>
      {rows.map((row, i) => (
        <DetailRow key={row.label} {...row} accent={accent} index={i} />
      ))}
    </Animatable.View>
  );
}

export default function PaymentResultModal({
  visible,
  success,
  summary,
  orderId,
  message,
  cancelled,
  onDismiss,
  onRetry,
  onSuccessNavigate,
}) {
  const screenOp = useRef(new Animated.Value(0)).current;
  const screenScale = useRef(new Animated.Value(0.96)).current;
  const navigated = useRef(false);

  const rowCount = useMemo(() => {
    const amount = summary?.amount != null;
    let n = 0;
    if (summary?.farmer) n += 1;
    if (summary?.package) n += 1;
    if (amount) n += 1;
    if (summary?.payment) n += 1;
    if (orderId) n += 1;
    if (summary?.pickupDate) n += 1;
    return n;
  }, [summary, orderId]);

  const animEndMs = useMemo(() => calcAnimEndMs(rowCount), [rowCount]);

  const runExitAndNavigate = useCallback((goSuccess) => {
    if (navigated.current) return;
    navigated.current = true;
    Animated.parallel([
      Animated.timing(screenOp, { toValue: 0, duration: EXIT_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(screenScale, { toValue: 0.98, duration: EXIT_MS, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) return;
      if (goSuccess) onSuccessNavigate?.();
      else onDismiss?.();
    });
  }, [screenOp, screenScale, onSuccessNavigate, onDismiss]);

  useEffect(() => {
    if (!visible) {
      navigated.current = false;
      screenOp.setValue(0);
      screenScale.setValue(0.96);
      return;
    }
    Animated.parallel([
      Animated.timing(screenOp, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(screenScale, { toValue: 1, friction: 7, tension: 70, useNativeDriver: true }),
    ]).start();
  }, [visible, screenOp, screenScale]);

  useEffect(() => {
    if (!visible) return undefined;
    const t = setTimeout(() => runExitAndNavigate(success), animEndMs);
    return () => clearTimeout(t);
  }, [visible, success, animEndMs, runExitAndNavigate]);

  if (!visible) return null;

  const theme = success ? THEMES.success : THEMES.fail;
  const title = success
    ? 'Order confirm ho gaya!'
    : (cancelled ? 'Payment cancel!' : 'Payment failed!');
  const subtitle = success
    ? 'Aapka soil test order successfully place ho gaya.'
    : (cancelled
      ? 'Aapne payment cancel kar di. Koi charge nahi hua.'
      : 'Payment process nahi hui. Dubara try kar sakte hain.');
  const failReason = message || (cancelled ? 'Payment cancel ho gayi.' : 'Payment complete nahi hui.');

  return (
    <Modal visible animationType="none" presentationStyle="fullScreen" onRequestClose={() => runExitAndNavigate(false)}>
      <View style={[st.root, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
        <View style={[st.blobA, { backgroundColor: theme.blob1 }]} />
        <View style={[st.blobB, { backgroundColor: theme.blob2 }]} />

        <SafeAreaView style={st.safe} edges={['top', 'bottom']}>
          <Animated.View style={[st.screen, { opacity: screenOp, transform: [{ scale: screenScale }] }]}>
            <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false} bounces={false}>
              <View style={st.hero}>
                <HeroIcon success={success} theme={theme} />
                <Animatable.Text animation="fadeInUp" delay={200} duration={420} useNativeDriver style={[st.title, { color: theme.title }]}>
                  {title}
                </Animatable.Text>
                <Animatable.Text animation="fadeInUp" delay={290} duration={420} useNativeDriver style={[st.subtitle, { color: theme.subtitle }]}>
                  {subtitle}
                </Animatable.Text>
              </View>

              {!success && (
                <Animatable.View animation="bounceIn" delay={360} duration={480} useNativeDriver style={st.reasonBox}>
                  <View style={st.reasonIco}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color="#FFF" />
                  </View>
                  <Text style={st.reasonTxt}>
                    <Text style={st.reasonBold}>Reason: </Text>
                    {failReason}
                  </Text>
                </Animatable.View>
              )}

              <PaymentDetailsCard summary={summary} orderId={orderId} accent={theme.accent} />

              <Animatable.View animation="fadeIn" delay={animEndMs - 600} duration={350} useNativeDriver style={st.autoHintWrap}>
                <MaterialCommunityIcons name={success ? 'arrow-right-circle-outline' : 'arrow-left-circle-outline'} size={15} color={theme.subtitle} />
                <Text style={[st.autoHint, { color: theme.subtitle }]}>
                  {success ? 'Order detail khul rahi hai...' : 'Form par wapas ja rahe hain...'}
                </Text>
              </Animatable.View>
            </ScrollView>

            <Animatable.View animation="fadeInUp" delay={600} duration={420} useNativeDriver style={st.actions}>
              {success ? (
                <>
                  <TouchableOpacity
                    style={[st.primaryBtn, { backgroundColor: theme.btn, shadowColor: theme.btnShadow }]}
                    onPress={() => runExitAndNavigate(true)}
                    activeOpacity={0.88}
                  >
                    <Text style={st.primaryBtnTxt}>Order detail dekhein</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.secondaryBtn} onPress={() => runExitAndNavigate(false)} activeOpacity={0.7}>
                    <Text style={[st.secondaryBtnTxt, { color: theme.secondary }]}>Wapas jayein</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[st.primaryBtn, { backgroundColor: theme.btn, shadowColor: theme.btnShadow }]}
                    onPress={() => { navigated.current = true; onRetry?.(); }}
                    activeOpacity={0.88}
                  >
                    <MaterialCommunityIcons name="refresh" size={18} color="#FFF" style={st.btnIco} />
                    <Text style={st.primaryBtnTxt}>Dubara try karein</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.secondaryBtn} onPress={() => runExitAndNavigate(false)} activeOpacity={0.7}>
                    <Text style={[st.secondaryBtnTxt, { color: theme.secondary }]}>Wapas jayein</Text>
                  </TouchableOpacity>
                </>
              )}
            </Animatable.View>
          </Animated.View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const cardShadow = Platform.select({
  ios: { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 18 },
  android: { elevation: 5 },
});

const st = StyleSheet.create({
  root: { flex: 1 },
  blobA: { position: 'absolute', top: -60, right: -40, width: 200, height: 200, borderRadius: 100 },
  blobB: { position: 'absolute', top: 180, left: -70, width: 160, height: 160, borderRadius: 80 },
  safe: { flex: 1 },
  screen: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 12 },

  hero: { alignItems: 'center', marginBottom: 20 },
  heroIconWrap: { width: 110, height: 110, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroRing: {
    position: 'absolute', width: 92, height: 92, borderRadius: 46, borderWidth: 2.5,
  },
  heroGlow: { position: 'absolute', width: 96, height: 96, borderRadius: 48 },
  heroCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  particle: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },

  title: { fontSize: 21, fontWeight: '800', textAlign: 'center', marginTop: 10, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19, paddingHorizontal: 16, opacity: 0.85 },

  reasonBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 14, padding: 13, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(254,202,202,0.8)',
  },
  reasonIco: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
  },
  reasonTxt: { flex: 1, fontSize: 12.5, color: '#991B1B', lineHeight: 18, paddingTop: 4 },
  reasonBold: { fontWeight: '700' },

  detailsCard: {
    backgroundColor: '#FFF', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', marginBottom: 10,
    ...cardShadow,
  },
  detailsHdr: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  detailsTitle: { fontSize: 15, fontWeight: '800', color: S.TXT },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F1F5F9',
  },
  detailIco: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  detailLbl: { flex: 1, fontSize: 13, fontWeight: '500', color: S.SUB },
  detailVal: { fontSize: 13, fontWeight: '700', color: S.TXT, maxWidth: '48%', textAlign: 'right' },

  autoHintWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6, marginBottom: 4 },
  autoHint: { fontSize: 11.5, fontWeight: '600' },

  actions: { paddingHorizontal: 20, paddingBottom: 14, paddingTop: 6, gap: 8 },
  primaryBtn: {
    flexDirection: 'row', borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  btnIco: { marginRight: 6 },
  primaryBtnTxt: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  secondaryBtn: { paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnTxt: { fontSize: 14, fontWeight: '600' },
});
