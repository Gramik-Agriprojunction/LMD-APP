import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Publishes live bottom inset for overlay/footer helpers (all platforms). */
export default function AndroidInsetBridge({ children }) {
  const { bottom } = useSafeAreaInsets();

  useEffect(() => {
    global.__SAFE_BOTTOM_INSET__ = bottom;
    if (Platform.OS === 'android') {
      global.__ANDROID_BOTTOM_INSET__ = bottom;
    }
  }, [bottom]);

  return children;
}
