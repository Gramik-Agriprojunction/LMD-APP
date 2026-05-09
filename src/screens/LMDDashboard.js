import React, { Component } from 'react';
import {
  View, SafeAreaView, Text, StatusBar, TouchableOpacity, StyleSheet,
  Dimensions, FlatList, ScrollView, Linking, Image, Animated, RefreshControl, Alert,
} from 'react-native';
import constants from '../utils/constants';
import { NavigationEvents, withV4Navigation } from '../utils/v4Compat';
import ShimmerLoader from '../components/ShimmerLoader';
import NetBanner from '../components/NetBanner';

const { width } = Dimensions.get('window');
const P = '#5D3FD3';

class LMDDashboard extends Component {
  constructor() {
    super();
    this.state = { loading: true, refreshing: false, data: null, notif: 0 };
    this.anims = [0,1,2,3,4].map(() => ({ o: new Animated.Value(0), y: new Animated.Value(20) }));
  }

  componentDidMount() { this.load(); }

  animate = () => {
    this.anims.forEach((a, i) => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(a.o, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.spring(a.y, { toValue: 0, friction: 8, useNativeDriver: true }),
        ]).start();
      }, i * 60);
    });
  };

  load = () => {
    if (!this.state.refreshing) this.setState({ loading: true });
    fetch(constants.homescreen, {
      headers: { 'X-localization': 'en', Authorization: 'Bearer ' + global.token }, method: 'GET',
    })
      .then(r => r.json())
      .then(j => {
        console.log('Dashboard API response== ', JSON.stringify(j));
        if (j.status) {
          this.setState({ loading: false, refreshing: false, data: j.data || {}, notif: Number(j.data?.notification_count || 0) }, this.animate);
        } else this.setState({ loading: false, refreshing: false });
      })
      .catch(() => this.setState({ loading: false, refreshing: false }));
  };

  refresh = () => {
    this.anims.forEach(a => { a.o.setValue(0); a.y.setValue(20); });
    this.setState({ refreshing: true }, this.load);
  };

  go = (s) => this.props.navigation.navigate('TrackOrders', { selectedStatus: s || 'ALL' });
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

  badge = (s) => {
    const m = { PENDING:{bg:'#EA580C',c:'#FFF'}, DELIVERED:{bg:'#16A34A',c:'#FFF'}, PICKUP:{bg:'#7C3AED',c:'#FFF'}, INTRANSIT:{bg:'#2563EB',c:'#FFF'}, RESCHEDULE:{bg:'#7C3AED',c:'#FFF'}, RTO:{bg:'#DC2626',c:'#FFF'}, CANCELLED:{bg:'#DC2626',c:'#FFF'} };
    return m[s] || { bg: '#F1F5F9', c: '#475569' };
  };

  statusLabel = (s) => {
    const m = { PENDING:'Pending', DELIVERED:'Delivered', PICKUP:'Picked Up', INTRANSIT:'In Transit', RESCHEDULE:'Reschedule', RTO:'RTO', CANCELLED:'Cancelled' };
    return m[s] || s;
  };

  renderItem = ({ item }) => {
    const st = (item?.status || '').toUpperCase();
    const b = this.badge(st);
    const ds = item?.dark_store;

    return (
      <TouchableOpacity activeOpacity={0.75} onPress={() => this.props.navigation.navigate('DeliveryDetails', { order: item })} style={$.dlv}>
        {/* Order ID + Status */}
        <View style={$.dlvHead}>
          <Text style={$.dlvOid}>#{item?.order_id}</Text>
          <View style={{ flex: 1 }} />
          <View style={[$.chip, { backgroundColor: b.bg }]}><Text style={[$.chipT, { color: b.c }]}>{this.statusLabel(st)}</Text></View>
        </View>

        {/* Farmer */}
        <View style={$.dlvPerson}>
          <Image source={require('./assets/farmer.png')} style={$.dlvAvt} />
          <View style={{ flex: 1 }}>
            <Text style={$.dlvName}>{item?.farmer_name || '-'}</Text>
            <Text style={$.dlvPhone}>{this.mask(item?.farmer_mobile)}</Text>
          </View>
          <TouchableOpacity onPress={() => this.dial(item?.farmer_mobile)} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}}><Image source={require('./assets/call.png')} style={$.ico} /></TouchableOpacity>
          <TouchableOpacity onPress={() => this.wa(item?.farmer_mobile)} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}} style={{ marginLeft: 8 }}><Image source={require('./assets/whatsapp.png')} style={$.ico} /></TouchableOpacity>
        </View>

        {/* Route: Pickup → Drop */}
        <View style={$.routeWrap}>
          {/* Pickup */}
          <View style={$.routeRow}>
            <View style={$.routeTl}>
              <View style={[$.dot, { backgroundColor: '#0DA60D' }]} />
              <View style={$.routeLine} />
            </View>
            <View style={$.routeBody}>
              <Text style={[$.routeLbl, { color: '#0DA60D' }]}>Pickup</Text>
              <Text style={$.routeTitle}>{ds?.name || '-'}</Text>
              {ds?.mobile ? <Text style={$.routePhone}>{ds.mobile}</Text> : null}
              <Text style={$.routeAddr}>{ds?.location || `${ds?.city || ''}${ds?.pincode ? `, ${ds.pincode}` : ''}`}</Text>
            </View>
            {ds?.mobile ? (
              <TouchableOpacity onPress={() => this.dial(ds.mobile)} activeOpacity={0.7} style={$.dsCallBtn}>
                <Image source={require('./assets/call.png')} style={$.dsCallIco} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Drop */}
          <View style={$.routeRow}>
            <View style={$.routeTl}>
              <View style={[$.dot, { backgroundColor: '#EF4444' }]} />
            </View>
            <View style={[$.routeBody, { paddingBottom: 0 }]}>
              <Text style={[$.routeLbl, { color: '#EF4444' }]}>Drop</Text>
              <Text style={$.routeAddr}>{item?.shipping_address || '-'}</Text>
            </View>
          </View>
        </View>

        {/* Footer: payment info + amount */}
        <View style={$.dlvFoot}>
          {item?.payment_mode ? <View style={[$.pill, { backgroundColor: '#475569' }]}><Text style={[$.pillT, { color: '#FFF' }]}>{item.payment_mode}</Text></View> : null}
          <View style={[$.pill, { backgroundColor: item?.payment_status === 'paid' ? '#16A34A' : '#B45309' }]}>
            <Text style={[$.pillT, { color: '#FFF' }]}>{item?.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={$.dlvAmt}>₹{this.n(item?.amount)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  a = (i) => ({ opacity: this.anims[Math.min(i,4)].o, transform: [{ translateY: this.anims[Math.min(i,4)].y }] });

  render() {
    const d = this.state.data;
    const name = d?.partner?.name || '';
    const rule = d?.partner?.rule;
    const live = d?.live_orders || {};
    const today = d?.today_deliveries || [];
    const earn = this.n(d?.earnings?.this_month);
    const pen = this.n(d?.penalties?.this_month);

    return (
      <View style={$.root}>
        <StatusBar backgroundColor={P} translucent={false} barStyle="light-content" />
        <NavigationEvents onWillFocus={() => {}} onDidFocus={() => this.load()} />

        <View style={$.hdr}>
          <SafeAreaView>
            <View style={$.hdrRow}>
              <TouchableOpacity style={$.hdrBtn} onPress={() => this.props.navigation.navigate('Profile')} activeOpacity={0.7}>
                <Image source={require('./assets/profile.png')} style={$.profIco} />
              </TouchableOpacity>
              <View style={$.hdrInfo}>
                <Text style={$.hdrSub}>Welcome</Text>
                <Text style={$.hdrName} numberOfLines={1}>{name || '-'}</Text>
              </View>
              <TouchableOpacity style={$.hdrBtn} onPress={() => this.props.navigation.navigate('Notifications')} activeOpacity={0.7}>
                <Image source={require('./assets/bell.png')} style={$.hdrIco} />
                {this.state.notif > 0 && <View style={$.hdrBadge}><Text style={$.hdrBadgeT}>{this.state.notif}</Text></View>}
              </TouchableOpacity>
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
                  <Text style={$.earnLbl}>Earnings</Text>
                  <Text style={$.earnVal}>₹ {fmt(earn)}</Text>
                </View>
                <View style={{ width: 8 }} />
                <View style={[$.earnCard, { backgroundColor: '#DC2626' }]}>
                  <Text style={$.earnLbl}>Penalties</Text>
                  <Text style={$.earnVal}>₹ {fmt(pen)}</Text>
                </View>
              </Animated.View>

              <Animated.View style={[$.card, this.a(2)]}>
                <View style={$.cardH}>
                  <Text style={$.cardT}>Live Orders <Text style={{ color: P }}>({this.n(live?.all_orders)})</Text></Text>
                  <TouchableOpacity onPress={() => this.go('ALL')} activeOpacity={0.7}><View style={$.viewAllWrap}><Text style={$.viewAll}>View All ›</Text></View></TouchableOpacity>
                </View>
                <View style={$.sg}>
                  {[
                    { l: 'Picked Up', v: live?.picked_up, bg: '#E2E8F0', c: '#334155', k: 'PICKUP' },
                    { l: 'Pending', v: live?.pending, bg: '#FFEDD5', c: '#C2410C', k: 'PENDING' },
                    { l: 'Delivered', v: live?.delivered, bg: '#DCFCE7', c: '#15803D', k: 'DELIVERED' },
                    { l: 'In-Transit', v: live?.in_transit, bg: '#DBEAFE', c: '#1D4ED8', k: 'IN_TRANSIT' },
                    { l: 'Reschedule', v: live?.reschedule_order, bg: '#EDE9FE', c: '#6D28D9', k: 'RESCHEDULE' },
                    { l: 'RTO', v: live?.rto, bg: '#FEE2E2', c: '#B91C1C', k: 'RTO' },
                    ...(live?.cancelled !== undefined ? [{ l: 'Cancelled', v: live?.cancelled, bg: '#FEE2E2', c: '#B91C1C', k: 'CANCELLED' }] : []),
                  ].map(s => (
                    <TouchableOpacity key={s.k} activeOpacity={0.8} onPress={() => this.go(s.k)} style={[$.sb, { backgroundColor: s.bg }]}>
                      <Text style={[$.sbV, { color: s.c }]}>{this.n(s.v)}</Text>
                      <Text style={[$.sbL, { color: s.c }]}>{s.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Animated.View>

              <Animated.View style={this.a(3)}>
                <View style={$.dlvHeader}>
                  <Text style={$.cardT}>Today's Deliveries</Text>
                  <TouchableOpacity onPress={() => this.go('TODAY')} activeOpacity={0.7}><View style={$.viewAllWrap}><Text style={$.viewAll}>View All ›</Text></View></TouchableOpacity>
                </View>
                {today.length > 0 ? (
                  <FlatList data={today} keyExtractor={(it, i) => `${it?.order_id || i}`} renderItem={this.renderItem} scrollEnabled={false} />
                ) : <View style={[$.card, { alignItems: 'center', paddingVertical: 14 }]}><Image source={require('./assets/dlh.png')} style={{ width: 64, height: 64, resizeMode: 'contain', marginBottom: 6 }} /><Text style={$.empty}>No deliveries for today</Text></View>}
              </Animated.View>

              <Animated.View style={this.a(4)}>
                <Text style={$.secT}>Quick Actions</Text>
                <View style={$.actRow}>
                  {[
                    { l: 'Deposit', ico: require('./assets/purse.png'), bg: '#DDD6FE', c: '#4C1D95', nav: 'SettlementList' },
                    { l: 'History', ico: require('./assets/dlh.png'), bg: '#BFDBFE', c: '#1E3A8A', nav: 'ALL' },
                    { l: 'Support', ico: require('./assets/help2.png'), bg: '#A7F3D0', c: '#064E3B', nav: 'support' },
                  ].map(q => (
                    <TouchableOpacity key={q.l} style={[$.qa, { backgroundColor: q.bg }]} activeOpacity={0.8}
                      onPress={() => q.nav === 'support' ? this.dial(this.state.data?.Support) : q.nav === 'ALL' ? this.go('ALL') : this.props.navigation.navigate(q.nav)}>
                      <Image source={q.ico} style={$.qaImg} resizeMode="contain" />
                      <Text style={[$.qaL, { color: q.c }]}>{q.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Animated.View>
              <View style={{ height: 20 }} />
            </ScrollView>
          )}
        </View>
        <NetBanner />
      </View>
    );
  }
}

function fmt(n) { try { return Number(n).toLocaleString('en-IN'); } catch(e) { return String(n); } }

const G = 8;
const SW = (width - 8*2 - 12*2 - G*2) / 3;

const $ = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E8ECF4' },

  hdr: { backgroundColor: P, paddingBottom: 4 },
  hdrRow: { height: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' },
  hdrBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  hdrIco: { width: 17, height: 17, tintColor: '#FFF', resizeMode: 'contain' },
  profIco: { width: 36, height: 36, borderRadius: 18, resizeMode: 'contain' },
  hdrInfo: { flex: 1, marginLeft: 12 },
  hdrSub: { fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.6)' },
  hdrName: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  hdrBadge: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: P },
  hdrBadgeT: { color: '#FFF', fontSize: 8, fontWeight: '700' },

  scroll: { paddingHorizontal: 8, paddingTop: 10, paddingBottom: 20 },

  ruleCard: { backgroundColor: '#FFFBEB', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
  ruleDot: { display: 'none' },
  ruleT: { flex: 1, fontSize: 12, fontWeight: '500', color: '#475569', lineHeight: 17 },

  earnRow: { flexDirection: 'row', marginBottom: 8 },
  earnCard: { flex: 1, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3 },
  earnLbl: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '500' },
  earnVal: { color: '#FFF', fontSize: 20, fontWeight: '700', marginTop: 3 },

  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 },
  cardH: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardT: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  viewAll: { color: P, fontSize: 11, fontWeight: '600' },
  viewAllWrap: { backgroundColor: '#EDE9FE', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },

  sg: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: G },
  sb: { width: SW, borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  sbV: { fontSize: 18, fontWeight: '700' },
  sbL: { fontSize: 9, fontWeight: '500', marginTop: 2 },

  dlvHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 6 },
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
  secT: { fontSize: 12, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 6 },
  actRow: { flexDirection: 'row' },
  qa: { flex: 1, borderRadius: 12, alignItems: 'center', paddingVertical: 14, marginHorizontal: 4, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  qaImg: { width: 32, height: 32, marginBottom: 6 },
  qaL: { fontSize: 11, fontWeight: '600' },
});

export default withV4Navigation(LMDDashboard);
