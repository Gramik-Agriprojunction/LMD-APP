import { Alert, Linking } from 'react-native';
import Toast from 'react-native-simple-toast';
import constants from './constants';

export const resolveOrderId = (order) => {
  if (order == null) return '';
  if (typeof order === 'string' || typeof order === 'number') {
    return String(order).trim();
  }
  const id = order.order_id ?? order.id ?? order.orderId;
  return id != null && String(id).trim() !== '' ? String(id).trim() : '';
};

export const dialDirect = async (phone) => {
  const p = String(phone || '').replace(/\s+/g, '');
  if (!p) return;
  const url = `tel:${p}`;
  try {
    await Linking.openURL(url);
  } catch (e) {
    try {
      await Linking.openURL(`telprompt:${p}`);
    } catch (e2) {
      Alert.alert('Call', p);
    }
  }
};

export const callFarmerExotel = async ({
  order,
  orderId,
  toPhone,
  context = 'delivery',
}) => {
  const oid = orderId != null && String(orderId).trim() !== ''
    ? String(orderId).trim()
    : resolveOrderId(order);
  return initiateExotelCall({
    orderId: oid,
    toPhone,
    callType: 'farmer',
    context,
  });
};

/**
 * Initiate a masked Exotel call via backend (click-to-call).
 * Backend calls Exotel Connect API → rings LMD agent first → connects farmer.
 * Recording + CRM log are handled server-side via Exotel webhooks.
 */
export const initiateExotelCall = async ({
  orderId,
  toPhone,
  callType = 'farmer',
  context = 'delivery',
}) => {
  const phone = String(toPhone || '').replace(/\s+/g, '');
  const oid = orderId != null ? String(orderId).trim() : '';

  if (!phone) {
    Toast.show('Phone number nahi mila', Toast.SHORT);
    return { ok: false, error: 'missing_phone' };
  }
  if (!oid) {
    Toast.show('Order ID nahi mila', Toast.SHORT);
    return { ok: false, error: 'missing_order' };
  }

  try {
    const res = await fetch(constants.exotelCall, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + global.token,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-localization': 'en',
      },
      body: JSON.stringify({
        order_id: oid,
        to_phone: phone,
        call_type: callType,
        context,
      }),
    });

    let json = {};
    const rawText = await res.text();
    console.log('[LOG] Exotel Call API Exact Response==', rawText);
    try { json = rawText ? JSON.parse(rawText) : {}; } catch (e) { /* non-json body */ }

    if (json?.success || res.ok) {
      Toast.show(
        json?.message || 'Call connect ho raha hai — apna phone uthaiye',
        Toast.SHORT,
      );
      return { ok: true, data: json?.data || json };
    }

    Alert.alert(
      'Call connect nahi ho paya',
      'Exotel se call initiate nahi ho paya. Apne mobile se seedha call karein?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call karein', onPress: () => dialDirect(phone) },
      ],
    );
    return { ok: false, error: json?.message || `http_${res.status}` };
  } catch (e) {
    Alert.alert(
      'Call connect nahi ho paya',
      'Exotel se call initiate nahi ho paya. Apne mobile se seedha call karein?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call karein', onPress: () => dialDirect(phone) },
      ],
    );
    return { ok: false, error: String(e?.message || e) };
  }
};
