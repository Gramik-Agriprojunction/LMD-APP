// Super Admin read-only fetch layer. Must be imported after apiLogger so logs show the final URL/body.
// Pass-through for normal LMD users (isSuperAdmin() === false).

import constants from './constants';
import { isSuperAdmin, getViewPartnerId, READ_ONLY_MESSAGE } from './lmdViewMode';

const BASE = String(constants.login || '').replace(/auth\/lmd\/login$/, '');
const LMD_PREFIX = BASE + 'lmd/';
const PARTNER_LIST = BASE + 'lmd/view/partners';
const READ_POST_SUFFIXES = ['/orderlist', '/orderdetails'];

const innerFetch = global.fetch;

const pathOf = (url) => url.split('?')[0].replace(/\/$/, '').toLowerCase();

const isAllowedWrite = (url) => {
  if (url.startsWith(BASE + 'auth/')) return true;
  const path = pathOf(url);
  return url.startsWith(LMD_PREFIX) && READ_POST_SUFFIXES.some((s) => path.endsWith(s));
};

const withQueryParam = (url, id) => {
  if (/[?&]view_partner_id=/.test(url)) return url;
  return url + (url.indexOf('?') === -1 ? '?' : '&') + 'view_partner_id=' + encodeURIComponent(id);
};

const withBodyParam = (body, id) => {
  if (typeof body !== 'string') return body;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return JSON.stringify({ ...parsed, view_partner_id: Number(id) });
    }
  } catch (e) {}
  return body;
};

const readOnlyResponse = () =>
  new Response(JSON.stringify({ status: false, message: READ_ONLY_MESSAGE, data: null }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });

global.fetch = (input, init) => {
  if (typeof input !== 'string' || !isSuperAdmin() || !input.startsWith(BASE)) {
    return innerFetch(input, init);
  }

  const method = String(init?.method || 'GET').toUpperCase();
  if (method !== 'GET' && !isAllowedWrite(input)) {
    return Promise.resolve(readOnlyResponse());
  }

  const id = getViewPartnerId();
  if (!id || !input.startsWith(LMD_PREFIX) || input.startsWith(PARTNER_LIST)) {
    return innerFetch(input, init);
  }

  if (method === 'GET') {
    return innerFetch(withQueryParam(input, id), init);
  }
  return innerFetch(input, { ...init, body: withBodyParam(init?.body, id) });
};
