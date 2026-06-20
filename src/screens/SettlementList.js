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
    this.fetchList();
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
  getFarmerName = (it) => String(this.getFarmerObj(it)?.name || '').trim();
  getVillage = (it) => String(this.getFarmerObj(it)?.address || '').trim();

  getOrderId = (it) =>
    it?.order_id !== undefined && it?.order_id !== null ? String(it.order_id).trim() : '';

  getOrderCode = (it) =>
    it?.order_code !== undefined && it?.order_code !== null ? String(it.order_code).trim() : '';

  getCodAmount = (it) =>
    it?.order_amount !== undefined && it?.order_amount !== null ? String(it.order_amount) : '';

  getCollectedAmount = (it) =>
    it?.collected_amount !== undefined && it?.collected_amount !== null ? String(it.collected_amount) : '';

  getTimeSlot = (it) => String(it?.slot || '').trim();

  mapTabFromStatus = (statusRaw) => {
    const st = this.normalize(statusRaw);
    if (st.includes('settled') || st.includes('success')) return 'settled';
    if (st.includes('disputed')) return 'disputed';
    return 'pending';
  };

  isCollectedOk = (it) => {
    const cod = this.money(this.getCodAmount(it));
    const col = this.money(this.getCollectedAmount(it));
    if (!cod || !col) return false;
    return String(cod) === String(col);
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
    this.setState({ loading: true, search: '' }, () => {
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

          const rows = Array.isArray(json?.data) ? json.data : [];

          const lc = json?.list_count || {};
          const pending = Number(lc?.pending_count ?? 0) || 0;
          const settled = Number(lc?.settled_count ?? 0) || 0;
          const disputed = Number(lc?.disputed_count ?? 0) || 0;
          const all = Number(lc?.total ?? rows.length) || rows.length;

          const keep = {};
          const old = this.state.selectedMap || {};
          rows.forEach((it) => {
            const id = this.getOrderId(it);
            if (id && old[id]) keep[id] = true;
          });

          const td = json?.todays_order || {};
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
    this.props.navigation.navigate('CashSettlement', { selectedOrders: this.getSelectedOrderIds() });
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

  getSelectedOrderIds = () => Object.keys(this.state.selectedMap || {});

  getSelectedTotals = () => {
    const { selectedMap } = this.state;
    const rows = Array.isArray(this.state.list) ? this.state.list : [];

    let total = 0;
    let count = 0;

    rows.forEach((it) => {
      const id = this.getOrderId(it);
      if (id && selectedMap?.[id]) {
        const n = Number(it?.order_amount);
        if (!isNaN(n)) total += n;
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
  onCall = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${String(phone).replace(/\s+/g, '')}`).catch(() => {});
  };

  onWhatsApp = (phone) => {
    if (!phone) return;
    const p = String(phone).replace(/[^\d]/g, '');
    Linking.openURL(`https://wa.me/${p}`).catch(() => {});
  };

  renderRow = ({ item }) => {
    const orderId = this.getOrderId(item);
    const orderCode = this.getOrderCode(item);
    const codeDisplay = orderCode.includes(' ') ? orderCode.split(' ')[0] : orderCode;
    const farmer = this.getFarmerObj(item);
    const farmerName = this.getFarmerName(item);
    const farmerPhone = farmer?.phone || '';
    const farmerAddr = item?.farmer_address || {};
    const ds = item?.dark_store || {};
    const slot = this.getTimeSlot(item);
    const statusRaw = String(item?.status || '').toLowerCase();
    const isPending = statusRaw.includes('pending');

    const orderAmt = this.money(this.getCodAmount(item));
    const collected = this.money(this.getCollectedAmount(item));
    const deposited = this.money(item?.deposite_amount);
    const payType = String(item?.type || '').toUpperCase();

    const selected = !!this.state.selectedMap?.[orderId];

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => { if (isPending) this.toggleSelect(orderId); }}
        style={[styles.rowCard, selected && styles.rowCardSelected]}
      >
        <View style={[styles.rowTop, selected && styles.rowTopSelected]}>
          <View style={styles.rowHead}>
            <Text style={styles.rowOid}>#{codeDisplay || orderId || 'N/A'}</Text>
            <View style={{ flex: 1 }} />
            <View style={[styles.rowStatusPill, { backgroundColor: isPending ? '#EA580C' : '#16A34A' }]}>
              <Text style={styles.rowStatusT}>{isPending ? 'Pending' : 'Settled'}</Text>
            </View>
            {isPending ? (
              <View style={[styles.checkBox, selected && styles.checkBoxOn]}>
                {selected ? <Text style={styles.checkTick}>✓</Text> : null}
              </View>
            ) : null}
          </View>

          <View style={styles.rowFarmer}>
          <Image source={require('./assets/farmer.png')} style={styles.rowAvt} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowFarmerName}>{farmerName || '-'}</Text>
            {!!farmerPhone ? <Text style={styles.rowAddr}>{farmerPhone}</Text> : null}
          </View>
          {this.state.showCall ? (
            <>
              <TouchableOpacity onPress={() => this.onCall(farmerPhone)} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                <Image source={require('./assets/call.png')} style={styles.rowIco} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => this.onWhatsApp(farmerPhone)} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}} style={{ marginLeft: 10 }}>
                <Image source={require('./assets/whatsapp.png')} style={styles.rowIco} />
              </TouchableOpacity>
            </>
          ) : null}
          </View>
        </View>

        {/* Route: Pickup -> Drop */}
        <View style={styles.rowRoute}>
          <View style={styles.rowRouteR}>
            <View style={styles.rowTl}><View style={[styles.rowDot, { backgroundColor: '#0DA60D' }]} /><View style={styles.rowLine} /></View>
            <View style={styles.rowRouteBody}>
              <Text style={[styles.rowRouteLbl, { color: '#0DA60D' }]}>Pickup</Text>
              <Text style={styles.rowRouteTitle}>{ds?.name || '-'}</Text>
              {ds?.mobile ? <Text style={styles.rowRouteVal}>{ds.mobile}</Text> : null}
              <Text style={styles.rowRouteVal}>{ds?.location || `${ds?.city || ''}${ds?.pincode ? `, ${ds.pincode}` : ''}`}</Text>
            </View>
          </View>
          <View style={styles.rowRouteR}>
            <View style={styles.rowTl}><View style={[styles.rowDot, { backgroundColor: '#EF4444' }]} /></View>
            <View style={[styles.rowRouteBody, { paddingBottom: 0 }]}>
              <Text style={[styles.rowRouteLbl, { color: '#EF4444' }]}>Drop</Text>
              <Text style={styles.rowRouteVal}>
                {farmerAddr?.address || farmer?.address || '-'}
                {farmerAddr?.block ? `, ${farmerAddr.block}` : ''}
                {farmerAddr?.city ? `, ${farmerAddr.city}` : ''}
                {farmerAddr?.state ? `, ${farmerAddr.state}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* Amounts */}
        <View style={styles.rowAmounts}>
          <View style={styles.rowAmtItem}>
            <Text style={styles.rowAmtLabel}>Order</Text>
            <Text style={styles.rowAmtVal}>{'₹'}{orderAmt || '0'}</Text>
          </View>
          <View style={styles.rowAmtItem}>
            <Text style={styles.rowAmtLabel}>Collected</Text>
            <Text style={[styles.rowAmtVal, { color: '#16A34A' }]}>{'₹'}{collected || '0'}</Text>
          </View>
          <View style={styles.rowAmtItem}>
            <Text style={styles.rowAmtLabel}>Deposited</Text>
            <Text style={[styles.rowAmtVal, { color: '#5D3FD3' }]}>{'₹'}{deposited || '0'}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.rowFooter}>
          {!!payType ? <View style={styles.rowTypePill}><Text style={styles.rowTypeT}>{payType}</Text></View> : null}
          {!!slot ? <Text style={styles.rowSlot}>{slot}</Text> : null}
          <View style={{ flex: 1 }} />
          <Text style={styles.rowAmtTotal}>{'₹'}{orderAmt}</Text>
        </View>
      </TouchableOpacity>
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

  emptyWrap: { alignItems: 'center', paddingVertical: 50 },
  emptyImg: { width: 64, height: 64, resizeMode: 'contain', marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#475569', marginBottom: 4 },
  emptySub: { fontSize: 12, color: THEME.muted, textAlign: 'center', paddingHorizontal: 32 },

  rowCard: {
    backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: THEME.border,
    marginTop: 8, overflow: 'hidden',
  },
  rowCardSelected: { borderColor: P, borderWidth: 2 },
  rowTop: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8 },
  rowTopSelected: { backgroundColor: '#EDE9FE' },
  rowHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rowOid: { fontSize: 11, fontWeight: '800', color: P },
  rowStatusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, marginRight: 8 },
  rowStatusT: { fontSize: 9, fontWeight: '700', color: '#FFF' },

  rowFarmer: { flexDirection: 'row', alignItems: 'center' },
  rowAvt: { width: 28, height: 28, borderRadius: 14, resizeMode: 'cover', marginRight: 8 },
  rowFarmerName: { fontSize: 13, fontWeight: '700', color: THEME.text },
  rowAddr: { fontSize: 11, color: THEME.muted, marginTop: 1 },
  rowIco: { width: 26, height: 26, resizeMode: 'contain' },

  rowRoute: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowRouteR: { flexDirection: 'row', alignItems: 'flex-start' },
  rowTl: { width: 12, alignItems: 'center', marginRight: 8, paddingTop: 3 },
  rowDot: { width: 7, height: 7, borderRadius: 4 },
  rowLine: { width: 1.5, flex: 1, minHeight: 6, backgroundColor: '#D1D5DB', marginVertical: 2 },
  rowRouteBody: { flex: 1, paddingBottom: 6 },
  rowRouteLbl: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.3, marginBottom: 2 },
  rowRouteTitle: { fontSize: 12.5, fontWeight: '700', color: THEME.text },
  rowRouteVal: { fontSize: 11.5, color: THEME.subText, lineHeight: 16, marginTop: 1 },

  rowAmounts: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8 },
  rowAmtItem: { flex: 1, alignItems: 'center' },
  rowAmtLabel: { fontSize: 10, fontWeight: '500', color: THEME.muted, marginBottom: 2 },
  rowAmtVal: { fontSize: 13, fontWeight: '800', color: THEME.text },

  rowFooter: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  rowTypePill: { backgroundColor: '#F1F5F9', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  rowTypeT: { fontSize: 9, fontWeight: '700', color: '#475569' },
  rowSlot: { fontSize: 11, color: THEME.muted },
  rowAmtTotal: { fontSize: 15, fontWeight: '800', color: '#16A34A' },

  checkBox: {
    marginLeft: 8, width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: '#CBD5E1', backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: P, borderColor: P },
  checkTick: { color: '#FCD34D', fontSize: 13, fontWeight: '900', marginTop: -1 },

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
