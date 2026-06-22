import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

const CHECK = 76;
const CONTAINER = 220;

function useRipple() {
  return {
    scale: useRef(new Animated.Value(0.85)).current,
    opacity: useRef(new Animated.Value(0)).current,
  };
}

export default function VerifySuccessCheck({
  visible,
  title,
  subtitle,
  circleBg = '#FFF',
  tickColor = '#16A34A',
  ringColor = '#FFF',
}) {
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const ring1 = useRipple();
  const ring2 = useRipple();
  const ring3 = useRipple();

  useEffect(() => {
    if (!visible) return;

    checkScale.setValue(0);
    checkOpacity.setValue(0);
    textOpacity.setValue(0);
    [ring1, ring2, ring3].forEach((r) => {
      r.scale.setValue(0.85);
      r.opacity.setValue(0);
    });

    const pulse = (ring, delay, peakScale) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(ring.scale, {
            toValue: peakScale,
            duration: 900,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(ring.opacity, { toValue: 0.5, duration: 80, useNativeDriver: true }),
            Animated.timing(ring.opacity, { toValue: 0, duration: 820, useNativeDriver: true }),
          ]),
        ]),
      ]);

    Animated.sequence([
      Animated.parallel([
        Animated.spring(checkScale, { toValue: 1.12, friction: 4, tension: 140, useNativeDriver: true }),
        Animated.timing(checkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.spring(checkScale, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }),
    ]).start();

    pulse(ring1, 120, 1.55).start();
    pulse(ring2, 280, 1.75).start();
    pulse(ring3, 440, 1.95).start();

    Animated.timing(textOpacity, { toValue: 1, duration: 400, delay: 180, useNativeDriver: true }).start();
  }, [visible, checkScale, checkOpacity, textOpacity, ring1, ring2, ring3]);

  if (!visible) return null;

  const ringStyle = (ring) => ({
    opacity: ring.opacity,
    transform: [{ scale: ring.scale }],
  });

  return (
    <View style={st.wrap}>
      <View style={st.checkArea}>
        <Animated.View style={[st.ring, { borderColor: ringColor }, ringStyle(ring3)]} />
        <Animated.View style={[st.ring, { borderColor: ringColor }, ringStyle(ring2)]} />
        <Animated.View style={[st.ring, { borderColor: ringColor }, ringStyle(ring1)]} />
        <Animated.View
          style={[
            st.checkCircle,
            { backgroundColor: circleBg, opacity: checkOpacity, transform: [{ scale: checkScale }] },
          ]}
        >
          <Text style={[st.checkMark, { color: tickColor }]}>✓</Text>
        </Animated.View>
      </View>
      <Animated.View style={[st.textWrap, { opacity: textOpacity }]}>
        {title ? <Text style={st.title}>{title}</Text> : null}
        {subtitle ? <Text style={st.sub}>{subtitle}</Text> : null}
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 8,
    overflow: 'visible',
  },
  checkArea: {
    width: CONTAINER,
    height: CONTAINER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'visible',
  },
  ring: {
    position: 'absolute',
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK / 2,
    borderWidth: 2.5,
  },
  checkCircle: {
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  checkMark: {
    fontSize: 36,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 40,
  },
  textWrap: { alignItems: 'center', paddingHorizontal: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 6, textAlign: 'center' },
  sub: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
});
