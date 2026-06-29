import { Linking, Platform, AppState, StatusBar, Keyboard } from 'react-native';

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

export const isPaymentCancelled = (err) => {
  const code = Number(err?.code ?? err?.error?.code);
  const msg = String(err?.description || err?.message || err?.error?.description || '').toLowerCase();
  return code === 0 || code === 2 || msg.includes('cancel') || msg.includes('dismiss');
};

export const getPaymentErrorMessage = (err) => {
  if (!err) return 'Payment complete nahi hui';
  if (isPaymentCancelled(err)) return 'Payment cancel ho gayi';
  return String(
    err?.description
    || err?.message
    || err?.error?.description
    || err?.error?.message
    || 'Payment complete nahi hui',
  );
};

export const parseCreateOrderResponse = (json) => {
  const data = json?.data;
  const order = data?.order || data?.soil_order || (data?.id ? data : null);
  const orderId = order?.id || data?.order_id || data?.id;
  const rz = data?.razorpay_data || data?.razorpay || order?.razorpay_data || {};
  return {
    order: order || { id: orderId },
    orderId,
    razorpayOrderId: data?.razorpay_order_id || rz?.order_id || order?.razorpay_order_id,
    razorpayKey: data?.razorpay_key || rz?.key || order?.razorpay_key,
    upiVpa: data?.upi_vpa || data?.upi_object?.UPIID || data?.upi?.vpa || data?.vpa,
    message: json?.message,
    success: !!(json?.success || json?.status),
  };
};

export const paymentConfigFromPage = (pageData = {}) => {
  const rz = pageData?.razorpay_data || pageData?.razorpayData || {};
  const upi = pageData?.upi_object || pageData?.upiObject || {};
  return {
    razorpayKey: rz.key || pageData.razorpay_key || pageData.razorpayKey || pageData.payment_key || pageData.razor_pay_key,
    razorpayDescription: rz.description || 'Mitti Jaanch',
    razorpayImage: rz.image,
    razorpayName: rz.name || 'Gramik',
    razorpayTheme: rz.theme?.color || '#0D7A4C',
    razorpayPrefill: rz.prefill || {},
    upiVpa: upi.UPIID || upi.upiid || upi.vpa || upi.VPA || pageData.upi_vpa || pageData.merchant_vpa,
    upiName: upi.PayToName || upi.bankingName || upi.name || pageData.upi_name || 'Gramik',
    upiNote: upi.note || pageData.upi_note || 'Soil Testing',
  };
};

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

const RAZORPAY_THEME = '#174A30';

export const prepareRazorpayPresentation = (themeColor = RAZORPAY_THEME) => {
  Keyboard.dismiss();
  const color = themeColor || RAZORPAY_THEME;
  if (Platform.OS === 'android') {
    StatusBar.setTranslucent(false);
    StatusBar.setBackgroundColor(color, true);
  }
  StatusBar.setBarStyle('light-content', true);
};

export const restoreRazorpayPresentation = () => {
  if (Platform.OS === 'android') {
    StatusBar.setTranslucent(true);
  }
  StatusBar.setBarStyle('light-content', true);
};

export const openRazorpayCheckout = ({
  key,
  amount,
  orderId,
  razorpayOrderId,
  name,
  email,
  phone,
  description,
  themeColor,
  image,
  merchantName,
}) => {
  if (!RazorpayCheckout) {
    console.log('[SoilPay][Razorpay] SDK not linked');
    return Promise.reject(new Error('Razorpay SDK not linked. Run pod install and rebuild.'));
  }
  if (!key) {
    console.log('[SoilPay][Razorpay] key missing');
    return Promise.reject(new Error('Razorpay key missing'));
  }

  const contact = formatPhone(phone);
  const paise = Math.max(1, Math.round(Number(amount) * 100));

  const theme = themeColor || RAZORPAY_THEME;
  const options = {
    key: String(key).trim(),
    amount: paise,
    currency: 'INR',
    name: merchantName || 'Gramik',
    description: description || 'Mitti Jaanch',
    image: image || undefined,
    order_id: razorpayOrderId ? String(razorpayOrderId) : undefined,
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
    theme: { color: theme, backdrop_color: '#F8FAFC' },
    notes: orderId ? { soil_order_id: String(orderId) } : {},
    modal: { confirm_close: true, animation: true },
  };

  console.log('[SoilPay][Razorpay] opening checkout', {
    key: options.key,
    amount: options.amount,
    order_id: options.order_id,
    name: options.name,
    contact: options.prefill.contact,
  });

  prepareRazorpayPresentation(theme);

  return RazorpayCheckout.open(options)
    .then((data) => {
      const paymentId = data?.razorpay_payment_id || data?.payment_id || '';
      console.log('[SoilPay][Razorpay] success', { paymentId, orderId: data?.razorpay_order_id });
      return {
        success: true,
        paymentId,
        orderId: data?.razorpay_order_id || razorpayOrderId || '',
        signature: data?.razorpay_signature || '',
        data,
      };
    })
    .catch((err) => {
      console.log('[SoilPay][Razorpay] failed', {
        code: err?.code,
        description: err?.description || err?.message,
      });
      throw err;
    })
    .finally(() => {
      restoreRazorpayPresentation();
    });
};

export const openUpiPayment = async ({ appCode, vpa, name, payeeName, amount, note, txnRef, phone }) => {
  if (!vpa) {
    console.log('[SoilPay][UPI] VPA missing');
    return Promise.reject(new Error('UPI VPA missing'));
  }

  const displayName = name || 'Gramik';
  const urls = buildUpiUrls({
    vpa,
    name: displayName,
    amount,
    note: note || (payeeName ? `Soil Test - ${payeeName}` : 'Soil Test'),
    txnRef,
    appCode,
  });

  console.log('[SoilPay][UPI] opening', {
    appCode,
    vpa,
    amount,
    txnRef,
    urlCount: urls.length,
    firstUrl: urls[0]?.slice(0, 120),
  });

  let lastErr = null;
  for (const url of urls) {
    try {
      if (Platform.OS === 'ios') {
        const ok = await Linking.canOpenURL(url);
        if (!ok) {
          console.log('[SoilPay][UPI] canOpenURL false', url.slice(0, 80));
          continue;
        }
      }
      await Linking.openURL(url);
      console.log('[SoilPay][UPI] opened', url.slice(0, 80));
      return { opened: true, url, txnRef };
    } catch (e) {
      console.log('[SoilPay][UPI] open failed', url.slice(0, 80), e?.message);
      lastErr = e;
    }
  }

  if (Platform.OS === 'android' && urls.length > 0) {
    try {
      await Linking.openURL(urls[0]);
      console.log('[SoilPay][UPI] opened via android fallback');
      return { opened: true, url: urls[0], txnRef };
    } catch (e) {
      lastErr = e;
    }
  }

  console.log('[SoilPay][UPI] all attempts failed');
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
