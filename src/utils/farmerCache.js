import constants from './constants';

const PER_PAGE = 20;

export const parseFarmers = (json) => {
  const d = json?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.farmers)) return d.farmers;
  if (Array.isArray(d?.list)) return d.list;
  if (Array.isArray(json?.farmers)) return json.farmers;
  return [];
};

export const parseFarmerPagination = (json, page, listLen) => {
  const pg = json?.pagination || json?.meta || json?.data?.pagination || {};
  const currentPage = Math.max(1, Number(pg?.currentPage || pg?.current_page || pg?.page || page) || page);
  const totalPages = Math.max(1, Number(pg?.totalPages || pg?.total_pages || pg?.last_page || 1) || 1);
  const hasMore = typeof pg?.hasNextPage === 'boolean'
    ? pg.hasNextPage
    : typeof pg?.has_next_page === 'boolean'
      ? pg.has_next_page
      : currentPage < totalPages || listLen >= PER_PAGE;
  return { currentPage, totalPages, hasMore };
};

const buildUrl = (query, page) => {
  const q = String(query || '').trim();
  return `${constants.allFarmers}?page=${page}&per_page=${PER_PAGE}&search=${encodeURIComponent(q)}`;
};

let _cache = null;
let _inflight = null;

export const getCachedFarmers = () => _cache;

export const setCachedFarmers = (payload) => {
  if (!payload?.farmers?.length) return;
  _cache = {
    farmers: payload.farmers,
    page: payload.page ?? 1,
    hasMore: !!payload.hasMore,
    query: payload.query ?? '',
    fetchedAt: Date.now(),
  };
};

export const prefetchFarmers = (token = global.token) => {
  if (_cache?.farmers?.length) return Promise.resolve(_cache);
  if (_inflight) return _inflight;

  _inflight = fetch(buildUrl('', 1), {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/json',
      'X-localization': 'en',
    },
  })
    .then((r) => r.json())
    .then((json) => {
      const farmers = parseFarmers(json);
      const { currentPage, hasMore } = parseFarmerPagination(json, 1, farmers.length);
      setCachedFarmers({ farmers, page: currentPage, hasMore, query: '' });
      return _cache;
    })
    .catch(() => _cache)
    .finally(() => {
      _inflight = null;
    });

  return _inflight;
};

export const clearFarmerCache = () => {
  _cache = null;
  _inflight = null;
};
