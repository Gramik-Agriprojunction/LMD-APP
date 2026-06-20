import React, { useEffect } from 'react';
import { Modal, StyleSheet, Dimensions, StatusBar, TouchableOpacity, Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

const { height: SH } = Dimensions.get('window');

export default function ProofImageViewer({ visible, uri, onClose }) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTX = useSharedValue(0);
  const savedTY = useSharedValue(0);
  const dismissY = useSharedValue(0);
  const backdropOp = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      scale.value = 1;
      savedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      savedTX.value = 0;
      savedTY.value = 0;
      dismissY.value = 0;
      backdropOp.value = 1;
    }
  }, [visible, uri, scale, savedScale, translateX, translateY, savedTX, savedTY, dismissY, backdropOp]);

  const close = () => onClose?.();

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
        backdropOp.value = Math.max(0.25, 1 - Math.abs(e.translationY) / 320);
      } else {
        translateX.value = savedTX.value + e.translationX;
        translateY.value = savedTY.value + e.translationY;
      }
    })
    .onEnd((e) => {
      if (scale.value <= 1.05) {
        if (Math.abs(e.translationY) > 90 || Math.abs(e.velocityY) > 700) {
          const dir = e.translationY >= 0 ? 1 : -1;
          dismissY.value = withTiming(dir * SH * 0.35, { duration: 220 });
          backdropOp.value = withTiming(0, { duration: 220 }, (finished) => {
            if (finished) runOnJS(close)();
          });
        } else {
          dismissY.value = withSpring(0);
          backdropOp.value = withSpring(1);
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
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value + dismissY.value },
      { scale: scale.value },
    ],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOp.value,
  }));

  if (!visible || !uri) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent presentationStyle="overFullScreen" onRequestClose={close}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Animated.View style={[st.backdrop, backdropStyle]}>
        <GestureDetector gesture={composed}>
          <Animated.Image source={{ uri }} style={[st.image, imgStyle]} resizeMode="contain" />
        </GestureDetector>

        <View style={[st.closeWrap, { top: insets.top + 10 }]} pointerEvents="box-none">
          <TouchableOpacity activeOpacity={0.85} onPress={close} style={st.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Image source={require('../screens/assets/close.png')} style={st.closeIco} />
          </TouchableOpacity>
        </View>
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
  image: {
    width: '100%',
    height: '100%',
  },
  closeWrap: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIco: {
    width: 14,
    height: 14,
    resizeMode: 'contain',
    tintColor: '#FFF',
  },
});
