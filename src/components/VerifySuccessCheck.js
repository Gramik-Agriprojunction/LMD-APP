import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image } from 'react-native';

const CHECK = 76;
const CONTAINER = 220;
const CHECK_COMPACT = 62;
const CONTAINER_COMPACT = 88;

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
  compact = false,
  showLabels = true,
  tickImage = null,
}) {
  const check = compact ? CHECK_COMPACT : CHECK;
  const container = compact ? CONTAINER_COMPACT : CONTAINER;

  const circleScale = useRef(new Animated.Value(0)).current;
  const circleOpacity = useRef(new Animated.Value(0)).current;
  const tickScale = useRef(new Animated.Value(0)).current;
  const tickOpacity = useRef(new Animated.Value(0)).current;
  const tickRotate = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const ring1 = useRipple();

  useEffect(() => {
    if (!visible) return;

    circleScale.setValue(0);
    circleOpacity.setValue(0);
    tickScale.setValue(0);
    tickOpacity.setValue(0);
    tickRotate.setValue(0);
    textOpacity.setValue(0);
    ring1.scale.setValue(0.92);
    ring1.opacity.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.spring(circleScale, { toValue: 1, friction: 5, tension: 110, useNativeDriver: true }),
        Animated.timing(circleOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(tickScale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
        Animated.timing(tickOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(tickRotate, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(compact ? 280 : 320),
      Animated.parallel([
        Animated.timing(ring1.scale, {
          toValue: compact ? 1.65 : 1.85,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(ring1.opacity, { toValue: 0.42, duration: 60, useNativeDriver: true }),
          Animated.timing(ring1.opacity, { toValue: 0, duration: 640, useNativeDriver: true }),
        ]),
      ]),
    ]).start();

    if (showLabels) {
      Animated.timing(textOpacity, { toValue: 1, duration: 350, delay: compact ? 240 : 280, useNativeDriver: true }).start();
    }
  }, [visible, compact, showLabels, circleScale, circleOpacity, tickScale, tickOpacity, tickRotate, textOpacity, ring1]);

  if (!visible) return null;

  const tickSpin = tickRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-28deg', '0deg'],
  });

  const tickNode = tickImage ? (
    <Animated.Image
      source={tickImage}
      style={[
        compact ? st.checkImgCompact : st.checkImg,
        {
          tintColor: tickColor,
          opacity: tickOpacity,
          transform: [{ scale: tickScale }, { rotate: tickSpin }],
        },
      ]}
    />
  ) : (
    <Animated.Text
      style={[
        compact ? st.checkMarkCompact : st.checkMark,
        {
          color: tickColor,
          opacity: tickOpacity,
          transform: [{ scale: tickScale }, { rotate: tickSpin }],
        },
      ]}
    >
      ✓
    </Animated.Text>
  );

  return (
    <View style={[st.wrap, compact && st.wrapCompact]}>
      <View style={[st.checkArea, { width: container, height: container }, compact && st.checkAreaCompact]}>
        <Animated.View
          style={[
            st.ring,
            { width: check, height: check, borderRadius: check / 2, borderColor: ringColor },
            { opacity: ring1.opacity, transform: [{ scale: ring1.scale }] },
          ]}
        />
        <Animated.View
          style={[
            st.checkCircle,
            {
              width: check,
              height: check,
              borderRadius: check / 2,
              backgroundColor: circleBg,
              opacity: circleOpacity,
              transform: [{ scale: circleScale }],
            },
          ]}
        >
          {tickNode}
        </Animated.View>
      </View>
      {showLabels ? (
        <Animated.View style={[st.textWrap, { opacity: textOpacity }]}>
          {title ? <Text style={st.title}>{title}</Text> : null}
          {subtitle ? <Text style={st.sub}>{subtitle}</Text> : null}
        </Animated.View>
      ) : null}
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
  wrapCompact: {
    paddingTop: 0,
    paddingBottom: 0,
  },
  checkArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'visible',
  },
  checkAreaCompact: {
    marginBottom: 6,
  },
  ring: {
    position: 'absolute',
    borderWidth: 2.5,
  },
  checkCircle: {
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
  checkMarkCompact: {
    fontSize: 30,
    fontWeight: '900',
    includeFontPadding: false,
    lineHeight: 34,
  },
  checkImg: { width: 30, height: 30, resizeMode: 'contain' },
  checkImgCompact: { width: 26, height: 26, resizeMode: 'contain' },
  textWrap: { alignItems: 'center', paddingHorizontal: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 6, textAlign: 'center' },
  sub: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
});
