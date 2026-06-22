import React, { Component } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  StatusBar, Image, Animated, RefreshControl, Linking, Alert, ActivityIndicator,
  LayoutAnimation, Platform, UIManager, Easing, Pressable, Dimensions,
} from 'react-native';

// Fade + slide-up wrapper so paged-in rows animate when they appear.
class FadeInItem extends React.PureComponent {
  constructor(props) {
    super(props);
    this.opacity = new Animated.Value(0);
    this.translateY = new Animated.Value(14);
  }
  componentDidMount() {
    const delay = Math.min((this.props.delay || 0) * 40, 180);
    Animated.parallel([
      Animated.timing(this.opacity, { toValue: 1, duration: 260, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(this.translateY, { toValue: 0, friction: 8, tension: 65, delay, useNativeDriver: true }),
    ]).start();
  }
  render() {
    return (
      <Animated.View style={{ opacity: this.opacity, transform: [{ translateY: this.translateY }] }}>
        {this.props.children}
      </Animated.View>
    );
  }
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SWAP_ANIM = {
  duration: 240,
  create: { type: 'easeInEaseOut', property: 'opacity' },
  update: { type: 'easeInEaseOut' },
  delete: { type: 'easeInEaseOut', property: 'opacity' },
};
import { SafeAreaView, SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { overlayBottomPadding, screenFooterPadding } from '../utils/safeAreaInsets';
import Clipboard from '@react-native-clipboard/clipboard';
import constants from '../utils/constants';
import ShimmerLoader from '../components/ShimmerLoader';
import Toast from 'react-native-simple-toast';
import BottomSheet from '../components/BottomSheet';
import { NavigationEvents, withV4Navigation } from '../utils/v4Compat';
import { get as cacheGet, set as cacheSet, has as cacheHas, subscribe as cacheSubscribe, KEYS, invalidateOrderRelated } from '../utils/dataCache';
import LiveOrdersGrid from '../components/LiveOrdersGrid';
import { STATUS, STATUS_SEQUENCE, getStatus, getPriority } from '../utils/statusColors';
import { preloadImages } from '../components/CachedImage';

// Best-effort: walk an order tree and yank any http(s) image URLs we'd render.
const extractImageUrls = (orders) => {
  const urls = new Set();
  (Array.isArray(orders) ? orders : []).forEach((o) => {
    if (typeof o?.farmer_data?.image === 'string') urls.add(o.farmer_data.image);
    if (typeof o?.farmer?.image === 'string') urls.add(o.farmer.image);
    if (Array.isArray(o?.order_items)) {
      o.order_items.forEach((it) => { if (typeof it?.image === 'string') urls.add(it.image); });
    }
  });
  return Array.from(urls).filter((u) => /^https?:\/\//i.test(u));
};

const P = '#5D3FD3';
const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

const STATUSES = STATUS_SEQUENCE;

const isApiGroupedData = (raw) =>
  Array.isArray(raw) && raw.length > 0 && Array.isArray(raw[0]?.data);

const flattenFromApiGroups = (raw) => {
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

const mergeApiGroups = (prev, next) => {
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

const buildRowsFromApiGroups = (groups, groupBy) => {
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

const parseOrderListPayload = (rawData, groupBy, { append, prevApiGroups, prevOrders }) => {
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

const GROUP_FILTERS = [
  { id: 'farmer', label: 'Farmer wise', sub: 'Farmer ke naam se group karein', icon: require('./assets/farmer.png'), tint: '#EDE9FE', accent: P },
  { id: 'darkstore', label: 'Darkstore wise', sub: 'Darkstore ke naam se group karein', icon: require('./assets/shop2.png'), iconTint: '#0284C7', tint: '#E0F2FE', accent: '#0284C7' },
  { id: 'pickup', label: 'Pickup wise', sub: 'Pickup location se group karein', icon: require('./assets/gps.png'), iconTint: '#16A34A', tint: '#DCFCE7', accent: '#16A34A' },
  { id: 'drop', label: 'Drop wise', sub: 'Delivery address se group karein', icon: require('./assets/location.png'), iconTint: '#DC2626', tint: '#FEE2E2', accent: '#DC2626' },
  { id: 'pincode', label: 'Pin Code wise', sub: 'PIN code se group karein', icon: require('./assets/pin.png'), iconTint: '#CA8A04', tint: '#FEF9C3', accent: '#CA8A04' },
  { id: 'priority', label: 'Priority wise', sub: 'Priority ke hisaab se group karein', icon: require('./assets/star.png'), iconTint: '#DC2626', tint: '#FEE2E2', accent: '#DC2626' },
];

const DEFAULT_GROUP_BY = 'priority';

const FILTER_ROW_H = 68;

const extractPincode = (address) => {
  const m = String(address || '').match(/\b(\d{6})\b(?!.*\d{6})/);
  return m ? m[1] : '';
};

const normalizeSearchText = (v) => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

const isPendingOrder = (item) => getStatus(item?.status).key === 'PENDING';

const PRIORITY_GROUP_ORDER = { High: 0, Medium: 1, Low: 2 };

const groupKeyFor = (order, groupBy) => {
  switch (groupBy) {
    case 'farmer':
      return String(order?.farmer_name || 'Unknown farmer').trim() || 'Unknown farmer';
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

const buildGroupedRows = (orders, groupBy) => {
  if (!groupBy) return (orders || []).map((item) => ({ type: 'order', item, key: `o-${item?.id || item?.order_id}` }));
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

const SAFE_BOTTOM = overlayBottomPadding();
const SHEET_ACTIONS_BOTTOM = SAFE_BOTTOM + screenFooterPadding() + 12;

const filterSheetMaxHeight = (hasActive) => {
  const listH = GROUP_FILTERS.length * FILTER_ROW_H;
  const total = 108 + listH + (hasActive ? 42 : 0) + 88 + SHEET_ACTIONS_BOTTOM;
  return Math.min(total, Math.round(Dimensions.get('window').height * 0.82));
};

class TrackOrders extends Component {
  constructor(props) {
    super(props);
    const init = this.props?.navigation?.getParam('selectedStatus', 'ALL');
    const selected = STATUSES.includes(init) ? init : 'ALL';
    const cacheKey = `${KEYS.ORDERS}_${selected}_${DEFAULT_GROUP_BY}_`;
    const cached = cacheGet(cacheKey);
    this.state = {
      loading: !cached,
      refreshing: false,
      loadingMore: false,
      query: '',
      searchLoading: false,
      selected,
      orders: cached?.orders || [],
      live: cached?.live || {},
      listRows: cached?.listRows || null,
      apiGroups: null,
      totalCount: cached?.totalCount ?? cached?.orders?.length ?? 0,
      selectedIds: new Set(),
      batchSubmitting: false,
      generatingOtp: false,
      page: 1,
      totalPages: 1,
      hasMore: false,
      groupBy: DEFAULT_GROUP_BY,
      filterDraft: DEFAULT_GROUP_BY,
      showFilterSheet: false,
    };
    this.fetchSeq = 0;
    this._searchTimer = null;
    this._skipNextFocusReload = true;
    this.filterSheetRef = null;
    this.anims = [0,1,2].map(() => ({ o: new Animated.Value(1), y: new Animated.Value(0) }));
    this.ctaArrowX = new Animated.Value(0);
    this._ctaArrowLoop = null;
  }

  // Arrow animation intentionally disabled per design — static circle is calmer.
  startCtaArrowLoop = () => {};
  stopCtaArrowLoop = () => {};

  copyOrderId = (orderId) => {
    if (!orderId) return;
    try {
      Clipboard.setString(String(orderId));
      Toast.show(`Copied #${orderId}`, Toast.SHORT);
    } catch (e) {
      Toast.show('Could not copy', Toast.SHORT);
    }
  };

  cacheKeyFor = (selected, groupBy, query) =>
    `${KEYS.ORDERS}_${selected}_${groupBy || ''}_${normalizeSearchText(query || '')}`;

  cacheKey = () => this.cacheKeyFor(this.state.selected, this.state.groupBy, this.state.query);

  resubscribeCache = () => {
    if (this.unsubscribe) this.unsubscribe();
    const key = this.cacheKey();
    this.unsubscribe = cacheSubscribe(key, (v) => {
      if (!v) return;
      LayoutAnimation.configureNext(SWAP_ANIM);
      this.setState({
        orders: v.orders || [],
        live: v.live || {},
        listRows: v.listRows ?? null,
        totalCount: v.totalCount ?? v.orders?.length ?? 0,
      });
    });
  };

  reloadOrders = () => {
    this.setState({ page: 1, hasMore: false, selectedIds: new Set(), apiGroups: null }, () => {
      this.resubscribeCache();
      this.load(true, { page: 1, append: false });
    });
  };
  componentDidMount() {
    this.resubscribeCache();
    this.load(cacheHas(this.cacheKey()));
  }

  componentWillUnmount() {
    if (this.unsubscribe) this.unsubscribe();
    if (this._searchTimer) clearTimeout(this._searchTimer);
  }

  animateIn = () => {};

  load = (silent = false, opts = {}) => {
    const { page = 1, append = false } = opts;
    const requestedQuery = normalizeSearchText(this.state.query);
    const isSearchFetch = !!requestedQuery && !append;
    const loadFlags = {};
    if (!silent && !this.state.refreshing && !append) loadFlags.loading = true;
    if (isSearchFetch) loadFlags.searchLoading = true;
    if (Object.keys(loadFlags).length) this.setState(loadFlags);
    // Snapshot the tab the request was issued for, so a stale response can't
    // overwrite the rows of a tab the user has since switched away from.
    const requestedFor = this.state.selected;
    const requestedGroup = this.state.groupBy || '';
    const seq = ++this.fetchSeq;
    const body = {
      status: requestedFor === 'ALL' ? '' : requestedFor.toLowerCase(),
      page,
      limit: 20,
      group_by: requestedGroup,
      search: requestedQuery,
    };
    fetch(constants.orderList, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + global.token, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(j => {
        if (seq !== this.fetchSeq) return;
        const rawData = j?.status ? j.data : [];
        const parsed = parseOrderListPayload(rawData, requestedGroup, {
          append,
          prevApiGroups: this.state.apiGroups,
          prevOrders: this.state.orders,
        });
        const live = j?.live || this.state.live;
        const pg = j?.pagination || j?.meta || {};
        const currentPage = Math.max(1, Number(pg?.currentPage || pg?.page || page) || page);
        const totalPages = Math.max(1, Number(pg?.totalPages || pg?.total_pages || 1) || 1);
        const hasMore = typeof pg?.hasNextPage === 'boolean'
          ? pg.hasNextPage
          : currentPage < totalPages;
        const totalCount = Number(pg?.total ?? j?.meta?.total ?? parsed.orders.length) || parsed.orders.length;

        cacheSet(this.cacheKeyFor(requestedFor, requestedGroup, requestedQuery), {
          orders: parsed.orders,
          live,
          listRows: parsed.listRows,
          totalCount,
        });
        preloadImages(extractImageUrls(parsed.orders));
        const doneFlags = { loading: false, refreshing: false, loadingMore: false, searchLoading: false };
        const canApply = this.state.selected === requestedFor
          && (this.state.groupBy || '') === requestedGroup
          && normalizeSearchText(this.state.query) === requestedQuery;
        if (!canApply) {
          this.setState(doneFlags);
          return;
        }
        LayoutAnimation.configureNext(SWAP_ANIM);
        this.setState({
          ...doneFlags,
          orders: parsed.orders,
          apiGroups: parsed.apiGroups,
          listRows: parsed.listRows,
          totalCount,
          live,
          page: currentPage,
          totalPages,
          hasMore,
        });
      })
      .catch(() => {
        if (seq !== this.fetchSeq) return;
        this.setState({ loading: false, refreshing: false, loadingMore: false, searchLoading: false });
      });
  };

  refresh = () => {
    this.setState({ refreshing: true, page: 1, hasMore: false }, () => this.load(true, { page: 1, append: false }));
  };

  handleEndReached = () => {
    const { loadingMore, hasMore, loading, refreshing, page } = this.state;
    if (loadingMore || !hasMore || loading || refreshing) return;
    this.setState({ loadingMore: true }, () =>
      this.load(true, { page: page + 1, append: true })
    );
  };

  pick = (s) => {
    if (s === this.state.selected) return;
    if (this.unsubscribe) this.unsubscribe();
    const newKey = this.cacheKeyFor(s, this.state.groupBy, this.state.query);
    const cached = cacheGet(newKey);

    // Keep the FlatList mounted (no shimmer swap) and animate the row replacement
    // via LayoutAnimation so tab switches feel like a list refresh, not a flicker.
    LayoutAnimation.configureNext(SWAP_ANIM);
    this.setState({
      selected: s,
      selectedIds: new Set(), // clear multi-select when switching tabs
      // Show cached rows instantly when we have them, otherwise keep the previous
      // tab's rows visible until the silent fetch resolves.
      orders: cached?.orders || this.state.orders,
      live: cached?.live || this.state.live,
      listRows: cached?.listRows ?? null,
      totalCount: cached?.totalCount ?? cached?.orders?.length ?? 0,
      apiGroups: null,
      page: 1,
      hasMore: false,
    }, () => {
      this.unsubscribe = cacheSubscribe(newKey, (v) => {
        if (!v) return;
        LayoutAnimation.configureNext(SWAP_ANIM);
        this.setState({
          orders: v.orders || [],
          live: v.live || {},
          listRows: v.listRows ?? null,
          totalCount: v.totalCount ?? v.orders?.length ?? 0,
        });
      });
      this.load(true, { page: 1, append: false }); // silent — never flips back to ShimmerLoader
    });
  };

  // -------- Multi-select (pending orders — any tab) --------
  getOrderKey = (item) => String(item?.id || item?.order_id || '');

  toggleSelect = (key) => {
    if (!key) return;
    const next = new Set(this.state.selectedIds);
    if (next.has(key)) next.delete(key); else next.add(key);
    this.setState({ selectedIds: next });
  };

  clearSelection = () => this.setState({ selectedIds: new Set() });

  selectAllPending = () => {
    const next = new Set();
    (this.state.orders || []).forEach(o => {
      const k = this.getOrderKey(o);
      if (k) next.add(k);
    });
    this.setState({ selectedIds: next });
  };

  // Call bulk-pickup-generate-otp, then navigate to the full-screen OTP entry.
  // The OTP screen calls back via onDone so we can clear selection + reload.
  openGenerateOtp = () => {
    if (this.state.generatingOtp) return;
    const keys = Array.from(this.state.selectedIds);
    if (!keys.length) return;
    const idMap = {};
    (this.state.orders || []).forEach(o => {
      idMap[this.getOrderKey(o)] = o?.id;
    });
    const orderMap = {};
    (this.state.orders || []).forEach(o => {
      orderMap[this.getOrderKey(o)] = o;
    });
    const orderIds = keys.map(k => idMap[k]).filter(Boolean);
    const selectedOrders = keys.map(k => orderMap[k]).filter(Boolean);
    if (!orderIds.length) {
      Toast.show('No valid orders selected', Toast.SHORT);
      return;
    }

    this.setState({ generatingOtp: true });
    fetch(constants.bulkPickupGenerateOtp, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + global.token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ orderIds }),
    })
      .then(r => r.json())
      .then(json => {
        this.setState({ generatingOtp: false });
        if (json?.status || json?.success) {
          if (json?.message) Toast.show(String(json.message), Toast.SHORT);
          this.props.navigation.navigate('BatchPickupOtp', {
            orderIds,
            orders: selectedOrders,
            count: orderIds.length,
            onDone: () => {
              this.setState({ selectedIds: new Set() });
              invalidateOrderRelated();
              this.load(true);
            },
          });
        } else {
          Toast.show(json?.message || 'Failed to generate OTP', Toast.SHORT);
        }
      })
      .catch(() => {
        this.setState({ generatingOtp: false });
        Toast.show('Something went wrong', Toast.SHORT);
      });
  };
  n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  mask = (p) => { if (!p) return ''; const s = String(p); if (s.length < 6) return s; return s.slice(0,2) + '****' + s.slice(-2); };
  dial = async (p) => {
    if (!p) return;
    const url = `tel:${String(p).replace(/\s+/g, '')}`;
    const can = await Linking.canOpenURL(url);
    if (can) { Linking.openURL(url); } else { Alert.alert('Call', `${p}`); }
  };
  wa = async (p) => {
    if (!p) return;
    const c = String(p).replace(/[^\d]/g, '');
    try {
      const can = await Linking.canOpenURL(`whatsapp://send?phone=${c}`);
      if (can) { await Linking.openURL(`whatsapp://send?phone=${c}`); return; }
    } catch (e) {}
    Linking.openURL(`https://wa.me/${c}`).catch(() => Alert.alert('WhatsApp', `${p}`));
  };

  badge = (s) => {
    const st = getStatus(s);
    return { bg: st.bg };
  };

  onQueryChange = (text) => {
    const hasQuery = !!normalizeSearchText(text);
    this.setState({ query: text, searchLoading: hasQuery });
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.reloadOrders(), 400);
  };

  clearQuery = () => {
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this.setState({ query: '', searchLoading: false }, () => this.reloadOrders());
  };

  openFilterSheet = () => {
    this.setState({
      showFilterSheet: true,
      filterDraft: this.state.groupBy || DEFAULT_GROUP_BY,
    });
  };

  closeFilterSheet = () => {
    this.filterSheetRef?.close?.();
  };

  onFilterSheetClosed = () => {
    this.setState({ showFilterSheet: false });
  };

  selectFilterDraft = (id) => {
    this.setState({ filterDraft: this.state.filterDraft === id ? null : id });
  };

  applyFilters = () => {
    LayoutAnimation.configureNext(SWAP_ANIM);
    this.setState({ groupBy: this.state.filterDraft }, () => {
      this.closeFilterSheet();
      this.reloadOrders();
    });
  };

  clearFilters = () => {
    LayoutAnimation.configureNext(SWAP_ANIM);
    this.setState({ groupBy: null, filterDraft: null }, () => {
      this.closeFilterSheet();
      this.reloadOrders();
    });
  };

  groupedRows = () => {
    if (this.state.listRows) return this.state.listRows;
    return buildGroupedRows(this.state.orders, this.state.groupBy);
  };

  filteredOrderCount = () => this.state.totalCount || this.state.orders.length;

  renderPriorityBadge = (priority) => {
    const pri = getPriority(priority);
    return (
      <View style={[s.chip, s.priorityChip, { backgroundColor: pri.bg }]}>
        <Text style={s.chipT}>{pri.label}</Text>
      </View>
    );
  };

  renderGroupHeader = (title, count, groupBy) => {
    const isPriority = groupBy === 'priority';
    const pri = isPriority ? getPriority(title) : null;
    return (
      <View style={[
        s.groupHdr,
        isPriority && { backgroundColor: pri.tint, borderLeftColor: pri.bg },
      ]}>
        <View style={[s.groupHdrDot, isPriority && { backgroundColor: pri.bg }]} />
        <Text style={[s.groupHdrT, isPriority && { color: pri.accent }]} numberOfLines={2}>{title}</Text>
        <View style={[s.groupHdrCount, isPriority && { backgroundColor: pri.bg }]}>
          <Text style={s.groupHdrCountT}>{count}</Text>
        </View>
      </View>
    );
  };

  renderFilterSheet = () => {
    const { showFilterSheet, filterDraft, groupBy } = this.state;
    if (!showFilterSheet) return null;
    const activeOpt = GROUP_FILTERS.find((g) => g.id === groupBy);
    const sheetMax = filterSheetMaxHeight(!!groupBy);

    return (
      <BottomSheet
        ref={(r) => { this.filterSheetRef = r; }}
        visible
        dynamicSize
        maxDynamicContentSize={sheetMax}
        onSheetClose={this.onFilterSheetClosed}
      >
        <View style={s.fsRoot}>
          <View style={s.fsBanner}>
            <View style={s.fsBannerGlow} />
            <View style={s.fsBannerRow}>
              <View style={s.fsBannerIco}>
                <Image source={require('./assets/sort.png')} style={s.fsBannerIcoImg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fsBannerTitle}>Group Orders</Text>
                <Text style={s.fsBannerSub}>List ko organize karne ka tareeka chunein</Text>
              </View>
              <TouchableOpacity onPress={this.closeFilterSheet} style={s.fsBannerClose} hitSlop={HIT}>
                <Image source={require('./assets/cross.png')} style={s.fsBannerCloseIco} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.fsList}>
            {GROUP_FILTERS.map((opt, idx) => {
              const on = filterDraft === opt.id;
              const last = idx === GROUP_FILTERS.length - 1;
              return (
                <TouchableOpacity
                  key={opt.id}
                  activeOpacity={0.82}
                  style={[s.fsRow, on && s.fsRowOn, last && s.fsRowLast]}
                  onPress={() => this.selectFilterDraft(opt.id)}
                >
                  {on ? <View style={[s.fsRowBar, { backgroundColor: opt.accent }]} /> : null}
                  <View style={[
                    s.fsRowIco,
                    { borderColor: on ? opt.accent : `${opt.accent}40`, backgroundColor: on ? opt.tint : '#FFF' },
                  ]}>
                    <Image
                      source={opt.icon}
                      style={[s.fsRowIcoImg, opt.iconTint ? { tintColor: opt.iconTint } : null]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.fsRowT, on && { color: opt.accent }]}>{opt.label}</Text>
                    <Text style={s.fsRowS}>{opt.sub}</Text>
                  </View>
                  <View style={[s.fsRadio, on && { borderColor: opt.accent, backgroundColor: opt.tint }]}>
                    {on ? <View style={[s.fsRadioDot, { backgroundColor: opt.accent }]} /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {!!groupBy && activeOpt ? (
            <View style={s.fsActivePill}>
              <View style={[s.fsActiveDot, { backgroundColor: activeOpt.accent }]} />
              <Text style={s.fsActiveTxt} numberOfLines={1}>
                Abhi active: <Text style={{ fontWeight: '800', color: activeOpt.accent }}>{activeOpt.label}</Text>
              </Text>
            </View>
          ) : null}

          <View style={[s.fsActions, { paddingBottom: SHEET_ACTIONS_BOTTOM }]}>
            <TouchableOpacity
              style={[s.fsResetBtn, (!filterDraft && !groupBy) && s.fsResetBtnOff]}
              activeOpacity={0.85}
              onPress={this.clearFilters}
              disabled={!filterDraft && !groupBy}
            >
              <Text style={[s.fsResetT, (!filterDraft && !groupBy) && { opacity: 0.45 }]}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.fsDoneBtn} activeOpacity={0.88} onPress={this.applyFilters}>
              <Text style={s.fsDoneT}>Apply</Text>
              <View style={s.fsDoneArrow}>
                <Image source={require('./assets/arrow.png')} style={s.fsDoneArrowIco} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>
    );
  };

  renderItem = ({ item: row, index }) => {
    if (row.type === 'header') {
      return this.renderGroupHeader(row.title, row.count, this.state.groupBy);
    }
    const inner = this.renderOrderCard({ item: row.item, index });
    return <FadeInItem delay={index < 6 ? index : 0}>{inner}</FadeInItem>;
  };

  renderFooter = () => {
    if (!this.state.loadingMore) return null;
    return (
      <View style={s.footerLoader}>
        <ActivityIndicator size="small" color={P} />
        <Text style={s.footerLoaderT}>Loading more...</Text>
      </View>
    );
  };

  renderOrderCard = ({ item }) => {
    const st = (item?.status || '').toUpperCase();
    const b = this.badge(st);
    const ds = item?.dark_store;
    const statusLabel = getStatus(st).label;

    const canSelect = isPendingOrder(item);
    const orderKey = this.getOrderKey(item);
    const isChecked = this.state.selectedIds.has(orderKey);
    const goToDetails = () => this.props.navigation.navigate('DeliveryDetails', { order: item });

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={goToDetails}
        onLongPress={canSelect ? () => this.toggleSelect(orderKey) : undefined}
        delayLongPress={250}
        style={[s.dlv, isChecked && s.dlvSelected]}
      >
        {/* Light-grey header (order id + status + farmer) */}
        <View style={[s.dlvTop, isChecked && s.dlvTopSelected]}>
          <View style={s.dlvHead}>
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => this.copyOrderId(item?.order_id)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              style={s.oidWrap}
            >
              <Text style={s.dlvOid}>#{item?.order_id}</Text>
              <Text style={s.oidCopy}>⎘</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            {this.renderPriorityBadge(item?.priority)}
            <View style={[s.chip, { backgroundColor: b.bg, marginLeft: 6 }]}>
              <Text style={s.chipT}>{statusLabel}</Text>
            </View>
          </View>

          <View style={s.dlvPerson}>
            <Image source={require('./assets/farmer.png')} style={s.dlvAvt} />
            <View style={{ flex: 1 }}>
              <Text style={s.dlvName}>{item?.farmer_name || '-'}</Text>
              <Text style={s.dlvPhone}>{this.mask(item?.farmer_mobile)}</Text>
            </View>
            <TouchableOpacity onPress={() => this.dial(item?.farmer_mobile)} activeOpacity={0.7} style={s.actBtn}>
              <Image source={require('./assets/call.png')} style={s.actIco} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => this.wa(item?.farmer_mobile)} activeOpacity={0.7} style={[s.actBtn, { marginLeft: 6 }]}>
              <Image source={require('./assets/whatsapp.png')} style={s.actIco} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Route */}
        <View style={s.routeWrap}>
          <View style={s.routeRow}>
            <View style={s.routeTl}><View style={[s.dot, { backgroundColor: '#0DA60D' }]} /><View style={s.routeLine} /></View>
            <View style={s.routeBody}>
              <Text style={[s.routeLbl, { color: '#0DA60D' }]}>PICKUP</Text>
              <Text style={s.routeTitle}>{ds?.name || '-'}</Text>
              {ds?.mobile ? <Text style={s.routePhone}>{ds.mobile}</Text> : null}
              <Text style={s.routeAddr} numberOfLines={2}>{ds?.location || `${ds?.city || ''}${ds?.pincode ? `, ${ds.pincode}` : ''}`}</Text>
            </View>
            {ds?.mobile ? (
              <TouchableOpacity onPress={() => this.dial(ds.mobile)} activeOpacity={0.7} style={s.dsCall}>
                <Image source={require('./assets/call.png')} style={s.dsCallIco} />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={s.routeRow}>
            <View style={s.routeTl}><View style={[s.dot, { backgroundColor: '#EF4444' }]} /></View>
            <View style={[s.routeBody, { paddingBottom: 0 }]}>
              <Text style={[s.routeLbl, { color: '#EF4444' }]}>DROP</Text>
              <Text style={s.routeAddr} numberOfLines={2}>{item?.shipping_address || '-'}</Text>
            </View>
          </View>
        </View>

        {/* Footer — the ENTIRE white bottom row is the tap-to-select target
            when we're on the Pending tab. Pills and amount Text are
            non-interactive Views, so the Pressable receives every tap inside
            the row and toggles selection. The visible checkbox on the left
            is just a status indicator (pointerEvents="none"). The inner
            Pressable wins the responder over the parent card's onPress so
            navigation never accidentally fires from here. */}
        {canSelect ? (
          <Pressable
            onPress={() => this.toggleSelect(orderKey)}
            hitSlop={{ top: 12, bottom: 8, left: 12, right: 12 }}
            style={({ pressed }) => [s.dlvFoot, pressed && { backgroundColor: '#EEF2FF' }]}
          >
            {/* Dedicated inner Pressable around the visible checkbox with a
                very generous hitSlop — extends UP into the route area (60 px),
                DOWN past the footer (32 px) and 60 px out to either side. So
                the actual tap region is roughly 146 × 118 around the small
                26 × 26 chip on the left of the footer. */}
            <Pressable
              onPress={() => this.toggleSelect(orderKey)}
              hitSlop={{ top: 60, bottom: 32, left: 60, right: 60 }}
              style={({ pressed }) => [{ marginRight: 10 }, pressed && { opacity: 0.65 }]}
            >
              <View style={[s.checkBoxFoot, isChecked && s.checkBoxOn]} pointerEvents="none">
                {isChecked ? <Text style={s.checkTick}>✓</Text> : null}
              </View>
            </Pressable>
            <View style={[s.pill, { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' }]}>
              <Text style={[s.pillT, { color: '#475569' }]}>{(item?.payment_mode || '-').toUpperCase()}</Text>
            </View>
            <View style={[s.pill, { backgroundColor: item?.payment_status === 'paid' ? '#DCFCE7' : '#FEF3C7', borderWidth: 1, borderColor: item?.payment_status === 'paid' ? '#86EFAC' : '#FCD34D' }]}>
              <Text style={[s.pillT, { color: item?.payment_status === 'paid' ? '#15803D' : '#B45309' }]}>{item?.payment_status === 'paid' ? 'PAID' : 'UNPAID'}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text style={s.dlvAmt}>₹{this.n(item?.amount)}</Text>
          </Pressable>
        ) : (
          <View style={s.dlvFoot}>
            <View style={[s.pill, { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' }]}>
              <Text style={[s.pillT, { color: '#475569' }]}>{(item?.payment_mode || '-').toUpperCase()}</Text>
            </View>
            <View style={[s.pill, { backgroundColor: item?.payment_status === 'paid' ? '#DCFCE7' : '#FEF3C7', borderWidth: 1, borderColor: item?.payment_status === 'paid' ? '#86EFAC' : '#FCD34D' }]}>
              <Text style={[s.pillT, { color: item?.payment_status === 'paid' ? '#15803D' : '#B45309' }]}>{item?.payment_status === 'paid' ? 'PAID' : 'UNPAID'}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text style={s.dlvAmt}>₹{this.n(item?.amount)}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  a = (i) => ({ opacity: this.anims[Math.min(i,2)].o, transform: [{ translateY: this.anims[Math.min(i,2)].y }] });

  render() {
    const { loading, refreshing, query, searchLoading, selected, live, selectedIds, groupBy } = this.state;
    const rows = this.groupedRows();
    const orderCount = this.filteredOrderCount();
    const selectedCount = selectedIds.size;
    const pendingInView = (this.state.orders || []).filter(isPendingOrder).length;
    const showCta = selectedCount > 0;
    const showSelectHint = pendingInView > 0;
    const activeFilter = GROUP_FILTERS.find((g) => g.id === groupBy);

    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={P} />
        <NavigationEvents onWillFocus={() => {}} onDidFocus={() => {
          if (this._skipNextFocusReload) {
            this._skipNextFocusReload = false;
            return;
          }
          this.reloadOrders();
        }} />

        <View style={s.hdr}>
          <SafeAreaView edges={['top']}>
            <View style={s.hdrRow}>
              <TouchableOpacity onPress={() => this.props.navigation.goBack()} style={s.hdrBtn} activeOpacity={0.7} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
                <Image source={require('./assets/back.png')} style={s.hdrIco} />
              </TouchableOpacity>
              <View style={s.searchBar}>
                <Image source={require('./assets/search.png')} style={s.searchBarIco} />
                <TextInput
                  value={query}
                  onChangeText={this.onQueryChange}
                  placeholder="Orders dhoondein..."
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  style={s.searchBarInput}
                  returnKeyType="search"
                  onSubmitEditing={() => {
                    if (this._searchTimer) clearTimeout(this._searchTimer);
                    this.reloadOrders();
                  }}
                />
                {searchLoading ? (
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.9)" style={s.searchBarLoader} />
                ) : query.length > 0 ? (
                  <TouchableOpacity onPress={this.clearQuery} activeOpacity={0.7} style={s.clearIco}>
                    <Image source={require('./assets/cross.png')} style={s.clearIcoImg} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity onPress={this.openFilterSheet} activeOpacity={0.85} style={[s.filterBtn, !!groupBy && s.filterBtnOn]}>
                <Image source={require('./assets/filter.png')} style={s.filterBtnIco} />
                {!!groupBy && <View style={s.filterDot} />}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>

        <View style={{ flex: 1, backgroundColor: '#E8ECF4' }}>
          {loading && !refreshing ? <ShimmerLoader /> : (
            <FlatList
              data={rows}
              extraData={`${selected}-${selectedCount}-${groupBy}-${query}`}
              keyExtractor={(row) => row.key || `${selected}-${row?.item?.id || row?.item?.order_id}`}
              renderItem={this.renderItem}
              contentContainerStyle={[s.scroll, showCta && { paddingBottom: 120 }]}
              showsVerticalScrollIndicator={false}
              onEndReached={this.handleEndReached}
              onEndReachedThreshold={0.4}
              ListFooterComponent={this.renderFooter}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={this.refresh} tintColor={P} colors={[P]} />}
              ListHeaderComponent={
                <View>
                  {/* Stats */}
                  <Animated.View style={[s.card, this.a(0)]}>
                    <Text style={s.cardTitle}>Live Orders</Text>
                    <LiveOrdersGrid live={live} selected={selected} onPress={this.pick} />
                  </Animated.View>

                  <Animated.View style={[this.a(1), s.secRow]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.secTitle}>{selected === 'ALL' ? 'All Orders' : getStatus(selected).label} ({orderCount})</Text>
                      {!!activeFilter && (
                        <Text style={s.secFilterNote} numberOfLines={1}>Grouped: {activeFilter.label}</Text>
                      )}
                    </View>
                    {selectedCount > 0 && (
                      <View style={s.selCountChip}>
                        <Text style={s.selCountChipT}>{selectedCount} order{selectedCount > 1 ? 's' : ''} selected</Text>
                      </View>
                    )}
                  </Animated.View>

                  {showSelectHint && (
                    <View style={s.selHint}>
                      <Text style={s.selHintIco}>☑</Text>
                      <Text style={s.selHintT}>Batch pickup ke liye checkbox tap karein. Details ke liye card tap karein.</Text>
                    </View>
                  )}
                </View>
              }
              ListEmptyComponent={
                <View style={s.emptyWrap}>
                  <Image source={require('./assets/dlh.png')} style={s.emptyImg} />
                  <Text style={s.emptyTitle}>Koi Order Nahi Mila</Text>
                  <Text style={s.emptySub}>Aapki search ke liye koi order nahi mila</Text>
                </View>
              }
            />
          )}

          {showCta && (
            <SafeAreaInsetsContext.Consumer>
              {(insets) => (
                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={this.state.generatingOtp}
                  onPress={this.openGenerateOtp}
                  style={[
                    s.ctaBtn,
                    { bottom: (insets?.bottom || 0) + 12 },
                    this.state.generatingOtp && { opacity: 0.75 },
                  ]}
                >
                  {this.state.generatingOtp ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <View style={s.ctaTextCol}>
                        <Text style={s.ctaSubLbl}>
                          {selectedCount} order{selectedCount > 1 ? 's' : ''} chune gaye
                        </Text>
                        <Text style={s.ctaMainLbl}>Pickup OTP Banayein</Text>
                      </View>
                      <View style={s.ctaArrowCircle}>
                        <Image source={require('./assets/arrow.png')} style={s.ctaArrowIco} />
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </SafeAreaInsetsContext.Consumer>
          )}
          {this.renderFilterSheet()}
        </View>
      </View>
    );
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E8ECF4' },

  hdr: { backgroundColor: P, paddingBottom: 8 },
  hdrRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  hdrBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  hdrIco: { width: 17, height: 17, tintColor: '#FFF', resizeMode: 'contain' },

  searchBar: { flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, marginLeft: 10, paddingHorizontal: 10 },
  searchBarIco: { width: 14, height: 14, resizeMode: 'contain', tintColor: 'rgba(255,255,255,0.5)', marginRight: 8 },
  searchBarInput: { flex: 1, fontSize: 14, color: '#FFF', paddingVertical: 0, letterSpacing: 0 },
  clearIco: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  clearIcoImg: { width: 8, height: 8, resizeMode: 'contain', tintColor: '#FFF' },
  searchBarLoader: { marginLeft: 6, width: 20, height: 20 },
  filterBtn: {
    width: 38, height: 38, borderRadius: 10, marginLeft: 8,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  filterBtnOn: { backgroundColor: 'rgba(255,255,255,0.28)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  filterBtnIco: { width: 16, height: 16, resizeMode: 'contain', tintColor: '#FFF' },
  filterDot: {
    position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#FCD34D', borderWidth: 1, borderColor: P,
  },

  scroll: { paddingHorizontal: 8, paddingTop: 10, paddingBottom: 28 },

  card: { backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 10, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginBottom: 8 },

  secRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, marginBottom: 8 },
  secTitle: { fontSize: 12, fontWeight: '700', color: '#475569', letterSpacing: 0.3 },
  secFilterNote: { fontSize: 10.5, fontWeight: '600', color: P, marginTop: 2 },
  selCountChip: { backgroundColor: STATUS.PICKUP.bg, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  selCountChipT: { color: '#FFF', fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  selHint: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#EDE9FE', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: P },
  selHintIco: { fontSize: 14, color: P, marginRight: 8, marginTop: 0 },
  selHintT: { flex: 1, fontSize: 11.5, fontWeight: '500', color: '#4C1D95', lineHeight: 16 },

  // Delivery card
  dlv: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  dlvTop: { backgroundColor: '#F1F5F9' },
  dlvTopSelected: { backgroundColor: '#E0E7FF' },
  dlvSelected: { borderColor: '#08081c', borderWidth: 2, backgroundColor: '#EEF0FA', shadowOpacity: 0.12 },

  dlvHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  oidWrap: { flexDirection: 'row', alignItems: 'center' },
  dlvOid: { fontSize: 10.5, fontWeight: '800', color: P, letterSpacing: 0.2, includeFontPadding: false },
  oidCopy: { fontSize: 20, fontWeight: '600', color: P, marginLeft: 6, opacity: 0.85, includeFontPadding: false, lineHeight: 22 },
  chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  chipT: { fontSize: 9, fontWeight: '700', color: '#FFF', letterSpacing: 0.3 },
  priorityChip: { marginRight: 6 },

  groupHdr: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#EDE9FE',
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8, marginTop: 2,
    borderLeftWidth: 3, borderLeftColor: P,
  },
  groupHdrDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: P, marginRight: 8 },
  groupHdrT: { flex: 1, fontSize: 12, fontWeight: '700', color: '#312E81', lineHeight: 16 },
  groupHdrCount: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: P, alignItems: 'center', justifyContent: 'center', marginLeft: 8, paddingHorizontal: 6 },
  groupHdrCountT: { fontSize: 10, fontWeight: '700', color: '#FFF' },

  checkBox: { marginLeft: 10, width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#CBD5E1', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  // Visible 26 × 26 checkbox chip — sits on the LEFT of the payment pills.
  // The Pressable wrapper around it provides the actual tap zone via internal
  // padding (16 × 10) plus hitSlop (16), so the touch area is generous while
  // the visual stays compact in the slim footer.
  checkBoxFoot: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#CBD5E1', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  // Padded press surface around the checkbox — also the responder owner.
  checkBoxHit: { paddingHorizontal: 16, paddingVertical: 10, marginLeft: -8, marginRight: -2, alignItems: 'center', justifyContent: 'center' },
  checkBoxOn: { backgroundColor: '#08081c', borderColor: '#08081c' },
  checkTick: { color: '#FCD34D', fontSize: 15, fontWeight: '900', marginTop: -1, lineHeight: 17 },

  dlvPerson: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10 },
  dlvAvt: { width: 30, height: 30, borderRadius: 15, resizeMode: 'cover', marginRight: 10 },
  dlvName: { fontSize: 13.5, fontWeight: '700', color: '#1E293B' },
  dlvPhone: { fontSize: 11.5, fontWeight: '500', color: '#64748B', marginTop: 1 },
  actBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  actIco: { width: 26, height: 26, resizeMode: 'contain' },

  routeWrap: { marginHorizontal: 12, paddingTop: 12, paddingBottom: 10 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  routeTl: { width: 14, alignItems: 'center', marginRight: 8, paddingTop: 4 },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  routeLine: { width: 1.5, flex: 1, minHeight: 10, backgroundColor: '#D1D5DB', marginVertical: 3 },
  routeBody: { flex: 1, paddingBottom: 10 },
  routeLbl: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  routeTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  routePhone: { fontSize: 11, fontWeight: '500', color: '#94A3B8', marginTop: 1 },
  routeAddr: { fontSize: 12, fontWeight: '400', color: '#64748B', lineHeight: 16, marginTop: 1 },
  dsCall: { marginLeft: 6, alignSelf: 'flex-start', marginTop: 2 },
  dsCallIco: { width: 30, height: 30, resizeMode: 'contain', tintColor: '#EA580C' },

  dlvFoot: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, minHeight: 38, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FAFBFC' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginRight: 6 },
  pillT: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.3 },
  dlvAmt: { fontSize: 16, fontWeight: '800', color: '#16A34A' },

  emptyWrap: { paddingVertical: 50, alignItems: 'center' },
  emptyImg: { width: 70, height: 70, resizeMode: 'contain', marginBottom: 14 },
  footerLoader: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  footerLoaderT: { marginLeft: 8, fontSize: 11.5, fontWeight: '600', color: P },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#475569', marginBottom: 6 },
  emptySub: { fontSize: 12, fontWeight: '400', color: '#94A3B8', textAlign: 'center', paddingHorizontal: 40 },

  // Floating CTA pill: left count circle, center stacked label, right arrow circle.
  ctaBtn: {
    position: 'absolute',
    alignSelf: 'center',
    // bottom is set dynamically from SafeAreaInsetsContext so the Android nav bar doesn't clip it
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 8,
    paddingVertical: 8,
    backgroundColor: STATUS.PICKUP.bg,
    borderRadius: 30,
    shadowColor: STATUS.PICKUP.bg,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaTextCol: { marginRight: 10, alignItems: 'flex-start' },
  ctaSubLbl: { color: 'rgba(255,255,255,0.8)', fontSize: 9.5, fontWeight: '500', letterSpacing: 0.4, includeFontPadding: false },
  ctaMainLbl: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700', letterSpacing: 0.2, includeFontPadding: false, marginTop: 1 },
  ctaArrowCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaArrowIco: { width: 12, height: 12, resizeMode: 'contain', tintColor: STATUS.PICKUP.bg },

  fsRoot: { overflow: 'hidden' },

  fsBanner: {
    backgroundColor: P,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 14,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  fsBannerGlow: {
    position: 'absolute', top: -30, right: -20, width: 100, height: 100,
    borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.12)',
  },
  fsBannerRow: { flexDirection: 'row', alignItems: 'center' },
  fsBannerIco: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  fsBannerIcoImg: { width: 18, height: 18, resizeMode: 'contain', tintColor: '#FFF' },
  fsBannerTitle: { fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: -0.2 },
  fsBannerSub: { fontSize: 11.5, color: 'rgba(255,255,255,0.78)', marginTop: 2, lineHeight: 15 },
  fsBannerClose: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  fsBannerCloseIco: { width: 9, height: 9, resizeMode: 'contain', tintColor: '#FFF' },

  fsList: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
    overflow: 'hidden',
  },
  fsRow: {
    flexDirection: 'row', alignItems: 'center', minHeight: FILTER_ROW_H,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFF',
  },
  fsRowLast: { borderBottomWidth: 0 },
  fsRowOn: { backgroundColor: '#FAFAFF' },
  fsRowBar: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },
  fsRowIco: {
    width: 44, height: 44, borderRadius: 13, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  fsRowIcoImg: { width: 24, height: 24, resizeMode: 'contain' },
  fsRowT: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  fsRowS: { fontSize: 11, color: '#94A3B8', marginTop: 2, lineHeight: 14 },
  fsRadio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center', marginLeft: 10,
  },
  fsRadioDot: { width: 10, height: 10, borderRadius: 5 },

  fsActivePill: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12,
    backgroundColor: '#F8FAFC', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  fsActiveDot: { width: 7, height: 7, borderRadius: 4, marginRight: 8 },
  fsActiveTxt: { flex: 1, fontSize: 12, fontWeight: '600', color: '#64748B' },

  fsActions: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 14, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  fsResetBtn: {
    flex: 1, height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF',
  },
  fsResetBtnOff: { borderColor: '#E2E8F0' },
  fsResetT: { fontSize: 14, fontWeight: '700', color: '#475569' },
  fsDoneBtn: {
    flex: 1.5, height: 50, borderRadius: 14, backgroundColor: P,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  fsDoneT: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  fsDoneArrow: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  fsDoneArrowIco: { width: 10, height: 10, resizeMode: 'contain', tintColor: '#FFF' },
});

export default withV4Navigation(TrackOrders);
