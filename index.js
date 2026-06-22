/**
 * @format
 */

import './src/utils/apiLogger';
import './src/utils/metroLog';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Background FCM handler must be registered at the top level (before AppRegistry).
// Guarded so a missing GoogleService-Info.plist / google-services.json doesn't
// crash app boot.
try {
  // eslint-disable-next-line global-require
  const messaging = require('@react-native-firebase/messaging').default;
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('[push] FCM background message (index)', remoteMessage);
  });
} catch (e) {
  console.log('[push] Background handler skipped — Firebase not configured');
}

AppRegistry.registerComponent(appName, () => App);
