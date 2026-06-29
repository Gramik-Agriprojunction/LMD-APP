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
import constants from '../utils/constants';
import Toast from 'react-native-simple-toast';
import OrderCard from '../components/OrderCard';
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
  }

  goBack = () => {
    const nav = this.props?.navigation;
    if (nav?.goBack) nav.goBack();
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
    this.props.navigation.navigate('CashSettlement', {
      selectedOrders: this.getSelectedOrderIds(),
      selectedOrderItems: this.getSelectedOrderItems(),
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
    const canSelect = this.isPendingItem(item);
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
    const { counts, stats } = this.state;
    const activeTab = this.state.activeTab;

    return (
      <View>
        <View style={styles.mainCard}>
          <Text style={styles.cardTitle}>Today's Settlement</Text>

          <View style={styles.statsRow}>
            <View style={styles.statCell}>
              <Text style={styles.statVal}>{this.toNum(stats?.todaysOrders)}</Text>
              <Text style={styles.statLbl}>Orders</Text>
            </View>
            <View style={styles.statSep} />
            <View style={styles.statCell}>
              <Text style={[styles.statVal, { color: THEME.orange }]}>₹{this.money(stats?.codCollected) || '0'}</Text>
              <Text style={styles.statLbl}>COD</Text>
            </View>
            <View style={styles.statSep} />
            <View style={styles.statCell}>
              <Text style={[styles.statVal, { color: '#16A34A' }]}>₹{this.money(stats?.cashDeposited) || '0'}</Text>
              <Text style={styles.statLbl}>Deposited</Text>
            </View>
            <View style={styles.statSep} />
            <View style={styles.statCell}>
              <Text style={[styles.statVal, { color: P }]}>₹{this.money(stats?.upiCollected) || '0'}</Text>
              <Text style={styles.statLbl}>UPI</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

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
        <StatusBar barStyle="light-content" backgroundColor={THEME.green} />

        {/* Header */}
        <View style={styles.headerWrap}>
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={this.goBack} style={styles.headerIconBtn} activeOpacity={0.85}>
                <Image style={styles.backImg} source={require('./assets/back.png')} />
              </TouchableOpacity>

              <View style={styles.headerSearch}>
                <Image style={styles.headerSearchIco} source={require('./assets/search.png')} />
                <TextInput
                  value={this.state.search}
                  onChangeText={this.onSearchChange}
                  placeholder="Search orders..."
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  style={styles.headerSearchInput}
                  returnKeyType="search"
                  onSubmitEditing={() => this.fetchList()}
                />
                {this.state.search ? (
                  <TouchableOpacity onPress={this.clearSearch} activeOpacity={0.7} style={styles.headerCrossBtn}>
                    <Image source={require('./assets/cross.png')} style={styles.headerCrossIco} />
                  </TouchableOpacity>
                ) : null}
              </View>
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
              </View>
            </View>
          </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.bg },

  headerWrap: { backgroundColor: P, paddingBottom: 8 },
  headerSafe: { backgroundColor: P },
  headerRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center', marginLeft: 4, marginRight: 10,
  },
  backImg: { width: 17, height: 17, resizeMode: 'contain', tintColor: '#fff' },
  headerSearch: {
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10, height: 38, paddingHorizontal: 10,
  },
  headerSearchIco: { width: 14, height: 14, resizeMode: 'contain', tintColor: 'rgba(255,255,255,0.5)', marginRight: 8 },
  headerSearchInput: { flex: 1, fontSize: 14, color: '#FFF', paddingVertical: 0 },
  headerCrossBtn: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  headerCrossIco: { width: 8, height: 8, resizeMode: 'contain', tintColor: '#FFF' },

  listContent: { paddingHorizontal: 8, paddingTop: 10, paddingBottom: 120 },

  mainCard: {
    backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10,
    marginBottom: 6, borderWidth: 1, borderColor: THEME.border,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: THEME.text, marginBottom: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statCell: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 15, fontWeight: '800', color: THEME.text },
  statLbl: { fontSize: 10, fontWeight: '500', color: THEME.subText, marginTop: 3 },
  statSep: { width: 1, height: 28, backgroundColor: '#E2E8F0' },
  cardDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  tabsRow: { flexDirection: 'row' },
  tab: {
    flex: 1, borderRadius: 8, paddingVertical: 9, marginHorizontal: 2,
    alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent',
  },
  tabT: { fontSize: 11, fontWeight: '600', color: THEME.subText },

  subHint: { fontSize: 11, color: THEME.muted, marginBottom: 8, marginLeft: 4 },

  rowWrap: { marginBottom: 0 },
  rowSelectedWrap: { marginBottom: 0 },
  settlePill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  settlePillT: { fontSize: 9, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingVertical: 50 },
  emptyImg: { width: 64, height: 64, resizeMode: 'contain', marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#475569', marginBottom: 4 },
  emptySub: { fontSize: 12, color: THEME.muted, textAlign: 'center', paddingHorizontal: 32 },

  footerWrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 13,
    borderTopWidth: 1, borderTopColor: '#E2E8F0',
  },
  footerRow: { flexDirection: 'row', alignItems: 'center' },
  footerLeft: { width: 100, marginRight: 12 },
  totalLabel: { fontSize: 10, fontWeight: '600', color: THEME.subText },
  totalValue: { fontSize: 18, fontWeight: '800', color: THEME.orange, marginTop: 2 },
  footerSel: { fontSize: 10, fontWeight: '600', color: P, marginTop: 3 },
  settleBtn: {
    flex: 1, height: 48, borderRadius: 12, backgroundColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16,
  },
  settleBtnOff: { opacity: 0.5 },
  settleBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
export default withV4Navigation(SettlementList);
