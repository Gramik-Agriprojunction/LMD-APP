// Global fetch interceptor — logs each API call:
//   <Name> API URL== + Payload==  (synchronously when fetch is called)
//   <Name> API Response==         (as soon as the response arrives)
//   <Name> API Error==            (on network / read failure)

import constants from './constants';

const originalFetch = global.fetch;

const FRIENDLY_NAMES = {
  login: 'Login',
  verifyOtp: 'Verify OTP',
  homescreen: 'Dashboard',
  orderList: 'Orders List',
  orderDetails: 'Order Details',
  updateStatus: 'Update Status',
  getQR: 'Generate QR',
  cancelReasons: 'Cancel Reasons',
  rejectReasons: 'Reject Reasons',
  disputeReasons: 'Dispute Reasons',
  cashSettle: 'Cash Settle',
  settleDetail: 'Settlement Detail',
  checkSettle: 'Check Settle',
  settleList: 'Settle List',
  settleHistory: 'Settle History',
  submitSettlement: 'Submit Settlement',
  settlementQr: 'Settlement QR',
  settlementQrPaymentSuccess: 'Settlement QR Payment Success',
  profile: 'Profile',
  notification: 'Notification',
  orderVerifyOtp: 'Order Verify OTP',
  farmerSurveyForm: 'Farmer Survey Form',
  fillSurvey: 'Fill Survey',
  penaltyOrders: 'Penalty Orders',
  bulkPickupGenerateOtp: 'Bulk Pickup Generate OTP',
  bulkPickupOtpVerify: 'Bulk Pickup OTP Verify',
  soilOrders: 'Soil Order List',
  soilOrderDetail: 'Soil Order Detail',
  cancelSoilOrder: 'Cancel Soil Order',
  soilOrderPickup: 'Soil Order Pickup',
  soilPackages: 'Soil Packages',
  createSoilOrder: 'Create Soil Order',
  getPostOffice: 'Get Post Office',
  allFarmers: 'All Farmers',
  exotelCall: 'Exotel Call',
  locationUpdate: 'Location Update',
};

const METHOD_OVERRIDES = [
  { match: 'soil-testing/soil-package', method: 'GET', name: 'Soil Packages' },
  { match: 'user/all-farmer', method: 'GET', name: 'All Farmers' },
  { match: 'user/get-post-office', method: 'POST', name: 'Get Post Office' },
];

function prettifyKey(key) {
  return String(key || 'API')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

const URL_TO_NAME = {};
Object.entries(constants || {}).forEach(([key, url]) => {
  if (typeof url === 'string') {
    URL_TO_NAME[url] = FRIENDLY_NAMES[key] || prettifyKey(key);
  }
});

const isLogEndpoint = (url) =>
  typeof url === 'string' && url.indexOf('localhost:8081/log') !== -1;

const isNoiseEndpoint = (url) => {
  if (!url || typeof url !== 'string') return false;
  if (isLogEndpoint(url)) return true;
  if (url.indexOf('generate_204') !== -1) return true;
  if (url.indexOf('clients1.google.com') !== -1) return true;
  if (url.indexOf('clients3.google.com') !== -1) return true;
  if (url.indexOf('connectivitycheck.gstatic.com') !== -1) return true;
  return false;
};

function getApiName(url, method) {
  if (!url || typeof url !== 'string') return 'API';
  const m = String(method || 'GET').toUpperCase();
  const path = url.split('?')[0].replace(/\/$/, '');

  if (/\/soil-testing\/soil-order-pickup/.test(path)) return 'Soil Order Pickup';
  if (/\/soil-testing\/soil-order-cancelled\/\d+/.test(path)) return 'Cancel Soil Order';
  if (/\/soil-testing\/soil-order\/\d+/.test(path)) return 'Soil Order Detail';
  if (m === 'POST' && /\/soil-testing\/soil-order$/.test(path)) return 'Create Soil Order';
  if (m === 'GET' && /\/soil-testing\/soil-order$/.test(path)) return 'Soil Order List';
  if (/\/lmd\/cash-settlement-detail\/\d+/.test(path)) return 'Settlement Detail';
  if (m === 'POST' && /\/lmd\/cash-settlement$/.test(path)) return 'Cash Settle';

  for (const o of METHOD_OVERRIDES) {
    if (url.indexOf(o.match) !== -1 && m === o.method) return o.name;
  }
  if (URL_TO_NAME[url]) return URL_TO_NAME[url];
  for (const base in URL_TO_NAME) {
    if (url.startsWith(base)) return URL_TO_NAME[base];
  }
  if (url.indexOf('play.google.com') !== -1) return 'Play Store Check';
  if (url.indexOf('itunes.apple.com') !== -1) return 'App Store Check';
  if (url.indexOf('wa.me') !== -1) return 'WhatsApp';
  try {
    const path = url.split('?')[0].split('/').filter(Boolean).pop() || 'API';
    return path.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  } catch (e) {
    return 'API';
  }
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function normalizeFormValue(val) {
  if (val && typeof val === 'object' && val.uri) {
    return { uri: val.uri, type: val.type, name: val.name };
  }
  return val;
}

function describeFormData(body) {
  if (Array.isArray(body._parts) && body._parts.length) {
    return body._parts.map((part) => [part[0], normalizeFormValue(part[1])]);
  }
  if (Array.isArray(body._data) && body._data.length) {
    return body._data.map((part) => [part.fieldName || part[0], normalizeFormValue(part.data ?? part[1])]);
  }
  if (typeof body.getParts === 'function') {
    try {
      const parts = body.getParts();
      if (Array.isArray(parts) && parts.length) {
        return parts.map((part) => [part.fieldName || part.name, normalizeFormValue(part.data ?? part)]);
      }
    } catch (e) {}
  }
  if (typeof body.forEach === 'function') {
    const entries = [];
    try {
      body.forEach((value, key) => {
        entries.push([key, normalizeFormValue(value)]);
      });
      if (entries.length) return entries;
    } catch (e) {}
  }
  return '(FormData)';
}

function describeBody(body) {
  if (body == null) return null;
  if (typeof body === 'string') {
    const parsed = safeParse(body);
    return parsed != null ? parsed : body;
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return describeFormData(body);
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) return `(Blob, ${body.size} bytes)`;
  if (body instanceof ArrayBuffer) return `(ArrayBuffer, ${body.byteLength} bytes)`;
  return body;
}

function logLine(tag, value) {
  if (value === undefined || value === null) {
    console.log(tag);
    return;
  }
  if (typeof value === 'string') {
    console.log(`${tag} ${value}`);
    return;
  }
  try {
    console.log(`${tag} ${JSON.stringify(value)}`);
  } catch (e) {
    console.log(tag, value);
  }
}

function resolveRequest(input, init) {
  const opts = init || {};
  if (typeof input === 'string') {
    return {
      url: input,
      method: String(opts.method || 'GET').toUpperCase(),
      body: opts.body,
    };
  }
  if (input && typeof input === 'object') {
    return {
      url: input.url || '',
      method: String(opts.method || input.method || 'GET').toUpperCase(),
      body: opts.body != null ? opts.body : input._bodyInit,
    };
  }
  return { url: '', method: 'GET', body: null };
}

const MAX_RESP_LEN = 8000;

function logResponseBody(name, response, text) {
  let toLog = text || '';
  const truncated = toLog.length > MAX_RESP_LEN;
  if (truncated) toLog = toLog.slice(0, MAX_RESP_LEN) + '…(truncated)';
  const parsed = safeParse(toLog);
  const payload = {
    status: response.status,
    ok: response.ok,
    body: parsed != null
      ? (truncated && typeof parsed === 'object' ? { ...parsed, _truncated: true } : parsed)
      : (toLog || '(empty)'),
  };
  logLine(`${name} API Response==`, payload);
}

global.fetch = async (input, init) => {
  const { url, method, body } = resolveRequest(input, init);

  if (isNoiseEndpoint(url)) {
    return originalFetch(input, init);
  }

  const name = getApiName(url, method);

  logLine(`${name} API URL==`, `${method} ${url}`);
  if (body != null) {
    logLine(`${name} API Payload==`, describeBody(body));
  } else if (method === 'GET' && url.indexOf('?') !== -1) {
    logLine(`${name} API Payload==`, url.slice(url.indexOf('?')));
  }

  try {
    const response = await originalFetch(input, init);

    try {
      const cloned = response.clone();
      cloned.text().then((text) => {
        logResponseBody(name, response, text);
      }).catch((readErr) => {
        logLine(`${name} API Error==`, {
          status: response.status,
          message: readErr?.message || String(readErr),
        });
      });
    } catch (cloneErr) {
      logLine(`${name} API Response==`, {
        status: response.status,
        ok: response.ok,
        body: '(body not readable)',
      });
    }

    return response;
  } catch (err) {
    logLine(`${name} API Error==`, err?.message || String(err));
    throw err;
  }
};

function patchBlobUtil() {
  try {
    const BlobUtil = require('react-native-blob-util').default || require('react-native-blob-util');
    if (!BlobUtil || typeof BlobUtil.fetch !== 'function' || BlobUtil.fetch.__apiLoggerPatched) return;

    const originalBlobFetch = BlobUtil.fetch.bind(BlobUtil);
    const wrapped = (...args) => {
      const method = String(args[0] || 'GET').toUpperCase();
      const url = String(args[1] || '');
      const headers = args[2];
      const body = args[3];

      if (!isNoiseEndpoint(url)) {
        const name = getApiName(url, method);
        logLine(`${name} API URL==`, `${method} ${url}`);
        if (headers != null) logLine(`${name} API Payload==`, { headers, body: describeBody(body) });
        else if (body != null) logLine(`${name} API Payload==`, describeBody(body));
      }

      return originalBlobFetch(...args)
        .then((res) => {
          if (!isNoiseEndpoint(url)) {
            const name = getApiName(url, method);
            const info = typeof res?.info === 'function' ? res.info() : res?.respInfo;
            logLine(`${name} API Response==`, {
              status: info?.status ?? res?.status,
              ok: (info?.status ?? res?.status) >= 200 && (info?.status ?? res?.status) < 300,
              path: info?.path || res?.path,
            });
          }
          return res;
        })
        .catch((err) => {
          if (!isNoiseEndpoint(url)) {
            logLine(`${getApiName(url, method)} API Error==`, err?.message || String(err));
          }
          throw err;
        });
    };
    wrapped.__apiLoggerPatched = true;
    BlobUtil.fetch = wrapped;
  } catch (e) {}
}

patchBlobUtil();

console.log('[apiLogger] fetch interceptor active — URL + Payload on call, Response/Error on reply');
