import Toast from 'react-native-simple-toast';
import constants from './constants';

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
    try { json = await res.json(); } catch (e) { /* non-json body */ }

    if (json?.success || res.ok) {
      Toast.show(
        json?.message || 'Call connect ho raha hai — apna phone uthaiye',
        Toast.SHORT,
      );
      return { ok: true, data: json?.data || json };
    }

    Toast.show(json?.message || 'Call initiate nahi ho paya', Toast.SHORT);
    return { ok: false, error: json?.message || `http_${res.status}` };
  } catch (e) {
    Toast.show('Call initiate nahi ho paya', Toast.SHORT);
    return { ok: false, error: String(e?.message || e) };
  }
};
