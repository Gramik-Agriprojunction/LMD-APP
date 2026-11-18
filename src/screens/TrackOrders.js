import React, { Component } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  StatusBar, Image, Animated, RefreshControl, Linking, Alert, ActivityIndicator,
  LayoutAnimation, Platform, UIManager, Easing,
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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Clipboard from '@react-native-clipboard/clipboard';
import constants from '../utils/constants';
import ShimmerLoader from '../components/ShimmerLoader';
import Toast from 'react-native-simple-toast';
import { NavigationEvents, withV4Navigation } from '../utils/v4Compat';
import { get as cacheGet, set as cacheSet, has as cacheHas, subscribe as cacheSubscribe, KEYS, invalidateOrderRelated } from '../utils/dataCache';
import LiveOrdersGrid from '../components/LiveOrdersGrid';
import OrderGroupHeader from '../components/OrderGroupHeader';
import ActiveFiltersSummary from '../components/ActiveFiltersSummary';
import NotificationBellButton from '../components/NotificationBellButton';
import OrderCard from '../components/OrderCard';
import { STATUS, STATUS_SEQUENCE, getStatus } from '../utils/statusColors';
import { preloadImages } from '../components/CachedImage';
import {
  DEFAULT_GROUP_BY,
  parseOrderListPayload,
  buildNestedGroupedRows,
  buildOrderListBody,
  hasActiveFilters,
  groupCacheSuffix,
  priorityCacheSuffix,
  rescheduleCacheSuffix,
  entityFilterCacheSuffix,
  dedupeGroupStack,
  stackFromLegacy,
  listRowsWithoutGroupHeaders,
} from '../utils/orderGrouping';
import { callFarmerExotel, dialDirect } from '../utils/exotelCall';
import { isReadOnly } from '../utils/lmdViewMode';
import { HEADER } from '../theme/headerColors';

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

const STATUSES = STATUS_SEQUENCE;

const normalizeSearchText = (v) => String(v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

const isPendingOrder = (item) => getStatus(item?.status).key === 'PENDING';

class TrackOrders extends Component {
  constructor(props) {
    super(props);
    const init = this.props?.navigation?.getParam('selectedStatus', 'ALL');
    const selected = STATUSES.includes(init) ? init : 'ALL';
    const initGroupStack = this.props?.navigation?.getParam('groupStack')
      || stackFromLegacy(
        this.props?.navigation?.getParam('groupBy', DEFAULT_GROUP_BY),
        this.props?.navigation?.getParam('subGroupBy', null),
      );
    const levels = dedupeGroupStack(initGroupStack);
    const cacheKey = `${KEYS.ORDERS}_${selected}${groupCacheSuffix(null, null, levels)}_`;
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
      groupStack: levels,
      pickReadyFilter: null,
      rescheduleDateFilter: null,
      priorityFilter: null,
      entityFilters: null,
    };
    this.fetchSeq = 0;
    this._searchTimer = null;
    this._skipNextFocusReload = true;
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

  cacheKeyFor = (selected, groupStack, query, pickReadyFilter, rescheduleDateFilter, priorityFilter, entityFilters) =>
    `${KEYS.ORDERS}_${selected}${groupCacheSuffix(null, null, groupStack)}_${pickReadyFilter ? 'ready' : ''}${rescheduleCacheSuffix(rescheduleDateFilter)}${priorityCacheSuffix(priorityFilter)}${entityFilterCacheSuffix(entityFilters)}_${normalizeSearchText(query || '')}`;

  cacheKey = () => this.cacheKeyFor(
    this.state.selected,
    this.state.groupStack,
    this.state.query,
    this.state.pickReadyFilter,
    this.state.rescheduleDateFilter,
    this.state.priorityFilter,
    this.state.entityFilters,
  );

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
    const requestedStack = dedupeGroupStack(this.state.groupStack);
    const requestedPickReady = this.state.pickReadyFilter;
    const requestedRescheduleDate = this.state.rescheduleDateFilter;
    const requestedPriority = this.state.priorityFilter;
    const requestedEntity = this.state.entityFilters;
    const seq = ++this.fetchSeq;
    const body = buildOrderListBody({
      status: requestedFor === 'ALL' ? '' : requestedFor.toLowerCase(),
      page,
      limit: 20,
      groupStack: requestedStack,
      search: requestedQuery,
      pickReadyFilter: requestedPickReady,
      rescheduleDateFilter: requestedRescheduleDate,
      priorityFilter: requestedPriority,
      entityFilters: requestedEntity,
    });
    fetch(constants.orderList, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + global.token, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(j => {
        if (seq !== this.fetchSeq) return;
        const rawData = j?.status ? j.data : [];
        const parsed = parseOrderListPayload(rawData, requestedStack[0], {
          append,
          prevApiGroups: this.state.apiGroups,
          prevOrders: this.state.orders,
          pickReadyFilter: requestedPickReady,
          subGroupBy: requestedStack[1],
          groupStack: requestedStack,
        });
        const live = j?.live || this.state.live;
        const pg = j?.pagination || j?.meta || {};
        const currentPage = Math.max(1, Number(pg?.currentPage || pg?.page || page) || page);
        const totalPages = Math.max(1, Number(pg?.totalPages || pg?.total_pages || 1) || 1);
        const hasMore = typeof pg?.hasNextPage === 'boolean'
          ? pg.hasNextPage
          : currentPage < totalPages;
        const totalCount = Number(pg?.total ?? j?.meta?.total ?? parsed.orders.length) || parsed.orders.length;

        cacheSet(this.cacheKeyFor(requestedFor, requestedStack, requestedQuery, requestedPickReady, requestedRescheduleDate, requestedPriority, requestedEntity), {
          orders: parsed.orders,
          live,
          listRows: parsed.listRows,
          totalCount,
        });
        preloadImages(extractImageUrls(parsed.orders));
        const doneFlags = { loading: false, refreshing: false, loadingMore: false, searchLoading: false };
        const canApply = this.state.selected === requestedFor
          && JSON.stringify(dedupeGroupStack(this.state.groupStack)) === JSON.stringify(requestedStack)
          && this.state.pickReadyFilter === requestedPickReady
          && JSON.stringify(this.state.rescheduleDateFilter || null) === JSON.stringify(requestedRescheduleDate || null)
          && JSON.stringify(this.state.priorityFilter || null) === JSON.stringify(requestedPriority || null)
          && JSON.stringify(this.state.entityFilters || null) === JSON.stringify(requestedEntity || null)
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
    const newKey = this.cacheKeyFor(s, this.state.groupStack, this.state.query, this.state.pickReadyFilter, this.state.rescheduleDateFilter, this.state.priorityFilter, this.state.entityFilters);
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
  callFarmer = (phone, orderId) => callFarmerExotel({ orderId, toPhone: phone, context: 'delivery' });
  dial = async (p) => dialDirect(p);
  wa = async (p) => {
    if (!p) return;
    const c = String(p).replace(/[^\d]/g, '');
    try {
      const can = await Linking.canOpenURL(`whatsapp://send?phone=${c}`);
      if (can) { await Linking.openURL(`whatsapp://send?phone=${c}`); return; }
    } catch (e) {}
    Linking.openURL(`https://wa.me/${c}`).catch(() => Alert.alert('WhatsApp', `${p}`));
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

  openFilters = () => {
    this.props.navigation.navigate('OrderFilters', {
      groupStack: this.state.groupStack,
      pickReadyFilter: this.state.pickReadyFilter,
      rescheduleDateFilter: this.state.rescheduleDateFilter,
      priorityFilter: this.state.priorityFilter,
      entityFilters: this.state.entityFilters,
      onApply: this.handleFiltersApplied,
    });
  };

  handleFiltersApplied = ({
    groupStack,
    pickReadyFilter,
    rescheduleDateFilter,
    priorityFilter,
    entityFilters,
  }) => {
    LayoutAnimation.configureNext(SWAP_ANIM);
    this.setState({
      groupStack: dedupeGroupStack(groupStack),
      pickReadyFilter,
      rescheduleDateFilter: rescheduleDateFilter || null,
      priorityFilter: priorityFilter || null,
      entityFilters: entityFilters || null,
    }, () => this.reloadOrders());
  };

  groupedRows = () => {
    let rows;
    if (this.state.listRows) rows = this.state.listRows;
    else {
      const levels = dedupeGroupStack(this.state.groupStack);
      rows = buildNestedGroupedRows(this.state.orders, levels[0], levels[1], levels);
    }
    const levels = dedupeGroupStack(this.state.groupStack);
    const filtersActive = hasActiveFilters(
      levels[0],
      this.state.pickReadyFilter,
      this.state.rescheduleDateFilter,
      levels[1],
      levels,
      this.state.priorityFilter,
      this.state.entityFilters,
    );
    return listRowsWithoutGroupHeaders(rows, filtersActive);
  };

  filteredOrderCount = () => this.state.totalCount || this.state.orders.length;

  renderItem = ({ item: row, index }) => {
    if (row.type === 'header') {
      return (
        <OrderGroupHeader
          title={row.title}
          count={row.count}
          groupBy={row.groupBy || dedupeGroupStack(this.state.groupStack)[0]}
          level={row.level || 'primary'}
          depth={row.depth || 0}
          compact={row.level !== 'primary'}
        />
      );
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
    const canSelect = !isReadOnly() && isPendingOrder(item);
    const orderKey = this.getOrderKey(item);
    const isChecked = this.state.selectedIds.has(orderKey);
    const goToDetails = () => this.props.navigation.navigate('DeliveryDetails', { order: item });

    return (
      <OrderCard
        order={item}
        onPress={goToDetails}
        onLongPress={canSelect ? () => this.toggleSelect(orderKey) : undefined}
        selected={isChecked}
        showCheckbox={canSelect}
        isChecked={isChecked}
        onToggleSelect={() => this.toggleSelect(orderKey)}
        onCall={(p, id) => this.callFarmer(p, id)}
        onWhatsApp={(p) => this.wa(p)}
        onCallStore={(p) => this.dial(p)}
        onCopyOrderId={(id) => this.copyOrderId(id)}
      />
    );
  };

  a = (i) => ({ opacity: this.anims[Math.min(i,2)].o, transform: [{ translateY: this.anims[Math.min(i,2)].y }] });

  render() {
    const { loading, refreshing, query, searchLoading, selected, live, selectedIds, groupStack, pickReadyFilter, rescheduleDateFilter, priorityFilter, entityFilters } = this.state;
    const levels = dedupeGroupStack(groupStack);
    const rows = this.groupedRows();
    const orderCount = this.filteredOrderCount();
    const selectedCount = selectedIds.size;
    const pendingInView = (this.state.orders || []).filter(isPendingOrder).length;
    const showCta = selectedCount > 0;
    const showSelectHint = !isReadOnly() && pendingInView > 0;
    const filtersActive = hasActiveFilters(levels[0], pickReadyFilter, rescheduleDateFilter, levels[1], levels, priorityFilter, entityFilters);

    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={HEADER.orders} />
        <NavigationEvents onWillFocus={() => {}} onDidFocus={() => {
          if (this._skipNextFocusReload) {
            this._skipNextFocusReload = false;
            return;
          }
          this.reloadOrders();
        }} />

        <View style={s.hdr}>
          <View style={s.hdrBlobA} />
          <View style={s.hdrBlobB} />
          <SafeAreaView edges={['top']}>
            <View style={s.hdrTopRow}>
              <TouchableOpacity
                onPress={() => (this.props.navigation?.canGoBack?.() ? this.props.navigation.goBack() : this.props.navigation?.navigate?.('Home'))}
                style={s.hdrBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons name="arrow-left" size={20} color="#FFF" />
              </TouchableOpacity>
              <Text style={s.hdrTitle}>Orders</Text>
              <View style={s.hdrRightRow}>
                <TouchableOpacity onPress={this.openFilters} activeOpacity={0.85} style={[s.filterBtn, filtersActive && s.filterBtnOn]}>
                  <Image source={require('./assets/filter.png')} style={s.filterIco} />
                  {filtersActive ? <View style={s.filterDot} /> : null}
                </TouchableOpacity>
                <NotificationBellButton
                  navigation={this.props.navigation}
                  size={38}
                  iconSize={17}
                  style={{ backgroundColor: 'rgba(255,255,255,0.16)', marginLeft: 0 }}
                />
              </View>
            </View>
            <View style={s.searchBar}>
              <MaterialCommunityIcons name="magnify" size={18} color="rgba(255,255,255,0.7)" />
              <TextInput
                value={query}
                onChangeText={this.onQueryChange}
                placeholder="Orders dhoondein..."
                placeholderTextColor="rgba(255,255,255,0.45)"
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
                <TouchableOpacity onPress={this.clearQuery} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialCommunityIcons name="close-circle" size={18} color="rgba(255,255,255,0.55)" />
                </TouchableOpacity>
              ) : null}
            </View>
          </SafeAreaView>
        </View>

        <View style={{ flex: 1, backgroundColor: '#EBE7F5' }}>
          {loading && !refreshing ? <ShimmerLoader /> : (
            <FlatList
              data={rows}
              extraData={`${selected}-${selectedCount}-${JSON.stringify(levels)}-${pickReadyFilter}-${JSON.stringify(rescheduleDateFilter || null)}-${JSON.stringify(priorityFilter || null)}-${JSON.stringify(entityFilters || null)}-${query}`}
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
                    </View>
                    {selectedCount > 0 && (
                      <View style={s.selCountChip}>
                        <Text style={s.selCountChipT}>{selectedCount} order{selectedCount > 1 ? 's' : ''} selected</Text>
                      </View>
                    )}
                  </Animated.View>

                  {filtersActive && (
                    <ActiveFiltersSummary
                      compact
                      groupBy={levels[0]}
                      subGroupBy={levels[1]}
                      groupStack={levels}
                      pickReadyFilter={pickReadyFilter}
                      rescheduleDateFilter={rescheduleDateFilter}
                      priorityFilter={priorityFilter}
                      entityFilters={entityFilters}
                    />
                  )}

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
        </View>
      </View>
    );
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EBE7F5' },

  hdr: {
    backgroundColor: HEADER.orders,
    paddingBottom: 16,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },
  hdrBlobA: {
    position: 'absolute', width: 190, height: 190, borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.10)', right: -50, top: -60,
  },
  hdrBlobB: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.08)', left: -40, bottom: -50,
  },
  hdrTopRow: {
    height: 52, paddingHorizontal: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  hdrBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center', justifyContent: 'center',
  },
  hdrTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2, flex: 1, textAlign: 'center' },
  hdrRightRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  searchBar: {
    marginTop: 8, marginHorizontal: 14, height: 44, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.28)',
  },
  searchBarInput: { flex: 1, fontSize: 14, color: '#FFF', paddingVertical: 0, fontWeight: '500' },
  searchBarLoader: { width: 20, height: 20 },
  filterBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center',
  },
  filterBtnOn: { backgroundColor: 'rgba(255,255,255,0.32)' },
  filterIco: { width: 18, height: 18, resizeMode: 'contain', tintColor: '#FFF' },
  filterDot: {
    position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#FCD34D', borderWidth: 1, borderColor: P,
  },

  scroll: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 28 },

  card: {
    backgroundColor: '#F7F5FC',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E5F0',
    elevation: 0,
  },
  cardTitle: { fontSize: 15.5, fontWeight: '700', color: '#171A2A', marginBottom: 12 },

  secRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 10 },
  secTitle: { fontSize: 15.5, fontWeight: '700', color: '#171A2A' },
  secFilterNote: { fontSize: 10.5, fontWeight: '600', color: P, marginTop: 2 },
  selCountChip: { backgroundColor: STATUS.PICKUP.bg, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  selCountChipT: { color: '#FFF', fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  selHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EDE9FE',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: P,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C4B5FD',
  },
  selHintIco: { fontSize: 14, color: P, marginRight: 8, marginTop: 0 },
  selHintT: { flex: 1, fontSize: 12, fontWeight: '600', color: '#4C1D95', lineHeight: 17 },

  // Delivery card
  dlv: {
    backgroundColor: '#F7F5FC',
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

  checkBox: { marginLeft: 10, width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#CBD5E1', backgroundColor: '#F7F5FC', alignItems: 'center', justifyContent: 'center' },
  // Visible 26 × 26 checkbox chip — sits on the LEFT of the payment pills.
  // The Pressable wrapper around it provides the actual tap zone via internal
  // padding (16 × 10) plus hitSlop (16), so the touch area is generous while
  // the visual stays compact in the slim footer.
  checkBoxFoot: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: '#CBD5E1', backgroundColor: '#F7F5FC', alignItems: 'center', justifyContent: 'center' },
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
});

export default withV4Navigation(TrackOrders);
