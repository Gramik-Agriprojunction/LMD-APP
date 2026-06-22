import React, { useEffect, useCallback } from 'react';
import {
  Modal, Text, ActivityIndicator, TouchableOpacity, Dimensions,
  StatusBar, StyleSheet, View,
} from 'react-native';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SH, width: SW } = Dimensions.get('window');

export default function QrPayModal({ visible, qr, loading, failed, total, onClose, onRetry }) {
  const insets = useSafeAreaInsets();
  const sheetY = useSharedValue(SH);
  const dragY = useSharedValue(0);
  const backdropOp = useSharedValue(0);

  const close = useCallback(() => onClose?.(), [onClose]);

  const animateClose = useCallback(() => {
    dragY.value = withTiming(SH, { duration: 280 });
    backdropOp.value = withTiming(0, { duration: 260 }, (finished) => {
      if (finished) runOnJS(close)();
    });
  }, [close, dragY, backdropOp]);

  useEffect(() => {
    if (!visible) return;
    dragY.value = 0;
    sheetY.value = SH;
    backdropOp.value = 0;
    sheetY.value = withSpring(0, { damping: 22, stiffness: 220 });
    backdropOp.value = withTiming(1, { duration: 260 });
  }, [visible, dragY, sheetY, backdropOp]);

  const pan = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetX([-24, 24])
    .onUpdate((e) => {
      if (e.translationY > 0) {
        dragY.value = e.translationY;
        backdropOp.value = Math.max(0.2, 1 - e.translationY / 360);
      }
    })
    .onEnd((e) => {
      if (e.translationY > 90 || e.velocityY > 650) {
        dragY.value = withTiming(SH, { duration: 280 });
        backdropOp.value = withTiming(0, { duration: 260 }, (finished) => {
          if (finished) runOnJS(close)();
        });
      } else {
        dragY.value = withSpring(0, { damping: 18, stiffness: 220 });
        backdropOp.value = withSpring(1);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value + dragY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOp.value,
  }));

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={animateClose}
    >
      <GestureHandlerRootView style={s.ghRoot}>
        <StatusBar barStyle="light-content" backgroundColor="#000" translucent />
        <Animated.View style={[s.root, backdropStyle]}>
          <GestureDetector gesture={pan}>
            <Animated.View style={[s.sheet, sheetStyle]}>
              <View style={[s.qrArea, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 72 }]}>
                {qr ? (
                  <Animated.Image source={{ uri: qr }} style={s.qrImg} resizeMode="contain" />
                ) : (
                  <View style={s.placeholder}>
                    {loading ? (
                      <ActivityIndicator size="large" color="#FFF" />
                    ) : (
                      <>
                        <Text style={s.errT}>
                          {failed ? 'QR generate nahi ho paya. Dubara try karein.' : 'QR not available'}
                        </Text>
                        {failed && onRetry ? (
                          <TouchableOpacity onPress={onRetry} activeOpacity={0.85} style={s.retryBtn}>
                            <Text style={s.retryT}>Retry</Text>
                          </TouchableOpacity>
                        ) : null}
                      </>
                    )}
                  </View>
                )}
              </View>

              {total != null ? (
                <View style={[s.footer, { paddingBottom: insets.bottom + 14 }]}>
                  <Text style={s.amt}>₹ {total}</Text>
                </View>
              ) : null}

              <Text style={[s.hint, { bottom: insets.bottom + 4 }]}>Neeche kheench kar band karein</Text>
            </Animated.View>
          </GestureDetector>

          <View style={[s.closeWrap, { top: insets.top + 8 }]} pointerEvents="box-none">
            <TouchableOpacity onPress={animateClose} activeOpacity={0.75} style={s.closeBtn}>
              <Text style={s.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const s = StyleSheet.create({
  ghRoot: { flex: 1 },
  root: { flex: 1, backgroundColor: '#000' },
  sheet: { flex: 1, backgroundColor: '#000' },
  closeWrap: { position: 'absolute', left: 16, zIndex: 20 },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: { color: '#FFF', fontSize: 18, fontWeight: '600', lineHeight: 20 },
  qrArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  qrImg: { width: SW, height: SH * 0.72 },
  placeholder: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  errT: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  retryT: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  footer: { alignItems: 'center', paddingTop: 4 },
  amt: { color: '#FCD34D', fontSize: 26, fontWeight: '800', letterSpacing: 0.3 },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.28)',
    fontSize: 11,
    fontWeight: '500',
  },
});
