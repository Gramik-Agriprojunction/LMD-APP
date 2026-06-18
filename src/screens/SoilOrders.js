import React, { Component } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Image,
  ActivityIndicator, RefreshControl, Animated, Dimensions, LayoutAnimation,
  Platform, UIManager, Pressable, Easing,
} from 'react-native';
import moment from 'moment';
import constants from '../utils/constants';
import { withV4Navigation, NavigationEvents } from '../utils/v4Compat';
import ScreenHeader from '../components/ScreenHeader';
import Toast from 'react-native-simple-toast';
import { S, soilIcons as I } from '../utils/soilTheme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const W = Dimensions.get('window').width;
const PAD = 8;
const FOOTER_PAD = 20;
const FOOTER = 56;
const BOOK_GREEN = '#28AD54';
const BOOK_GREEN_DARK = '#1E8A42';

const titleCase = (s) => {
  const t = String(s || '').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const TABS = [
  { key: 'all', label: 'All', apiTab: '', ico: I.order },
  { key: 'pickup', label: 'Pickup', apiTab: 'pending', ico: I.clock },
  { key: 'lab', label: 'Lab', apiTab: 'lab', ico: I.fertilizer },
  { key: 'ready', label: 'Ready', apiTab: 'ready', ico: I.doc },
];

const STAGE = {
  pickup: { color: S.ORANGE, fill: S.ORANGE, bg: S.ORANGE_BG, ico: I.clock, label: 'Pickup pending' },
  lab: { color: S.BLUE, fill: S.BLUE, bg: S.BLUE_BG, ico: I.fertilizer, label: 'In lab' },
  ready: { color: S.GREEN_DARK, fill: S.GREEN, bg: S.GREEN_BG, ico: I.doc, label: 'Report ready' },
  cancelled: { color: S.RED, fill: S.RED, bg: S.RED_BG, ico: I.close, label: 'Cancelled' },
};

const PKG = {
  BASIC: { color: S.GREEN_DARK, fill: S.GREEN_BG, accent: S.GREEN },
  ADVANCE: { color: S.P_DARK, fill: S.P_TINT, accent: S.P },
  PREMIUM: { color: S.AMBER, fill: S.AMBER_BG, accent: S.AMBER },
};

const EMPTY_COPY = {
  all: { title: 'Koi order nahi mila', sub: 'Apna pehla soil test book karein aur yahan track karein' },
  pickup: { title: 'Pickup orders nahi hain', sub: 'Jab sample pickup hoga, order yahan dikhega' },
  lab: { title: 'Lab mein koi sample nahi', sub: 'Testing ke dauran orders yahan dikhenge' },
  ready: { title: 'Report ready nahi hai', sub: 'Jab report ban jayega, yahan dikhega' },
};

const EMPTY_STEPS = [
  { ico: I.clock, label: 'Pickup', fill: '#FFF3E6', icoColor: '#D97706' },
  { ico: I.fertilizer, label: 'Lab test', fill: '#E8EEFF', icoColor: '#4F6FD6' },
  { ico: I.doc, label: 'Report', fill: '#E6F7F0', icoColor: BOOK_GREEN },
];

const getStage = (o) => {
  const stt = String(o?.status || '').toLowerCase();
  const rs = String(o?.report_status || '').toLowerCase();
  const hasReport = Array.isArray(o?.report) && o.report.length > 0;
  if (stt === 'cancelled' || o?.cancelled_date) return 'cancelled';
  if (hasReport || stt === 'ready' || stt === 'completed' || rs.includes('generated') || rs.includes('ready')) return 'ready';
  if (['in_lab', 'lab', 'processing', 'sample_collected', 'picked_up', 'in_progress'].includes(stt) || (o?.picked_date && !hasReport)) return 'lab';
  return 'pickup';
};

const getPkg = (o) => {
  const line = o?.packages?.[0];
  const p = line?.package || {};
  return {
    type: String(p?.type || p?.name || 'Soil Test').toUpperCase(),
    price: o?.final_total_amount || line?.package_amount || p?.price || 0,
    qty: line?.quantity || 1,
  };
};

const payLbl = (m) => {
  const s = String(m || '').toLowerCase();
  if (s === 'cash_on_delivery' || s === 'cod') return 'COD';
  if (s === 'online' || s === 'upi') return 'Online';
  return m || '-';
};

class EmptyState extends React.PureComponent {
  constructor(props) {
    super(props);
    this.o = new Animated.Value(0);
    this.y = new Animated.Value(16);
  }
  componentDidMount() {
    Animated.parallel([
      Animated.timing(this.o, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(this.y, { toValue: 0, friction: 8, tension: 55, useNativeDriver: true }),
    ]).start();
  }
  render() {
    const { tab } = this.props;
    const copy = EMPTY_COPY[tab] || EMPTY_COPY.all;
    return (
      <Animated.View style={[st.empty, { opacity: this.o, transform: [{ translateY: this.y }] }]}>
        <View style={st.emptyCard}>
          <View style={st.emptyIconOuter}>
            <View style={st.emptyIconRing} />
            <View style={st.emptyIconCircle}>
              <Image source={I.plant} style={st.emptyIco} />
            </View>
          </View>

          <Text style={st.emptyT}>{copy.title}</Text>
          <Text style={st.emptyS}>{copy.sub}</Text>

          <View style={st.emptySteps}>
            {EMPTY_STEPS.map((s) => (
              <View key={s.label} style={[st.emptyStep, { backgroundColor: s.fill }]}>
                <Image source={s.ico} style={[st.emptyStepIco, { tintColor: s.icoColor }]} />
                <Text style={[st.emptyStepTxt, { color: s.icoColor }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          <View style={st.emptyHint}>
            <Image source={I.down} style={st.emptyHintIco} />
            <Text style={st.emptyHintTxt}>Neeche "Book Soil Test" dabayein</Text>
          </View>
        </View>
      </Animated.View>
    );
  }
}

const SWAP = { duration: 240, create: { type: 'easeInEaseOut', property: 'opacity' }, update: { type: 'easeInEaseOut' } };

class FadeCard extends React.PureComponent {
  constructor(props) {
    super(props);
    this.o = new Animated.Value(0);
    this.y = new Animated.Value(12);
  }
  componentDidMount() {
    const d = Math.min((this.props.delay || 0) * 50, 250);
    Animated.parallel([
      Animated.timing(this.o, { toValue: 1, duration: 300, delay: d, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(this.y, { toValue: 0, friction: 8, tension: 65, delay: d, useNativeDriver: true }),
    ]).start();
  }
  render() {
    return (
      <Animated.View style={{ opacity: this.o, transform: [{ translateY: this.y }] }}>
        {this.props.children}
      </Animated.View>
    );
  }
}

class PressCard extends React.PureComponent {
  s = new Animated.Value(1);
  in = () => Animated.spring(this.s, { toValue: 0.98, friction: 8, tension: 120, useNativeDriver: true }).start();
  out = () => Animated.spring(this.s, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();
  render() {
    const { onPress, style, children } = this.props;
    return (
      <Animated.View style={{ transform: [{ scale: this.s }] }}>
        <Pressable onPress={onPress} onPressIn={this.in} onPressOut={this.out} style={style}>
          {children}
        </Pressable>
      </Animated.View>
    );
  }
}

class BookArrow extends React.PureComponent {
  constructor(props) {
    super(props);
    this.slide = new Animated.Value(0);
    this._loop = null;
  }
  componentDidMount() {
    this._loop = Animated.loop(
      Animated.sequence([
        Animated.timing(this.slide, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(this.slide, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    this._loop.start();
  }
  componentWillUnmount() {
    this._loop?.stop();
  }
  render() {
    const tx = this.slide.interpolate({ inputRange: [0, 1], outputRange: [0, 4] });
    return (
      <Animated.Image source={I.arrow} style={[st.bookArrowIco, { transform: [{ translateX: tx }] }]} />
    );
  }
}

class SoilOrders extends Component {
  constructor(props) {
    super(props);
    this.state = { loading: true, refreshing: false, orders: [], tab: 'all' };
    this.pillX = new Animated.Value(0);
    this.fetchSeq = 0;
  }

  componentDidMount() {
    this.fetchOrders();
  }

  goBack = () => this.props?.navigation?.goBack?.();
  onBook = () => this.props.navigation.navigate('CreateSoilOrder');

  segW = () => (W - PAD * 2 - 8) / TABS.length;

  switchTab = (key) => {
    if (key === this.state.tab) return;
    const idx = TABS.findIndex((t) => t.key === key);
    Animated.spring(this.pillX, { toValue: idx * this.segW(), friction: 10, tension: 110, useNativeDriver: true }).start();
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

  renderTabs = () => {
    const { tab } = this.state;
    const sw = this.segW();
    return (
      <View style={st.tabWrap}>
        <View style={st.seg}>
          <Animated.View style={[st.segPill, { width: sw, transform: [{ translateX: this.pillX }] }]} />
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <TouchableOpacity key={t.key} style={[st.segItem, { width: sw }]} activeOpacity={0.75} onPress={() => this.switchTab(t.key)}>
                <Image source={t.ico} style={[st.segIco, { tintColor: on ? S.P : 'rgba(255,255,255,0.75)' }]} />
                <Text style={[st.segTxt, on && st.segTxtOn]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  renderCard = ({ item, index }) => {
    const pkg = getPkg(item);
    const pt = PKG[pkg.type] || PKG.BASIC;
    const stage = getStage(item);
    const sm = STAGE[stage] || STAGE.pickup;
    const pickup = item?.sample_pickup_date ? moment(item.sample_pickup_date).format('DD MMM') : '-';
    const report = item?.report_status || sm.label;
    const pay = payLbl(item?.payment_mode);
    const unpaid = String(item?.payment_status || '').toLowerCase() !== 'paid';
    const hasPdf = Array.isArray(item?.report) && item.report.length > 0;
    const pdfCount = hasPdf ? item.report.length : 0;
    const farmer = item?.farmer?.name || 'Farmer';
    const district = item?.farmer?.address || item?.address?.district || '';

    return (
      <FadeCard delay={index < 6 ? index : 0}>
        <PressCard
          style={st.card}
          onPress={() => this.props.navigation.navigate('SoilOrderDetail', { orderId: item.id, order: item })}
        >
          <View style={[st.cardAccent, { backgroundColor: sm.fill }]} />

          <View style={st.cardBody}>
            <View style={st.cardHead}>
              <View style={[st.pkgIco, { backgroundColor: pt.fill }]}>
                <Image source={I.plant} style={[st.pkgIcoImg, { tintColor: pt.accent }]} />
              </View>
              <View style={st.cardHeadInfo}>
                <View style={st.cardTitleRow}>
                  <Text style={st.cTitle} numberOfLines={1}>{titleCase(pkg.type)} Soil Test</Text>
                  <Text style={st.cPrice}>₹{pkg.price}</Text>
                </View>
                <Text style={st.cFarmer} numberOfLines={1}>
                  {farmer}{district ? ` · ${district}` : ''}
                </Text>
                <View style={st.badgeRow}>
                  <View style={[st.statusBadge, { backgroundColor: sm.bg }]}>
                    <Image source={sm.ico} style={[st.statusBadgeIco, { tintColor: sm.color }]} />
                    <Text style={[st.statusBadgeTxt, { color: sm.color }]} numberOfLines={1}>{report}</Text>
                  </View>
                  {unpaid && (
                    <View style={st.unpaidBadge}>
                      <Text style={st.unpaidTxt}>Unpaid</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <View style={st.cardFoot}>
              <View style={st.metaGroup}>
                <View style={st.metaItem}>
                  <Image source={I.calendar} style={st.metaIco} />
                  <Text style={st.metaTxt}>{pickup}</Text>
                </View>
                <View style={st.metaSep} />
                <View style={st.metaItem}>
                  <Image source={I.wallet} style={st.metaIco} />
                  <Text style={st.metaTxt}>{pay}</Text>
                </View>
                <View style={st.metaSep} />
                <View style={st.metaItem}>
                  <Image source={I.bag} style={st.metaIco} />
                  <Text style={st.metaTxt}>×{pkg.qty}</Text>
                </View>
              </View>

              {hasPdf ? (
                <View style={st.pdfBadge}>
                  <Image source={I.doc} style={st.pdfBadgeIco} />
                  <Text style={st.pdfBadgeTxt}>{pdfCount} PDF</Text>
                </View>
              ) : (
                <View style={st.arrowBtn}>
                  <Image source={I.arrow} style={st.arrowIco} />
                </View>
              )}
            </View>
          </View>
        </PressCard>
      </FadeCard>
    );
  };

  renderEmpty = () => {
    if (this.state.loading) return null;
    return <EmptyState tab={this.state.tab} />;
  };

  renderFooter = () => (
    <View style={st.footer}>
      <PressCard onPress={this.onBook} style={st.bookBtn}>
        <Image source={I.plant} style={st.bookPlantIco} />
        <Text style={st.bookTxt}>Book Soil Test</Text>
        <BookArrow />
      </PressCard>
    </View>
  );

  render() {
    const { loading, refreshing, orders } = this.state;

    return (
      <View style={st.root}>
        <StatusBar barStyle="light-content" backgroundColor={S.P} />
        <NavigationEvents onDidFocus={() => this.fetchOrders()} />

        <ScreenHeader
          bg={S.P}
          kicker="Aapke soil test orders"
          title="Mitti Jaanch"
          onBack={this.goBack}
          right={
            <TouchableOpacity activeOpacity={0.7} onPress={() => this.props.navigation.navigate('Notifications')} style={st.hdrBtn}>
              <Image source={I.bell} style={st.hdrBtnIco} />
            </TouchableOpacity>
          }
        />

        {this.renderTabs()}

        <View style={st.body}>
          {loading && !refreshing ? (
            <View style={st.loader}><ActivityIndicator color={S.P} size="small" /></View>
          ) : (
            <FlatList
              data={orders}
              keyExtractor={(it, i) => `soil-${it?.id || i}`}
              renderItem={this.renderCard}
              ListHeaderComponent={orders.length > 0 ? (
                <View style={st.listHdr}>
                  <Text style={st.listLabel}>{orders.length} order{orders.length !== 1 ? 's' : ''}</Text>
                </View>
              ) : null}
              ListEmptyComponent={this.renderEmpty}
              contentContainerStyle={[st.list, orders.length === 0 && { flexGrow: 1 }]}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={this.onRefresh} colors={[S.P]} tintColor={S.P} />}
            />
          )}
        </View>

        {this.renderFooter()}
      </View>
    );
  }
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: S.BG },

  hdrBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  hdrBtnIco: { width: 16, height: 16, tintColor: '#FFF', resizeMode: 'contain' },

  tabWrap: { paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 6, backgroundColor: S.P },
  seg: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, padding: 3, position: 'relative' },
  segPill: {
    position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: 9, backgroundColor: '#FFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3,
  },
  segItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 5, zIndex: 1 },
  segIco: { width: 13, height: 13, resizeMode: 'contain' },
  segTxt: { fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },
  segTxtOn: { color: S.P_DARK },

  body: { flex: 1, backgroundColor: S.BG },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: PAD + 2, paddingBottom: FOOTER, paddingTop: 4 },
  listHdr: { paddingTop: 12, paddingBottom: 8 },
  listLabel: { fontSize: 12, fontWeight: '600', color: S.SUB },

  card: {
    flexDirection: 'row', backgroundColor: S.CARD, borderRadius: 14, marginBottom: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: S.BORDER,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start' },
  pkgIco: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  pkgIcoImg: { width: 20, height: 20, resizeMode: 'contain' },
  cardHeadInfo: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  cTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: S.TXT, marginRight: 8 },
  cPrice: { fontSize: 14, fontWeight: '700', color: S.TXT },
  cFarmer: { fontSize: 11.5, fontWeight: '500', color: S.SUB, marginBottom: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeIco: { width: 11, height: 11, resizeMode: 'contain', marginRight: 4 },
  statusBadgeTxt: { fontSize: 10.5, fontWeight: '600' },
  unpaidBadge: { backgroundColor: S.AMBER_BG, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#FDE68A' },
  unpaidTxt: { fontSize: 10, fontWeight: '600', color: S.AMBER },

  cardFoot: {
    flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: S.BORDER,
  },
  metaGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaIco: { width: 12, height: 12, tintColor: S.MUTED, resizeMode: 'contain' },
  metaTxt: { fontSize: 11, fontWeight: '500', color: S.SUB },
  metaSep: { width: 1, height: 12, backgroundColor: S.BORDER, marginHorizontal: 8 },
  pdfBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: S.GREEN_BG,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, gap: 4,
  },
  pdfBadgeIco: { width: 11, height: 11, tintColor: S.GREEN_DARK, resizeMode: 'contain' },
  pdfBadgeTxt: { fontSize: 10.5, fontWeight: '700', color: S.GREEN_DARK },
  arrowBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: S.P_TINT,
    alignItems: 'center', justifyContent: 'center',
  },
  arrowIco: { width: 10, height: 10, tintColor: S.P, resizeMode: 'contain' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: PAD, paddingBottom: 24, paddingTop: 8 },
  emptyCard: {
    width: '100%', backgroundColor: S.CARD, borderRadius: 16, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center',
    borderWidth: 1, borderColor: S.BORDER,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  emptyIconOuter: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyIconRing: {
    position: 'absolute', width: 88, height: 88, borderRadius: 44, backgroundColor: S.GREEN_BG, opacity: 0.9,
  },
  emptyIconCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: BOOK_GREEN,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: BOOK_GREEN_DARK, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3,
  },
  emptyIco: { width: 30, height: 30, tintColor: '#FFF', resizeMode: 'contain' },
  emptyT: { fontSize: 16, fontWeight: '700', color: S.TXT, textAlign: 'center', marginBottom: 6 },
  emptyS: { fontSize: 12.5, fontWeight: '400', color: S.SUB, textAlign: 'center', lineHeight: 18, paddingHorizontal: 8 },
  emptySteps: { flexDirection: 'row', gap: 8, marginTop: 20, marginBottom: 18 },
  emptyStep: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 10 },
  emptyStepIco: { width: 16, height: 16, resizeMode: 'contain', marginBottom: 5 },
  emptyStepTxt: { fontSize: 10, fontWeight: '600' },
  emptyHint: { flexDirection: 'row', alignItems: 'center', backgroundColor: S.BG, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  emptyHintIco: { width: 12, height: 12, tintColor: BOOK_GREEN, resizeMode: 'contain', marginRight: 6 },
  emptyHintTxt: { fontSize: 11.5, fontWeight: '500', color: S.SUB },

  footer: {
    backgroundColor: S.BG,
    paddingHorizontal: FOOTER_PAD,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    borderTopWidth: 1,
    borderTopColor: S.BORDER,
  },
  bookBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: BOOK_GREEN, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 18, gap: 8,
    marginBottom: 5,
    shadowColor: BOOK_GREEN_DARK, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  bookPlantIco: { width: 17, height: 17, tintColor: '#FFF', resizeMode: 'contain' },
  bookTxt: { fontSize: 15, fontWeight: '700', color: '#FFF', letterSpacing: 0.15 },
  bookArrowIco: { width: 14, height: 14, tintColor: '#FFF', resizeMode: 'contain' },
});

export default withV4Navigation(SoilOrders);
