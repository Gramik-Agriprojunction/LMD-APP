import React, { useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  Dimensions,
  StatusBar,
  Pressable,
  Image,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import Toast from 'react-native-simple-toast';

const { height: SH, width: SW } = Dimensions.get('window');

let BlobUtil = null;
try {
  BlobUtil = require('react-native-blob-util').default || require('react-native-blob-util');
} catch (e) {
  BlobUtil = null;
}

let RNShare = null;
try {
  RNShare = require('react-native-share').default || require('react-native-share');
} catch (e) {
  RNShare = null;
}

function isLocalUri(uri) {
  if (!uri) return false;
  return uri.startsWith('file://') || (uri.startsWith('/') && !/^https?:\/\//i.test(uri));
}

async function resolveSharePath(uri) {
  if (!uri) return null;
  if (isLocalUri(uri)) {
    return uri.startsWith('file://') ? uri.replace(/^file:\/\//, '') : uri;
  }
  if (!BlobUtil) return null;
  const ext = /\.jpe?g/i.test(uri) ? 'jpg' : 'png';
  const path = `${BlobUtil.fs.dirs.CacheDir}/settlement-qr-share-${Date.now()}.${ext}`;
  const res = await BlobUtil.config({ fileCache: true, path }).fetch('GET', uri);
  return res.path();
}

export default function SettlementQrModal({
  visible,
  uri,
  loading,
  failed,
  total,
  receiveLoading,
  onClose,
  onRetry,
  onReceivePayment,
}) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTX = useSharedValue(0);
  const savedTY = useSharedValue(0);
  const imageOp = useSharedValue(0);
  const openedAtRef = useRef(0);
  const closingRef = useRef(false);

  const close = useCallback(() => onClose?.(), [onClose]);

  useEffect(() => {
    if (!visible) {
      imageOp.value = 0;
      closingRef.current = false;
      return;
    }

    openedAtRef.current = Date.now();
    closingRef.current = false;

    cancelAnimation(scale);
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    cancelAnimation(imageOp);

    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTX.value = 0;
    savedTY.value = 0;
    imageOp.value = uri && !loading ? 1 : 0;
  }, [visible, uri, loading, scale, savedScale, translateX, translateY, savedTX, savedTY, imageOp]);

  useEffect(() => {
    if (!visible || !uri || loading) {
      imageOp.value = 0;
      return;
    }
    imageOp.value = withTiming(1, { duration: 180 });
  }, [visible, uri, loading, imageOp]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    close();
    closingRef.current = false;
  }, [close]);

  const handleClosePress = requestClose;

  const handleRequestClose = useCallback(() => {
    if (Date.now() - openedAtRef.current < 450) return;
    requestClose();
  }, [requestClose]);

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
    .minPointers(1)
    .maxPointers(1)
    .activeOffsetX([-12, 12])
    .activeOffsetY([-12, 12])
    .onUpdate((e) => {
      // Pan only when zoomed — no swipe-to-dismiss (avoids accidental close when QR appears).
      if (scale.value <= 1.05) return;
      translateX.value = savedTX.value + e.translationX;
      translateY.value = savedTY.value + e.translationY;
    })
    .onEnd(() => {
      if (scale.value <= 1.05) return;
      savedTX.value = translateX.value;
      savedTY.value = translateY.value;
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
    opacity: imageOp.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const topPad = insets.top + 48;
  const bottomPad = insets.bottom + 76;
  const amountBand = total != null && total !== '' ? 32 : 0;
  const qrHeight = Math.max(SH * 0.62, SH - topPad - bottomPad - amountBand - 12);
  const qrWidth = SW - 12;

  const onShare = async () => {
    if (!uri) return;
    try {
      const localPath = await resolveSharePath(uri);
      if (!localPath) {
        Toast.show('Share module not available', Toast.SHORT);
        return;
      }
      const mime = /\.jpe?g/i.test(uri) ? 'image/jpeg' : 'image/png';
      const fileUri = Platform.OS === 'ios' ? localPath : `file://${localPath}`;
      if (RNShare?.open) {
        await RNShare.open({
          url: fileUri,
          type: mime,
          title: 'Settlement QR',
          failOnCancel: false,
        });
      } else {
        const { Share } = require('react-native');
        await Share.share({ url: fileUri, title: 'Settlement QR' });
      }
    } catch (e) {
      if (String(e?.message || e).toLowerCase().includes('cancel')) return;
      Toast.show('Could not share QR', Toast.SHORT);
    }
  };

  const onDownload = async () => {
    if (!uri) return;
    if (!BlobUtil) {
      Toast.show('Download module not available', Toast.SHORT);
      return;
    }
    try {
      const localPath = await resolveSharePath(uri);
      if (!localPath) {
        Toast.show('Download failed', Toast.SHORT);
        return;
      }
      const mime = /\.jpe?g/i.test(uri) ? 'image/jpeg' : 'image/png';
      if (Platform.OS === 'android') {
        const raw = localPath.replace(/^file:\/\//, '');
        const filename = `settlement-qr-${Date.now()}.${mime === 'image/jpeg' ? 'jpg' : 'png'}`;
        if (BlobUtil.MediaCollection?.copyToMediaStore) {
          await BlobUtil.MediaCollection.copyToMediaStore(
            { name: filename, parentFolder: 'Gramik', mimeType: mime },
            'Download',
            raw,
          );
        } else {
          const dest = `${BlobUtil.fs.dirs.DownloadDir}/${filename}`;
          await BlobUtil.fs.cp(raw, dest);
        }
        Toast.show('QR downloaded', Toast.SHORT);
        return;
      }
      const fileUri = localPath.startsWith('file://') ? localPath : `file://${localPath}`;
      if (RNShare?.open) {
        await RNShare.open({
          url: fileUri,
          type: mime,
          saveToFiles: true,
          failOnCancel: false,
        });
      } else {
        Toast.show('QR saved', Toast.SHORT);
      }
    } catch (e) {
      Toast.show('Download failed', Toast.SHORT);
    }
  };

  const showImage = !!uri && !loading;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={handleRequestClose}
    >
      <View style={st.root}>
        <StatusBar barStyle="light-content" backgroundColor="#000" translucent />

        <View style={[st.topBar, { paddingTop: insets.top + 8 }]}>
          <View style={st.topBarInner}>
            <Text style={st.title} numberOfLines={1}>Settlement QR</Text>
            <View style={st.topActions}>
              {showImage ? (
                <>
                  <Pressable
                    onPress={onShare}
                    style={({ pressed }) => [st.iconBtn, pressed && st.iconBtnPressed]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Share QR"
                  >
                    <Image source={require('../screens/assets/share.png')} style={st.iconImg} />
                  </Pressable>
                  <Pressable
                    onPress={onDownload}
                    style={({ pressed }) => [st.iconBtn, pressed && st.iconBtnPressed]}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Download QR"
                  >
                    <Image source={require('../screens/assets/down.png')} style={st.iconImg} />
                  </Pressable>
                </>
              ) : null}
              <Pressable
                onPress={handleClosePress}
                style={({ pressed }) => [st.closeBtn, pressed && st.closeBtnPressed]}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Image source={require('../screens/assets/cross.png')} style={st.closeIco} />
              </Pressable>
            </View>
          </View>
        </View>

        {total != null && total !== '' ? (
          <View style={[st.amtWrap, { top: insets.top + 56 }]}>
            <Text style={st.amt}>₹ {total}</Text>
          </View>
        ) : null}

        <View
          style={[
            st.content,
            { paddingTop: topPad, paddingBottom: showImage ? bottomPad : insets.bottom + 24 },
          ]}
        >
          {showImage ? (
            <GestureHandlerRootView style={st.gestureRoot}>
              <GestureDetector gesture={composed}>
                <Animated.View style={[st.imageWrap, imgStyle]}>
                  <Image
                    source={{ uri }}
                    style={{ width: qrWidth, height: qrHeight }}
                    resizeMode="contain"
                  />
                </Animated.View>
              </GestureDetector>
            </GestureHandlerRootView>
          ) : (
            <View style={st.placeholder}>
              {loading ? (
                <>
                  <ActivityIndicator size="large" color="#FFF" />
                  <Text style={st.loadingT}>Loading QR…</Text>
                </>
              ) : (
                <>
                  <Text style={st.errT}>
                    {failed ? 'QR generate nahi ho paya. Dubara try karein.' : 'QR not available'}
                  </Text>
                  {failed && onRetry ? (
                    <TouchableOpacity onPress={onRetry} activeOpacity={0.85} style={st.retryBtn}>
                      <Text style={st.retryT}>Retry</Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </View>
          )}
        </View>

        {showImage ? (
          <View style={[st.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[st.receiveBtn, receiveLoading && st.receiveBtnDisabled]}
              onPress={() => onReceivePayment?.()}
              activeOpacity={0.85}
              disabled={!!receiveLoading}
            >
              {receiveLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={st.receiveBtnT}>Receive Payment</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gestureRoot: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrap: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  loadingT: { marginTop: 14, color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '500' },
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
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
    paddingHorizontal: 16,
  },
  topBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.24)',
    transform: [{ scale: 0.94 }],
  },
  iconImg: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
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
  amtWrap: { position: 'absolute', alignSelf: 'center', zIndex: 8 },
  amt: { color: '#FCD34D', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 },
  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    zIndex: 20,
    elevation: 20,
  },
  receiveBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiveBtnDisabled: {
    opacity: 0.75,
  },
  receiveBtnT: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
