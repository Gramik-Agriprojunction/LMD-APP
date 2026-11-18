// SettlementList.js
// ✅ Updated full file
// ✅ Top summary uses ONLY API response: json.todays_order { total_order, cod_collected, cash_collected, upi_collected }
// ✅ Top summary alignment fixed (2x2 grid, proper spacing)
// ✅ Labels grey + values black bold (as requested)
// ✅ Search works on: order_code, order_id, farmer name, address, order_amount, collected_amount
// ✅ Status box tabs (no outer tab boxes) + updated colors:
//    - ALL tab: Blue (#0B5CAD)
//    - PENDING tab: Orange (same as before)
//    - SETTLED tab: Green (previous ALL color)
// ✅ Shows Order CODE in list (keeps order_id for selection + POST)

import React, { Component } from 'react';
import { withV4Navigation } from "../utils/v4Compat";
import { isReadOnly } from "../utils/lmdViewMode";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  TextInput,
  ActivityIndicator,
  Platform,
  FlatList,
  Linking,
  Animated,
  RefreshControl,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import constants from '../utils/constants';
import Toast from 'react-native-simple-toast';
import OrderCard from '../components/OrderCard';
import NotificationBellButton from '../components/NotificationBellButton';
import { HEADER } from '../theme/headerColors';
import { callFarmerExotel, dialDirect } from '../utils/exotelCall';

const P = '#5D3FD3';

const THEME = {
  green: P,
  bg: '#E8ECF4',
  border: '#E2E8F0',
  text: '#1E293B',
  subText: '#64748B',
  muted: '#94A3B8',
  orange: '#EA580C',
  blue: '#0B5CAD',
};

class SettlementList extends Component {
  constructor(props) {
    super(props);
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    this.state = {
      loading: false,
      submitting: false,
      search: '',
      activeTab: 'all', // all | pending | settled | disputed
      list: [],
      counts: { all: 0, pending: 0, settled: 0, disputed: 0 },

      // selection
      selectedMap: {}, // { [order_id]: true }

      showCall: true,
      stats: { todaysOrders: 0, codCollected: 0, cashDeposited: 0, upiCollected: 0 },
    };
  }

  componentDidMount() {
    const initialTab = this.props?.navigation?.getParam?.('initialTab');
    const tab = initialTab && ['all', 'pending', 'settled', 'disputed'].includes(initialTab)
      ? initialTab
      : this.state.activeTab;
    this.setState({ activeTab: tab }, () => this.fetchList(tab));

    this._hasBeenBlurred = false;
    this._blurSub = this.props.navigation.addListener('didBlur', () => {
      this._hasBeenBlurred = true;
    });
    this._focusSub = this.props.navigation.addListener('didFocus', () => {
      const clearSelection = this.props.navigation.getParam?.('clearSelection');
      const force =
        this.props.navigation.getParam?.('refreshSettlements') ||
        this.props.navigation.getParam?.('refresh');
      if (clearSelection || force) {
        this.props.navigation.setParams?.({
          clearSelection: undefined,
          refreshSettlements: undefined,
          refresh: undefined,
        });
        this.setState({ selectedMap: {}, search: '' }, () => this.fetchList(this.state.activeTab));
        return;
      }
      if (this._hasBeenBlurred) {
        this._hasBeenBlurred = false;
        this.fetchList(this.state.activeTab);
      }
    });
  }

  componentWillUnmount() {
    this._blurSub?.();
    this._focusSub?.();
  }

  goBack = () => {
    const nav = this.props?.navigation;
    if (nav?.canGoBack?.()) nav.goBack();
    else nav?.navigate?.('Home');
  };

  // ------------------------
  // Helpers
  // ------------------------
  normalize = (v) => String(v || '').toLowerCase();

  toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  money = (v) => {
    if (v === undefined || v === null || v === '') return '';
    const s = String(v);
    return s.endsWith('.00') ? s.replace('.00', '') : s;
  };

  // ------------------------
  // Response mapping helpers
  // ------------------------
  getFarmerObj = (it) => (it?.farmer && typeof it.farmer === 'object' ? it.farmer : {});

  getFarmerName = (it) =>
    String(it?.farmer_name || this.getFarmerObj(it)?.name || '').trim();

  getFarmerMobile = (it) =>
    String(it?.farmer_mobile || this.getFarmerObj(it)?.phone || this.getFarmerObj(it)?.mobile || '').trim();

  // Numeric order_id for selection + checkSettle/submitSettlement POST
  getOrderId = (it) => {
    if (it?.order_id !== undefined && it?.order_id !== null) return String(it.order_id).trim();
    return '';
  };

  getSettlementId = (it) =>
    it?.id !== undefined && it?.id !== null ? String(it.id).trim() : '';

  // AGRI code shown in list UI
  getOrderCode = (it) => {
    if (it?.order_code) return String(it.order_code).split(/\s+/)[0].trim();
    if (it?.order_id !== undefined && it?.order_id !== null) return String(it.order_id).trim();
    return '';
  };

  getAmount = (it) => {
    if (it?.amount != null) return this.toNum(it.amount);
    if (it?.order_amount != null) return this.toNum(it.order_amount);
    if (it?.order_grand_total != null) return this.toNum(it.order_grand_total);
    return 0;
  };

  getTimeSlot = (it) => String(it?.slot || '').trim();

  isPendingItem = (item) => {
    const ss = String(item?.settlement_status || '').toLowerCase();
    if (ss === 'settled' || ss === 'completed' || ss === 'success') return false;
    if (ss === 'disputed' || ss === 'rejected') return false;
    const ps = String(item?.payment_status || '').toLowerCase();
    if (ps === 'unpaid' || ps === 'pending') return true;
    return ss === 'pending' || String(item?.status || '').toLowerCase().includes('pending');
  };

  settlementBadge = (item) => {
    const ps = String(item?.payment_status || '').toLowerCase();
    const ss = String(item?.settlement_status || '').toLowerCase();
    if (ss === 'settled' || ss === 'completed' || ss === 'success' || ps === 'paid') {
      return { bg: '#16A34A', c: '#FFFFFF', label: 'Settled' };
    }
    if (ss === 'disputed') return { bg: '#DC2626', c: '#FFFFFF', label: 'Disputed' };
    if (ps === 'unpaid' || ps === 'pending' || this.isPendingItem(item)) {
      return { bg: '#EA580C', c: '#FFFFFF', label: 'Pending' };
    }
    return { bg: '#64748B', c: '#FFFFFF', label: 'Pending' };
  };

  // ------------------------
  // API: constants.settleList (GET)
  // ------------------------
  fetchList = (status) => {
    const tab = status || this.state.activeTab;
    const q = String(this.state.search || '').trim();
    let url = constants.settleList;
    const params = [];
    if (tab && tab !== 'all') params.push(`status=${tab}`);
    if (q) params.push(`search=${encodeURIComponent(q)}`);
    if (params.length) url += `?${params.join('&')}`;

    console.log('Settlement List API url== ', url);
    this.setState({ loading: true }, () => {
      console.log('Settlement List API calling== ', url);
      fetch(url, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + global.token,
          Accept: 'application/json',
        },
      })
        .then((r) => r.json())
        .then((json) => {
          console.log('Settlement List API response== ', JSON.stringify(json));

          const payload =
            json?.data && typeof json.data === 'object' && !Array.isArray(json.data)
              ? json.data
              : json;

          const rows = Array.isArray(payload?.list)
            ? payload.list
            : Array.isArray(json?.data)
              ? json.data
              : [];

          const summary = payload?.summary || json?.list_count || {};
          const pending = Number(summary?.pending_count ?? 0) || 0;
          const settled = Number(summary?.settled_count ?? 0) || 0;
          const disputed = Number(summary?.disputed_count ?? 0) || 0;
          const all = Number(summary?.total ?? rows.length) || rows.length;

          const keep = {};
          const old = this.state.selectedMap || {};
          rows.forEach((it) => {
            const id = this.getOrderId(it);
            if (id && old[id]) keep[id] = true;
          });

          const td = payload?.todays_order || json?.todays_order || {};
          const todaysOrders = this.toNum(td?.total_order);
          const codCollected = this.toNum(td?.cod_collected);
          const cashDeposited = this.toNum(td?.cash_deposited || td?.cash_collected);
          const upiCollected = this.toNum(td?.upi_collected);

          this.setState({
            loading: false,
            list: rows,
            counts: { all, pending, settled, disputed },
            selectedMap: keep,
            showCall: json?.show_call !== false,
            stats: { todaysOrders, codCollected, cashDeposited, upiCollected },
          });
        })
        .catch((e) => {
          console.log('Settlement List API error== ', e);
          Toast.show(e?.message || String(e), Toast.SHORT);
          this.setState({
            loading: false,
            list: [],
            counts: { all: 0, pending: 0, settled: 0, disputed: 0 },
            selectedMap: {},
            stats: { todaysOrders: 0, codCollected: 0, cashDeposited: 0, upiCollected: 0 },
          });
        });
    });
  };

  onTabChange = (tab) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(250, 'easeInEaseOut', 'opacity'));
    this.setState({ activeTab: tab, search: '' }, () => this.fetchList(tab));
  };

  // ------------------------
  // Next screen
  // ------------------------
  submitSettlement = () => {
    const selectedCount = this.getSelectedTotals().count;
    if (selectedCount === 0) {
      Toast.show('Pehle orders select karein', Toast.SHORT);
      return;
    }
    this.props.navigation.navigate('CashSettlement', {
      selectedOrders: this.getSelectedOrderIds(),
      selectedOrderItems: this.getSelectedOrderItems(),
      onSettlementComplete: () => this.refreshAfterSettlement(),
    });
  };

  refreshAfterSettlement = () => {
    this.setState({ selectedMap: {}, search: '' }, () => {
      this.fetchList(this.state.activeTab);
    });
  };

  openDetail = (item) => {
    const settlementId = this.getSettlementId(item);
    if (!settlementId) {
      Toast.show('Settlement ID nahi mila', Toast.SHORT);
      return;
    }
    this.props.navigation.navigate('SettlementDetail', { settlementId, preview: item });
  };

  // Search is server-side now — pass the query in the API and reload.
  getFilteredList = () => (Array.isArray(this.state.list) ? this.state.list : []);

  onSearchChange = (text) => {
    this.setState({ search: text });
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.fetchList(), 400);
  };

  clearSearch = () => {
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this.setState({ search: '' }, () => this.fetchList());
  };

  // ------------------------
  // Selection
  // ------------------------
  toggleSelect = (orderId) => {
    if (!orderId) return;
    this.setState((prev) => {
      const next = { ...(prev.selectedMap || {}) };
      if (next[orderId]) delete next[orderId];
      else next[orderId] = true;
      return { selectedMap: next };
    });
  };

  getSelectedOrderIds = () =>
    Object.keys(this.state.selectedMap || {}).map((id) => String(id));

  getSelectedOrderItems = () => {
    const { selectedMap } = this.state;
    const rows = Array.isArray(this.state.list) ? this.state.list : [];
    return rows.filter((it) => {
      const id = this.getOrderId(it);
      return id && selectedMap?.[id];
    });
  };

  getSelectedTotals = () => {
    const { selectedMap } = this.state;
    const rows = Array.isArray(this.state.list) ? this.state.list : [];

    let total = 0;
    let count = 0;

    rows.forEach((it) => {
      const id = this.getOrderId(it);
      if (id && selectedMap?.[id]) {
        const n = this.getAmount(it);
        if (n) total += n;
        count += 1;
      }
    });

    return { total, count };
  };

  // ------------------------
  // Tabs UI (status boxes) - UPDATED COLORS
  // ------------------------
  tabColors = { all: { bg: '#E6F4FF', border: THEME.blue, text: THEME.blue }, pending: { bg: '#FEF3C7', border: '#B45309', text: '#B45309' }, settled: { bg: '#DCFCE7', border: '#16A34A', text: '#16A34A' }, disputed: { bg: '#FEE2E2', border: '#DC2626', text: '#DC2626' } };

  // ------------------------
  // Row
  // ------------------------
  onCall = (phone, orderId) => callFarmerExotel({ orderId, toPhone: phone, context: 'delivery' });
  onCallStore = (phone) => dialDirect(phone);

  onWhatsApp = (phone) => {
    if (!phone) return;
    const p = String(phone).replace(/[^\d]/g, '');
    Linking.openURL(`https://wa.me/${p}`).catch(() => {});
  };

  renderRow = ({ item }) => {
    const orderId = this.getOrderId(item);
    const canSelect = !isReadOnly() && this.isPendingItem(item);
    const selected = !!this.state.selectedMap?.[orderId];
    const badge = this.settlementBadge(item);

    return (
      <View style={selected ? styles.rowSelectedWrap : styles.rowWrap}>
        <OrderCard
          order={item}
          compactChips
          useFarmerNew
          selected={selected}
          showCheckbox={canSelect}
          checkboxInHeader
          isChecked={selected}
          onToggleSelect={() => this.toggleSelect(orderId)}
          onHeaderPress={canSelect ? () => this.toggleSelect(orderId) : undefined}
          onBodyPress={() => this.openDetail(item)}
          onCall={(p, id) => this.onCall(p, id)}
          onWhatsApp={(p) => this.onWhatsApp(p)}
          onCallStore={(p) => this.onCallStore(p)}
          extraHeaderRight={
            <View style={[styles.settlePill, { backgroundColor: badge.bg, marginLeft: 6 }]}>
              <Text style={[styles.settlePillT, { color: badge.c }]}>{badge.label}</Text>
            </View>
          }
        />
      </View>
    );
  };

  // ------------------------
  // Header inside list
  // ------------------------
  renderListHeader = () => {
    const { counts } = this.state;
    const activeTab = this.state.activeTab;

    return (
      <View>
        <View style={styles.mainCard}>
          <View style={styles.tabsRow}>
            {[
              { key: 'all', label: 'All', count: counts.all },
              { key: 'pending', label: 'Pending', count: counts.pending },
              { key: 'settled', label: 'Settled', count: counts.settled },
              { key: 'disputed', label: 'Disputed', count: counts.disputed },
            ].map((t) => {
              const c = this.tabColors[t.key] || this.tabColors.all;
              const isActive = activeTab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  activeOpacity={0.85}
                  onPress={() => this.onTabChange(t.key)}
                  style={[styles.tab, isActive && { backgroundColor: c.bg, borderColor: c.border }]}
                >
                  <Text style={[styles.tabT, isActive && { color: c.text, fontWeight: '700' }]}>
                    {t.label} ({t.count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Text style={styles.subHint}>Pending orders select karke settle karein</Text>
      </View>
    );
  };

  render() {
    const { loading, submitting } = this.state;
    const rows = this.getFilteredList();
    const totals = this.getSelectedTotals();
    const selectedCount = totals.count;

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={HEADER.cash} />

        {/* Modern header sheet — DeliveryDetails style */}
        <View style={styles.hdrSheet}>
          <View style={styles.hdrBlobA} />
          <View style={styles.hdrBlobB} />
          <SafeAreaView edges={['top']}>
            <View style={styles.hdrTopRow}>
              <TouchableOpacity
                onPress={this.goBack}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.hdrBack}
              >
                <MaterialCommunityIcons name="arrow-left" size={20} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.hdrTitle}>Cash Jama</Text>
              <NotificationBellButton
                navigation={this.props.navigation}
                size={38}
                iconSize={17}
                style={{ backgroundColor: 'rgba(255,255,255,0.20)', marginLeft: 0 }}
              />
            </View>

            <View style={styles.hdrHero}>
              <View style={{ flex: 1 }}>
                <Text style={styles.hdrHeroLbl}>AAJ KI COD</Text>
                <Text style={styles.hdrHeroAmt}>₹ {this.money(this.state.stats?.codCollected) || '0'}</Text>
                <View style={styles.hdrChipRow}>
                  <View style={styles.hdrChip}>
                    <MaterialCommunityIcons name="package-variant" size={12} color="#FFF" />
                    <Text style={styles.hdrChipT}>{this.toNum(this.state.stats?.todaysOrders)} Orders</Text>
                  </View>
                  <View style={styles.hdrChip}>
                    <MaterialCommunityIcons name="cash-check" size={12} color="#FFF" />
                    <Text style={styles.hdrChipT}>Dep ₹{this.money(this.state.stats?.cashDeposited) || '0'}</Text>
                  </View>
                  <View style={styles.hdrChip}>
                    <MaterialCommunityIcons name="qrcode" size={12} color="#FFF" />
                    <Text style={styles.hdrChipT}>UPI ₹{this.money(this.state.stats?.upiCollected) || '0'}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.hdrStatus}>
                <Text style={[styles.hdrStatusT, { color: HEADER.cash }]}>Cash</Text>
              </View>
            </View>

            <View style={styles.hdrSearch}>
              <MaterialCommunityIcons name="magnify" size={18} color="rgba(255,255,255,0.7)" />
              <TextInput
                value={this.state.search}
                onChangeText={this.onSearchChange}
                placeholder="Order / farmer dhoondhein..."
                placeholderTextColor="rgba(255,255,255,0.45)"
                style={styles.hdrSearchInput}
                returnKeyType="search"
                onSubmitEditing={() => this.fetchList()}
              />
              {this.state.search ? (
                <TouchableOpacity onPress={this.clearSearch} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialCommunityIcons name="close-circle" size={18} color="rgba(255,255,255,0.55)" />
                </TouchableOpacity>
              ) : null}
            </View>
          </SafeAreaView>
        </View>

        <View style={{ flex: 1 }}>
            <FlatList
              data={loading ? [] : rows}
              keyExtractor={(it, idx) => `${this.getOrderId(it) || idx}-${idx}`}
              renderItem={this.renderRow}
              ListHeaderComponent={this.renderListHeader}
              ListEmptyComponent={() => (
                <View style={styles.emptyWrap}>
                  {loading ? (
                    <ActivityIndicator size="large" color={P} />
                  ) : (
                    <>
                      <Image source={require('./assets/dlh.png')} style={styles.emptyImg} />
                      <Text style={styles.emptyTitle}>No orders found</Text>
                      <Text style={styles.emptySub}>
                        {this.state.search ? 'Try a different search' : 'No settlement orders for this filter'}
                      </Text>
                    </>
                  )}
                </View>
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />

            {/* Fixed bottom bar */}
            <View style={styles.footerWrap}>
              <View style={styles.footerRow}>
                <View style={styles.footerLeft}>
                  <Text style={styles.totalLabel}>Total Cash</Text>
                  <Text style={styles.totalValue}>₹ {this.money(totals.total) || '0'}</Text>
                  {selectedCount > 0 ? (
                    <Text style={styles.footerSel}>{selectedCount} selected</Text>
                  ) : null}
                </View>
                {!isReadOnly() ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  disabled={submitting || selectedCount === 0}
                  onPress={this.submitSettlement}
                  style={[styles.settleBtn, selectedCount === 0 && styles.settleBtnOff]}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.settleBtnText}>Settle Now · ₹ {this.money(totals.total) || '0'}</Text>
                  )}
                </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EBE7F5' },

  hdrSheet: {
    backgroundColor: HEADER.cash,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  hdrBlobA: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.10)',
    right: -50,
    top: -60,
  },
  hdrBlobB: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.08)',
    left: -40,
    bottom: -50,
  },
  hdrTopRow: {
    height: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hdrBack: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hdrTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  hdrHero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  hdrHeroLbl: { color: 'rgba(255,255,255,0.80)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  hdrHeroAmt: { color: '#FFF', fontSize: 32, fontWeight: '800', letterSpacing: -0.6, marginTop: 2 },
  hdrChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  hdrChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  hdrChipT: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  hdrStatus: {
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 4,
  },
  hdrStatusT: { fontSize: 12, fontWeight: '800' },
  hdrSearch: {
    marginTop: 14,
    marginHorizontal: 14,
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  hdrSearchInput: { flex: 1, fontSize: 14, color: '#FFF', paddingVertical: 0, fontWeight: '500' },

  listContent: { paddingHorizontal: 10, paddingTop: 12, paddingBottom: 120 },

  mainCard: {
    backgroundColor: '#F7F5FC',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E5F0',
  },
  tabsRow: { flexDirection: 'row' },
  tab: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 9,
    marginHorizontal: 2,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tabT: { fontSize: 11, fontWeight: '600', color: THEME.subText },

  subHint: { fontSize: 12, color: THEME.muted, marginBottom: 10, marginLeft: 4, fontWeight: '500' },

  rowWrap: { marginBottom: 0 },
  rowSelectedWrap: { marginBottom: 0 },
  settlePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  settlePillT: { fontSize: 9, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingVertical: 50 },
  emptyImg: { width: 64, height: 64, resizeMode: 'contain', marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#475569', marginBottom: 4 },
  emptySub: { fontSize: 12, color: THEME.muted, textAlign: 'center', paddingHorizontal: 32 },

  footerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F7F5FC',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  footerRow: { flexDirection: 'row', alignItems: 'center' },
  footerLeft: { width: 100, marginRight: 12 },
  totalLabel: { fontSize: 10, fontWeight: '600', color: THEME.subText },
  totalValue: { fontSize: 18, fontWeight: '800', color: THEME.orange, marginTop: 2 },
  footerSel: { fontSize: 10, fontWeight: '600', color: P, marginTop: 3 },
  settleBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    shadowColor: '#16A34A',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  settleBtnOff: { opacity: 0.5 },
  settleBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
});
export default withV4Navigation(SettlementList);
