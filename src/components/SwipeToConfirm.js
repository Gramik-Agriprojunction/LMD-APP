import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const THUMB = 50;
const TRACK_H = 58;
const PAD = 4;
const COMPLETE_AT = 0.78;

/**
 * Zomato / Swiggy style left → right swipe confirm (RNGH — no scroll steal mid-drag).
 */
export default function SwipeToConfirm({
  label = 'Swipe to confirm',
  color = '#0891B2',
  disabled = false,
  disabledHint,
  resetKey,
  onConfirm,
  onDragActiveChange,
}) {
  const [trackW, setTrackW] = useState(0);
  const maxX = Math.max(0, trackW - THUMB - PAD * 2);

  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const maxXSv = useSharedValue(0);
  const done = useSharedValue(false);
  const shimmer = useSharedValue(0);

  const setDragging = useCallback(
    (active) => {
      onDragActiveChange?.(active);
    },
    [onDragActiveChange],
  );

  const fireConfirm = useCallback(() => {
    onConfirm?.();
  }, [onConfirm]);

  useEffect(() => {
    maxXSv.value = maxX;
  }, [maxX, maxXSv]);

  useEffect(() => {
    done.value = false;
    translateX.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, disabled]);

  useEffect(() => {
    if (disabled) {
      shimmer.value = 0;
      return undefined;
    }
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100 }),
        withTiming(0, { duration: 1100 }),
      ),
      -1,
      false,
    );
    return undefined;
  }, [disabled, shimmer]);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-6, 6])
    .failOffsetY([-14, 14])
    .shouldCancelWhenOutside(false)
    .onBegin(() => {
      if (done.value) return;
      startX.value = translateX.value;
      runOnJS(setDragging)(true);
    })
    .onUpdate((e) => {
      if (done.value || disabled) return;
      const cap = maxXSv.value;
      const next = Math.max(0, Math.min(cap, startX.value + e.translationX));
      translateX.value = next;
    })
    .onFinalize(() => {
      runOnJS(setDragging)(false);
    })
    .onEnd(() => {
      if (done.value || disabled) return;
      const cur = translateX.value;
      const cap = maxXSv.value;
      if (cap > 0 && cur >= cap * COMPLETE_AT) {
        done.value = true;
        translateX.value = withTiming(cap, { duration: 120 }, (finished) => {
          if (finished) runOnJS(fireConfirm)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 16, stiffness: 180 });
      }
    });

  const fillStyle = useAnimatedStyle(() => ({
    width: translateX.value + THUMB + PAD,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: disabled ? 0.7 : 1,
  }));

  const labelStyle = useAnimatedStyle(() => {
    const cap = Math.max(maxXSv.value, 48);
    return {
      opacity: disabled
        ? 1
        : interpolate(translateX.value, [0, cap * 0.5], [1, 0], 'clamp'),
    };
  });

  const chevronStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.35, 1, 0.35]),
    transform: [{ translateX: interpolate(shimmer.value, [0, 1], [0, 8]) }],
  }));

  const showLabel = disabled && disabledHint ? disabledHint : label;

  const track = (
    <Animated.View
      style={[
        styles.track,
        { backgroundColor: disabled ? '#94A3B8' : color },
      ]}
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
    >
      {!disabled && (
        <Animated.View
          pointerEvents="none"
          style={[styles.fill, { backgroundColor: 'rgba(255,255,255,0.18)' }, fillStyle]}
        />
      )}

      <Animated.View pointerEvents="none" style={[styles.labelWrap, labelStyle]}>
        <Text style={styles.label} numberOfLines={1}>
          {showLabel}
        </Text>
        {!disabled && (
          <Animated.Text style={[styles.chevrons, chevronStyle]}>
            {' ›››'}
          </Animated.Text>
        )}
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.thumb, thumbStyle]}>
        <Text style={[styles.thumbArrow, { color: disabled ? '#64748B' : color }]}>
          ››
        </Text>
      </Animated.View>
    </Animated.View>
  );

  if (disabled) return track;

  return <GestureDetector gesture={pan}>{track}</GestureDetector>;
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