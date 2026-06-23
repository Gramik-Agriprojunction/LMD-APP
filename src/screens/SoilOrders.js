import React, { Component } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Image,
  ActivityIndicator, RefreshControl, LayoutAnimation, Platform, UIManager, Pressable,
  Animated, Dimensions,
} from 'react-native';
import { screenFooterPadding } from '../utils/safeAreaInsets';
import moment from 'moment';
import constants from '../utils/constants';
import { withV4Navigation, NavigationEvents } from '../utils/v4Compat';
import ScreenHeader from '../components/ScreenHeader';
import Toast from 'react-native-simple-toast';
import { S, soilIcons as I } from '../utils/soilTheme';
import { prefetchSoilOrderPincode } from '../utils/locationHelper';
import NotificationBellButton from '../components/NotificationBellButton';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PAD = 10;
const FOOTER_PAD = 24;
const FOOTER_H = 58;
const SCREEN_BG = '#edf1f7';
const BOOK_GREEN = '#28AD54';
const SCREEN_W = Dimensions.get('window').width;
const TAB_PAD = 4;
const TAB_INNER = SCREEN_W - PAD * 2 - TAB_PAD * 2;

const titleCase = (s) => {
  const t = String(s || '').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const TABS = [
  { key: 'all', label: 'All', apiTab: '' },
  { key: 'pending', label: 'Pending', apiTab: 'pending' },
  { key: 'picked', label: 'Picked', apiTab: 'picked' },
  { key: 'completed', label: 'Completed', apiTab: 'completed' },
  { key: 'cancelled', label: 'Cancelled', apiTab: 'cancelled' },
];

const TAB_W = TAB_INNER / TABS.length;

const STAGE = {
  pending: { color: S.ORANGE, fill: S.ORANGE, bg: S.ORANGE_BG, label: 'Pending', icon: I.clock },
  picked: { color: S.BLUE, fill: S.BLUE, bg: S.BLUE_BG, label: 'Picked', icon: I.fertilizer },
  completed: { color: S.GREEN_DARK, fill: S.GREEN_DARK, bg: S.GREEN_BG, label: 'Completed', icon: I.doc },
  cancelled: { color: S.RED, fill: S.RED, bg: S.RED_BG, label: 'Cancelled', icon: I.close },
};

const PKG = {
  BASIC: { color: S.GREEN_DARK, bg: S.GREEN_BG, label: 'Basic' },
  ADVANCE: { color: S.P_DARK, bg: S.P_TINT, label: 'Advance' },
  PREMIUM: { color: S.AMBER, bg: S.AMBER_BG, label: 'Premium' },
};

const EMPTY_COPY = {
  all: { title: 'Koi order nahi', sub: 'Neeche se soil test book karein' },
  pending: { title: 'Pending order nahi', sub: 'Naye order yahan dikhenge' },
  picked: { title: 'Picked order nahi', sub: 'Pickup ke baad yahan dikhega' },
  completed: { title: 'Completed order nahi', sub: 'Report ready hone par dikhega' },
  cancelled: { title: 'Cancelled order nahi', sub: 'Cancel order yahan dikhega' },
};

const getStage = (o) => {
  const stt = String(o?.status || '').toLowerCase();
  const rs = String(o?.report_status || '').toLowerCase();
  const hasReport = Array.isArray(o?.report) && o.report.length > 0;
  if (stt === 'cancelled' || o?.cancelled_date) return 'cancelled';
  if (hasReport || stt === 'ready' || stt === 'completed' || rs.includes('generated') || rs.includes('ready')) {
    return 'completed';
  }
  if (
    ['picked_up', 'picked', 'sample_collected', 'in_lab', 'lab', 'processing', 'in_progress'].includes(stt)
    || (o?.picked_date && !hasReport)
  ) {
    return 'picked';
  }
  return 'pending';
};

const getPkg = (o) => {
  const line = o?.packages?.[0];
  const p = line?.package || {};
  const name = String(p?.name || 'BASIC').toUpperCase();
  return {
    key: name,
    label: PKG[name]?.label || titleCase(name),
    price: o?.final_total_amount || line?.package_amount || p?.price || 0,
    qty: line?.quantity || 1,
  };
};

const payLbl = (m) => {
  const s = String(m || '').toLowerCase();
  if (s === 'cash_on_delivery' || s === 'cod') return 'COD';
  if (s.includes('google')) return 'GPay';
  if (s === 'online' || s === 'upi') return 'Online';
  return titleCase(s.replace(/_/g, ' ')) || '-';
};

const payIconUri = (item) => {
  const uri = item?.paymentMethod?.icon;
  return uri && String(uri).trim() ? String(uri).trim() : '';
};

const CARD_ICO = {
  cal: require('./assets/cal.png'),
  money: require('./assets/money.png'),
  pay: require('./assets/pay.png'),
  doc: require('./assets/doc.png'),
  tick: require('./assets/tick.png'),
  soil: require('./assets/soil.png'),
};

const SWAP = { duration: 180, create: { type: 'easeInEaseOut', property: 'opacity' }, update: { type: 'easeInEaseOut' } };

const FootItem = ({ icon, iconUri, text, textColor }) => (
  <View style={st.footItem}>
    {iconUri ? (
      <Image source={{ uri: iconUri }} style={st.footIco} resizeMode="contain" />
    ) : (
      <Image source={icon} style={st.footIco} resizeMode="contain" />
    )}
    <Text style={[st.footTxt, textColor && { color: textColor }]} numberOfLines={1}>{text}</Text>
  </View>
);

class SoilOrders extends Component {
  state = { loading: true, refreshing: false, orders: [], tab: 'all' };
  fetchSeq = 0;
  tabX = new Animated.Value(0);

  componentDidMount() {
    prefetchSoilOrderPincode();
    this.fetchOrders();
  }

  onScreenFocus = () => {
    prefetchSoilOrderPincode();
  };

  goBack = () => this.props?.navigation?.goBack?.();
  onBook = () => {
    prefetchSoilOrderPincode();
    this.props.navigation.navigate('CreateSoilOrder');
  };

  switchTab = (key) => {
    if (key === this.state.tab) return;
    const idx = TABS.findIndex((t) => t.key === key);
    Animated.spring(this.tabX, {
      toValue: idx * TAB_W,
      useNativeDriver: true,
      friction: 9,
      tension: 90,
    }).start();
    this.setState({ tab: key, loading: true, orders: [] }, () => this.fetchOrders(key));
  };

  fetchOrders = (tabKey) => {
    const key = tabKey || this.state.tab;
    const apiTab = TABS.find((t) => t.key === key)?.apiTab || '';
    const qs = apiTab ? `?tab=${encodeURIComponent(apiTab)}` : '';
    const seq = ++this.fetchSeq;

    fetch(constants.soilOrders + qs, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + global.token, Accept: 'application/json', 'X-localization': 'en' },
    })
      .then((r) => r.json())
      .then((json) => {
        if (seq !== this.fetchSeq) return;
        const list = Array.isArray(json?.data) ? json.data : [];
        LayoutAnimation.configureNext(SWAP);
        this.setState({ loading: false, refreshing: false, orders: list });
      })
      .catch(() => {
        if (seq !== this.fetchSeq) return;
        Toast.show('Orders load nahi ho paye', Toast.SHORT);
        this.setState({ loading: false, refreshing: false, orders: [] });
      });
  };

  onRefresh = () => this.setState({ refreshing: true }, () => this.fetchOrders());

  renderTabBar = () => {
    const { tab } = this.state;
    return (
      <View style={st.tabBarWrap}>
        <View style={st.tabBar}>
          <Animated.View style={[st.tabIndicator, { width: TAB_W, transform: [{ translateX: this.tabX }] }]} />
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <TouchableOpacity key={t.key} style={st.tabBtn} activeOpacity={0.85} onPress={() => this.switchTab(t.key)}>
                <Text style={[st.tabLbl, on && st.tabLblOn]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  renderListHeader = () => {
    const { orders, tab } = this.state;
    if (!orders.length) return null;
    const tabLbl = TABS.find((t) => t.key === tab)?.label || 'All';
    return (
      <Text style={st.listCount}>
        {orders.length} {tabLbl.toLowerCase()} order{orders.length !== 1 ? 's' : ''}
      </Text>
    );
  };

  renderCard = ({ item }) => {
    const pkg = getPkg(item);
    const stage = getStage(item);
    const sm = STAGE[stage] || STAGE.pending;
    const pickup = (item?.order_sample_pickup_date || item?.sample_pickup_date)
      ? moment(item.order_sample_pickup_date || item.sample_pickup_date).format('DD MMM')
      : '-';
    const report = item?.report_status || sm.label;
    const pay = payLbl(item?.payment_mode);
    const payIcon = payIconUri(item);
    const unpaid = String(item?.payment_status || '').toLowerCase() !== 'paid';
    const hasPdf = Array.isArray(item?.report) && item.report.length > 0;
    const pdfCount = hasPdf ? item.report.length : 0;
    const farmer = item?.farmer?.name || 'Farmer';
    const loc = item?.farmer?.address || item?.address?.district || '';

    return (
      <Pressable
        style={({ pressed }) => [st.card, { borderLeftColor: sm.fill }, pressed && st.cardPressed]}
        onPress={() => this.props.navigation.navigate('SoilOrderDetail', { orderId: item.id, order: item })}
      >
        <View style={st.cardTop}>
          <View style={[st.soilIco, { backgroundColor: sm.bg }]}>
            <Image source={CARD_ICO.soil} style={st.soilImg} resizeMode="contain" />
          </View>
          <View style={st.cardMid}>
            <View style={st.nameRow}>
              <Text style={st.farmerName} numberOfLines={1}>{farmer}</Text>
              <Text style={st.price}>₹{Number(pkg.price).toLocaleString('en-IN')}</Text>
              <Image source={I.arrow} style={st.chev} resizeMode="contain" />
            </View>
            <Text style={st.metaTxt} numberOfLines={1}>
              {pkg.label} · #{item.id}{loc ? ` · ${loc}` : ''}
            </Text>
          </View>
        </View>
        <View style={[st.cardBot, { backgroundColor: sm.bg }]}>
          <View style={st.statusRow}>
            <View style={[st.statusDot, { backgroundColor: sm.color }]} />
            <Text style={[st.statusTxt, { color: sm.color }]} numberOfLines={1}>{report}</Text>
          </View>
          {hasPdf && <Text style={st.pdfT}>{pdfCount} PDF</Text>}
          <View style={st.spacer} />
          <FootItem icon={CARD_ICO.cal} text={pickup} />
          <Text style={st.metaDot}>·</Text>
          <FootItem icon={CARD_ICO.pay} iconUri={payIcon || undefined} text={pay} />
          {unpaid && (
            <>
              <Text style={st.metaDot}>·</Text>
              <FootItem icon={CARD_ICO.money} text="Unpaid" textColor={S.AMBER} />
            </>
          )}
        </View>
      </Pressable>
    );
  };

  renderEmpty = () => {
    if (this.state.loading) return null;
    const copy = EMPTY_COPY[this.state.tab] || EMPTY_COPY.all;
    return (
      <View style={st.empty}>
        <Image source={require('./assets/soil.png')} style={st.emptyIco} />
        <Text style={st.emptyT}>{copy.title}</Text>
        <Text style={st.emptyS}>{copy.sub}</Text>
      </View>
    );
  };

  render() {
    const { loading, refreshing, orders } = this.state;

    return (
      <View style={st.root}>
        <StatusBar barStyle="light-content" backgroundColor={S.P} />
        <NavigationEvents onDidFocus={() => { this.onScreenFocus(); this.fetchOrders(); }} />

        <View style={st.hdrWrap}>
          <ScreenHeader
            bg={S.P}
            kicker="Soil test orders"
            title="Mitti Jaanch"
            onBack={this.goBack}
            right={(
              <NotificationBellButton
                navigation={this.props.navigation}
                size={36}
                iconSize={15}
                style={{ backgroundColor: 'rgba(255,255,255,0.14)', marginLeft: 0 }}
              />
            )}
          />
        </View>

        <View style={st.body}>
          {this.renderTabBar()}
          {loading && !refreshing ? (
            <View style={st.loader}><ActivityIndicator color={S.P} size="small" /></View>
          ) : (
            <FlatList
              data={orders}
              keyExtractor={(it, i) => `soil-${it?.id || i}`}
              renderItem={this.renderCard}
              ListHeaderComponent={this.renderListHeader}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              ListEmptyComponent={this.renderEmpty}
              contentContainerStyle={[
                st.listInner,
                orders.length === 0 && { flexGrow: 1 },
              ]}
              style={st.list}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={this.onRefresh} colors={[S.P]} tintColor={S.P} />}
            />
          )}
        </View>

        <View style={[st.footerSafe, { paddingBottom: screenFooterPadding() }]}>
          <View style={st.footer}>
            <TouchableOpacity style={st.bookBtn} activeOpacity={0.88} onPress={this.onBook}>
              <Image source={require('./assets/soil.png')} style={st.bookIco} />
              <Text style={st.bookTxt}>Book Soil Test</Text>
              <Image source={I.arrow} style={st.bookArrow} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: SCREEN_BG },

  hdrWrap: { backgroundColor: S.P },
  bellBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  bellIco: { width: 15, height: 15, tintColor: '#FFF', resizeMode: 'contain' },

  body: { flex: 1, backgroundColor: SCREEN_BG },

  tabBarWrap: { paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 6 },
  tabBar: {
    flexDirection: 'row', backgroundColor: S.P_SOFT, borderRadius: 12, padding: TAB_PAD,
    borderWidth: 1, borderColor: S.P_GLOW, position: 'relative',
  },
  tabIndicator: {
    position: 'absolute', top: TAB_PAD, left: TAB_PAD, bottom: TAB_PAD,
    backgroundColor: '#FFF', borderRadius: 9,
    shadowColor: S.P, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2,
  },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 2 },
  tabLbl: { fontSize: 10.5, fontWeight: '500', color: S.P_DARK, opacity: 0.65 },
  tabLblOn: { color: S.P, fontWeight: '600', opacity: 1 },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1, paddingHorizontal: PAD },
  listInner: { paddingBottom: FOOTER_H + 6 },
  listCount: { fontSize: 11, fontWeight: '500', color: S.MUTED, marginBottom: 4 },

  card: {
    backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E8ECF1',
    borderLeftWidth: 4, overflow: 'hidden',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardPressed: { opacity: 0.96 },

  cardTop: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 11, paddingTop: 11, paddingBottom: 9,
  },
  soilIco: {
    width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 9,
  },
  soilImg: { width: 24, height: 24 },
  cardMid: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3, gap: 6 },
  farmerName: { fontSize: 14, fontWeight: '600', color: S.TXT, flex: 1 },
  metaTxt: { fontSize: 10.5, fontWeight: '400', color: S.SUB },
  spacer: { flex: 1, minWidth: 4 },
  cardBot: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 11, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusTxt: { fontSize: 10.5, fontWeight: '600' },
  pdfT: { fontSize: 10, fontWeight: '600', color: S.GREEN_DARK },
  price: { fontSize: 13.5, fontWeight: '600', color: S.TXT },
  chev: { width: 8, height: 8, tintColor: '#CBD5E1' },
  metaDot: { fontSize: 10, color: '#CBD5E1' },
  footItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footIco: { width: 18, height: 18 },
  footTxt: { fontSize: 10, fontWeight: '600', color: S.TXT },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40, gap: 6 },
  emptyIco: { width: 44, height: 44, resizeMode: 'contain', marginBottom: 6, opacity: 0.85 },
  emptyT: { fontSize: 14, fontWeight: '600', color: S.TXT },
  emptyS: { fontSize: 11.5, fontWeight: '400', color: S.SUB },

  footerSafe: { backgroundColor: '#FFF', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8ECF1' },
  footer: { paddingHorizontal: FOOTER_PAD, paddingTop: 8 },
  bookBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: BOOK_GREEN, borderRadius: 12, minHeight: 48, paddingVertical: 13,
  },
  bookIco: { width: 18, height: 18, resizeMode: 'contain' },
  bookTxt: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  bookArrow: { width: 10, height: 10, tintColor: '#FFF', resizeMode: 'contain' },
});

export default withV4Navigation(SoilOrders);
