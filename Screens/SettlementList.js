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
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  TextInput,
  ActivityIndicator,
  Platform,
  FlatList,
} from 'react-native';
import constants from './constants';
import Toast from 'react-native-simple-toast';

const THEME = {
  green: '#1C8A62',
  greenDark: '#2F7D67',
  bg: '#F3F5F7',
  card: '#FFFFFF',
  border: '#E6EAF0',
  text: '#111827',
  subText: '#000',
  muted: '#9CA3AF',
  orange: '#F37A20',
  yellow: '#F6C34A',
  danger: '#7A1B1B',
  settledGreenBg: '#DDF4EA', // old ALL bg -> now SETTLED
  pendingBg: '#FCEED7',
  greyBg: '#EEF2F6',
  blue: '#0B5CAD',
  dot: '#36454F',
  labelGrey: '#6B7280',
};

export default class SettlementList extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      submitting: false,
      search: '',
      activeTab: 'all', // all | pending | settled
      list: [],
      counts: { all: 0, pending: 0, settled: 0 },

      // selection
      selectedMap: {}, // { [order_id]: true }

      // ✅ top stats from API (todays_order)
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
    if (st.includes('settled')) return 'settled';
    if (st.includes('success')) return 'settled';
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
  fetchList = () => {
    this.setState({ loading: true }, () => {
      fetch(constants.settleList, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + global.token,
          Accept: 'application/json',
        },
      })
        .then((r) => r.json())
        .then((json) => {
          console.log('settle list response== ', JSON.stringify(json));

          const rows = Array.isArray(json?.data) ? json.data : [];

          const lc = json?.list_count || {};
          const pending = Number(lc?.pending_count ?? 0) || 0;
          const settled = Number(lc?.settled_count ?? 0) || 0;
          const all = Number(lc?.total ?? rows.length) || rows.length;

          // keep selection only for existing order_ids
          const keep = {};
          const old = this.state.selectedMap || {};
          rows.forEach((it) => {
            const id = this.getOrderId(it);
            if (id && old[id]) keep[id] = true;
          });

          // ✅ STRICT: read top stats ONLY from todays_order (no dummy)
          const td = json?.todays_order || {};
          const todaysOrders = this.toNum(td?.total_order);
          const codCollected = this.toNum(td?.cod_collected);
          const cashDeposited = this.toNum(td?.cash_collected);
          const upiCollected = this.toNum(td?.upi_collected);

          this.setState({
            loading: false,
            list: rows,
            counts: { all, pending, settled },
            selectedMap: keep,
            stats: { todaysOrders, codCollected, cashDeposited, upiCollected },
          });
        })
        .catch((e) => {
          console.log('settleList error== ', e);
          Toast.show('Failed to load settlement list', Toast.SHORT);
          this.setState({
            loading: false,
            list: [],
            counts: { all: 0, pending: 0, settled: 0 },
            selectedMap: {},
            stats: { todaysOrders: 0, codCollected: 0, cashDeposited: 0, upiCollected: 0 },
          });
        });
    });
  };

  // ------------------------
  // Next screen
  // ------------------------
  submitSettlement = () => {
    this.props.navigation.navigate('CashSettlement', { selectedOrders: this.getSelectedOrderIds() });
  };

  // ------------------------
  // Filtering (search on code, id, name, address, amount, collected)
  // ------------------------
  getFilteredList = () => {
    const { list, activeTab, search } = this.state;
    const q = this.normalize(search).trim();

    return (Array.isArray(list) ? list : []).filter((it) => {
      const tab = this.mapTabFromStatus(it?.status);
      const matchTab = activeTab === 'all' ? true : tab === activeTab;

      if (!q) return matchTab;

      const orderId = this.normalize(this.getOrderId(it));
      const orderCode = this.normalize(this.getOrderCode(it));
      const farmer = this.normalize(this.getFarmerName(it));
      const village = this.normalize(this.getVillage(it));
      const amt = this.normalize(this.money(this.getCodAmount(it)));
      const collected = this.normalize(this.money(this.getCollectedAmount(it)));

      return (
        matchTab &&
        (orderCode.includes(q) ||
          orderId.includes(q) ||
          farmer.includes(q) ||
          village.includes(q) ||
          amt.includes(q) ||
          collected.includes(q))
      );
    });
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
  tabStyle = (key) => {
    const active = this.state.activeTab === key;

    // ALL -> Blue
    if (key === 'all') {
      return [
        styles.statusTab,
        { backgroundColor: '#E6F4FF' },
        active ? [styles.statusTabActive, { borderColor: THEME.blue }] : null,
      ];
    }

    // Pending -> Orange
    if (key === 'pending') {
      return [
        styles.statusTab,
        { backgroundColor: THEME.pendingBg },
        active ? [styles.statusTabActive, { borderColor: THEME.orange }] : null,
      ];
    }

    // Settled -> Green (old all color)
    return [
      styles.statusTab,
      { backgroundColor: THEME.settledGreenBg },
      active ? [styles.statusTabActive, { borderColor: THEME.green }] : null,
    ];
  };

  tabValueStyle = (key) => {
    if (key === 'all') return [styles.statusTabValue, { color: THEME.blue }];
    if (key === 'pending') return [styles.statusTabValue, { color: THEME.orange }];
    return [styles.statusTabValue, { color: THEME.green }];
  };

  // ------------------------
  // Row
  // ------------------------
  renderRow = ({ item, index }) => {
    const orderId = this.getOrderId(item);
    const orderCode = this.getOrderCode(item);
    const farmer = this.getFarmerName(item);
    const village = this.getVillage(item);
    const slot = this.getTimeSlot(item);

    const cod = this.money(this.getCodAmount(item));
    const collected = this.money(this.getCollectedAmount(item));

    const collectedOk = this.isCollectedOk(item);
    const selected = !!this.state.selectedMap?.[orderId];

    return (
      <View style={[styles.rowCard, index === 0 ? styles.rowCardFirst : null]}>
        <View style={styles.rowTop}>
          <Text style={styles.orderLine} numberOfLines={1}>
            <Text style={styles.orderStrong}>{orderCode || 'N/A'}</Text>
          </Text>

          <View style={styles.amountCols}>
            <View style={styles.amountCol}>
              <Text style={[styles.amountText, { color: THEME.orange }]}>{cod ? `₹${cod}` : '-'}</Text>
            </View>

            <View style={styles.amountColRight}>
              <View style={styles.collectedWrap}>
                <Text style={[styles.amountText, collectedOk ? styles.amountGreen : null]}>
                  {collected ? `₹${collected}` : '-'}
                </Text>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => this.toggleSelect(orderId)}
                  style={[styles.checkBox, selected ? styles.checkBoxOn : null]}
                >
                  {selected ? <Text style={styles.checkTick}>✓</Text> : null}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {!!farmer ? <Text style={styles.farmerName}>{farmer}</Text> : null}

        {!!slot ? (
          <View style={styles.slotRow}>
            <Text style={styles.slotText} numberOfLines={1}>
              {slot}
            </Text>
          </View>
        ) : null}

        {!!village ? (
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            <Image
              style={{ width: 22, height: 22, resizeMode: 'contain', alignSelf: 'center', marginRight: 2, marginLeft: -6 }}
              source={require('./assets/gps.png')}
            />
            <Text style={styles.villageText}>{`${village}`}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  // ------------------------
  // Header inside list
  // ------------------------
  renderListHeader = () => {
    const { search, counts, stats } = this.state;

    return (
      <View>
        {/* ✅ Summary card: 2 rows, 2 columns, aligned */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryCol}>
              <View style={styles.summaryDot} />
              <Text style={styles.summaryLabel}>Today Orders :</Text>
              <Text style={styles.summaryValue}>{this.toNum(stats?.todaysOrders)}</Text>
            </View>

            <View style={styles.summaryCol}>
              <View style={styles.summaryDot} />
              <Text style={styles.summaryLabel}>COD Collected :</Text>
              <Text style={styles.summaryValue}>{`₹${this.money(stats?.codCollected)}`}</Text>
            </View>
          </View>

          <View style={[styles.summaryGrid, { marginTop: 10 }]}>
            <View style={styles.summaryCol}>
              <View style={styles.summaryDot} />
              <Text style={styles.summaryLabel}>Cash Deposited :</Text>
              <Text style={[styles.summaryValue,{color:'#1C8A62'}]}>{`₹${this.money(stats?.cashDeposited)}`}</Text>
            </View>

            <View style={styles.summaryCol}>
              <View style={styles.summaryDot} />
              <Text style={styles.summaryLabel}>UPI Collected :</Text>
              <Text style={[styles.summaryValue,{color:'#1C8A62'}]}>{`₹${this.money(stats?.upiCollected)}`}</Text>
            </View>
          </View>
        </View>

        {/* ✅ Status box tabs */}
        <View style={styles.tabsOuter}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => this.setState({ activeTab: 'all' })} style={this.tabStyle('all')}>
            <Text style={styles.statusTabTitle}>All</Text>
            <Text style={this.tabValueStyle('all')}>{counts.all}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => this.setState({ activeTab: 'pending' })}
            style={this.tabStyle('pending')}
          >
            <Text style={styles.statusTabTitle}>Pending</Text>
            <Text style={this.tabValueStyle('pending')}>{counts.pending}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => this.setState({ activeTab: 'settled' })}
            style={this.tabStyle('settled')}
          >
            <Text style={styles.statusTabTitle}>Settled</Text>
            <Text style={this.tabValueStyle('settled')}>{counts.settled}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.instructionText}>Please verify and mark cash orders as settled</Text>

        {/* Search */}
        <View style={styles.searchBox}>
          <Image style={styles.searchImg} source={require('./assets/search.png')} />
          <TextInput
            value={search}
            onChangeText={(t) => this.setState({ search: t })}
            placeholder="Search here.."
            placeholderTextColor={THEME.muted}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>

        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={styles.thLeft}>ORDER</Text>
          <Text style={styles.thMid}>COD</Text>
          <Text style={styles.thRight}>COLLECTED</Text>
        </View>
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
          <SafeAreaView style={styles.headerSafe}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={this.goBack} style={styles.headerIconBtn} activeOpacity={0.85}>
                <Image style={styles.backImg} source={require('./assets/back.png')} />
              </TouchableOpacity>

              <Text style={styles.headerTitle} numberOfLines={1}>
                Cash Settlement
              </Text>

              <View style={{ width: 42, height: 42 }} />
            </View>
          </SafeAreaView>
        </View>

        <SafeAreaView style={styles.bodySafe}>
          <View style={{ flex: 1 }}>
            {loading ? (
              <View style={{ paddingTop: 22 }}>
                {this.renderListHeader()}
                <View style={{ paddingVertical: 26 }}>
                  <ActivityIndicator size="large" color={THEME.green} />
                </View>
              </View>
            ) : (
              <FlatList
                data={rows}
                keyExtractor={(it, idx) => `${this.getOrderId(it) || idx}-${idx}`}
                renderItem={this.renderRow}
                ListHeaderComponent={this.renderListHeader}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            )}

            {/* Fixed bottom */}
            <View style={styles.footerWrap}>
              <View style={styles.footerTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.totalLabel}>Total Cash</Text>
                  <Text style={styles.totalValue}>{`₹ ${this.money(totals.total)}`}</Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.92}
                  disabled={submitting || selectedCount === 0}
                  onPress={this.submitSettlement}
                  style={[styles.settleBtn, selectedCount === 0 ? { opacity: 0.55 } : null]}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Text style={styles.settleBtnText}>Settle Now</Text>
                      <Text style={styles.settleBtnAmt}>{`₹ ${this.money(totals.total)}`}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <SafeAreaView style={{ backgroundColor: THEME.bg }} />
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.bg },

  // Header
  headerWrap: { backgroundColor: THEME.green },
  headerSafe: { backgroundColor: THEME.green },
  headerRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  backImg: { width: 24, height: 24, resizeMode: 'contain', tintColor: '#fff' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 15, fontWeight: '800' },

  bodySafe: { flex: 1, backgroundColor: THEME.bg },

  listContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 170 },

  // ✅ Summary card (aligned)
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 12,
    marginBottom: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCol: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#36454F',
    marginRight: 7,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '350',
    color: '#000',
    marginRight: 6,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F37A20',
  },

  // Tabs
  tabsOuter: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 0,
    padding: 10,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusTab: {
    width: '32%',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  statusTabActive: { borderWidth: 1.3 },
  statusTabTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
    alignSelf: 'center',
  },
  statusTabValue: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '800',
    alignSelf: 'center',
  },

  instructionText: { fontSize: 12, fontWeight: '400', color: '#000' },

  // Search
  searchBox: {
    marginTop: 10,
    height: 46,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchImg: { width: 18, height: 18, resizeMode: 'contain', marginRight: 10, tintColor: THEME.muted },
  searchInput: { flex: 1, fontSize: 14, color: THEME.text },

  // Table header
  tableHeader: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: 1,
    borderColor: THEME.border,
    paddingVertical: 15,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  thLeft: { flex: 1, fontSize: 11, fontWeight: '700', color: THEME.subText },
  thMid: { width: 80, textAlign: 'right', fontSize: 11, fontWeight: '700', color: THEME.subText },
  thRight: { width: 140, textAlign: 'right', fontSize: 11, fontWeight: '700', color: THEME.subText },

  // Row
  rowCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.border,
    borderTopWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowCardFirst: {},
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  orderLine: { fontSize: 14, fontWeight: '800', color: THEME.text, paddingTop: 2, flex: 1 },
  orderMuted: { color: THEME.subText, fontWeight: '800', fontSize: 10 },
  orderStrong: { color: THEME.orange, fontWeight: '400', fontSize: 10 },

  amountCols: { flexDirection: 'row', alignItems: 'flex-start' },
  amountCol: { width: 80, alignItems: 'flex-end' },
  amountColRight: { width: 140, alignItems: 'flex-end' },

  amountText: { fontSize: 13, fontWeight: '700', color: THEME.text },
  amountGreen: { color: THEME.greenDark, fontSize: 13, fontWeight: '700' },

  collectedWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },

  checkBox: {
    marginLeft: 10,
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: { backgroundColor: THEME.greenDark, borderColor: THEME.greenDark },
  checkTick: { color: '#fff', fontSize: 12, fontWeight: '500', marginTop: -1 },

  farmerName: { marginTop: 10, fontSize: 13, fontWeight: '600', color: THEME.text },
  villageText: { fontSize: 12, fontWeight: '500', color: '#000', alignSelf: 'center' },

  slotRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  slotText: { fontSize: 12, color: 'grey' },

  // Footer fixed
  footerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: THEME.bg,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 6 : 10,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  footerTopRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 6, paddingRight: 5 },

  totalLabel: { fontSize: 11, fontWeight: '700', color: '#000' },
  totalValue: { marginTop: 6, fontSize: 18, fontWeight: '800', color: THEME.orange },

  settleBtn: {
    height: 45,
    borderRadius: 10,
    backgroundColor: '#0F7451',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginLeft: 12,
    justifyContent: 'space-between',
    flex: 1,
  },
  settleBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  settleBtnAmt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});