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
import { prefetchSoilOrderPincode } from '../utils/locationHelper';
import OrderCard from '../components/OrderCard';
import PendingSettlementsCarousel from '../components/PendingSettlementsCarousel';
import NotificationBellButton from '../components/NotificationBellButton';
import GroupOrdersFilterSheet from '../components/GroupOrdersFilterSheet';
import OrderGroupHeader from '../components/OrderGroupHeader';
import {
  DEFAULT_GROUP_BY,
  GROUP_FILTERS,
  buildListRows,
  homescreenUrl,
  flattenFromApiGroups,
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
    nav: 'SoilOrders',
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
    const groupBy = DEFAULT_GROUP_BY;
    const cached = cacheGet(this.dashboardCacheKey(groupBy));
    this.state = {
      loading: !cached,
      refreshing: false,
      data: cached || null,
      groupBy,
      filterDraft: groupBy,
      showFilterSheet: false,
    };
    this.anims = [0,1,2,3,4].map(() => ({ o: new Animated.Value(1), y: new Animated.Value(0) }));
    this.filterSheetRef = null;
  }

  dashboardCacheKey = (groupBy) => `${KEYS.DASHBOARD}_${groupBy || ''}`;

  componentDidMount() {
    prefetchSoilOrderPincode();
    const { groupBy } = this.state;
    this.unsubscribe = cacheSubscribe(this.dashboardCacheKey(groupBy), (data) => {
      if (!data) return;
      this.setState({ data });
    });
    this.load(cacheHas(this.dashboardCacheKey(groupBy)));
    flushPendingNotificationNavigation();
  }

  componentWillUnmount() {
    if (this.unsubscribe) this.unsubscribe();
  }

  animate = () => {};

  // silent=true → background refresh, no shimmer flicker
  load = (silent = false) => {
    const groupBy = this.state.groupBy || DEFAULT_GROUP_BY;
    const cacheKey = this.dashboardCacheKey(groupBy);
    if (!silent && !this.state.refreshing) this.setState({ loading: true });
    fetch(homescreenUrl(constants.homescreen, groupBy), {
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
    groupBy: this.state.groupBy || DEFAULT_GROUP_BY,
  });

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
    const nextGroup = this.state.filterDraft || DEFAULT_GROUP_BY;
    if (this.unsubscribe) this.unsubscribe();
    this.setState({ groupBy: nextGroup, filterDraft: nextGroup, showFilterSheet: false }, () => {
      this.closeFilterSheet();
      this.unsubscribe = cacheSubscribe(this.dashboardCacheKey(nextGroup), (data) => {
        if (!data) return;
        this.setState({ data });
      });
      this.load(true);
    });
  };

  clearFilters = () => {
    const nextGroup = DEFAULT_GROUP_BY;
    if (this.unsubscribe) this.unsubscribe();
    this.setState({ groupBy: nextGroup, filterDraft: nextGroup, showFilterSheet: false }, () => {
      this.closeFilterSheet();
      this.unsubscribe = cacheSubscribe(this.dashboardCacheKey(nextGroup), (data) => {
        if (!data) return;
        this.setState({ data });
      });
      this.load(true);
    });
  };
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
  n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  mask = (p) => { if (!p) return ''; const s = String(p); if (s.length < 6) return s; return s.slice(0, 2) + '****' + s.slice(-2); };

  badge = (s) => ({ bg: getStatus(s).bg, c: '#FFF' });

  statusLabel = (s) => getStatus(s).label;

  renderItem = ({ item }) => (
    <OrderCard
      order={item}
      onPress={() => this.props.navigation.navigate('DeliveryDetails', { order: item })}
      onCall={(p) => this.dial(p)}
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
          groupBy={this.state.groupBy || DEFAULT_GROUP_BY}
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
    const { groupBy } = this.state;
    const effectiveGroupBy = groupBy || DEFAULT_GROUP_BY;
    const name = d?.partner?.name || '';
    const rule = d?.partner?.rule;
    const live = d?.live_orders || {};
    const todayRaw = d?.today_deliveries || [];
    const todayRows = buildListRows(todayRaw, effectiveGroupBy);
    const hasToday = todayRows.some((r) => r.type === 'order');
    const activeFilter = GROUP_FILTERS.find((g) => g.id === effectiveGroupBy);
    const pendingSettlements = d?.pending_settlements || [];
    const pendingAmount = d?.pending_settlement_amount;
    const pendingCount = d?.pending_settlement_orders_count;
    const earn = this.n(d?.earnings?.this_month);
    const pen = this.n(d?.penalties?.this_month);

    return (
      <View style={$.root}>
        <StatusBar backgroundColor={P} translucent={false} barStyle="light-content" />
        <NavigationEvents onWillFocus={() => {}} onDidFocus={() => this.load(true)} />

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
                    onPress={this.openFilterSheet}
                    activeOpacity={0.85}
                    style={[$.filterBtn, $.filterBtnOn]}
                  >
                    <Image source={require('./assets/filter.png')} style={$.filterIco} />
                    <View style={$.filterDot} />
                  </TouchableOpacity>
                </View>
                {hasToday && (
                  <Text style={$.groupNote} numberOfLines={1}>
                    Grouped: {(activeFilter || GROUP_FILTERS.find((g) => g.id === DEFAULT_GROUP_BY)).label}
                  </Text>
                )}
                {hasToday ? (
                  <FlatList
                    data={todayRows}
                    keyExtractor={(row) => row.key || `${row?.item?.order_id}`}
                    renderItem={this.renderTodayItem}
                    scrollEnabled={false}
                    extraData={effectiveGroupBy}
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
                  {QUICK_ACTIONS.map((q) => (
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
                      <Image source={q.ico} style={$.qaImg} resizeMode="contain" />
                      <Text style={[$.qaL, { color: q.accent }]}>{q.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Animated.View>
              <View style={{ height: 8 }} />
            </ScrollView>
          )}
        </View>
        <NetBanner />
        <GroupOrdersFilterSheet
          visible={this.state.showFilterSheet}
          filterDraft={this.state.filterDraft || DEFAULT_GROUP_BY}
          groupBy={effectiveGroupBy}
          sheetRef={(r) => { this.filterSheetRef = r; }}
          onClose={this.closeFilterSheet}
          onSheetClosed={this.onFilterSheetClosed}
          onSelectDraft={this.selectFilterDraft}
          onApply={this.applyFilters}
          onReset={this.clearFilters}
        />
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
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  qaImg: { width: 48, height: 48, marginBottom: 8 },
  qaL: { fontSize: 11.5, fontWeight: '700', textAlign: 'center', letterSpacing: 0.1 },
});

export default withV4Navigation(LMDDashboard);
