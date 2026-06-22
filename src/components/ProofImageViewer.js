import React, { useEffect, useCallback } from 'react';
import { Modal, StyleSheet, Dimensions, StatusBar, Pressable, Image, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

const { height: SH, width: SW } = Dimensions.get('window');
const DISMISS_THRESHOLD = 90;
const DISMISS_VELOCITY = 650;

export default function ProofImageViewer({ visible, uri, onClose, title = 'Receipt' }) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTX = useSharedValue(0);
  const savedTY = useSharedValue(0);
  const dismissY = useSharedValue(0);
  const backdropOp = useSharedValue(0);
  const presentScale = useSharedValue(0.92);
  const hintOp = useSharedValue(0);

  const close = useCallback(() => onClose?.(), [onClose]);

  useEffect(() => {
    if (visible) {
      scale.value = 1;
      savedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedTX.value = 0;
      savedTY.value = 0;
      dismissY.value = 0;
      backdropOp.value = 0;
      presentScale.value = 0.92;
      hintOp.value = 0;

      backdropOp.value = withTiming(1, { duration: 280 });
      presentScale.value = withSpring(1, { damping: 20, stiffness: 260 });
      hintOp.value = withDelay(350, withTiming(1, { duration: 400 }));
    }
  }, [visible, uri, scale, savedScale, translateX, translateY, savedTX, savedTY, dismissY, backdropOp, presentScale, hintOp]);

  const handleClosePress = () => {
    backdropOp.value = withTiming(0, { duration: 220 });
    presentScale.value = withTiming(0.9, { duration: 220 });
    dismissY.value = withTiming(SH * 0.08, { duration: 220 }, (finished) => {
      if (finished) runOnJS(close)();
    });
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), 4);
    })
    .onEnd(() => {
      if (scale.value < 1.05) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTX.value = 0;
        savedTY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value <= 1.05) {
        dismissY.value = e.translationY;
        const progress = Math.min(Math.abs(e.translationY) / 280, 1);
        backdropOp.value = 1 - progress * 0.72;
        presentScale.value = 1 - progress * 0.12;
        hintOp.value = 1 - progress;
      } else {
        translateX.value = savedTX.value + e.translationX;
        translateY.value = savedTY.value + e.translationY;
      }
    })
    .onEnd((e) => {
      if (scale.value <= 1.05) {
        if (Math.abs(e.translationY) > DISMISS_THRESHOLD || Math.abs(e.velocityY) > DISMISS_VELOCITY) {
          const dir = e.translationY >= 0 ? 1 : -1;
          dismissY.value = withTiming(dir * SH * 0.42, { duration: 240 });
          backdropOp.value = withTiming(0, { duration: 240 });
          presentScale.value = withTiming(0.82, { duration: 240 }, (finished) => {
            if (finished) runOnJS(close)();
          });
        } else {
          dismissY.value = withSpring(0, { damping: 22, stiffness: 280 });
          backdropOp.value = withSpring(1);
          presentScale.value = withSpring(1);
          hintOp.value = withSpring(1);
        }
      } else {
        savedTX.value = translateX.value;
        savedTY.value = translateY.value;
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd(() => {
      if (scale.value > 1.05) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTX.value = 0;
        savedTY.value = 0;
      } else {
        scale.value = withSpring(2.2);
        savedScale.value = 2.2;
      }
    });

  const composed = Gesture.Simultaneous(pinch, Gesture.Race(doubleTap, pan));

  const imgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.abs(dismissY.value),
      [0, 220],
      [1, 0.45],
      Extrapolation.CLAMP,
    ),
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value + dismissY.value },
      { scale: scale.value * presentScale.value },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOp.value,
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOp.value,
    transform: [{ translateY: interpolate(hintOp.value, [0, 1], [8, 0], Extrapolation.CLAMP) }],
  }));

  if (!visible || !uri) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={handleClosePress}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Animated.View style={[st.backdrop, backdropStyle]}>
        <GestureDetector gesture={composed}>
          <Animated.View style={[st.imageWrap, imgStyle]}>
            <Image source={{ uri }} style={st.image} resizeMode="contain" />
          </Animated.View>
        </GestureDetector>

        <View style={[st.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <View style={st.topBarInner}>
            <Text style={st.title} numberOfLines={1}>{title}</Text>
            <Pressable
              onPress={handleClosePress}
              style={({ pressed }) => [st.closeBtn, pressed && st.closeBtnPressed]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Image source={require('../screens/assets/cross.png')} style={st.closeIco} />
            </Pressable>
          </View>
        </View>

        <Animated.View style={[st.hintWrap, { bottom: insets.bottom + 24 }, hintStyle]} pointerEvents="none">
          <View style={st.hintPill}>
            <Image source={require('../screens/assets/down.png')} style={st.hintIco} />
            <Text style={st.hintTxt}>Swipe down to close</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrap: {
    width: SW,
    height: SH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
  },
  topBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    marginRight: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.24)',
    transform: [{ scale: 0.94 }],
  },
  closeIco: {
    width: 11,
    height: 11,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
  },
  hintWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 8,
  },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  hintIco: {
    width: 12,
    height: 12,
    resizeMode: 'contain',
    tintColor: 'rgba(255,255,255,0.85)',
  },
  hintTxt: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },
});
