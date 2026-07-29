import moment from 'moment';
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
  { id: 'farmer', label: 'Farmer wise', sub: 'Farmer ke naam se group', icon: require('../screens/assets/farmer.png'), tint: '#F5F3FF', accent: P },
  { id: 'darkstore', label: 'Darkstore wise', sub: 'Darkstore ke naam se group', icon: require('../screens/assets/shop2.png'), iconTint: '#0284C7', tint: '#F0F9FF', accent: '#0284C7' },
  { id: 'drop', label: 'Drop wise', sub: 'Delivery address se group', icon: require('../screens/assets/location.png'), iconTint: '#DC2626', tint: '#FEF2F2', accent: '#DC2626' },
  { id: 'pincode', label: 'Pin Code wise', sub: 'PIN code se group', icon: require('../screens/assets/pin.png'), iconTint: '#CA8A04', tint: '#FFFBEB', accent: '#CA8A04' },
  { id: 'priority', label: 'Priority wise', sub: 'Priority se group', icon: require('../screens/assets/star.png'), iconTint: '#DC2626', tint: '#FEF2F2', accent: '#DC2626' },
];

export const PICK_READY_FILTER = {
  label: 'Ready to pick',
  sub: 'Sirf darkstore se ready orders',
  icon: require('../screens/assets/box.png'),
  iconTint: '#16A34A',
  tint: '#F0FDF4',
  accent: '#16A34A',
};

export const RESCHEDULE_DATE_PRESETS = [
  { id: 'today', label: 'Aaj' },
  { id: 'tomorrow', label: 'Kal' },
  { id: 'this_week', label: 'Is hafte' },
  { id: 'range', label: 'Date range' },
];

export const RESCHEDULE_DATE_FILTER = {
  label: 'Delivery date',
  sub: 'Delivery date ke hisaab se filter',
  icon: require('../screens/assets/cal.png'),
  iconTint: '#0D9488',
  tint: '#F0FDFA',
  accent: '#0D9488',
};

export const PRIORITY_FILTER_OPTIONS = [
  { id: 'critical', label: 'Critical', tint: '#FEE2E2', accent: '#7F1D1D', icon: 'alert-decagram' },
  { id: 'high', label: 'High', tint: '#FEE2E2', accent: '#DC2626', icon: 'arrow-up-bold' },
  { id: 'medium', label: 'Medium', tint: '#FFEDD5', accent: '#EA580C', icon: 'minus' },
  { id: 'low', label: 'Low', tint: '#FEF3C7', accent: '#CA8A04', icon: 'arrow-down-bold' },
];

export const EMPTY_ENTITY_FILTERS = {
  farmer: null,
  darkstore: '',
  pincode: '',
  drop: '',
};

export const ENTITY_FILTER_FIELDS = [
  {
    id: 'farmer',
    label: 'Farmer',
    pickLabel: 'Farmer chunein',
    accent: P,
    tint: '#F5F3FF',
    icon: require('../screens/assets/farmer.png'),
    type: 'pick',
  },
  {
    id: 'darkstore',
    label: 'Darkstore',
    placeholder: 'Darkstore ka naam',
    accent: '#0284C7',
    tint: '#F0F9FF',
    icon: require('../screens/assets/shop2.png'),
    iconTint: '#0284C7',
    type: 'text',
  },
  {
    id: 'pincode',
    label: 'Pin Code',
    placeholder: '6 digit PIN daalein',
    accent: '#CA8A04',
    tint: '#FFFBEB',
    icon: require('../screens/assets/pin.png'),
    iconTint: '#CA8A04',
    type: 'pin',
  },
  {
    id: 'drop',
    label: 'Drop',
    placeholder: 'Delivery address',
    accent: '#DC2626',
    tint: '#FEF2F2',
    icon: require('../screens/assets/location.png'),
    iconTint: '#DC2626',
    type: 'text',
  },
];

export const DEFAULT_GROUP_BY = 'priority';
export const MAX_GROUP_LAYERS = 3;

export const SUB_GROUP_NONE = { id: null, label: 'None', sub: 'Sirf primary group dikhayein' };

export const groupFilterById = (id) => GROUP_FILTERS.find((g) => g.id === id);

export const secondaryGroupOptions = (primaryGroupBy) =>
  [SUB_GROUP_NONE, ...GROUP_FILTERS.filter((g) => g.id !== primaryGroupBy)];

export const dedupeGroupStack = (stack) => {
  const out = [];
  (Array.isArray(stack) ? stack : []).forEach((id) => {
    if (!id || id === 'pickup' || out.includes(id)) return;
    out.push(id);
  });
  return out.length ? out : [DEFAULT_GROUP_BY];
};

export const stackFromLegacy = (groupBy, subGroupBy) => {
  const stack = dedupeGroupStack([groupBy || DEFAULT_GROUP_BY, subGroupBy].filter(Boolean));
  return stack;
};

export const optionsForLayer = (stack, layerIndex) =>
  GROUP_FILTERS.filter((g) => !stack.some((id, idx) => idx !== layerIndex && id === g.id));

export const formatGroupStackLabel = (stack) => {
  const levels = dedupeGroupStack(stack);
  return levels
    .map((id) => groupFilterById(id)?.label)
    .filter(Boolean)
    .join(' › ') || 'Priority wise';
};

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

export const isRescheduleDateFilterActive = (filter) => !!filter?.preset;

export const rescheduleCacheSuffix = (filter) => {
  if (!isRescheduleDateFilterActive(filter)) return '';
  if (filter.preset === 'range') return `_rd_${filter.from || ''}_${filter.to || ''}`;
  const resolved = deliveryOnDateFromFilter(filter);
  return resolved ? `_rd_${resolved}` : `_rd_${filter.preset}`;
};

/** API `delivery_on` expects YYYY-MM-DD, not preset ids like today/tomorrow. */
export const deliveryOnDateFromFilter = (filter) => {
  if (!filter?.preset) return '';
  if (filter.preset === 'range') {
    return filter.from ? String(filter.from).trim() : '';
  }
  switch (filter.preset) {
    case 'today':
      return moment().format('YYYY-MM-DD');
    case 'tomorrow':
      return moment().add(1, 'day').format('YYYY-MM-DD');
    case 'this_week':
      return moment().startOf('isoWeek').format('YYYY-MM-DD');
    default:
      return '';
  }
};

export const defaultRescheduleRangeFilter = () => ({
  preset: 'range',
  from: moment().format('YYYY-MM-DD'),
  to: moment().add(6, 'days').format('YYYY-MM-DD'),
});

export const pickReadyCacheSuffix = (pickReadyFilter) =>
  (pickReadyFilter === true ? '_ready' : '');

/** Query/body params for ready-to-pick filter on lmd/home and lmd/orderList. */
export const buildPickReadyApiParams = (pickReadyFilter) => {
  if (pickReadyFilter !== true) return {};
  return { pick_ready: 1 };
};

export const entityFilterTextActive = (value) => String(value ?? '').trim().length > 0;

export const normalizeEntityFilters = (filters) => ({
  farmer: filters?.farmer || null,
  darkstore: String(filters?.darkstore ?? ''),
  pincode: String(filters?.pincode || '').replace(/\D/g, '').slice(0, 6),
  drop: String(filters?.drop ?? ''),
});

export const isEntityFiltersActive = (filters) => {
  const f = normalizeEntityFilters(filters);
  return !!(f.farmer || entityFilterTextActive(f.darkstore) || f.pincode || entityFilterTextActive(f.drop));
};

export const entityFilterCacheSuffix = (filters) => {
  const f = normalizeEntityFilters(filters);
  const parts = [];
  if (f.farmer) {
    const id = f.farmer.id || f.farmer.farmer_id || f.farmer.user_id;
    parts.push(`f${id || f.farmer.name || f.farmer.farmer_name || 'x'}`);
  }
  if (entityFilterTextActive(f.darkstore)) parts.push(`ds${String(f.darkstore).trim()}`);
  if (f.pincode) parts.push(`pin${f.pincode}`);
  if (entityFilterTextActive(f.drop)) parts.push(`dr${String(f.drop).trim()}`);
  if (!parts.length) return '';
  return `_ef_${parts.join('_')}`;
};

export const formatEntityFilterValue = (fieldId, filters) => {
  const f = normalizeEntityFilters(filters);
  switch (fieldId) {
    case 'farmer':
      return String(f.farmer?.name || f.farmer?.farmer_name || '').trim();
    case 'darkstore':
      return String(f.darkstore).trim();
    case 'pincode':
      return f.pincode;
    case 'drop':
      return String(f.drop).trim();
    default:
      return '';
  }
};

/** Query/body params for entity field filters on lmd/home and lmd/orderList. */
export const buildEntityFilterApiParams = (entityFilters) => {
  const f = normalizeEntityFilters(entityFilters);
  const params = {};
  if (f.farmer) {
    const id = f.farmer.id || f.farmer.farmer_id || f.farmer.user_id;
    if (id) params.farmer_id = id;
    else {
      const name = f.farmer.name || f.farmer.farmer_name;
      if (name) params.farmer_name = name;
    }
  }
  if (entityFilterTextActive(f.darkstore)) params.darkstore = String(f.darkstore).trim();
  if (f.pincode) params.pincode = f.pincode;
  if (entityFilterTextActive(f.drop)) params.drop = String(f.drop).trim();
  return params;
};

/** Combined filter params for API requests. */
export const buildFilterApiParams = ({
  pickReadyFilter,
  rescheduleDateFilter,
  priorityFilter,
  entityFilters,
} = {}) => ({
  ...buildPickReadyApiParams(pickReadyFilter),
  ...buildRescheduleDateApiParams(rescheduleDateFilter),
  ...buildPriorityApiParams(priorityFilter),
  ...buildEntityFilterApiParams(entityFilters),
});

/** All grouping + filter params for lmd/home and lmd/orderList. */
export const buildAllOrderApiParams = ({
  groupBy,
  subGroupBy,
  groupStack,
  pickReadyFilter,
  rescheduleDateFilter,
  priorityFilter,
  entityFilters,
} = {}) => ({
  ...buildGroupApiParams(groupBy, subGroupBy, groupStack),
  ...buildFilterApiParams({
    pickReadyFilter,
    rescheduleDateFilter,
    priorityFilter,
    entityFilters,
  }),
});

/** Query/body params for lmd/home and lmd/orderList delivery-on date filters. */
export const buildRescheduleDateApiParams = (filter) => {
  if (!isRescheduleDateFilterActive(filter)) return {};
  if (filter.preset === 'range') {
    const params = {};
    if (filter.from) params.delivery_on = filter.from;
    if (filter.to) params.delivery_on_to = filter.to;
    return params;
  }
  const deliveryOn = deliveryOnDateFromFilter(filter);
  if (!deliveryOn) return {};
  return { delivery_on: deliveryOn };
};

export const isPriorityFilterActive = (filter) => Array.isArray(filter) && filter.length > 0;

export const priorityCacheSuffix = (filter) => {
  if (!isPriorityFilterActive(filter)) return '';
  return `_pri_${[...filter].sort().join('_')}`;
};

/** Query/body params for priority filter on lmd/home and lmd/orderList. */
export const buildPriorityApiParams = (priorityFilter) => {
  if (!isPriorityFilterActive(priorityFilter)) return {};
  return { priority: priorityFilter.join(',') };
};

export const formatPriorityFilterLabel = (priorityFilter) => {
  if (!isPriorityFilterActive(priorityFilter)) return '';
  return priorityFilter
    .map((id) => PRIORITY_FILTER_OPTIONS.find((p) => p.id === id)?.label || id)
    .join(', ');
};

export const appendQueryParams = (baseUrl, params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return baseUrl;
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}${qs}`;
};

export const formatRescheduleDateFilterLabel = (filter) => {
  if (!isRescheduleDateFilterActive(filter)) return '';
  if (filter.preset === 'range') {
    const from = filter.from ? moment(filter.from, 'YYYY-MM-DD').format('DD MMM') : '...';
    const to = filter.to ? moment(filter.to, 'YYYY-MM-DD').format('DD MMM') : '...';
    return `${from} – ${to}`;
  }
  return RESCHEDULE_DATE_PRESETS.find((p) => p.id === filter.preset)?.label || RESCHEDULE_DATE_FILTER.label;
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

export const buildNestedGroupedRows = (orders, primaryGroupBy, secondaryGroupBy = null, groupStack = null) => {
  const levels = groupStack?.length
    ? dedupeGroupStack(groupStack)
    : stackFromLegacy(primaryGroupBy, secondaryGroupBy);

  const buildLevel = (items, depth) => {
    if (depth >= levels.length) {
      return (items || []).map((item) => ({
        type: 'order',
        item,
        key: `o-${item?.id || item?.order_id}`,
      }));
    }
    const groupBy = levels[depth];
    const map = new Map();
    (items || []).forEach((order) => {
      const title = groupKeyFor(order, groupBy);
      if (!map.has(title)) map.set(title, []);
      map.get(title).push(order);
    });
    const rows = [];
    const level = depth === 0 ? 'primary' : depth === 1 ? 'secondary' : 'tertiary';
    [...sortGroupEntries([...map.entries()], groupBy)].forEach(([title, groupItems]) => {
      if (!groupItems.length) return;
      rows.push({
        type: 'header',
        level,
        depth,
        title,
        count: groupItems.length,
        groupBy,
        key: `h-${depth}-${groupBy}-${title}`,
      });
      rows.push(...buildLevel(groupItems, depth + 1));
    });
    return rows;
  };

  return buildLevel(orders, 0);
};

/** Hide nested group header rows when filter chips already summarize grouping. */
export const listRowsWithoutGroupHeaders = (rows, filtersActive) => {
  if (!filtersActive || !Array.isArray(rows)) return rows;
  return rows.filter((r) => r.type !== 'header');
};

export const buildGroupedRows = (orders, groupBy) => buildNestedGroupedRows(orders, groupBy, null);

export const parseOrderListPayload = (rawData, groupBy, { append, prevApiGroups, prevOrders, pickReadyFilter = null, subGroupBy = null, groupStack = null }) => {
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
  const levels = groupStack?.length ? dedupeGroupStack(groupStack) : stackFromLegacy(groupBy, subGroupBy);
  const listRows = buildNestedGroupedRows(orders, levels[0], levels[1], levels);

  return { orders, apiGroups, listRows };
};

export const buildListRows = (rawData, groupBy, pickReadyFilter = null, subGroupBy = null, groupStack = null) => {
  const levels = groupStack?.length ? dedupeGroupStack(groupStack) : stackFromLegacy(groupBy, subGroupBy);
  const parsed = parseOrderListPayload(rawData, levels[0], {
    append: false,
    prevApiGroups: null,
    prevOrders: [],
    pickReadyFilter,
    subGroupBy: levels[1],
    groupStack: levels,
  });
  return parsed.listRows || buildNestedGroupedRows(parsed.orders, levels[0], levels[1], levels);
};

export const buildGroupApiParams = (groupBy, subGroupBy = null, groupStack = null) => {
  const levels = groupStack?.length ? dedupeGroupStack(groupStack) : stackFromLegacy(groupBy, subGroupBy);
  const params = { group_by: apiGroupByParam(levels[0]) };
  if (levels[1]) params.sub_group_by = levels[1];
  if (levels[2]) params.third_group_by = levels[2];
  return params;
};

export const groupCacheSuffix = (groupBy, subGroupBy = null, groupStack = null) => {
  const levels = groupStack?.length ? dedupeGroupStack(groupStack) : stackFromLegacy(groupBy, subGroupBy);
  if (levels.length === 1 && levels[0] === DEFAULT_GROUP_BY) return '';
  return `_${levels.join('_')}`;
};

export const hasActiveFilters = (
  groupBy,
  pickReadyFilter,
  rescheduleDateFilter = null,
  subGroupBy = null,
  groupStack = null,
  priorityFilter = null,
  entityFilters = null,
) => {
  const levels = groupStack?.length ? dedupeGroupStack(groupStack) : stackFromLegacy(groupBy, subGroupBy);
  const groupingActive = levels.length > 1 || levels[0] !== DEFAULT_GROUP_BY;
  return groupingActive
    || pickReadyFilter === true
    || isRescheduleDateFilterActive(rescheduleDateFilter)
    || isPriorityFilterActive(priorityFilter)
    || isEntityFiltersActive(entityFilters);
};

export const formatGroupLabel = (groupBy, subGroupBy = null, groupStack = null) => {
  if (groupStack?.length) return formatGroupStackLabel(groupStack);
  return formatGroupStackLabel(stackFromLegacy(groupBy, subGroupBy));
};

export const formatActiveFilterLabel = (
  groupBy,
  pickReadyFilter,
  rescheduleDateFilter = null,
  subGroupBy = null,
  groupStack = null,
  priorityFilter = null,
  entityFilters = null,
) => {
  const parts = [formatGroupLabel(groupBy, subGroupBy, groupStack)];
  const priorityLabel = formatPriorityFilterLabel(priorityFilter);
  if (priorityLabel) parts.push(priorityLabel);
  if (pickReadyFilter === true) parts.push(PICK_READY_FILTER.label);
  const rescheduleLabel = formatRescheduleDateFilterLabel(rescheduleDateFilter);
  if (rescheduleLabel) parts.push(rescheduleLabel);
  ENTITY_FILTER_FIELDS.forEach((field) => {
    const value = formatEntityFilterValue(field.id, entityFilters);
    if (value) parts.push(`${field.label}: ${value}`);
  });
  return parts.join(' · ');
};

const GROUP_SHORT = {
  farmer: 'Farmer',
  darkstore: 'Darkstore',
  drop: 'Drop',
  pincode: 'Pin Code',
  priority: 'Priority',
};

/** Compact group path + filter chips for dashboard / track orders. */
export const buildActiveFilterSummary = (
  groupBy,
  pickReadyFilter,
  rescheduleDateFilter = null,
  subGroupBy = null,
  groupStack = null,
  priorityFilter = null,
  entityFilters = null,
) => {
  const levels = groupStack?.length ? dedupeGroupStack(groupStack) : stackFromLegacy(groupBy, subGroupBy);
  const groupingActive = levels.length > 1 || levels[0] !== DEFAULT_GROUP_BY;
  const groupPath = groupingActive
    ? levels
      .map((id) => GROUP_SHORT[id] || groupFilterById(id)?.label?.replace(' wise', '') || id)
      .join(' › ')
    : null;

  const chips = [];
  (priorityFilter || []).forEach((id) => {
    const opt = PRIORITY_FILTER_OPTIONS.find((p) => p.id === id);
    if (!opt) return;
    chips.push({
      id: `priority-${id}`,
      label: opt.label,
      tint: opt.tint,
      accent: opt.accent,
      icon: opt.icon,
    });
  });
  if (pickReadyFilter === true) {
    chips.push({
      id: 'pick-ready',
      label: PICK_READY_FILTER.label,
      tint: PICK_READY_FILTER.tint,
      accent: PICK_READY_FILTER.accent,
      imageIcon: PICK_READY_FILTER.icon,
      iconTint: PICK_READY_FILTER.iconTint,
    });
  }
  const dateLabel = formatRescheduleDateFilterLabel(rescheduleDateFilter);
  if (dateLabel) {
    chips.push({
      id: 'delivery-date',
      label: dateLabel,
      tint: RESCHEDULE_DATE_FILTER.tint,
      accent: RESCHEDULE_DATE_FILTER.accent,
      imageIcon: RESCHEDULE_DATE_FILTER.icon,
      iconTint: RESCHEDULE_DATE_FILTER.iconTint,
    });
  }
  ENTITY_FILTER_FIELDS.forEach((field) => {
    const value = formatEntityFilterValue(field.id, entityFilters);
    if (!value) return;
    chips.push({
      id: `entity-${field.id}`,
      label: `${field.label}: ${value}`,
      tint: field.tint,
      accent: field.accent,
      imageIcon: field.icon,
      iconTint: field.iconTint,
    });
  });

  return { groupPath, chips };
};

export const apiGroupByParam = (groupBy) => groupBy || DEFAULT_GROUP_BY;

export const homescreenUrl = (baseUrl, {
  groupBy,
  subGroupBy,
  groupStack,
  rescheduleDateFilter,
  pickReadyFilter,
  priorityFilter,
  entityFilters,
} = {}) => appendQueryParams(baseUrl, buildAllOrderApiParams({
  groupBy,
  subGroupBy,
  groupStack,
  pickReadyFilter,
  rescheduleDateFilter,
  priorityFilter,
  entityFilters,
}));

export const buildOrderListBody = ({
  status = '',
  page = 1,
  limit = 20,
  groupBy,
  subGroupBy = null,
  groupStack = null,
  search = '',
  rescheduleDateFilter = null,
  pickReadyFilter = null,
  priorityFilter = null,
  entityFilters = null,
} = {}) => ({
  status,
  page,
  limit,
  search,
  ...buildAllOrderApiParams({
    groupBy,
    subGroupBy,
    groupStack,
    pickReadyFilter,
    rescheduleDateFilter,
    priorityFilter,
    entityFilters,
  }),
});
