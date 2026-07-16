import { getPriority } from './statusColors';

const P = '#5D3FD3';

export const parsePickReady = (order) => {
  const v = order?.pick_ready ?? order?.pickReady;
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1' || String(v).toLowerCase() === 'true') return true;
  if (v === 0 || v === '0' || String(v).toLowerCase() === 'false') return false;
  return null;
};

export const GROUP_FILTERS = [
  { id: 'farmer', label: 'Farmer wise', sub: 'Farmer ke naam se group karein', icon: require('../screens/assets/farmer.png'), tint: '#EDE9FE', accent: P },
  { id: 'darkstore', label: 'Darkstore wise', sub: 'Darkstore ke naam se group karein', icon: require('../screens/assets/shop2.png'), iconTint: '#0284C7', tint: '#E0F2FE', accent: '#0284C7' },
  { id: 'pickup', label: 'Pickup wise', sub: 'Pickup location se group karein', icon: require('../screens/assets/gps.png'), iconTint: '#16A34A', tint: '#DCFCE7', accent: '#16A34A' },
  { id: 'drop', label: 'Drop wise', sub: 'Delivery address se group karein', icon: require('../screens/assets/location.png'), iconTint: '#DC2626', tint: '#FEE2E2', accent: '#DC2626' },
  { id: 'pincode', label: 'Pin Code wise', sub: 'PIN code se group karein', icon: require('../screens/assets/pin.png'), iconTint: '#CA8A04', tint: '#FEF9C3', accent: '#CA8A04' },
  { id: 'priority', label: 'Priority wise', sub: 'Priority ke hisaab se group karein', icon: require('../screens/assets/star.png'), iconTint: '#DC2626', tint: '#FEE2E2', accent: '#DC2626' },
];

export const PICK_READY_FILTER = {
  label: 'Ready to pick',
  sub: 'Sirf dark store se taiyar orders dikhayein',
  icon: require('../screens/assets/box.png'),
  iconTint: '#16A34A',
  tint: '#DCFCE7',
  accent: '#16A34A',
};

export const DEFAULT_GROUP_BY = 'priority';

export const FILTER_ROW_H = 68;

const extractPincode = (address) => {
  const m = String(address || '').match(/\b(\d{6})\b(?!.*\d{6})/);
  return m ? m[1] : '';
};

const PRIORITY_GROUP_ORDER = { High: 0, Medium: 1, Low: 2 };

export const isApiGroupedData = (raw) =>
  Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0]?.data);

const PRIORITY_TITLES = new Set(['low', 'medium', 'high']);

const inferPriorityFromTitle = (title) => {
  const t = String(title || '').trim().toLowerCase();
  return PRIORITY_TITLES.has(t) ? t : '';
};

export const enrichGroupedOrder = (order, groupTitle = '', groupBy = '') => {
  const next = {
    ...order,
    group_title: groupTitle || order?.group_title || '',
  };
  if (!next.priority) {
    const inferred = groupBy === 'priority'
      ? inferPriorityFromTitle(groupTitle)
      : inferPriorityFromTitle(groupTitle);
    if (inferred) next.priority = inferred;
  }
  return next;
};

export const flattenFromApiGroups = (raw) => {
  if (!Array.isArray(raw)) return [];
  if (isApiGroupedData(raw)) {
    return raw.flatMap((group) => {
      const title = group.title || group.pincode || '';
      return (Array.isArray(group.data) ? group.data : []).map((order) =>
        enrichGroupedOrder(
          {
            ...order,
            group_pincode: group.pincode || order.pincode,
          },
          title,
          'priority',
        ),
      );
    });
  }
  return raw;
};

export const filterOrdersByPickReady = (orders, pickReadyFilter) => {
  if (pickReadyFilter !== true) return orders || [];
  return (orders || []).filter((order) => parsePickReady(order) === true);
};

export const mergeApiGroups = (prev, next) => {
  if (!Array.isArray(prev) || !prev.length) return next || [];
  if (!Array.isArray(next) || !next.length) return prev;
  const map = new Map();
  const addGroups = (groups) => {
    groups.forEach((group) => {
      const title = String(group?.title ?? group?.pincode ?? '').trim() || 'Other';
      const items = Array.isArray(group?.data) ? group.data : [];
      if (!map.has(title)) map.set(title, []);
      map.get(title).push(...items);
    });
  };
  addGroups(prev);
  addGroups(next);
  return [...map.entries()].map(([title, data]) => ({ title, data }));
};

export const groupKeyFor = (order, groupBy) => {
  switch (groupBy) {
    case 'farmer':
      return String(order?.farmer_name || order?.farmer_data?.name || 'Unknown farmer').trim() || 'Unknown farmer';
    case 'darkstore':
      return String(order?.dark_store?.name || 'Unknown darkstore').trim() || 'Unknown darkstore';
    case 'pickup':
      return String(order?.dark_store?.location || order?.dark_store?.name || 'Unknown pickup').trim() || 'Unknown pickup';
    case 'drop':
      return String(order?.shipping_address || 'Unknown drop').trim() || 'Unknown drop';
    case 'pincode':
      return String(order?.group_pincode || extractPincode(order?.shipping_address) || order?.dark_store?.pincode || 'Unknown PIN').trim();
    case 'priority':
      return getPriority(order?.priority).label;
    default:
      return '';
  }
};

const sortGroupEntries = (entries, groupBy) => {
  if (groupBy === 'priority') {
    return entries.sort((a, b) => {
      const pa = PRIORITY_GROUP_ORDER[a[0]] ?? 99;
      const pb = PRIORITY_GROUP_ORDER[b[0]] ?? 99;
      return pa - pb;
    });
  }
  return entries.sort((a, b) => a[0].localeCompare(b[0]));
};

export const buildGroupedRows = (orders, groupBy) => {
  if (!groupBy) {
    return (orders || []).map((item) => ({
      type: 'order',
      item,
      key: `o-${item?.id || item?.order_id}`,
    }));
  }
  const map = new Map();
  (orders || []).forEach((order) => {
    const title = groupKeyFor(order, groupBy);
    if (!map.has(title)) map.set(title, []);
    map.get(title).push(order);
  });
  const rows = [];
  [...sortGroupEntries([...map.entries()], groupBy)].forEach(([title, items]) => {
    if (!items.length) return;
    rows.push({ type: 'header', title, count: items.length, key: `h-${groupBy}-${title}` });
    items.forEach((item) => rows.push({ type: 'order', item, key: `o-${item?.id || item?.order_id}` }));
  });
  return rows;
};

export const parseOrderListPayload = (rawData, groupBy, { append, prevApiGroups, prevOrders, pickReadyFilter = null }) => {
  let apiGroups = null;
  let freshOrders = [];

  if (groupBy && isApiGroupedData(rawData)) {
    apiGroups = append ? mergeApiGroups(prevApiGroups, rawData) : rawData;
    freshOrders = flattenFromApiGroups(apiGroups);
  } else {
    freshOrders = flattenFromApiGroups(rawData);
    apiGroups = null;
  }

  const merged = append ? [...(prevOrders || []), ...freshOrders] : freshOrders;
  const orders = merged;
  const filtered = filterOrdersByPickReady(orders, pickReadyFilter);
  const listRows = groupBy ? buildGroupedRows(filtered, groupBy) : buildGroupedRows(filtered, null);

  return { orders, apiGroups, listRows };
};

export const buildListRows = (rawData, groupBy, pickReadyFilter = null) => {
  const effectiveGroupBy = groupBy || DEFAULT_GROUP_BY;
  const parsed = parseOrderListPayload(rawData, effectiveGroupBy, {
    append: false,
    prevApiGroups: null,
    prevOrders: [],
    pickReadyFilter,
  });
  return parsed.listRows || buildGroupedRows(parsed.orders, effectiveGroupBy);
};

export const hasActiveFilters = (groupBy, pickReadyFilter) =>
  (groupBy && groupBy !== DEFAULT_GROUP_BY) || pickReadyFilter === true;

export const formatActiveFilterLabel = (groupBy, pickReadyFilter) => {
  const group = GROUP_FILTERS.find((g) => g.id === (groupBy || DEFAULT_GROUP_BY));
  const parts = [group?.label || 'Priority wise'];
  if (pickReadyFilter === true) parts.push(PICK_READY_FILTER.label);
  return parts.join(' · ');
};

export const apiGroupByParam = (groupBy) => groupBy || DEFAULT_GROUP_BY;

export const homescreenUrl = (baseUrl, groupBy) => {
  const param = apiGroupByParam(groupBy);
  if (!param) return baseUrl;
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}group_by=${encodeURIComponent(param)}`;
};
