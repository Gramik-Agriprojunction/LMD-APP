import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Image,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
  Animated,
  Dimensions,
  LayoutAnimation,
  Platform,
  UIManager,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import constants from '../utils/constants';
import { withV4Navigation } from '../utils/v4Compat';
import * as STATUS_COLORS from '../utils/statusColors';
import OrderCard from '../components/OrderCard';
import { callFarmerExotel, dialDirect } from '../utils/exotelCall';
import ScreenHeader from '../components/ScreenHeader';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const P = '#5D3FD3';
const DANGER = '#DC2626';
const TAB_LIGHT_RED = '#FEE2E2';
const TAB_INACTIVE = '#B91C1C';
const PAGE_LIMIT = 20;

const TABS = [
  { key: 'total',    label: 'Sabhi',     param: '' },
  { key: 'applied',  label: 'Lagi Hui',  param: 'applied' },
  { key: 'upcoming', label: 'Aane Wali', param: 'upcoming' },
];

const SCREEN_W = Dimensions.get('window').width;
// Tab container: listContent paddingHorizontal 12 each side, inner padding 4 each side.
const TAB_INNER_W = SCREEN_W - 12 * 2 - 4 * 2;
const TAB_W = TAB_INNER_W / TABS.length;

const cap = (s) => {
  const str = String(s || '');
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Fade + slide-up wrapper for list items so new pages animate in nicely.
class FadeInItem extends React.PureComponent {
  constructor(props) {
    super(props);
    this.opacity = new Animated.Value(0);
    this.translateY = new Animated.Value(20);
  }
  componentDidMount() {
    const delay = Math.min((this.props.delay || 0) * 60, 360);
    Animated.parallel([
      Animated.timing(this.opacity, {
        toValue: 1,
        duration: 320,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(this.translateY, {
        toValue: 0,
        friction: 8,
        tension: 60,
        delay,
        useNativeDriver: true,
      }),
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

class PenaltyOrders extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      refreshing: false,
      loadingMore: false,
      orders: [],
      summary: { total: 0, applied_count: 0, upcoming_count: 0 },
      activeTab: 'total',
      page: 1,
      totalPages: 1,
      hasMore: false,
    };
    this.indicatorX = new Animated.Value(0);
    this.fetchSeq = 0; // guards against stale responses on rapid tab switches
  }

  componentDidMount() {
    this.fetchPenaltyOrders({ page: 1, append: false });
  }

  switchTab = (key) => {
    if (key === this.state.activeTab) return;
    const idx = TABS.findIndex((t) => t.key === key);
    Animated.spring(this.indicatorX, {
      toValue: idx * TAB_W,
      useNativeDriver: true,
      friction: 9,
      tension: 90,
    }).start();
    // Clear the list and show the loader so the switch is visibly confirmed,
    // then re-fetch. New rows fade in via FadeInItem when they arrive.
    this.setState(
      {
        activeTab: key,
        page: 1,
        hasMore: false,
        orders: [],
        isLoading: true,
      },
      () => this.fetchPenaltyOrders({ page: 1, append: false }),
    );
  };

  goBack = () => {
    const nav = this.props?.navigation;
    if (nav?.goBack) nav.goBack();
  };

  toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  fmt = (n) => {
    try { return Number(n).toLocaleString('en-IN'); } catch (e) { return String(n); }
  };

  mask = (p) => {
    if (!p) return '';
    const s = String(p);
    if (s.length < 6) return s;
    return s.slice(0, 2) + '****' + s.slice(-2);
  };

  callFarmer = (phone, orderId) => callFarmerExotel({ orderId, toPhone: phone, context: 'delivery' });
  dial = async (phone) => dialDirect(phone);

  wa = async (phone) => {
    if (!phone) return;
    const c = String(phone).replace(/[^\d]/g, '');
    try {
      const can = await Linking.canOpenURL(`whatsapp://send?phone=${c}`);
      if (can) { await Linking.openURL(`whatsapp://send?phone=${c}`); return; }
    } catch (e) {}
    Linking.openURL(`https://wa.me/${c}`).catch(() => Alert.alert('WhatsApp', String(phone)));
  };

  fetchPenaltyOrders = ({ page = 1, append = false } = {}) => {
    const tab = TABS.find((t) => t.key === this.state.activeTab);
    const params = [];
    if (tab?.param) params.push(`type=${encodeURIComponent(tab.param)}`);
    params.push(`page=${page}`);
    params.push(`limit=${PAGE_LIMIT}`);
    const qs = `?${params.join('&')}`;

    const seq = ++this.fetchSeq;

    fetch(constants.penaltyOrders + qs, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + global.token,
        Accept: 'application/json',
        'X-localization': 'en',
      },
    })
      .then((r) => r.json())
      .then((json) => {
        // Ignore stale responses (rapid tab switches).
        if (seq !== this.fetchSeq) return;

        const root = json?.data || {};
        const list = Array.isArray(root?.list)
          ? root.list
          : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.orders)
          ? json.orders
          : [];
        const s = root?.summary || {};
        const summary = {
          total: this.toNum(s?.total ?? list.length),
          applied_count: this.toNum(s?.applied_count),
          upcoming_count: this.toNum(s?.upcoming_count),
        };
        const pg = root?.pagination || root?.meta || {};
        const totalPages = Math.max(1, this.toNum(pg?.totalPages || pg?.total_pages || 1));
        const currentPage = Math.max(1, this.toNum(pg?.page || page));
        const hasMore = currentPage < totalPages;

        const nextOrders = append ? [...this.state.orders, ...list] : list;

        // Smoothly animate the new rows expanding into view.
        LayoutAnimation.configureNext({
          duration: 280,
          create: { type: 'easeInEaseOut', property: 'opacity' },
          update: { type: 'easeInEaseOut' },
        });

        this.setState({
          isLoading: false,
          refreshing: false,
          loadingMore: false,
          orders: nextOrders,
          summary,
          page: currentPage,
          totalPages,
          hasMore,
        });
      })
      .catch((e) => {
        if (seq !== this.fetchSeq) return;
        console.log('Penalty Orders API error== ', e);
        this.setState({
          isLoading: false,
          refreshing: false,
          loadingMore: false,
          orders: append ? this.state.orders : [],
          summary: append ? this.state.summary : { total: 0, applied_count: 0, upcoming_count: 0 },
        });
      });
  };

  onRefresh = () => {
    this.setState(
      { refreshing: true, page: 1, hasMore: false },
      () => this.fetchPenaltyOrders({ page: 1, append: false }),
    );
  };

  handleEndReached = () => {
    const { loadingMore, hasMore, isLoading, refreshing, page } = this.state;
    if (loadingMore || !hasMore || isLoading || refreshing) return;
    this.setState({ loadingMore: true }, () =>
      this.fetchPenaltyOrders({ page: page + 1, append: true }),
    );
  };

  statusBadge = (penaltyStatus) => {
    const st = String(penaltyStatus || '').toLowerCase();
    // Dark filled pill with white text — visually consistent across all states.
    if (st === 'applied') return { bg: '#B91C1C', c: '#FFFFFF', label: 'Applied' };
    if (st === 'upcoming' || st === 'pending') return { bg: '#B45309', c: '#FFFFFF', label: 'Upcoming' };
    if (st === 'waived' || st === 'cancelled') return { bg: '#15803D', c: '#FFFFFF', label: 'Waived' };
    return { bg: '#475569', c: '#FFFFFF', label: penaltyStatus || '-' };
  };

  settlementBadge = (st) => {
    const s = String(st || '').toLowerCase();
    if (s === 'pending') return { bg: '#FDE68A', c: '#92400E', label: 'Pending' };
    if (s === 'submitted' || s === 'received') return { bg: '#BFDBFE', c: '#1E3A8A', label: cap(s) };
    if (s === 'settled' || s === 'completed' || s === 'done') return { bg: '#86EFAC', c: '#166534', label: cap(s) };
    return { bg: '#E2E8F0', c: '#334155', label: cap(s) };
  };

  orderStatusBadge = (st) => {
    const so = STATUS_COLORS.getStatus(st);
    return { bg: so.tint, c: so.accent, label: so.label };
  };

  renderItem = ({ item, index }) => {
    const orderId = item?.order_id || '';
    const farmerName = item?.farmer_name || '-';
    const farmerMobile = item?.farmer_mobile || '';
    const amount = this.toNum(item?.amount);
    const payMode = String(item?.payment_mode || '').toUpperCase();
    const payStatus = String(item?.payment_status || '').toLowerCase();
    const ds = item?.dark_store || {};
    const drop = item?.shipping_address || '';
    const penaltyText = item?.penalty_text || '';
    const deliveryDate = item?.delivery_date || '';
    const windowEnds = item?.penalty_window_ends_at || '';
    const hoursRem = this.toNum(item?.hours_remaining);
    const badge = this.statusBadge(item?.penalty_status);
    const orderStatus = item?.status || '';
    const settlementStatus = item?.settlement_status || '';
    const orderBadge = this.orderStatusBadge(orderStatus);
    const setBadge = this.settlementBadge(settlementStatus);
    const isPenalty = !!item?.is_penalty;

    // Stagger only for the first viewport of items.
    const delayIndex = index < 6 ? index : 0;

    const isPendingSettlement = String(settlementStatus || '').toLowerCase() === 'pending';

    return (
      <FadeInItem delay={delayIndex}>
        <OrderCard
          order={item}
          compactChips
          onPress={() => this.props.navigation.navigate('DeliveryDetails', { order: item })}
          onCall={(p, id) => this.callFarmer(p, id)}
          onWhatsApp={(p) => this.wa(p)}
          onCallStore={(p) => this.dial(p)}
          extraHeaderRight={
            <View style={[styles.statusPill, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusT, { color: badge.c }]}>{badge.label}</Text>
            </View>
          }
        >
          {/* Penalty-specific extras live INSIDE the same card */}
          <View style={styles.penaltyExtras}>
            {!!penaltyText && (
              <View style={styles.reasonWrap}>
                <View style={styles.reasonHead}>
                  <Text style={styles.reasonLbl}>Penalty Ka Reason</Text>
                  {hoursRem > 0 && (
                    <View style={styles.hoursPill}>
                      <Text style={styles.hoursPillT}>{hoursRem}h baki</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.reasonText}>{penaltyText}</Text>
              </View>
            )}

            {(deliveryDate || windowEnds) && (
              <View style={styles.datesRow}>
                {!!deliveryDate && (
                  <View style={styles.dateItem}>
                    <Text style={styles.dateLbl}>Delivered</Text>
                    <Text style={styles.dateVal}>{deliveryDate}</Text>
                  </View>
                )}
                {!!windowEnds && (
                  <View style={styles.dateItem}>
                    <Text style={styles.dateLbl}>Window Ends</Text>
                    <Text style={[styles.dateVal, { color: DANGER }]}>{windowEnds}</Text>
                  </View>
                )}
              </View>
            )}

            {isPendingSettlement && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => this.props.navigation.navigate('SettlementList')}
                style={styles.settleBtn}
              >
                <View style={styles.settleBtnBadge}>
                  <Text style={styles.settleBtnBadgeT}>₹</Text>
                </View>
                <Text style={styles.settleBtnT}>Abhi Settle Karein</Text>
                <Text style={styles.settleBtnChev}>›</Text>
              </TouchableOpacity>
            )}
          </View>
        </OrderCard>
      </FadeInItem>
    );
  };

  renderFooter = () => {
    if (!this.state.loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={DANGER} />
        <Text style={styles.footerLoaderT}>Loading more...</Text>
      </View>
    );
  };

  renderHeader = () => {
    const { summary, activeTab } = this.state;
    const counts = {
      total: summary.total,
      applied: summary.applied_count,
      upcoming: summary.upcoming_count,
    };
    return (
      <View style={styles.tabBar}>
        <Animated.View
          style={[
            styles.tabIndicator,
            { width: TAB_W, transform: [{ translateX: this.indicatorX }] },
          ]}
        />
        {TABS.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              activeOpacity={0.85}
              onPress={() => this.switchTab(t.key)}
              style={styles.tabBtn}
            >
              <Text style={[styles.tabVal, isActive && styles.tabValActive]}>
                {counts[t.key]}
              </Text>
              <Text style={[styles.tabLbl, isActive && styles.tabLblActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  renderEmpty = () => {
    if (this.state.isLoading) return null;
    return (
      <View style={styles.emptyWrap}>
        <Image source={require('./assets/dlh.png')} style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>Koi Penalty Nahi</Text>
        <Text style={styles.emptySub}>
          Aapke paas koi penalty nahi hai.{' '}
          <Text style={styles.emptySubAccent}>Aise hi kaam karte rahein!</Text>
        </Text>
      </View>
    );
  };

  render() {
    const { isLoading, refreshing, orders } = this.state;

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={P} />

        <ScreenHeader bg={P} title="Penalty Orders" onBack={this.goBack} />

        <View style={styles.tabBarWrap}>{this.renderHeader()}</View>

        {/* Skip the bottom safe-area inset on iOS so the list runs flush to the
            home-indicator (matches the dashboard look). Keep it on Android so
            the navigation gesture bar doesn't clip the last row. */}
        <SafeAreaView edges={[]} style={{ flex: 1 }}>
          {isLoading && !refreshing ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="small" color={P} />
              <Text style={styles.loaderText}>Loading...</Text>
            </View>
          ) : (
            <FlatList
              data={orders}
              extraData={this.state.activeTab}
              keyExtractor={(item, i) => `${this.state.activeTab}-${item?.id || item?.order_id || i}`}
              renderItem={this.renderItem}
              ListEmptyComponent={this.renderEmpty}
              ListFooterComponent={this.renderFooter}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onEndReached={this.handleEndReached}
              onEndReachedThreshold={0.4}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={this.onRefresh} colors={[P]} tintColor={P} />
              }
            />
          )}
        </SafeAreaView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E8ECF4' },

  headerWrap: { backgroundColor: P },
  headerSafe: { backgroundColor: P },
  headerRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  backImg: { width: 17, height: 17, resizeMode: 'contain', tintColor: '#FFF' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#FFF', fontSize: 15, fontWeight: '700' },

  listContent: { paddingHorizontal: 8, paddingTop: 2, paddingBottom: 24, flexGrow: 1 },
  tabBarWrap: { paddingHorizontal: 8, paddingTop: 8 },

  tabBar: {
    backgroundColor: TAB_LIGHT_RED,
    borderRadius: 14,
    padding: 4,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'stretch',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    backgroundColor: '#FFF',
    borderRadius: 10,
    shadowColor: '#991B1B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, flexDirection: 'row', justifyContent: 'center' },
  tabVal: { color: TAB_INACTIVE, fontSize: 16, fontWeight: '800', includeFontPadding: false, marginRight: 6 },
  tabLbl: { color: TAB_INACTIVE, fontSize: 12.5, fontWeight: '600', letterSpacing: 0.2, includeFontPadding: false, opacity: 0.85 },
  tabValActive: { color: DANGER },
  tabLblActive: { color: DANGER, opacity: 1 },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    borderLeftWidth: 4,
    borderLeftColor: DANGER,
    overflow: 'hidden',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  orderId: { fontSize: 12, fontWeight: '700', color: P, maxWidth: '65%' },
  // Match the OrderCard's status chip exactly (rounded 8, smaller font).
  statusPill: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, marginLeft: 4, alignItems: 'center', justifyContent: 'center' },
  statusT: { fontSize: 7.5, fontWeight: '700', letterSpacing: 0.2, includeFontPadding: false, lineHeight: 10 },

  farmerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10 },
  farmerAvt: { width: 32, height: 32, borderRadius: 16, marginRight: 10, resizeMode: 'cover' },
  farmerName: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  farmerPhone: { fontSize: 11, fontWeight: '400', color: '#94A3B8', marginTop: 1 },
  actionIco: { width: 26, height: 26, resizeMode: 'contain' },

  routeWrap: { marginHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  routeTl: { width: 14, alignItems: 'center', marginRight: 8, paddingTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  routeLine: { width: 1.5, flex: 1, minHeight: 10, backgroundColor: '#D1D5DB', marginVertical: 3 },
  routeBody: { flex: 1, paddingBottom: 10 },
  routeLbl: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4, marginBottom: 3 },
  routeTitle: { fontSize: 12, fontWeight: '600', color: '#1E293B' },
  routePhone: { fontSize: 10, fontWeight: '500', color: '#94A3B8', marginTop: 1 },
  routeAddr: { fontSize: 11, fontWeight: '400', color: '#64748B', lineHeight: 16, marginTop: 1 },

  // Penalty-specific extras stack inside the shared OrderCard.
  penaltyExtras: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  reasonWrap: { backgroundColor: '#FEF2F2', marginHorizontal: 0, marginTop: 0, marginBottom: 10, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FEE2E2' },
  reasonHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  reasonLbl: { flex: 1, fontSize: 10, fontWeight: '700', color: '#B91C1C', letterSpacing: 0.4 },
  hoursPill: { backgroundColor: '#B91C1C', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  hoursPillT: { color: '#FFF', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  reasonText: { fontSize: 12, fontWeight: '500', color: '#7F1D1D', lineHeight: 17 },

  datesRow: { flexDirection: 'row', marginHorizontal: 0, marginBottom: 10 },
  dateItem: { flex: 1, paddingRight: 8 },
  dateLbl: { fontSize: 10, fontWeight: '600', color: '#94A3B8', letterSpacing: 0.3, marginBottom: 2 },
  dateVal: { fontSize: 11, fontWeight: '600', color: '#1E293B' },

  cardFoot: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  pill: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, marginRight: 4 },
  pillT: { fontSize: 9, fontWeight: '600' },
  amount: { fontSize: 15, fontWeight: '800', color: '#16A34A' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 12, marginTop: 2, marginBottom: 6 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  metaDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 5 },
  metaPillLbl: { fontSize: 9.5, fontWeight: '500', marginRight: 4, opacity: 0.85, letterSpacing: 0.2 },
  metaPillT: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },

  settleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    marginHorizontal: 0,
    marginBottom: 0,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  settleBtnBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  settleBtnBadgeT: { color: '#FFF', fontSize: 13, fontWeight: '800', includeFontPadding: false, lineHeight: 15 },
  settleBtnT: { color: '#FFF', fontSize: 13.5, fontWeight: '700', letterSpacing: 0.3 },
  settleBtnChev: { color: '#FFF', fontSize: 20, fontWeight: '700', marginLeft: 8, includeFontPadding: false, lineHeight: 20 },

  footerLoader: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  footerLoaderT: { marginLeft: 8, fontSize: 11.5, fontWeight: '600', color: DANGER },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loaderText: { marginTop: 10, fontSize: 12, fontWeight: '600', color: '#6B7280' },

  emptyWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 40, paddingTop: 80 },
  emptyIcon: { width: 110, height: 110, resizeMode: 'contain', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#374151', marginBottom: 8 },
  emptySub: { fontSize: 13, fontWeight: '400', color: '#16A34A', textAlign: 'center', lineHeight: 20 },
  emptySubAccent: { color: '#16A34A', fontWeight: '500' },
});

export default withV4Navigation(PenaltyOrders);
