import React, { useEffect } from 'react';
import { Platform, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import UpdateModal from './src/components/UpdateModal';
import AndroidInsetBridge from './src/components/AndroidInsetBridge';
import ErrorBoundary from './src/components/ErrorBoundary';
import { initPushNotifications } from './src/utils/pushNotifications';
import { startBackgroundLocationTracker, stopBackgroundLocationTracker } from './src/utils/locationTracker';
import { requestStatusLocationAccess } from './src/utils/locationHelper';

function AppShell({ children }) {
  if (Platform.OS !== 'android') return children;
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      {children}
    </SafeAreaView>
  );
}

export default function App() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Location first, then notifications — same asks as before, but not two
      // system dialogs on the same Activity frame (that was the Play crash).
      if (Platform.OS === 'android') {
        await requestStatusLocationAccess('delivery');
      }
      if (!cancelled) initPushNotifications();
    })();
    startBackgroundLocationTracker();
    return () => {
      cancelled = true;
      stopBackgroundLocationTracker();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AndroidInsetBridge>
          <BottomSheetModalProvider>
            <AppShell>
              <StatusBar barStyle="dark-content" />
              <ErrorBoundary>
                <AppNavigator />
              </ErrorBoundary>
              <UpdateModal />
            </AppShell>
          </BottomSheetModalProvider>
        </AndroidInsetBridge>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
