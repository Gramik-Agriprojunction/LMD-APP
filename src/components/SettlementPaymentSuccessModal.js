import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  Pressable,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SW, height: SH } = Dimensions.get('window');
const GREEN = '#16A34A';
const GREEN_DARK = '#15803D';

function orderLine(o) {
  const code = o?.order_code
    ? String(o.order_code).split(/\s+/)[0]
    : o?.order_id != null
      ? String(o.order_id)
      : '-';
  const farmer = String(o?.farmer_name || o?.farmer?.name || '').trim() || 'Order';
  const amount = o?.amount ?? o?.order_amount;
  const amtStr =
    amount === undefined || amount === null || amount === ''
      ? '0'
      : String(amount).endsWith('.00')
        ? String(amount).replace('.00', '')
        : String(amount);
  return { code, farmer, amtStr };
}

function SuccessCheck({ circleScale, tickScale, tickOpacity, ringScale, ringOpacity }) {
  return (
    <View style={st.iconStage}>
      <Animated.View
        style={[
          st.glowRing,
          {
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />
      <Animated.View style={[st.iconCircle, { transform: [{ scale: circleScale }] }]}>
        <View style={st.iconCircleInner}>
          <Animated.Text
            style={[
              st.tickGlyph,
              {
                opacity: tickOpacity,
                transform: [{ scale: tickScale }],
              },
            ]}
          >
            ✓
          </Animated.Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default function SettlementPaymentSuccessModal({
  visible,
  amount,
  orders,
  title,
  onDone,
}) {
  const insets = useSafeAreaInsets();
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const blobY = useRef(new Animated.Value(0)).current;
  const circleScale = useRef(new Animated.Value(0)).current;
  const tickScale = useRef(new Animated.Value(0.3)).current;
  const tickOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.7)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(12)).current;
  const amtOpacity = useRef(new Animated.Value(0)).current;
  const amtY = useRef(new Animated.Value(10)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(40)).current;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!visible) {
      bgOpacity.setValue(0);
      blobY.setValue(0);
      circleScale.setValue(0);
      tickScale.setValue(0.3);
      tickOpacity.setValue(0);
      ringScale.setValue(0.7);
      ringOpacity.setValue(0);
      titleOpacity.setValue(0);
      titleY.setValue(12);
      amtOpacity.setValue(0);
      amtY.setValue(10);
      cardOpacity.setValue(0);
      cardY.setValue(40);
      return undefined;
    }

    const anim = Animated.sequence([
      Animated.timing(bgOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(circleScale, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 0.55, duration: 400, useNativeDriver: true }),
        Animated.spring(ringScale, { toValue: 1.35, friction: 7, tension: 40, useNativeDriver: true }),
        Animated.timing(blobY, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(tickScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(tickOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]),
      Animated.stagger(80, [
        Animated.parallel([
          Animated.timing(titleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.spring(titleY, { toValue: 0, friction: 9, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(amtOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.spring(amtY, { toValue: 0, friction: 9, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(cardOpacity, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.spring(cardY, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
        ]),
      ]),
    ]);

    anim.start();

    const t = setTimeout(() => {
      doneRef.current?.();
    }, 5000);

    return () => clearTimeout(t);
  }, [
    visible,
    bgOpacity,
    blobY,
    circleScale,
    tickScale,
    tickOpacity,
    ringScale,
    ringOpacity,
    titleOpacity,
    titleY,
    amtOpacity,
    amtY,
    cardOpacity,
    cardY,
  ]);

  const heading = title || 'Payment Received';
  const blobTranslate = blobY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -18],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => onDone?.()}
    >
      <StatusBar barStyle="light-content" backgroundColor={GREEN_DARK} />
      <Animated.View style={[st.root, { opacity: bgOpacity }]}>
        <Animated.View style={[st.blob, st.blobA, { transform: [{ translateY: blobTranslate }] }]} />
        <Animated.View style={[st.blob, st.blobB, { transform: [{ translateY: blobTranslate }] }]} />

        <Pressable style={st.pressFill} onPress={() => onDone?.()}>
          <View style={[st.inner, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
            <SuccessCheck
              circleScale={circleScale}
              tickScale={tickScale}
              tickOpacity={tickOpacity}
              ringScale={ringScale}
              ringOpacity={ringOpacity}
            />

            <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleY }], alignItems: 'center' }}>
              <Text style={st.title}>{heading}</Text>
            </Animated.View>

            <Animated.View style={{ opacity: amtOpacity, transform: [{ translateY: amtY }], alignItems: 'center' }}>
              <Text style={st.amt}>₹ {amount || '0'}</Text>
              <Text style={st.amtSub}>Successfully credited</Text>
            </Animated.View>

            <Animated.View
              style={[
                st.card,
                { opacity: cardOpacity, transform: [{ translateY: cardY }] },
              ]}
            >
              <Text style={st.cardHead}>
                {(Array.isArray(orders) ? orders.length : 0) || 0} order(s) settled
              </Text>

              {Array.isArray(orders) && orders.length ? (
                <ScrollView showsVerticalScrollIndicator={false} style={st.listScroll}>
                  {orders.slice(0, 8).map((o, idx) => {
                    const { code, farmer, amtStr } = orderLine(o);
                    return (
                      <View key={`${code}-${idx}`} style={[st.row, idx > 0 ? st.rowBorder : null]}>
                        <View style={st.rowLeft}>
                          <Text style={st.rowFarmer} numberOfLines={1}>{farmer}</Text>
                          <Text style={st.rowCode} numberOfLines={1}>#{code}</Text>
                        </View>
                        <Text style={st.rowAmt}>₹{amtStr}</Text>
                      </View>
                    );
                  })}
                  {orders.length > 8 ? (
                    <Text style={st.moreT}>+{orders.length - 8} more</Text>
                  ) : null}
                </ScrollView>
              ) : (
                <Text style={st.emptyList}>Settlement complete</Text>
              )}

              <Pressable style={({ pressed }) => [st.doneBtn, pressed && st.doneBtnPressed]} onPress={() => onDone?.()}>
                <Text style={st.doneBtnT}>Back to settlements</Text>
              </Pressable>
            </Animated.View>
          </View>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GREEN_DARK,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.12,
  },
  blobA: {
    width: SW * 0.9,
    height: SW * 0.9,
    backgroundColor: GREEN,
    top: -SW * 0.35,
    right: -SW * 0.25,
  },
  blobB: {
    width: SW * 0.7,
    height: SW * 0.7,
    backgroundColor: '#FFFFFF',
    bottom: SH * 0.08,
    left: -SW * 0.3,
  },
  pressFill: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  iconStage: {
    width: 132,
    height: 132,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  glowRing: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  iconCircleInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  tickGlyph: {
    fontSize: 46,
    lineHeight: 50,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    includeFontPadding: false,
  },
  title: {
    color: '#F0FDF4',
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  amt: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    textAlign: 'center',
  },
  amtSub: {
    marginTop: 4,
    color: 'rgba(240,253,244,0.72)',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  card: {
    width: '100%',
    maxWidth: SW - 48,
    alignSelf: 'center',
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  cardHead: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 10,
  },
  listScroll: { maxHeight: 188 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  rowLeft: { flex: 1, marginRight: 10 },
  rowFarmer: { color: '#0F172A', fontSize: 14, fontWeight: '600' },
  rowCode: { color: '#94A3B8', fontSize: 12, marginTop: 2, fontWeight: '500' },
  rowAmt: { color: GREEN, fontSize: 14, fontWeight: '600' },
  moreT: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    paddingVertical: 8,
  },
  emptyList: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
    paddingVertical: 12,
  },
  doneBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 12,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnPressed: { opacity: 0.88 },
  doneBtnT: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
