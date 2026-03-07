// Screens/OrdersScreen.js
import React, { Component } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TextInput,
  LayoutAnimation,
  UIManager,
  Image,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import constants from './constants';

Ionicons.loadFont?.();

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const C = {
  green: '#0F7451',
  bg: '#F3F5F7',
  card: '#FFFFFF',
  text: '#111827',
  sub: '#6B7280',
  line: '#E5E7EB',
  border: '#D7DEE6',
  badgeRed: '#EF4444',

  warnBg: '#FFF7ED',
  warnText: '#9A3412',

  okBg: '#ECFDF5',
  okText: '#065F46',

  blueBg: '#EFF6FF',
  blueText: '#1D4ED8',
};

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const toTitle = (s) => {
  const str = String(s || '').replace(/_/g, ' ').trim();
  if (!str) return '';
  return str
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const formatDateLabel = (s) => {
  const raw = String(s || '').trim();
  if (!raw) return '';
  const iso = raw.replace(' ', 'T');
  const d = new Date(iso);
  if (isNaN(d.getTime())) return raw;
  try {
    return d.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return raw;
  }
};

const mapStatus = (order_status) => {
  const s = String(order_status || '').toUpperCase();

  if (s === 'PENDING') return { label: 'Pending', tone: 'warn', tab: 'pending' };
  if (s === 'DELIVERED') return { label: 'Delivered', tone: 'ok', tab: 'delivered' };
  if (s === 'CANCELLED') return { label: 'Cancelled', tone: 'cancelled', tab: 'cancelled' };
  if (s === 'RTO') return { label: 'RTO', tone: 'rto', tab: 'rto' };

  if (s === 'RESCHEDULE') return { label: 'Rescheduled', tone: 'reschedule', tab: 'reschedule' };
  if (s === 'PICKUP') return { label: 'Picked Up', tone: 'pickup', tab: 'pickup' };
  if (s === 'PICKUPCANCELLED') return { label: 'Pickup Cancelled', tone: 'pickupcancelled', tab: 'pickupcancelled' };
  if (s === 'REJECTED') return { label: 'Rejected', tone: 'rejected', tab: 'rejected' };
  if (s === 'INTRANSIT') return { label: 'In Transit', tone: 'intransit', tab: 'intransit' };

  return { label: s || 'Pending', tone: 'warn', tab: 'pending' };
};

export default class OrdersScreen extends Component {
  constructor(props) {
    super(props);

    this.searchTimer = null;

    this.state = {
      search: '',
      activeTab: 'all',
      expanded: {},

      notifications: 0,

      isLoading: false,

      stats: {
        totalOrders: 0,
        pending: 0,
        totalValue: 0,
      },

      orders: [],
      retailerId: '',
    };
  }

  componentDidMount() {
    this.ordersApi();
  }

  componentWillUnmount() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  buildOrdersUrl() {
    const base = String(constants.orders || '');
    const { search, activeTab } = this.state;

    let params = [];

    if (String(search || '').trim()) {
      params.push(`search=${encodeURIComponent(search.trim())}`);
    }

    if (activeTab !== 'all') {
      params.push(`status=${encodeURIComponent(String(activeTab).toUpperCase())}`);
    }

    if (!params.length) return base;

    const joiner = base.includes('?') ? '&' : '?';
    return `${base}${joiner}${params.join('&')}`;
  }

  ordersApi() {
    const url = this.buildOrdersUrl();
    console.log('orders url== ', url);

    this.setState({ isLoading: true });

    fetch(url, {
      headers: {
        'X-localization': 'en',
        Authorization: 'Bearer ' + global.token,
      },
      method: 'GET',
    })
      .then((r) => r.json())
      .then((res) => {
        console.log('orders response== ', JSON.stringify(res));

        const list = Array.isArray(res?.data?.order) ? res.data.order : [];
        const count = res?.count || res?.data?.count || {};

        this.setState({
          isLoading: false,
          orders: list,
          stats: {
            totalOrders: Number(count?.total_order || list.length || 0),
            pending: Number(count?.pending || 0),
            totalValue: Number(count?.total_value || 0),
          },
          notifications: Number(count?.notification_count || 0),
          retailerId: String(count?.retailer_id || ''),
        });

        if (!res?.status) {
          console.log('orders api status false, message== ', res?.message);
        }

        if (!Array.isArray(res?.data?.order)) console.log('missing key: data.order (array)');
        if (!count?.retailer_id) console.log('missing key: count.retailer_id');
      })
      .catch((e) => {
        console.log('orders error== ', e);
        this.setState({ isLoading: false });
      });
  }

  onSearchChange = (t) => {
    const val = String(t || '');
    this.setState({ search: val });

    if (this.searchTimer) clearTimeout(this.searchTimer);

    this.searchTimer = setTimeout(() => {
      this.ordersApi();
    }, 500);
  };

  clearSearch = () => {
    if (this.searchTimer) clearTimeout(this.searchTimer);

    this.setState({ search: '' }, () => {
      this.ordersApi();
    });
  };

  onBack = () => this.props?.navigation?.goBack?.();
  onBell = () => {};
  onMore = () => {};

  setTab = (t) =>
    this.setState({ activeTab: t }, () => {
      this.ordersApi();
    });

  toggleExpand = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    this.setState((p) => ({ expanded: { ...p.expanded, [id]: !p.expanded[id] } }));
  };

  renderHeader() {
    const retailerId = String(this.state.retailerId || '').trim() || '--';

    return (
      <View style={styles.headerWrap}>
        <SafeAreaView style={styles.headerSafe} />
        <StatusBar backgroundColor={C.green} barStyle="light-content" />

        <View style={styles.headerRow}>
          <TouchableOpacity onPress={this.onBack} activeOpacity={0.85} style={styles.headerBtn}>
            <Image style={{ height: 40, width: 40, resizeMode: 'contain' }} source={require('./assets/bag2.png')} />
          </TouchableOpacity>

          <View style={{ flex: 1, paddingHorizontal: 8 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Orders
            </Text>

            <View style={styles.headerSubRow}>
              <Text style={styles.headerSubText} numberOfLines={1}>
                Retailer ID : {retailerId}
              </Text>
            </View>
          </View>

          <TouchableOpacity onPress={this.onBell} activeOpacity={0.85} style={styles.headerBtnRight}>
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {Number(this.state.notifications || 0) > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{String(this.state.notifications || 0)}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  renderStats() {
    const { totalOrders, pending, totalValue } = this.state.stats;

    return (
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: '#1B7D5D' }]}>
          <Ionicons name="receipt-outline" size={16} color="#fff" />
          <Text style={styles.statLabel} numberOfLines={2}>
            Total Orders
          </Text>
          <Text style={styles.statValue} numberOfLines={1}>
            {String(totalOrders || 0)}
          </Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: '#273446' }]}>
          <Ionicons name="time-outline" size={16} color="#fff" />
          <Text style={styles.statLabel} numberOfLines={2}>
            Pending
          </Text>
          <Text style={styles.statValue} numberOfLines={1}>
            {String(pending || 0)}
          </Text>
        </View>

        <View style={[styles.statBox, { backgroundColor: '#B76112' }]}>
          <Ionicons name="cash-outline" size={16} color="#fff" />
          <Text style={styles.statLabel} numberOfLines={2}>
            Total Value
          </Text>
          <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.86}>
            {money(totalValue || 0)}
          </Text>
        </View>
      </View>
    );
  }

  renderSearch() {
    const has = String(this.state.search || '').length > 0;

    return (
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#9CA3AF" />
          <TextInput
            value={this.state.search}
            onChangeText={this.onSearchChange}
            placeholder="Search Order / Customer / Product"
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => this.ordersApi()}
          />
          {has ? (
            <TouchableOpacity activeOpacity={0.85} onPress={this.clearSearch} style={styles.clearBtn}>
              <Image source={require('./assets/close.png')} style={{ width: 18, height: 18, resizeMode: 'contain' }} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  tabTone = (tab) => {
    if (tab === 'pending') return { bg: '#edbf4b', text: '#FFFFFF' };
    if (tab === 'pickup') return { bg: '#8B5CF6', text: '#FFFFFF' };
    if (tab === 'reschedule') return { bg: '#14B8A6', text: '#FFFFFF' };
    if (tab === 'cancelled') return { bg: '#e55866', text: '#FFFFFF' };
    if (tab === 'delivered') return { bg: '#229b79', text: '#FFFFFF' };
    if (tab === 'rto') return { bg: '#EF4444', text: '#FFFFFF' };
    return { bg: C.green, text: '#FFFFFF' };
  };

  renderTabs() {
    const Tab = ({ id, label }) => {
      const active = this.state.activeTab === id;
      const tone = this.tabTone(id);
      return (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => this.setTab(id)}
          style={[
            styles.tabBtn,
            active ? { backgroundColor: tone.bg, borderColor: tone.bg } : null,
          ]}
        >
          <Text
            style={[
              styles.tabText,
              active ? { color: tone.text, fontWeight: '400' } : null,
            ]}
          >
            {label}
          </Text>
        </TouchableOpacity>
      );
    };

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        <Tab id="all" label="All" />
        <Tab id="pending" label="Pending" />
        <Tab id="pickup" label="Picked Up" />
        <Tab id="reschedule" label="Rescheduled" />
        <Tab id="cancelled" label="Cancelled" />
        <Tab id="delivered" label="Delivered" />
        <Tab id="rto" label="RTO" />
      </ScrollView>
    );
  }

  renderStatusChip(status, tone) {
    if (tone === 'warn') return [styles.chip, styles.chipWarn, styles.chipTextWarn];
    if (tone === 'ok') return [styles.chip, styles.chipOk, styles.chipTextOk];
    if (tone === 'rto') return [styles.chip, styles.chipRto, styles.chipTextRto];
    if (tone === 'pickup') return [styles.chip, styles.chipPickup, styles.chipTextPickup];
    if (tone === 'intransit') return [styles.chip, styles.chipIntransit, styles.chipTextIntransit];
    if (tone === 'rejected') return [styles.chip, styles.chipRejected, styles.chipTextRejected];
    if (tone === 'pickupcancelled') return [styles.chip, styles.chipPickupCancelled, styles.chipTextPickupCancelled];
    if (tone === 'reschedule') return [styles.chip, styles.chipReschedule, styles.chipTextReschedule];
    if (tone === 'cancelled') return [styles.chip, styles.chipCancelled, styles.chipTextCancelled];
    return [styles.chip, styles.chipBlue, styles.chipTextBlue];
  }

  renderPaymentStatusText(status) {
    const s = String(status || '').trim().toLowerCase();
    if (!s) return null;

    const isPaid = s === 'paid' || s === 'success' || s === 'completed';
    const isUnpaid = s === 'unpaid' || s === 'pending' || s === 'failed';

    let color = '#6B7280';
    if (isPaid) color = '#16A34A';
    if (isUnpaid) color = '#DC2626';

    return (
      <Text style={[styles.payText, { color }]} numberOfLines={1}>
        {toTitle(status)}
      </Text>
    );
  }

  getVisibleOrders = () => {
    const tab = this.state.activeTab;
    const list = Array.isArray(this.state.orders) ? this.state.orders : [];

    if (tab === 'all') return list;

    return list.filter((o) => {
      const m = mapStatus(o?.order_status);
      return m.tab === tab;
    });
  };

renderOrderCard(o) {
  const expanded = !!this.state.expanded[String(o?.id)];
  const statusMap = mapStatus(o?.order_status);

  const code = String(o?.code || '');
  const amount = Number(o?.grand_total || 0);
  const dateLabel = formatDateLabel(o?.created_at);

  const ship = o?.shipping_address || {};
  const customer = String(ship?.name || '');
  const address = String(ship?.address || ship?.city || ship?.state || '');
  const payment = toTitle(o?.payment_type);

  const itemsCount = Number(o?.sum_quantity || 0);
  const otp = Number(o?.otp || '-');


  const thumbUri = String(o?.first_product_image || '');
  const products = Array.isArray(o?.products) ? o.products : [];

  const paymentStatus = o?.payment_status;

  const rowTone =
    statusMap.tone === 'warn'
      ? '#edbf4b'
      : statusMap.tone === 'ok'
      ? '#229b79'
      : statusMap.tone === 'rto'
      ? '#EF4444'
      : statusMap.tone === 'pickup'
      ? '#8B5CF6'
      : statusMap.tone === 'intransit'
      ? '#0EA5E9'
      : statusMap.tone === 'rejected'
      ? '#111827'
      : statusMap.tone === 'pickupcancelled'
      ? '#F97316'
      : statusMap.tone === 'reschedule'
      ? '#14B8A6'
      : statusMap.tone === 'cancelled'
      ? '#e55866'
      : '#3B82F6';

  return (
    <View key={String(o?.id)} style={styles.cardOuter}>
      <View style={styles.card}>
        <View style={[styles.cardTop, { borderLeftWidth: 5, borderLeftColor: rowTone }]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => this.props?.navigation?.navigate?.('OrderDetails', { order: o, orderId: o?.id })}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <View style={styles.thumb}>
              {thumbUri ? (
                <Image source={{ uri: thumbUri }} style={styles.thumbImg} />
              ) : (
                <Ionicons name="cart-outline" size={22} color={C.green} />
              )}
            </View>

            <View style={{ flex: 1, paddingRight: 8 }}>
              <View style={styles.topLine}>
                <Text style={styles.orderId} numberOfLines={1}>
                  {code || `#${String(o?.id || '')}`}
                </Text>

                {this.renderPaymentStatusText(paymentStatus)}
              </View>

              <Text style={styles.orderMeta} numberOfLines={1}>
                {customer || '--'} • {address || '--'}
              </Text>

              <Text style={styles.orderSub} numberOfLines={1}>
                {String(itemsCount || 0)} Items • {dateLabel || '--'}
              </Text>
              <Text style={[styles.orderSub,{fontWeight:'600',color:'#292b28'}]} numberOfLines={1}>
                OTP : {String(otp || '--')}   •   {payment || '-'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amount}>{money(amount)}</Text>

            <TouchableOpacity activeOpacity={0.9} onPress={() => this.toggleExpand(String(o?.id))}>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={17}
                color={C.green}
                style={{ marginTop: 30 }}
              />
            </TouchableOpacity>
          </View>
        </View>

        {expanded ? (
          <View style={styles.expandWrap}>
            <View style={styles.expandHeader}>
              <Text style={[styles.expandHeadText, { flex: 1.25 }]}>Product</Text>
              <Text style={[styles.expandHeadText, { flex: 0.45, textAlign: 'center' }]}>Qty</Text>
              <Text style={[styles.expandHeadText, { flex: 0.55, textAlign: 'right' }]}>Price</Text>
            </View>

            {products.map((x, idx) => {
              const name = String(x?.name || '');
              const qty = Number(x?.quantity || 0);
              const price = x?.price == null ? null : Number(x?.price || 0);
              const img = String(x?.thumbnail_img || '');

              return (
                <View key={`${String(o?.id)}_${idx}`} style={styles.expandRow}>
                  <View style={styles.expandLeft}>
                    <View style={styles.expandImgBox}>
                      {img ? (
                        <Image source={{ uri: img }} style={styles.expandImg} />
                      ) : (
                        <Ionicons name="image-outline" size={16} color="#9CA3AF" />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.expandName} numberOfLines={1}>
                        {name || '--'}
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.expandQty, { flex: 0.45 }]} numberOfLines={1}>
                    {String(qty || 0)}
                  </Text>

                  <Text style={[styles.expandPrice, { flex: 0.55 }]} numberOfLines={1}>
                    {price == null ? '--' : money(price)}
                  </Text>
                </View>
              );
            })}

           
          </View>
        ) : null}
      </View>
    </View>
  );
}

  renderEmpty() {
    if (this.state.isLoading) return null;

    return (
      <View style={{ paddingHorizontal: 14, paddingTop: 40, alignItems: 'center' }}>
        <Ionicons name="receipt-outline" size={80} color="#9CA3AF" />
        <Text
          style={{
            marginTop: 10,
            color: '#6B7280',
            fontSize: 13,
            fontWeight: '400',
            alignSelf: 'center',
            textAlign: 'center',
          }}
        >
          No orders found
        </Text>
      </View>
    );
  }

  render() {
    const orders = this.getVisibleOrders();

    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {this.renderHeader()}

        <ScrollView
          contentContainerStyle={{ paddingBottom: 18 + 140 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.pagePad}>
            {this.renderStats()}
            {this.renderSearch()}
            {this.renderTabs()}
          </View>

          {this.state.isLoading ? (
            <View style={{ paddingTop: 25 }}>
              <ActivityIndicator size="small" color={C.green} />
            </View>
          ) : null}

          {orders.length ? orders.map((o) => this.renderOrderCard(o)) : this.renderEmpty()}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  headerWrap: { backgroundColor: C.green },
  headerSafe: { backgroundColor: C.green },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10 },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  headerBtnRight: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  headerSubText: { color: '#D1FAE5', fontSize: 12, fontWeight: '500' },

  badge: {
    position: 'absolute',
    top: 5,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.badgeRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '400' },

  pagePad: { paddingHorizontal: 14, paddingTop: 12 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  statBox: { width: '31.8%', borderRadius: 16, padding: 10, minHeight: 76 },
  statLabel: { marginTop: 9, color: '#fff', fontSize: 11, fontWeight: '400', lineHeight: 14 },
  statValue: { marginTop: 6, color: '#fff', fontSize: 18, fontWeight: '800' },

  searchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  searchBox: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1.2,
    borderColor: C.border,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 13.5, color: C.text, paddingVertical: 0 },
  clearBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  tabsRow: { paddingVertical: 10, gap: 8, paddingRight: 14 },
  tabBtn: { borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: '#fff' },
  tabText: { fontSize: 11.5, color: C.text, fontWeight: '400' },

  cardOuter: { paddingHorizontal: 14, marginTop: 12 },
  card: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1.1, borderColor: '#E5E7EB', overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },

  thumb: {
    width: 40,
    height: 40,
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%', resizeMode: 'contain' },

  topLine: { flexDirection: 'row', alignItems: 'center' },
  orderId: { color: C.text, fontSize: 12, fontWeight: '700', marginRight: 8 },
  orderMeta: { marginTop: 8, color: C.sub, fontSize: 12, fontWeight: '400' },
  orderSub: { color: C.sub, fontSize: 12, fontWeight: '400', marginTop: 8 },
  amount: { color: C.text, fontSize: 13, fontWeight: '600'},

  chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontSize: 10, fontWeight: '400' },

  chipWarn: { backgroundColor: '#edbf4b' },
  chipTextWarn: { color: '#FFFFFF' },

  chipOk: { backgroundColor: '#229b79' },
  chipTextOk: { color: '#FFFFFF' },

  chipBlue: { backgroundColor: '#3B82F6' },
  chipTextBlue: { color: '#FFFFFF' },

  chipCancelled: { backgroundColor: '#e55866' },
  chipTextCancelled: { color: '#FFFFFF' },

  chipRto: { backgroundColor: '#EF4444' },
  chipTextRto: { color: '#FFFFFF' },

  chipPickup: { backgroundColor: '#8B5CF6' },
  chipTextPickup: { color: '#FFFFFF' },

  chipIntransit: { backgroundColor: '#0EA5E9' },
  chipTextIntransit: { color: '#FFFFFF' },

  chipRejected: { backgroundColor: '#111827' },
  chipTextRejected: { color: '#FFFFFF' },

  chipPickupCancelled: { backgroundColor: '#F97316' },
  chipTextPickupCancelled: { color: '#FFFFFF' },

  chipReschedule: { backgroundColor: '#14B8A6' },
  chipTextReschedule: { color: '#FFFFFF' },

  payText: { marginLeft: 6, fontSize: 11, fontWeight: '500' },

  expandWrap: { borderTopWidth: 1, borderTopColor: C.line, backgroundColor: '#fff' },

  expandHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F3F4F6' },
  expandHeadText: { color: '#374151', fontSize: 12, fontWeight: '400' },

  expandRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },

  expandLeft: { flex: 1.25, flexDirection: 'row', alignItems: 'center', paddingRight: 10 },
  expandImgBox: { width: 30, height: 30, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  expandImg: { width: '100%', height: '100%', resizeMode: 'cover' },

  expandName: { color: C.text, fontSize: 12, fontWeight: '400' },
  expandQty: { textAlign: 'center', color: C.text, fontSize: 12, fontWeight: '400' },
  expandPrice: { textAlign: 'right', color: C.text, fontSize: 12, fontWeight: '400' },
  actionsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 },
  actionBtn: { flex: 1, height: 42, borderRadius: 14, backgroundColor: '#0B6B47', alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});