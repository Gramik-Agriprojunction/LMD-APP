// Global fetch interceptor — logs each API call:
//   <Name> API URL== + Payload==  (immediately when fetch is called)
//   <Name> API Response==         (when response arrives)
//   <Name> API Error==            (on network/read failure)

import constants from './constants';

const originalFetch = global.fetch;

// Hand-tuned readable labels for each endpoint key in constants.js.
const NAME_MAP = {
  login:             'Login',
  verifyOtp:         'Verify OTP',
  homescreen:        'Dashboard',
  orderList:         'Orders List',
  orderDetails:      'Order Details',
  updateStatus:      'Update Status',
  getQR:             'Generate QR',
  cancelReasons:     'Cancel Reasons',
  rejectReasons:     'Reject Reasons',
  cashSettle:        'Cash Settle',
  checkSettle:       'Check Settle',
  settleList:        'Settle List',
  settleHistory:     'Settle History',
  confirmSettle:     'Confirm Settle',
  banks:             'Banks',
  profile:           'Profile',
  notification:      'Notification',
  orderVerifyOtp:    'Order Verify OTP',
  farmerSurveyForm:  'Farmer Survey Form',
  fillSurvey:        'Fill Survey',
  soilOrders:        'Soil Order List',
  soilOrderDetail:   'Soil Order Detail',
  cancelSoilOrder:   'Cancel Soil Order',
  soilPackages:      'Soil Packages',
  createSoilOrder:   'Create Soil Order',
  getPostOffice:     'Get Post Office',
  allFarmers:        'All Farmers',
  exotelCall:        'Exotel Call',
};

// Same URL, different methods — disambiguate log labels.
const METHOD_OVERRIDES = [
  { match: 'soil-testing/soil-order', method: 'GET', name: 'Soil Order List' },
  { match: 'soil-testing/soil-order', method: 'POST', name: 'Create Soil Order' },
  { match: 'soil-testing/soil-package', method: 'GET', name: 'Soil Packages' },
  { match: 'user/all-farmer', method: 'GET', name: 'All Farmers' },
  { match: 'user/get-post-office', method: 'POST', name: 'Get Post Office' },
];

// Build URL → name lookup once at module load.
const URL_TO_NAME = {};
Object.entries(constants || {}).forEach(([key, url]) => {
  if (typeof url === 'string') {
    URL_TO_NAME[url] = NAME_MAP[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
  }
});

const isLogEndpoint = (url) =>
  typeof url === 'string' && url.indexOf('localhost:8081/log') !== -1;

function getApiName(url, method) {
  if (!url || typeof url !== 'string') return 'API';
  const m = String(method || 'GET').toUpperCase();
  if (/\/soil-testing\/soil-order-cancelled\/\d+/.test(url)) return 'Cancel Soil Order';
  if (/\/soil-testing\/soil-order\/\d+/.test(url)) return 'Soil Order Detail';
  for (const o of METHOD_OVERRIDES) {
    if (url.indexOf(o.match) !== -1 && m === o.method) return o.name;
  }
  // Exact match
  if (URL_TO_NAME[url]) return URL_TO_NAME[url];
  // Prefix match (handles URLs with appended path/query, e.g. settleHistory?status=...)
  for (const base in URL_TO_NAME) {
    if (url.startsWith(base)) return URL_TO_NAME[base];
  }
  // Well-known external services
  if (url.indexOf('play.google.com') !== -1) return 'Play Store Check';
  if (url.indexOf('itunes.apple.com') !== -1) return 'App Store Check';
  if (url.indexOf('wa.me') !== -1) return 'WhatsApp';
  // Fallback: last path segment, prettified
  try {
    const path = url.split('?')[0].split('/').filter(Boolean).pop() || 'API';
    return path.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  } catch (e) {
    return 'API';
  }
}

function safeParse(text) {
  try { return JSON.parse(text); } catch (e) { return null; }
}

function describeBody(body) {
  if (body == null) return null;
  if (typeof body === 'string') {
    const parsed = safeParse(body);
    return parsed != null ? parsed : body;
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const parts = body._parts;
    if (Array.isArray(parts) && parts.length) {
      return parts.map((part) => {
        const key = part[0];
        const val = part[1];
        if (val && typeof val === 'object' && val.uri) {
          return [key, { uri: val.uri, type: val.type, name: val.name }];
        }
        return [key, val];
      });
    }
    return '(FormData)';
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


const MAX_RESP_LEN = 8000;

global.fetch = async (input, init) => {
  const opts = init || {};
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  const method = String(opts.method || (typeof input !== 'string' && input?.method) || 'GET').toUpperCase();

  // Don't intercept the Metro log forwarder — avoids infinite log loop
  if (isLogEndpoint(url)) {
    return originalFetch(input, init);
  }

  const name = getApiName(url, method);

  // Log URL + payload synchronously before the request goes out
  logLine(`${name} API URL==`, `${method} ${url}`);
  if (opts.body != null) {
    logLine(`${name} API Payload==`, describeBody(opts.body));
  }

  try {
    const response = await originalFetch(input, init);

    try {
      const cloned = response.clone();
      cloned.text().then((text) => {
        let toLog = text || '';
        const truncated = toLog.length > MAX_RESP_LEN;
        if (truncated) toLog = toLog.slice(0, MAX_RESP_LEN) + '…(truncated)';
        const parsed = safeParse(toLog);
        const tag = `${name} API Response==`;
        if (parsed != null) {
          logLine(tag, truncated ? { ...(typeof parsed === 'object' ? parsed : { body: parsed }), _truncated: true } : parsed);
        } else {
          logLine(tag, toLog || '(empty)');
        }
      }).catch((readErr) => {
        logLine(`${name} API Error==`, readErr?.message || String(readErr));
      });
    } catch (cloneErr) {
      // Some response bodies (streams) may not be cloneable — ignore.
    }

    return response;
  } catch (err) {
    logLine(`${name} API Error==`, err?.message || String(err));
    throw err;
  }
};
