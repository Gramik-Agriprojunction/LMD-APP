import { getPriority } from './statusColors';

const P = '#5D3FD3';

export const GROUP_FILTERS = [
  { id: 'farmer', label: 'Farmer wise', sub: 'Farmer ke naam se group karein', icon: require('../screens/assets/farmer.png'), tint: '#EDE9FE', accent: P },
  { id: 'darkstore', label: 'Darkstore wise', sub: 'Darkstore ke naam se group karein', icon: require('../screens/assets/shop2.png'), iconTint: '#0284C7', tint: '#E0F2FE', accent: '#0284C7' },
  { id: 'pickup', label: 'Pickup wise', sub: 'Pickup location se group karein', icon: require('../screens/assets/gps.png'), iconTint: '#16A34A', tint: '#DCFCE7', accent: '#16A34A' },
  { id: 'drop', label: 'Drop wise', sub: 'Delivery address se group karein', icon: require('../screens/assets/location.png'), iconTint: '#DC2626', tint: '#FEE2E2', accent: '#DC2626' },
  { id: 'pincode', label: 'Pin Code wise', sub: 'PIN code se group karein', icon: require('../screens/assets/pin.png'), iconTint: '#CA8A04', tint: '#FEF9C3', accent: '#CA8A04' },
  { id: 'priority', label: 'Priority wise', sub: 'Priority ke hisaab se group karein', icon: require('../screens/assets/star.png'), iconTint: '#DC2626', tint: '#FEE2E2', accent: '#DC2626' },
];

export const DEFAULT_GROUP_BY = 'priority';

export const FILTER_ROW_H = 68;

const extractPincode = (address) => {
  const m = String(address || '').match(/\b(\d{6})\b(?!.*\d{6})/);
  return m ? m[1] : '';
};

const PRIORITY_GROUP_ORDER = { High: 0, Medium: 1, Low: 2 };

export const isApiGroupedData = (raw) =>
  Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0]?.data);

export const flattenFromApiGroups = (raw) => {
  if (!Array.isArray(raw)) return [];
  if (isApiGroupedData(raw)) {
    return raw.flatMap((group) =>
      (Array.isArray(group.data) ? group.data : []).map((order) => ({
        ...order,
        group_title: group.title || group.pincode || '',
        group_pincode: group.pincode || order.pincode,
      })),
    );
  }
  return raw;
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
    rows.push({ type: 'header', title, count: items.length, key: `h-${groupBy}-${title}` });
    items.forEach((item) => rows.push({ type: 'order', item, key: `o-${item?.id || item?.order_id}` }));
  });
  return rows;
};

export const buildRowsFromApiGroups = (groups, groupBy) => {
  if (!isApiGroupedData(groups)) return null;
  const rows = [];
  groups.forEach((group) => {
    const title = String(group.title || group.pincode || '').trim() || 'Other';
    const items = Array.isArray(group.data) ? group.data : [];
    if (!items.length) return;
    rows.push({ type: 'header', title, count: items.length, key: `h-${groupBy}-${title}` });
    items.forEach((item) => rows.push({ type: 'order', item, key: `o-${item?.id || item?.order_id}` }));
  });
  return rows.length ? rows : null;
};

export const parseOrderListPayload = (rawData, groupBy, { append, prevApiGroups, prevOrders }) => {
  let apiGroups = null;
  let freshOrders = [];
  let listRows = null;

  if (groupBy && isApiGroupedData(rawData)) {
    apiGroups = append ? mergeApiGroups(prevApiGroups, rawData) : rawData;
    freshOrders = flattenFromApiGroups(apiGroups);
    listRows = buildRowsFromApiGroups(apiGroups, groupBy);
  } else {
    freshOrders = flattenFromApiGroups(rawData);
    apiGroups = null;
  }

  const orders = append ? [...(prevOrders || []), ...freshOrders] : freshOrders;
  if (groupBy && !listRows) {
    listRows = buildGroupedRows(orders, groupBy);
  }

  return { orders, apiGroups, listRows };
};

export const buildListRows = (rawData, groupBy) => {
  const parsed = parseOrderListPayload(rawData, groupBy, {
    append: false,
    prevApiGroups: null,
    prevOrders: [],
  });
  if (groupBy) return parsed.listRows || buildGroupedRows(parsed.orders, groupBy);
  return buildGroupedRows(parsed.orders, null);
};

export const homescreenUrl = (baseUrl, groupBy) => {
  if (!groupBy) return baseUrl;
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}group_by=${encodeURIComponent(groupBy)}`;
};
