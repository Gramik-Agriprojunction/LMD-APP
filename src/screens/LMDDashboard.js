import React, { Component } from 'react';
import {
  View, Text, StatusBar, TouchableOpacity, StyleSheet,
  FlatList, ScrollView, Linking, Image, Animated, RefreshControl, Alert,
  Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
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
import ReadOnlyBanner from '../components/ReadOnlyBanner';
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

import { COLORS, FONT, RADIUS, SPACING, flatCard } from '../theme/tokens';

const P = COLORS.primary;
const SECTION_ICON = 22;

const QUICK_ACTIONS = [
  {
    l: 'Jama Karein',
    sub: 'Cash settle',
    tile: '#EFEAFE',
    ico: require('./assets/money.png'),
    bubble: '#F5F0FF',
    accent: COLORS.primary,
    nav: 'SettlementList',
  },
  {
    l: 'Mitti Jaanch',
    sub: 'Soil orders',
    tile: '#E3F6EC',
    ico: require('./assets/soil.png'),
    bubble: '#ECFBF2',
    accent: '#059669',
    countBg: '#EF4444',
    nav: 'SoilOrders',
    countKey: 'soilOrderCount',
  },
  {
    l: 'Madad',
    sub: 'Support call',
    tile: '#E1ECFB',
    ico: require('./assets/consultation.png'),
    bubble: '#EEF4FF',
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
      showRtoOverdueModal: false,
      rtoOverdueCount: 0,
      rtoOverdueDismissedFor: null,
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
      this.syncRtoOverdueAlert(data);
    });
    this.load(cacheHas(cacheKey));
    flushPendingNotificationNavigation();
  }

  componentWillUnmount() {
    if (this.unsubscribe) this.unsubscribe();
  }

  animate = () => {};

  syncRtoOverdueAlert = (data) => {
    const count = Math.max(0, Number(data?.rto_overdue_count || 0));
    if (count <= 0) {
      if (this.state.showRtoOverdueModal) {
        this.setState({ showRtoOverdueModal: false, rtoOverdueCount: 0 });
      }
      return;
    }
    if (this.state.rtoOverdueDismissedFor === count) return;
    this.setState({ showRtoOverdueModal: true, rtoOverdueCount: count });
  };

  dismissRtoOverdueModal = () => {
    this.setState((prev) => ({
      showRtoOverdueModal: false,
      rtoOverdueDismissedFor: prev.rtoOverdueCount || prev.rtoOverdueDismissedFor,
    }));
  };

  openRtoFromAlert = () => {
    const count = this.state.rtoOverdueCount;
    this.setState({
      showRtoOverdueModal: false,
      rtoOverdueDismissedFor: count,
    });
    this.go('RTO');
  };

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
          this.setState({ loading: false, refreshing: false, data }, () => this.syncRtoOverdueAlert(data));
        } else this.setState({ loading: false, refreshing: false });
      })
      .catch(() => this.setState({ loading: false, refreshing: false }));
  };

  refresh = () => {
    this.setState({ refreshing: true }, () => this.load(true));
  };

  go = (s) => this.props.navigation.navigate('Orders', {
    selectedStatus: s || 'ALL',
    groupStack: this.state.groupStack,
    pickReadyFilter: this.state.pickReadyFilter,
    rescheduleDateFilter: this.state.rescheduleDateFilter,
    priorityFilter: this.state.priorityFilter,
    entityFilters: this.state.entityFilters,
    filtersAppliedAt: Date.now(),
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

  applyFiltersLocally = ({
    groupStack = this.state.groupStack,
    pickReadyFilter = this.state.pickReadyFilter,
    rescheduleDateFilter = this.state.rescheduleDateFilter,
    priorityFilter = this.state.priorityFilter,
    entityFilters = this.state.entityFilters,
  }) => {
    const nextStack = dedupeGroupStack(groupStack);
    const nextPickReady = pickReadyFilter === true ? true : null;
    const nextReschedule = rescheduleDateFilter || null;
    const nextPriority = priorityFilter || null;
    const nextEntity = entityFilters || null;
    if (this.unsubscribe) this.unsubscribe();
    this.setState({
      groupStack: nextStack,
      pickReadyFilter: nextPickReady,
      rescheduleDateFilter: nextReschedule,
      priorityFilter: nextPriority,
      entityFilters: nextEntity,
    }, () => {
      const cacheKey = this.dashboardCacheKey(nextStack, nextPickReady, nextReschedule, nextPriority, nextEntity);
      this.unsubscribe = cacheSubscribe(cacheKey, (data) => {
        if (!data) return;
        this.setState({ data });
        this.syncRtoOverdueAlert(data);
      });
      this.load(true);
    });
  };

  clearFilterChip = (chip) => {
    if (!chip?.id) return;
    const id = String(chip.id);
    if (id === 'delivery-date') {
      this.applyFiltersLocally({ rescheduleDateFilter: null });
      return;
    }
    if (id === 'pick-ready') {
      this.applyFiltersLocally({ pickReadyFilter: null });
      return;
    }
    if (id.startsWith('priority-')) {
      const key = id.replace('priority-', '');
      const next = (this.state.priorityFilter || []).filter((p) => p !== key);
      this.applyFiltersLocally({ priorityFilter: next.length ? next : null });
      return;
    }
    if (id.startsWith('entity-')) {
      const field = id.replace('entity-', '');
      const next = { ...(this.state.entityFilters || {}), [field]: field === 'farmer' ? null : '' };
      this.applyFiltersLocally({ entityFilters: next });
    }
  };

  clearGroupFilter = () => {
    this.applyFiltersLocally({ groupStack: [DEFAULT_GROUP_BY] });
  };

  handleFiltersApplied = ({
    groupStack,
    pickReadyFilter,
    rescheduleDateFilter,
    priorityFilter,
    entityFilters,
  }) => {
    const nextStack = dedupeGroupStack(groupStack);
    const nextPickReady = pickReadyFilter === true ? true : null;
    const nextReschedule = rescheduleDateFilter || null;
    const nextPriority = priorityFilter || null;
    const nextEntity = entityFilters || null;
    if (this.unsubscribe) this.unsubscribe();
    this.setState({
      groupStack: nextStack,
      pickReadyFilter: nextPickReady,
      rescheduleDateFilter: nextReschedule,
      priorityFilter: nextPriority,
      entityFilters: nextEntity,
    }, () => {
      const cacheKey = this.dashboardCacheKey(nextStack, nextPickReady, nextReschedule, nextPriority, nextEntity);
      this.unsubscribe = cacheSubscribe(cacheKey, (data) => {
        if (!data) return;
        this.setState({ data });
        this.syncRtoOverdueAlert(data);
      });
      this.load(true);
      // Orders list should reflect the same filters immediately.
      this.props.navigation.navigate('Orders', {
        selectedStatus: 'ALL',
        groupStack: nextStack,
        pickReadyFilter: nextPickReady,
        rescheduleDateFilter: nextReschedule,
        priorityFilter: nextPriority,
        entityFilters: nextEntity,
        filtersAppliedAt: Date.now(),
      });
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
    this.props.navigation.navigate('Cash', { initialTab: 'pending' });
  };

  renderSectionHead = (icon, title) => (
    <View style={$.sectionHeadLeft}>
      <View style={[$.sectionIcoBubble, { width: 30, height: 30, borderRadius: 10 }]}>
        <MaterialCommunityIcons
          name={typeof icon === 'string' ? icon : 'view-grid-outline'}
          size={17}
          color={P}
        />
      </View>
      <Text style={$.sectionTitle}>{title}</Text>
    </View>
  );

  renderSectionLink = (label, onPress) => (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={$.sectionLink}>
      <Text style={$.sectionLinkT}>{label}</Text>
      <Text style={$.sectionLinkChevron}>›</Text>
    </TouchableOpacity>
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
          <View style={$.hdrBlobA} />
          <View style={$.hdrBlobB} />
          <SafeAreaView edges={['top']}>
            <View style={$.brandRow}>
              <View style={$.brandLeft}>
                <Image source={require('./assets/logo.png')} style={$.brandLogo} />
                <Text style={$.brandName}>Gramik</Text>
              </View>
              <NotificationBellButton navigation={this.props.navigation} />
            </View>
            <View style={$.hdrProfile}>
              <View style={$.hdrInfo}>
                <Text style={$.hdrHello} numberOfLines={1}>
                  Namaste 👋 <Text style={$.hdrName}>{name || 'Partner'}</Text>
                </Text>
                <View style={$.pillRow}>
                  <View style={[$.rolePill, $.rolePillAccent]}>
                    <MaterialCommunityIcons name="lightning-bolt" size={11} color="#FFF" />
                    <Text style={$.rolePillT}>LMD Partner</Text>
                  </View>
                </View>
              </View>
            </View>
          </SafeAreaView>
        </View>

        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
          <ReadOnlyBanner navigation={this.props.navigation} />
          {this.state.loading && !this.state.refreshing ? <ShimmerLoader /> : (
            <ScrollView contentContainerStyle={$.scroll} showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={this.state.refreshing} onRefresh={this.refresh} tintColor={P} colors={[P]} />}>

              {rule ? (
                <Animated.View style={[$.ruleCard, this.a(0)]}>
                  <View style={$.ruleIcoWrap}>
                    <MaterialCommunityIcons name="truck-fast-outline" size={16} color="#C2410C" />
                  </View>
                  <Text style={$.ruleT} numberOfLines={2}>{rule}</Text>
                  <Text style={$.ruleChev}>›</Text>
                </Animated.View>
              ) : null}

              <Animated.View style={[$.earnRow, this.a(1)]}>
                <View style={[$.earnCard, $.earnKamai]}>
                  <View style={$.earnIcoBubble}>
                    <MaterialCommunityIcons name="wallet-outline" size={16} color="#FFF" />
                  </View>
                  <View style={$.earnTextCol}>
                    <Text style={$.earnLbl}>KAMAI</Text>
                    <Text style={$.earnVal} numberOfLines={1}>₹ {fmt(earn)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => this.props.navigation.navigate('PenaltyOrders')}
                  style={[$.earnCard, $.earnPen]}
                >
                  <View style={$.earnIcoBubble}>
                    <MaterialCommunityIcons name="gift-outline" size={16} color="#FFF" />
                  </View>
                  <View style={$.earnTextCol}>
                    <Text style={$.earnLbl}>PENALTY</Text>
                    <Text style={$.earnVal} numberOfLines={1}>₹ {fmt(pen)}</Text>
                  </View>
                  <View style={$.penArrow}>
                    <MaterialCommunityIcons name="chevron-right" size={16} color="#E53935" />
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

              <Animated.View style={this.a(2)}>
                <View style={$.sectionRow}>
                  {this.renderSectionHead(
                    'chart-box-outline',
                    `Live Orders (${this.n(live?.all_orders ?? allCount(live)).toLocaleString('en-IN')})`,
                  )}
                  {this.renderSectionLink('Sabhi Dekhein', () => this.go('ALL'))}
                </View>
                <LiveOrdersGrid live={live} onPress={this.go} />
              </Animated.View>

              <Animated.View style={this.a(3)}>
                <View style={$.sectionRow}>
                  {this.renderSectionHead('truck-fast-outline', 'Aaj Ki Deliveries')}
                  <TouchableOpacity
                    onPress={this.openFilters}
                    activeOpacity={0.85}
                    style={[$.filterBtn, filtersActive && $.filterBtnOn]}
                  >
                    <Image source={require('./assets/filter.png')} style={$.filterIco} />
                    {filtersActive ? <View style={$.filterDot} /> : null}
                  </TouchableOpacity>
                </View>
                <View style={[$.card, hasToday ? { paddingBottom: 6 } : null]}>
                  {hasToday && filtersActive && (
                    <ActiveFiltersSummary
                      groupBy={levels[0]}
                      subGroupBy={levels[1]}
                      groupStack={levels}
                      pickReadyFilter={pickReadyFilter}
                      rescheduleDateFilter={rescheduleDateFilter}
                      priorityFilter={priorityFilter}
                      entityFilters={entityFilters}
                      onClearChip={this.clearFilterChip}
                      onClearGroup={this.clearGroupFilter}
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
                </View>
              </Animated.View>

              <Animated.View style={this.a(4)}>
                <View style={$.sectionRow}>
                  <Text style={$.sectionTitleAlone}>Quick Actions</Text>
                </View>
                <View style={$.qaGrid}>
                  {QUICK_ACTIONS.map((q) => {
                    const count = q.countKey ? Number(this.state.data?.[q.countKey] || 0) : 0;
                    return (
                      <TouchableOpacity
                        key={q.l}
                        style={[$.qaTile, { backgroundColor: q.tile }]}
                        activeOpacity={0.85}
                        onPress={() => (
                          q.nav === 'support'
                            ? this.dial(this.state.data?.Support)
                            : this.props.navigation.navigate(
                                q.nav === 'SettlementList' ? 'Cash' : q.nav,
                              )
                        )}
                      >
                        <View style={[$.qaBubble, { backgroundColor: q.bubble }]}>
                          <Image source={q.ico} style={$.qaIco} resizeMode="contain" />
                        </View>
                        <Text style={[$.qaL, { color: COLORS.textPrimary }]} numberOfLines={1}>{q.l}</Text>
                        <Text style={$.qaHint} numberOfLines={1}>{q.sub}</Text>
                        {count > 0 ? (
                          <View style={[$.qaBadge, { backgroundColor: q.countBg || q.accent }]}>
                            <Text style={$.qaBadgeT}>{count}</Text>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Animated.View>
              <View style={{ height: 16 }} />
            </ScrollView>
          )}
        </View>
        <NetBanner />

        <Modal
          visible={this.state.showRtoOverdueModal}
          transparent
          animationType="fade"
          onRequestClose={this.dismissRtoOverdueModal}
        >
          <Pressable style={$.rtoModalBackdrop} onPress={this.dismissRtoOverdueModal}>
            <Pressable style={$.rtoModalCard} onPress={() => {}}>
              <View style={$.rtoModalIconWrap}>
                <MaterialCommunityIcons name="backup-restore" size={28} color="#5B21B6" />
              </View>
              <Text style={$.rtoModalTitle}>RTO pending</Text>
              <Text style={$.rtoModalBody}>
                Aapke {this.state.rtoOverdueCount} order abhi RTO delivered nahi hue hain.
              </Text>
              <Text style={$.rtoModalSub}>
                1 din se zyada samay se RTO pending hai. Dark store par jaldi product wapas karein.
              </Text>
              <TouchableOpacity style={$.rtoModalPrimary} activeOpacity={0.88} onPress={this.openRtoFromAlert}>
                <Text style={$.rtoModalPrimaryT}>RTO Orders Dekhein</Text>
              </TouchableOpacity>
              <TouchableOpacity style={$.rtoModalGhost} activeOpacity={0.85} onPress={this.dismissRtoOverdueModal}>
                <Text style={$.rtoModalGhostT}>Baad mein</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    );
  }
}

function fmt(n) { try { return Number(n).toLocaleString('en-IN'); } catch(e) { return String(n); } }


const $ = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  hdr: {
    backgroundColor: P,
    paddingBottom: 18,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  hdrBlobA: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.10)',
    right: -60,
    top: -70,
  },
  hdrBlobB: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(0,0,0,0.10)',
    left: -45,
    bottom: -55,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandLogo: { width: 30, height: 30, borderRadius: 8, resizeMode: 'contain' },
  avatarChar: { color: '#FFF', fontSize: 22, fontWeight: '800' },
  brandName: { fontSize: 20, fontWeight: '800', color: '#FFF', letterSpacing: 0.4 },
  hdrProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profIco: { width: 44, height: 44, borderRadius: 22, resizeMode: 'contain' },
  hdrInfo: { flex: 1 },
  hdrHello: { fontSize: 15, fontWeight: '500', color: 'rgba(255,255,255,0.92)' },
  hdrName: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  rolePillAccent: { backgroundColor: 'rgba(255,255,255,0.26)' },
  rolePillT: { fontSize: 11, fontWeight: '700', color: '#FFF' },

  scroll: {
    paddingHorizontal: SPACING.screen,
    paddingTop: SPACING.sm,
    paddingBottom: 32,
    gap: SPACING.sm,
  },

  ruleCard: {
    backgroundColor: '#FFF4E8',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F5D9B0',
  },
  ruleIcoWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  ruleT: { flex: 1, fontSize: FONT.body, fontWeight: '600', color: '#7C2D12', lineHeight: 18 },
  ruleChev: { fontSize: 20, fontWeight: '700', color: '#C2410C', marginLeft: 6, opacity: 0.7 },

  earnRow: { flexDirection: 'row', gap: 8 },
  earnCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 58,
    overflow: 'hidden',
  },
  earnKamai: { backgroundColor: '#0D9488' },
  earnPen: { backgroundColor: '#E11D48' },
  earnIcoBubble: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  earnTextCol: { flex: 1, minWidth: 0 },
  earnLbl: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  earnVal: { color: '#FFF', fontSize: 16, fontWeight: '800', marginTop: 1, letterSpacing: -0.3 },
  penArrow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionHeadLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 },
  sectionIcoBubble: {
    borderRadius: RADIUS.icon,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { flex: 1, fontSize: FONT.h3, fontWeight: '700', color: COLORS.textPrimary },
  sectionTitleAlone: { fontSize: FONT.h3, fontWeight: '700', color: COLORS.textPrimary },
  sectionLink: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingLeft: 8 },
  sectionLinkT: { fontSize: FONT.body, fontWeight: '600', color: P },
  sectionLinkChevron: { fontSize: 18, fontWeight: '600', color: P, marginLeft: 2, marginTop: -1 },

  card: {
    padding: 0,
    marginBottom: 4,
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  filterBtnOn: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primarySoftBorder },
  filterIco: { width: 14, height: 14, resizeMode: 'contain', tintColor: P },
  filterDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FCD34D',
    borderWidth: 1,
    borderColor: P,
  },

  emptyWrap: { alignItems: 'center', paddingVertical: 18 },
  emptyImg: { width: 64, height: 64, resizeMode: 'contain', marginBottom: 8 },
  empty: { textAlign: 'center', color: COLORS.textSecondary, fontSize: FONT.title, fontWeight: '600', paddingVertical: 4 },

  qaGrid: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  qaTile: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  qaBubble: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  qaIco: {
    width: 34,
    height: 34,
  },
  qaL: { fontSize: 13, fontWeight: '800', letterSpacing: 0.1, textAlign: 'center' },
  qaHint: { fontSize: 10.5, fontWeight: '600', color: COLORS.textMuted, marginTop: 2, textAlign: 'center' },
  qaBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qaBadgeT: { fontSize: 10, fontWeight: '800', color: '#FFF' },

  rtoModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  rtoModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
  },
  rtoModalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  rtoModalTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  rtoModalBody: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    lineHeight: 20,
  },
  rtoModalSub: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 16,
  },
  rtoModalPrimary: {
    width: '100%',
    backgroundColor: P,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  rtoModalPrimaryT: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  rtoModalGhost: { marginTop: 10, paddingVertical: 8 },
  rtoModalGhostT: { color: '#64748B', fontSize: 13, fontWeight: '700' },
});

export default withV4Navigation(LMDDashboard);
