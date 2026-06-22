import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export const parseNotificationPayload = (raw) => {
  const data = raw?.data && typeof raw.data === 'object' ? raw.data : (raw || {});
  return {
    nav: data.nav || '',
    navId: data.navId != null ? String(data.navId) : '',
    type: data.type || '',
    orderId: data.order_id != null
      ? String(data.order_id)
      : data.orderId != null
        ? String(data.orderId)
        : '',
  };
};

export const applyNotificationNavigation = (navigation, payload) => {
  if (!navigation?.navigate) return false;

  const nav = String(payload?.nav || '').toLowerCase();
  const navId = payload?.navId || '';
  const type = String(payload?.type || '').toUpperCase();

  if (nav.includes('soilorder') || type === 'SOIL_ORDER') {
    if (navId) navigation.navigate('SoilOrderDetail', { orderId: navId });
    else navigation.navigate('SoilOrders');
    return true;
  }

  if (nav.includes('settlement')) {
    if (navId) navigation.navigate('SettlementDetail', { settlementId: navId });
    else navigation.navigate('SettlementList');
    return true;
  }

  if (nav.includes('notification')) {
    navigation.navigate('Notifications');
    return true;
  }

  const orderId = navId || payload?.orderId;
  if (nav.includes('orderdetail') || nav.includes('delivery') || orderId) {
    if (orderId) navigation.navigate('DeliveryDetails', { order: { id: orderId } });
    else navigation.navigate('TrackOrders');
    return true;
  }

  if (nav.includes('track') || nav.includes('order')) {
    navigation.navigate('TrackOrders');
    return true;
  }

  if (orderId) {
    navigation.navigate('DeliveryDetails', { order: { id: orderId } });
    return true;
  }

  navigation.navigate('Notifications');
  return true;
};

export const navigateFromNotification = (raw) => {
  const payload = parseNotificationPayload(raw);
  const hasTarget = !!(payload.nav || payload.navId || payload.orderId || payload.type);
  if (!hasTarget) return false;

  if (navigationRef.isReady()) {
    applyNotificationNavigation(navigationRef, payload);
    return true;
  }

  global.pendingNotificationNav = payload;
  return false;
};

export const flushPendingNotificationNavigation = () => {
  if (!global.pendingNotificationNav || !navigationRef.isReady()) return false;

  const route = navigationRef.getCurrentRoute()?.name;
  if (route === 'Splash' || route === 'Login' || route === 'Language') return false;

  const payload = global.pendingNotificationNav;
  global.pendingNotificationNav = null;
  applyNotificationNavigation(navigationRef, payload);
  return true;
};
