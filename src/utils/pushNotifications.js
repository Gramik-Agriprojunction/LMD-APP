import { Platform, PermissionsAndroid } from 'react-native';
import PushNotification from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';

const DEFAULT_CHANNEL_ID = 'lmd-default';

// Lazy-load Firebase so a missing GoogleService-Info.plist / google-services.json
// only disables FCM token fetching — it doesn't crash app boot.
let _messaging = null;
let _firebaseTried = false;
let _firebaseAvailable = false;

const getMessaging = () => {
  if (_firebaseTried) return _messaging;
  _firebaseTried = true;
  try {
    // eslint-disable-next-line global-require
    const mod = require('@react-native-firebase/messaging').default;
    // Touching mod() throws if no FirebaseApp is configured.
    mod();
    _messaging = mod;
    _firebaseAvailable = true;
  } catch (e) {
    console.log('[push] Firebase messaging unavailable:', e?.message || e);
    _messaging = null;
    _firebaseAvailable = false;
  }
  return _messaging;
};

let configured = false;

const ensureAndroidPermission = async () => {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version < 33) return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (e) {
    console.log('[push] Android notif permission error', e);
    return false;
  }
};

const requestIOSAuth = async () => {
  if (Platform.OS !== 'ios') return true;
  const messaging = getMessaging();
  if (!messaging) {
    // Fall back to RNCPushNotificationIOS permission prompt
    try {
      await PushNotificationIOS.requestPermissions();
      return true;
    } catch (e) {
      return false;
    }
  }
  try {
    const status = await messaging().requestPermission();
    return (
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL
    );
  } catch (e) {
    console.log('[push] iOS notif permission error', e);
    return false;
  }
};

const configurePushNotification = () => {
  if (configured) return;
  configured = true;

  PushNotification.configure({
    // On Android this is the FCM token (when google-services.json is configured).
    // On iOS this is the APNs token (HEX) from RNCPushNotificationIOS.
    // We use this as a fallback when @react-native-firebase isn't configured.
    onRegister: (token) => {
      console.log('[push] onRegister', token);
      if (!global.fcmToken && token?.token) {
        global.fcmToken = token.token;
        global.os = token.os || Platform.OS;
        console.log('[push] FCM/APNs TOKEN (rnpn) ==>', global.fcmToken);
      }
    },

    onNotification: (notification) => {
      console.log('[push] onNotification', notification);
      if (Platform.OS === 'ios') {
        notification.finish(PushNotificationIOS.FetchResult.NoData);
      }
    },

    onRegistrationError: (err) => {
      console.log('[push] onRegistrationError', err?.message || err);
    },

    permissions: { alert: true, badge: true, sound: true },
    popInitialNotification: true,
    requestPermissions: Platform.OS === 'ios',
  });

  if (Platform.OS === 'android') {
    PushNotification.createChannel(
      {
        channelId: DEFAULT_CHANNEL_ID,
        channelName: 'LMD Notifications',
        channelDescription: 'Order, settlement and delivery alerts',
        importance: 4,
        vibrate: true,
      },
      (created) => console.log(`[push] channel "${DEFAULT_CHANNEL_ID}" created=${created}`),
    );
  }
};

const fetchFcmToken = async () => {
  const messaging = getMessaging();
  if (!messaging) {
    // Firebase not configured — token will come from RNPN's onRegister callback (APNs/FCM).
    return global.fcmToken || '';
  }
  try {
    if (Platform.OS === 'ios') {
      try { await messaging().registerDeviceForRemoteMessages(); } catch (e) {}
    }
    const token = await messaging().getToken();
    global.fcmToken = token || global.fcmToken || '';
    global.os = Platform.OS;
    console.log('[push] FCM TOKEN ==>', global.fcmToken);
    return global.fcmToken;
  } catch (e) {
    console.log('[push] getToken error', e?.message || e);
    return global.fcmToken || '';
  }
};

const subscribeToTokenRefresh = () => {
  const messaging = getMessaging();
  if (!messaging) return () => {};
  return messaging().onTokenRefresh((token) => {
    global.fcmToken = token || '';
    console.log('[push] FCM TOKEN refreshed ==>', global.fcmToken);
  });
};

const subscribeToMessages = () => {
  const messaging = getMessaging();
  if (!messaging) return () => {};

  const unsubForeground = messaging().onMessage(async (remoteMessage) => {
    console.log('[push] FCM foreground message', remoteMessage);
    const n = remoteMessage?.notification;
    if (!n) return;
    PushNotification.localNotification({
      channelId: DEFAULT_CHANNEL_ID,
      title: n.title,
      message: n.body || '',
      playSound: true,
      soundName: 'default',
      userInfo: remoteMessage?.data || {},
    });
  });

  try {
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('[push] FCM background message', remoteMessage);
    });
  } catch (e) {}

  return unsubForeground;
};

export const initPushNotifications = async () => {
  global.os = Platform.OS;
  configurePushNotification();

  const [, granted] = await Promise.all([
    requestIOSAuth(),
    ensureAndroidPermission(),
  ]);
  if (!granted && Platform.OS === 'android') {
    console.log('[push] POST_NOTIFICATIONS permission not granted');
  }

  await fetchFcmToken();
  subscribeToTokenRefresh();
  subscribeToMessages();
};

export const getFcmToken = () => global.fcmToken || '';

export const refreshFcmToken = fetchFcmToken;

export const isFirebaseAvailable = () => _firebaseAvailable;
