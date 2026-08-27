import React, { Component } from 'react';
import {
  View, Text, StatusBar, TouchableOpacity, StyleSheet,
  FlatList, ScrollView, Linking, Image, Animated, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import constants from '../utils/constants';
import { NavigationEvents, withV4Navigation } from '../utils/v4Compat';
import ShimmerLoader from '../components/ShimmerLoader';
import NetBanner from '../components/NetBanner';
import { get as cacheGet, set as cacheSet, has as cacheHas, subscribe as cacheSubscribe, KEYS } from '../utils/dataCache';
import LiveOrdersGrid, { allCount } from '../components/LiveOrdersGrid';
import { getStatus } from '../utils/statusColors';
import { preloadImages } from '../components/CachedImage';
import { flushPendingNotificationNavigation } from '../utils/notificationNavigation';
import { prefetchSoilOrderPincode, requestStatusLocationAccess } from '../utils/locationHelper';
import { startBackgroundLocationTracker } from '../utils/locationTracker';
import { callFarmerExotel, dialDirect } from '../utils/exotelCall';
import OrderCard from '../components/OrderCard';
import PendingSettlementsCarousel from '../components/PendingSettlementsCarousel';
import NotificationBellButton from '../components/NotificationBellButton';
import OrderGroupHeader from '../components/OrderGroupHeader';
import ActiveFiltersSummary from '../components/ActiveFiltersSummary';
import {
  DEFAULT_GROUP_BY,
  buildListRows,
  homescreenUrl,
  flattenFromApiGroups,
  hasActiveFilters,
  groupCacheSuffix,
  pickReadyCacheSuffix,
  priorityCacheSuffix,
  rescheduleCacheSuffix,
  entityFilterCacheSuffix,
  dedupeGroupStack,
  listRowsWithoutGroupHeaders,
} from '../utils/orderGrouping';

const P = '#5D3FD3';
const SECTION_ICON = 24;

const QUICK_ACTIONS = [
  {
    l: 'Jama Karein',
    ico: require('./assets/money.png'),
    bg: '#EDE9FE',
    border: '#C4B5FD',
    accent: '#5D3FD3',
    nav: 'SettlementList',
  },
  {
    l: 'Mitti Jaanch',
    ico: require('./assets/soil.png'),
    bg: '#DCFCE7',
    border: '#86EFAC',
    accent: '#059669',
    countBg: '#EF4444',
    nav: 'SoilOrders',
    countKey: 'soilOrderCount',
  },
  {
    l: 'Madad',
    ico: require('./assets/consultation.png'),
    bg: '#DBEAFE',
    border: '#93C5FD',
    accent: '#2563EB',
    nav: 'support',
  },
];

class LMDDashboard extends Component {
  constructor() {
    super();
    const groupStack = [DEFAULT_GROUP_BY];
    const cached = cacheGet(this.dashboardCacheKey(groupStack, null, null, null, null));
    this.state = {
      loading: !cached,
      refreshing: false,
      data: cached || null,
      groupStack,
      pickReadyFilter: null,
      rescheduleDateFilter: null,
      priorityFilter: null,
      entityFilters: null,
    };
    this.anims = [0,1,2,3,4].map(() => ({ o: new Animated.Value(1), y: new Animated.Value(0) }));
  }

  dashboardCacheKey = (groupStack, pickReadyFilter, rescheduleDateFilter, priorityFilter, entityFilters) =>
    `${KEYS.DASHBOARD}${groupCacheSuffix(null, null, groupStack)}${pickReadyCacheSuffix(pickReadyFilter)}${rescheduleCacheSuffix(rescheduleDateFilter)}${priorityCacheSuffix(priorityFilter)}${entityFilterCacheSuffix(entityFilters)}`;

  componentDidMount() {
    prefetchSoilOrderPincode();
    const { groupStack, pickReadyFilter, rescheduleDateFilter, priorityFilter, entityFilters } = this.state;
    const cacheKey = this.dashboardCacheKey(groupStack, pickReadyFilter, rescheduleDateFilter, priorityFilter, entityFilters);
    this.unsubscribe = cacheSubscribe(cacheKey, (data) => {
      if (!data) return;
      this.setState({ data });
    });
    this.load(cacheHas(cacheKey));
    flushPendingNotificationNavigation();
  }

  componentWillUnmount() {
    if (this.unsubscribe) this.unsubscribe();
  }

  animate = () => {};

  // silent=true → background refresh, no shimmer flicker
  load = (silent = false) => {
    const { groupStack, pickReadyFilter, rescheduleDateFilter, priorityFilter, entityFilters } = this.state;
    const cacheKey = this.dashboardCacheKey(groupStack, pickReadyFilter, rescheduleDateFilter, priorityFilter, entityFilters);
    if (!silent && !this.state.refreshing) this.setState({ loading: true });
    fetch(homescreenUrl(constants.homescreen, { groupStack, pickReadyFilter, rescheduleDateFilter, priorityFilter, entityFilters }), {
      headers: { 'X-localization': 'en', Authorization: 'Bearer ' + global.token }, method: 'GET',
    })
      .then(r => r.json())
      .then(j => {
        if (j.status) {
          const data = j.data || {};
          cacheSet(cacheKey, data);
          cacheSet(KEYS.DASHBOARD, data);
          const urls = [];
          flattenFromApiGroups(data?.today_deliveries || []).forEach((o) => {
            if (typeof o?.farmer_data?.image === 'string') urls.push(o.farmer_data.image);
            (o?.order_items || []).forEach((it) => { if (typeof it?.image === 'string') urls.push(it.image); });
          });
          preloadImages(urls);
          this.setState({ loading: false, refreshing: false, data });
        } else this.setState({ loading: false, refreshing: false });
      })
      .catch(() => this.setState({ loading: false, refreshing: false }));
  };

  refresh = () => {
    this.setState({ refreshing: true }, () => this.load(true));
  };

  go = (s) => this.props.navigation.navigate('TrackOrders', {
    selectedStatus: s || 'ALL',
    groupStack: this.state.groupStack,
  });

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
    const nextStack = dedupeGroupStack(groupStack);
    if (this.unsubscribe) this.unsubscribe();
    this.setState({
      groupStack: nextStack,
      pickReadyFilter,
      rescheduleDateFilter: rescheduleDateFilter || null,
      priorityFilter: priorityFilter || null,
      entityFilters: entityFilters || null,
    }, () => {
      const cacheKey = this.dashboardCacheKey(nextStack, pickReadyFilter, rescheduleDateFilter, priorityFilter, entityFilters);
      this.unsubscribe = cacheSubscribe(cacheKey, (data) => {
        if (!data) return;
        this.setState({ data });
      });
      this.load(true);
    });
  };
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
  n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  mask = (p) => { if (!p) return ''; const s = String(p); if (s.length < 6) return s; return s.slice(0, 2) + '****' + s.slice(-2); };

  badge = (s) => ({ bg: getStatus(s).bg, c: '#FFF' });

  statusLabel = (s) => getStatus(s).label;

  renderItem = ({ item }) => (
    <OrderCard
      order={item}
      onPress={() => this.props.navigation.navigate('DeliveryDetails', { order: item })}
      onCall={(p, id) => this.callFarmer(p, id)}
      onWhatsApp={(p) => this.wa(p)}
      onCallStore={(p) => this.dial(p)}
    />
  );

  renderTodayItem = ({ item: row }) => {
    if (row.type === 'header') {
      return (
        <OrderGroupHeader
          title={row.title}
          count={row.count}
          groupBy={row.groupBy || this.state.groupStack?.[0] || DEFAULT_GROUP_BY}
          level={row.level || 'primary'}
          depth={row.depth || 0}
          compact
        />
      );
    }
    return this.renderItem({ item: row.item });
  };

  a = (i) => ({ opacity: this.anims[Math.min(i,4)].o, transform: [{ translateY: this.anims[Math.min(i,4)].y }] });

  goSettlements = () => {
    this.props.navigation.navigate('SettlementList', { initialTab: 'pending' });
  };

  renderSectionHead = (icon, title, iconSize = SECTION_ICON) => (
    <View style={$.sectionHeadLeft}>
      <View style={[$.sectionIcoBox, { width: iconSize, height: iconSize }]}>
        <Image source={icon} style={{ width: iconSize, height: iconSize }} resizeMode="contain" />
      </View>
      <Text style={$.sectionTitle}>{title}</Text>
    </View>
  );

  render() {
    const d = this.state.data;
    const { groupStack, pickReadyFilter, rescheduleDateFilter, priorityFilter, entityFilters } = this.state;
    const levels = dedupeGroupStack(groupStack);
    const name = d?.partner?.name || '';
    const rule = d?.partner?.rule;
    const live = d?.live_orders || {};
    const todayRaw = Array.isArray(d?.today_deliveries) ? d.today_deliveries : [];
    let filtersActive = false;
    let todayRows = [];
    let hasToday = false;
    try {
      filtersActive = hasActiveFilters(levels[0], pickReadyFilter, rescheduleDateFilter, levels[1], levels, priorityFilter, entityFilters);
      const todayRowsRaw = buildListRows(todayRaw, levels[0], pickReadyFilter, levels[1], levels);
      todayRows = listRowsWithoutGroupHeaders(todayRowsRaw, filtersActive);
      hasToday = todayRows.some((r) => r.type === 'order');
    } catch (e) {
      console.log('[dashboard] today list failed', e?.message || e);
    }
    const pendingSettlements = Array.isArray(d?.pending_settlements) ? d.pending_settlements : [];
    const pendingAmount = d?.pending_settlement_amount;
    const pendingCount = d?.pending_settlement_orders_count;
    const earn = this.n(d?.earnings?.this_month);
    const pen = this.n(d?.penalties?.this_month);

    return (
      <View style={$.root}>
        <StatusBar backgroundColor={P} translucent={false} barStyle="light-content" />
        <NavigationEvents onWillFocus={() => {}} onDidFocus={() => { requestStatusLocationAccess('delivery'); startBackgroundLocationTracker(); this.load(true); }} />

        <View style={$.hdr}>
          <SafeAreaView edges={['top']}>
            <View style={$.hdrRow}>
              {/* Profile chip + welcome name together = one big tap target */}
              <TouchableOpacity
                style={$.hdrLeft}
                onPress={() => this.props.navigation.navigate('Profile')}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6 }}
              >
                <View style={$.hdrBtn}>
                  <Image source={require('./assets/logo.png')} style={$.profIco} />
                </View>
                <View style={$.hdrInfo}>
                  <Text style={$.hdrSub}>Swagat</Text>
                  <Text style={$.hdrName} numberOfLines={1}>{name || '-'}</Text>
                </View>
              </TouchableOpacity>
              <NotificationBellButton navigation={this.props.navigation} />
            </View>
          </SafeAreaView>
        </View>

        <View style={{ flex: 1, backgroundColor: '#E8ECF4' }}>
          {this.state.loading && !this.state.refreshing ? <ShimmerLoader /> : (
            <ScrollView contentContainerStyle={$.scroll} showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={this.state.refreshing} onRefresh={this.refresh} tintColor={P} colors={[P]} />}>

              {rule ? (
                <Animated.View style={[$.ruleCard, this.a(0)]}>
                  <View style={$.ruleDot} />
                  <Text style={$.ruleT}>{rule}</Text>
                </Animated.View>
              ) : null}

              <Animated.View style={[$.earnRow, this.a(1)]}>
                <View style={[$.earnCard, { backgroundColor: '#16A34A' }]}>
                  <Text style={$.earnLbl}>Kamai</Text>
                  <Text style={$.earnVal}>₹ {fmt(earn)}</Text>
                </View>
                <View style={{ width: 8 }} />
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => this.props.navigation.navigate('PenaltyOrders')}
                  style={[$.earnCard, $.penCard, { backgroundColor: '#EF4444' }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={$.earnLbl}>Penalty</Text>
                    <Text style={$.earnVal}>₹ {fmt(pen)}</Text>
                  </View>
                  <View style={$.penArrow}>
                    <Image source={require('./assets/arrow.png')} style={$.penArrowIco} />
                  </View>
                </TouchableOpacity>
              </Animated.View>

              {pendingSettlements.length > 0 ? (
                <Animated.View style={this.a(2)}>
                  <PendingSettlementsCarousel
                    items={pendingSettlements}
                    totalAmount={pendingAmount}
                    totalCount={pendingCount}
                    onNavigate={this.goSettlements}
                  />
                </Animated.View>
              ) : null}

              <Animated.View style={[$.card, this.a(2)]}>
                <View style={$.cardH}>
                  {this.renderSectionHead(
                    require('./assets/reward.png'),
                    `Live Orders (${this.n(live?.all_orders ?? allCount(live))})`,
                    20,
                  )}
                  <TouchableOpacity onPress={() => this.go('ALL')} activeOpacity={0.7}><View style={$.viewAllWrap}><Text style={$.viewAll}>Sabhi Dekhein ›</Text></View></TouchableOpacity>
                </View>
                <LiveOrdersGrid live={live} onPress={this.go} />
              </Animated.View>

              <Animated.View style={[$.card, this.a(3), hasToday ? { paddingBottom: 4 } : null]}>
                <View style={[$.cardH, $.todayCardH]}>
                  {this.renderSectionHead(
                    require('./assets/truck.png'),
                    'Aaj Ki Deliveries',
                  )}
                  <TouchableOpacity
                    onPress={this.openFilters}
                    activeOpacity={0.85}
                    style={[$.filterBtn, filtersActive && $.filterBtnOn]}
                  >
                    <Image source={require('./assets/filter.png')} style={$.filterIco} />
                    {filtersActive ? <View style={$.filterDot} /> : null}
                  </TouchableOpacity>
                </View>
                {hasToday && filtersActive && (
                  <ActiveFiltersSummary
                    groupBy={levels[0]}
                    subGroupBy={levels[1]}
                    groupStack={levels}
                    pickReadyFilter={pickReadyFilter}
                    rescheduleDateFilter={rescheduleDateFilter}
                    priorityFilter={priorityFilter}
                    entityFilters={entityFilters}
                  />
                )}
                {hasToday ? (
                  <FlatList
                    data={todayRows}
                    keyExtractor={(row) => row.key || `${row?.item?.order_id}`}
                    renderItem={this.renderTodayItem}
                    scrollEnabled={false}
                    extraData={todayRows}
                  />
                ) : (
                  <View style={$.emptyWrap}>
                    <Image source={require('./assets/dlh.png')} style={$.emptyImg} />
                    <Text style={$.empty}>No deliveries for today</Text>
                  </View>
                )}
              </Animated.View>

              <Animated.View style={[$.card, this.a(4), { paddingBottom: 14 }]}>
                <Text style={$.cardT}>Quick Actions</Text>
                <View style={$.actRow}>
                  {QUICK_ACTIONS.map((q) => {
                    const count = q.countKey ? Number(this.state.data?.[q.countKey] || 0) : 0;
                    return (
                    <TouchableOpacity
                      key={q.l}
                      style={[$.qa, { backgroundColor: q.bg, borderColor: q.border }]}
                      activeOpacity={0.85}
                      onPress={() => (
                        q.nav === 'support'
                          ? this.dial(this.state.data?.Support)
                          : this.props.navigation.navigate(q.nav)
                      )}
                    >
                      {count > 0 ? (
                        <View style={[$.qaBadge, { backgroundColor: q.countBg || q.accent }]}>
                          <Text style={$.qaBadgeT}>{count}</Text>
                        </View>
                      ) : null}
                      <Image source={q.ico} style={$.qaImg} resizeMode="contain" />
                      <Text style={[$.qaL, { color: q.accent }]}>{q.l}</Text>
                    </TouchableOpacity>
                    );
                  })}
                </View>
              </Animated.View>
              <View style={{ height: 8 }} />
            </ScrollView>
          )}
        </View>
        <NetBanner />
      </View>
    );
  }
}

function fmt(n) { try { return Number(n).toLocaleString('en-IN'); } catch(e) { return String(n); } }


const $ = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E8ECF4' },

  hdr: { backgroundColor: P, paddingBottom: 4 },
  hdrRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  hdrBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  hdrIco: { width: 17, height: 17, tintColor: '#FFF', resizeMode: 'contain' },
  profIco: { width: 36, height: 36, borderRadius: 18, resizeMode: 'contain' },
  hdrLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  hdrInfo: { flex: 1, marginLeft: 12 },
  hdrSub: { fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.6)' },
  hdrName: { fontSize: 15, fontWeight: '600', color: '#FFF' },

  scroll: { paddingHorizontal: 8, paddingTop: 10, paddingBottom: 28 },

  ruleCard: { backgroundColor: '#FFFBEB', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
  ruleDot: { display: 'none' },
  ruleT: { flex: 1, fontSize: 12, fontWeight: '500', color: '#475569', lineHeight: 17 },

  earnRow: { flexDirection: 'row', marginBottom: 8 },
  earnCard: { flex: 1, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  earnLbl: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '500' },
  earnVal: { color: '#FFF', fontSize: 20, fontWeight: '700', marginTop: 3 },
  penCard: { flexDirection: 'row', alignItems: 'center' },
  penArrow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  penArrowIco: { width: 9, height: 9, resizeMode: 'contain', tintColor: '#EF4444' },

  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 },
  cardH: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  todayCardH: { marginBottom: 2 },
  cardT: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  filterBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  filterBtnOn: { backgroundColor: '#EDE9FE', borderColor: '#C4B5FD' },
  filterIco: { width: 14, height: 14, resizeMode: 'contain', tintColor: P },
  filterDot: {
    position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#FCD34D', borderWidth: 1, borderColor: P,
  },
  groupNote: { fontSize: 10.5, fontWeight: '600', color: P, marginBottom: 6, marginTop: -2 },
  sectionHeadLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 },
  sectionIcoBox: { width: SECTION_ICON, height: SECTION_ICON, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1E293B' },
  viewAll: { color: P, fontSize: 11, fontWeight: '600' },
  viewAllWrap: { backgroundColor: '#EDE9FE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },

  emptyWrap: { alignItems: 'center', paddingVertical: 14 },
  emptyImg: { width: 64, height: 64, resizeMode: 'contain', marginBottom: 6 },
  dlv: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },

  dlvHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, marginBottom: 2 },
  dlvOid: { fontSize: 11, fontWeight: '600', color: P },
  chip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  chipT: { fontSize: 8, fontWeight: '600', color: '#FFF' },

  dlvPerson: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10 },
  dlvAvt: { width: 34, height: 34, borderRadius: 17, resizeMode: 'cover', marginRight: 10 },
  dlvName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  dlvPhone: { fontSize: 11, fontWeight: '400', color: '#94A3B8', marginTop: 1 },
  ico: { width: 26, height: 26, resizeMode: 'contain' },

  routeWrap: { marginHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  routeTl: { width: 14, alignItems: 'center', marginRight: 8, paddingTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  routeLine: { width: 1.5, flex: 1, minHeight: 10, backgroundColor: '#D1D5DB', marginVertical: 3 },
  routeBody: { flex: 1, paddingBottom: 10 },
  routeLbl: { fontSize: 9, fontWeight: '600', letterSpacing: 0.3, marginBottom: 3 },
  routeTitle: { fontSize: 12, fontWeight: '600', color: '#1E293B' },
  routePhone: { fontSize: 10, fontWeight: '500', color: '#94A3B8', marginTop: 1 },
  routeAddr: { fontSize: 11, fontWeight: '400', color: '#64748B', lineHeight: 16, marginTop: 1 },
  dsCallBtn: { marginLeft: 6, alignSelf: 'flex-start', marginTop: 12 },
  dsCallIco: { width: 30, height: 30, resizeMode: 'contain', tintColor: '#EA580C' },

  dlvFoot: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  pill: { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, marginRight: 4 },
  pillT: { fontSize: 9, fontWeight: '500', color: '#64748B' },
  dlvAmt: { fontSize: 15, fontWeight: '700', color: '#16A34A' },

  empty: { textAlign: 'center', color: '#475569', fontSize: 13, fontWeight: '500', paddingVertical: 4 },
  actRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  qa: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: 1,
    position: 'relative',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  qaBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  qaBadgeT: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  qaImg: { width: 48, height: 48, marginBottom: 8 },
  qaL: { fontSize: 11.5, fontWeight: '700', textAlign: 'center', letterSpacing: 0.1 },
});

export default withV4Navigation(LMDDashboard);
