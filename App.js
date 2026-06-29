import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { Platform, StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import UpdateModal from './src/components/UpdateModal';
import AndroidInsetBridge from './src/components/AndroidInsetBridge';
import { initPushNotifications } from './src/utils/pushNotifications';
import { startBackgroundLocationTracker, stopBackgroundLocationTracker } from './src/utils/locationTracker';

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
    initPushNotifications();
    startBackgroundLocationTracker();
    return () => stopBackgroundLocationTracker();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AndroidInsetBridge>
          <BottomSheetModalProvider>
            <AppShell>
              <StatusBar barStyle="dark-content" />
              <AppNavigator />
              <UpdateModal />
            </AppShell>
          </BottomSheetModalProvider>
        </AndroidInsetBridge>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
