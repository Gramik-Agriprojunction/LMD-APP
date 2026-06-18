import { Linking, Platform, AppState } from 'react-native';

const UPI_ANDROID_PACKAGES = {
  google_pay: 'com.google.android.apps.nbu.paisa.user',
  phone_pe: 'com.phonepe.app',
  paytm: 'net.one97.paytm',
};

const UPI_IOS_SCHEMES = {
  google_pay: 'tez://upi/pay',
  phone_pe: 'phonepe://pay',
  paytm: 'paytmmp://pay',
};

let RazorpayCheckout = null;
try {
  RazorpayCheckout = require('react-native-razorpay').default;
} catch (e) {
  RazorpayCheckout = null;
}

export const isOnlinePayment = (code) => {
  const c = String(code || '').toLowerCase();
  return c !== 'cash_on_delivery' && c !== 'cod';
};

export const isUpiAppPayment = (code) => {
  const c = String(code || '').toLowerCase();
  return ['google_pay', 'phone_pe', 'paytm'].includes(c);
};

export const parseCreateOrderResponse = (json) => {
  const data = json?.data;
  const order = data?.order || data?.soil_order || (data?.id ? data : null);
  const orderId = order?.id || data?.order_id || data?.id;
  return {
    order: order || { id: orderId },
    orderId,
    razorpayOrderId: data?.razorpay_order_id || data?.razorpay?.order_id || order?.razorpay_order_id,
    razorpayKey: data?.razorpay_key || data?.razorpay?.key,
    upiVpa: data?.upi_vpa || data?.upi?.vpa || data?.vpa,
    message: json?.message,
    success: !!(json?.success || json?.status),
  };
};

export const paymentConfigFromPage = (pageData = {}) => ({
  razorpayKey: pageData.razorpay_key || pageData.razorpayKey || pageData.payment_key || pageData.razor_pay_key,
  upiVpa: pageData.upi_object?.vpa || pageData.upi_vpa || pageData.merchant_vpa || pageData.vpa,
  upiName: pageData.upi_object?.name || pageData.upi_name || pageData.merchant_name || 'Gramik',
  upiNote: pageData.upi_object?.note || pageData.upi_note || 'Soil Testing',
});

const formatPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
};

const buildUpiQuery = ({ vpa, name, amount, note, txnRef }) => {
  const params = [
    ['pa', vpa],
    ['pn', name || 'Gramik'],
    ['am', Number(amount).toFixed(2)],
    ['cu', 'INR'],
    ['tn', note || 'Soil Test'],
    ['tr', String(txnRef || `SOIL${Date.now()}`)],
  ];
  return params.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
};

const buildUpiUrls = ({ vpa, name, amount, note, txnRef, appCode }) => {
  const qs = buildUpiQuery({ vpa, name, amount, note, txnRef });
  const generic = `upi://pay?${qs}`;
  const urls = [];

  if (Platform.OS === 'android' && appCode && UPI_ANDROID_PACKAGES[appCode]) {
    const pkg = UPI_ANDROID_PACKAGES[appCode];
    const fallback = encodeURIComponent(generic);
    urls.push(`intent://pay?${qs}#Intent;scheme=upi;package=${pkg};S.browser_fallback_url=${fallback};end`);
  }

  if (Platform.OS === 'ios' && appCode && UPI_IOS_SCHEMES[appCode]) {
    urls.push(`${UPI_IOS_SCHEMES[appCode]}?${qs}`);
  }

  urls.push(generic);
  return [...new Set(urls)];
};

export const openRazorpayCheckout = ({
  key, amount, orderId, razorpayOrderId, name, email, phone, description,
}) => {
  if (!RazorpayCheckout) {
    return Promise.reject(new Error('Razorpay SDK not linked. Run pod install and rebuild.'));
  }
  if (!key) return Promise.reject(new Error('Razorpay key missing'));

  const contact = formatPhone(phone);
  const options = {
    key,
    amount: Math.round(Number(amount) * 100),
    currency: 'INR',
    name: 'Gramik',
    description: description || 'Mitti Jaanch',
    order_id: razorpayOrderId || undefined,
    prefill: {
      name: String(name || '').trim(),
      email: String(email || '').trim(),
      contact,
    },
    readonly: {
      name: !!name,
      email: !!email,
      contact: contact.length === 10,
    },
    theme: { color: '#26BD26' },
    notes: orderId ? { soil_order_id: String(orderId) } : {},
    modal: {
      confirm_close: true,
      ondismiss: () => {},
    },
  };

  return RazorpayCheckout.open(options).then((data) => ({
    success: true,
    paymentId: data?.razorpay_payment_id || data?.payment_id || '',
    data,
  }));
};

export const openUpiPayment = async ({ appCode, vpa, name, payeeName, amount, note, txnRef, phone }) => {
  if (!vpa) return Promise.reject(new Error('UPI VPA missing'));

  const displayName = name || 'Gramik';
  const urls = buildUpiUrls({
    vpa,
    name: displayName,
    amount,
    note: note || (payeeName ? `Soil Test - ${payeeName}` : 'Soil Test'),
    txnRef,
    appCode,
  });

  let lastErr = null;
  for (const url of urls) {
    try {
      if (Platform.OS === 'ios') {
        const ok = await Linking.canOpenURL(url);
        if (!ok) continue;
      }
      await Linking.openURL(url);
      return { opened: true, url };
    } catch (e) {
      lastErr = e;
    }
  }

  if (Platform.OS === 'android' && urls.length > 0) {
    try {
      await Linking.openURL(urls[0]);
      return { opened: true, url: urls[0] };
    } catch (e) {
      lastErr = e;
    }
  }

  return Promise.reject(lastErr || new Error('UPI app not available'));
};

export const waitForAppReturn = (timeoutMs = 120000) => new Promise((resolve) => {
  let done = false;
  const finish = (v) => {
    if (done) return;
    done = true;
    sub?.remove?.();
    clearTimeout(timer);
    resolve(v);
  };
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') finish({ returned: true });
  });
  const timer = setTimeout(() => finish({ returned: false, timeout: true }), timeoutMs);
});
