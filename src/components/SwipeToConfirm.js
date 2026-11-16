import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Easing,
  Platform,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const THUMB = 50;
const TRACK_H = 58;
const PAD = 4;
const COMPLETE_AT = 0.78;

/**
 * Zomato / Swiggy style left → right swipe confirm.
 */
export default function SwipeToConfirm({
  label = 'Swipe to confirm',
  color = '#0891B2',
  disabled = false,
  disabledHint,
  resetKey,
  onConfirm,
}) {
  const [trackW, setTrackW] = useState(0);
  const maxX = Math.max(0, trackW - THUMB - PAD * 2);
  const x = useRef(new Animated.Value(0)).current;
  const thumbPad = useRef(new Animated.Value(THUMB + PAD)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const done = useRef(false);
  const maxXRef = useRef(0);
  const dragStart = useRef(0);
  maxXRef.current = maxX;

  const resetThumb = () => {
    done.current = false;
    x.stopAnimation();
    x.setValue(0);
  };

  useEffect(() => {
    resetThumb();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, disabled]);

  useEffect(() => {
    if (disabled) {
      shimmer.stopAnimation();
      shimmer.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [disabled, shimmer]);

  const snapBack = () => {
    Animated.spring(x, {
      toValue: 0,
      friction: 6,
      tension: 70,
      useNativeDriver: false,
    }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !done.current,
      onMoveShouldSetPanResponder: (_, g) =>
        !disabled && !done.current && Math.abs(g.dx) > 3,
      onPanResponderGrant: () => {
        x.stopAnimation((value) => {
          dragStart.current = typeof value === 'number' ? value : 0;
        });
      },
      onPanResponderMove: (_, g) => {
        if (done.current || disabled) return;
        const next = Math.max(0, Math.min(maxXRef.current, dragStart.current + g.dx));
        x.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        if (done.current || disabled) return;
        const cur = Math.max(0, Math.min(maxXRef.current, dragStart.current + g.dx));
        if (maxXRef.current > 0 && cur >= maxXRef.current * COMPLETE_AT) {
          done.current = true;
          Animated.timing(x, {
            toValue: maxXRef.current,
            duration: 120,
            useNativeDriver: false,
          }).start(({ finished }) => {
            if (finished) onConfirm?.();
          });
        } else {
          snapBack();
        }
      },
      onPanResponderTerminate: () => {
        if (!done.current) snapBack();
      },
    }),
  ).current;

  const fillW = Animated.add(x, thumbPad);
  const labelOpacity = x.interpolate({
    inputRange: [0, Math.max(48, maxX * 0.5)],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const chevronShift = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 8],
  });
  const chevronOpacity = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.35, 1, 0.35],
  });

  const showLabel = disabled && disabledHint ? disabledHint : label;

  return (
    <View
      style={[
        styles.track,
        { backgroundColor: disabled ? '#94A3B8' : color },
      ]}
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
    >
      {!disabled && (
        <Animated.View
          pointerEvents="none"
          style={[styles.fill, { backgroundColor: 'rgba(255,255,255,0.18)', width: fillW }]}
        />
      )}

      <Animated.View
        pointerEvents="none"
        style={[styles.labelWrap, { opacity: disabled ? 1 : labelOpacity }]}
      >
        <Text style={styles.label} numberOfLines={1}>
          {showLabel}
        </Text>
        {!disabled && (
          <Animated.Text
            style={[
              styles.chevrons,
              { opacity: chevronOpacity, transform: [{ translateX: chevronShift }] },
            ]}
          >
            {' ›››'}
          </Animated.Text>
        )}
      </Animated.View>

      <Animated.View
        style={[
          styles.thumb,
          {
            transform: [{ translateX: x }],
            opacity: disabled ? 0.7 : 1,
          },
        ]}
        {...(disabled ? {} : pan.panHandlers)}
      >
        <Text style={[styles.thumbArrow, { color: disabled ? '#64748B' : color }]}>
          ››
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    marginTop: 6,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderTopLeftRadius: TRACK_H / 2,
    borderBottomLeftRadius: TRACK_H / 2,
  },
  labelWrap: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: THUMB + 10,
    paddingRight: 18,
  },
  label: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  chevrons: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  thumb: {
    position: 'absolute',
    left: PAD,
    top: PAD,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#0F172A',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  thumbArrow: {
    fontSize: 20,
    fontWeight: '800',
    marginLeft: 2,
    letterSpacing: -2,
  },
});
