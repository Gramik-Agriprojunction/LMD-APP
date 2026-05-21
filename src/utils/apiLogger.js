// Global fetch interceptor — automatically logs every API call:
//   <Name> API URL== <method> <url>
//   <Name> API Payload== <body>
//   <Name> API Response== <parsed body>
//   <Name> API Error== <message>
//
// Friendly names are derived from src/utils/constants.js so logs read like
// "Dashboard API ..." instead of "lmd/home ...".

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
};

// Build URL → name lookup once at module load.
const URL_TO_NAME = {};
Object.entries(constants || {}).forEach(([key, url]) => {
  if (typeof url === 'string') {
    URL_TO_NAME[url] = NAME_MAP[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
  }
});

const isLogEndpoint = (url) =>
  typeof url === 'string' && url.indexOf('localhost:8081/log') !== -1;

function getApiName(url) {
  if (!url || typeof url !== 'string') return 'API';
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
  // FormData / Blob / ArrayBuffer — don't try to serialize
  if (typeof FormData !== 'undefined' && body instanceof FormData) return '(FormData)';
  if (typeof Blob !== 'undefined' && body instanceof Blob) return `(Blob, ${body.size} bytes)`;
  if (body instanceof ArrayBuffer) return `(ArrayBuffer, ${body.byteLength} bytes)`;
  return body;
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

  const name = getApiName(url);

  console.log(`${name} API URL== ${method} ${url}`);
  if (opts.body != null) {
    console.log(`${name} API Payload==`, describeBody(opts.body));
  }

  try {
    const response = await originalFetch(input, init);

    // Clone so we don't consume the body for the caller.
    try {
      const cloned = response.clone();
      cloned.text().then(text => {
        let toLog = text || '';
        const truncated = toLog.length > MAX_RESP_LEN;
        if (truncated) toLog = toLog.slice(0, MAX_RESP_LEN) + '…(truncated)';
        const parsed = safeParse(toLog);
        const tag = `${name} API Response==`;
        if (parsed != null && !truncated) {
          console.log(tag, parsed);
        } else if (parsed != null) {
          console.log(tag, parsed, '(truncated)');
        } else {
          console.log(tag, toLog);
        }
      }).catch(() => {});
    } catch (cloneErr) {
      // Some response bodies (streams) may not be cloneable — ignore.
    }

    return response;
  } catch (err) {
    const msg = err && (err.message || String(err));
    console.log(`${name} API Error==`, msg);
    throw err;
  }
};
