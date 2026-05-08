import React, { Component } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, Dimensions,
  SafeAreaView, StatusBar, Image, Animated, RefreshControl, Linking, Alert,
} from 'react-native';
import constants from '../utils/constants';
import ShimmerLoader from '../components/ShimmerLoader';
import { NavigationEvents, withV4Navigation } from '../utils/v4Compat';

const { width } = Dimensions.get('window');
const P = '#5D3FD3';
const G = 8;
const SW = (width - 8*2 - 12*2 - G*2) / 3;

const STATUSES = ['ALL','PICKUP','PENDING','DELIVERED','IN_TRANSIT','RESCHEDULE','RTO','CANCELLED'];

class TrackOrders extends Component {
  constructor(props) {
    super(props);
    const init = this.props?.navigation?.getParam('selectedStatus', 'ALL');
    this.state = { loading: true, refreshing: false, query: '', selected: STATUSES.includes(init) ? init : 'ALL', orders: [], live: {} };
    this.anims = [0,1,2].map(() => ({ o: new Animated.Value(0), y: new Animated.Value(20) }));
  }

  componentDidMount() { this.load(); }

  animateIn = () => {
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
    const body = { status: this.state.selected === 'ALL' ? '' : this.state.selected.toLowerCase() };
    console.log('Orders List API payload== ', body);
    fetch(constants.orderList, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + global.token, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(j => {
        console.log('Orders List API response== ', JSON.stringify(j));
        this.setState({
          loading: false, refreshing: false,
          orders: j?.status && Array.isArray(j.data) ? j.data : [],
          live: j?.live || this.state.live,
        }, this.animateIn);
      })
      .catch(() => this.setState({ loading: false, refreshing: false, orders: [] }));
  };

  refresh = () => {
    this.anims.forEach(a => { a.o.setValue(0); a.y.setValue(20); });
    this.setState({ refreshing: true }, this.load);
  };

  pick = (s) => this.setState({ selected: s }, this.load);
  n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  mask = (p) => { if (!p) return ''; const s = String(p); if (s.length < 6) return s; return s.slice(0,2) + '****' + s.slice(-2); };
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

  badge = (s) => {
    const m = { PENDING:{bg:'#EA580C'}, DELIVERED:{bg:'#16A34A'}, PICKUP:{bg:'#7C3AED'}, INTRANSIT:{bg:'#2563EB'}, RESCHEDULE:{bg:'#7C3AED'}, RTO:{bg:'#DC2626'}, CANCELLED:{bg:'#DC2626'} };
    return m[s?.toUpperCase()] || { bg: '#475569' };
  };

  filtered = () => {
    const q = (this.state.query || '').trim().toLowerCase();
    if (!q) return this.state.orders;
    return this.state.orders.filter(o => {
      const ds = o?.dark_store;
      const hay = `${o?.order_id} ${o?.farmer_name} ${o?.farmer_mobile} ${o?.shipping_address} ${ds?.name} ${ds?.mobile} ${ds?.city} ${ds?.location}`.toLowerCase();
      return hay.includes(q);
    });
  };

  renderItem = ({ item }) => {
    const st = (item?.status || '').toUpperCase();
    const b = this.badge(st);
    const ds = item?.dark_store;

    return (
      <TouchableOpacity activeOpacity={0.75} onPress={() => this.props.navigation.navigate('DeliveryDetails', { order: item })} style={s.dlv}>
        {/* Order ID + Status */}
        <View style={s.dlvHead}>
          <Text style={s.dlvOid}>#{item?.order_id}</Text>
          <View style={{ flex: 1 }} />
          <View style={[s.chip, { backgroundColor: b.bg }]}><Text style={s.chipT}>{({PENDING:'Pending',DELIVERED:'Delivered',PICKUP:'Picked Up',INTRANSIT:'In Transit',RESCHEDULE:'Reschedule',RTO:'RTO',CANCELLED:'Cancelled'})[st] || st}</Text></View>
        </View>

        {/* Farmer */}
        <View style={s.dlvPerson}>
          <Image source={require('./assets/farmer.png')} style={s.dlvAvt} />
          <View style={{ flex: 1 }}>
            <Text style={s.dlvName}>{item?.farmer_name || '-'}</Text>
            <Text style={s.dlvPhone}>{this.mask(item?.farmer_mobile)}</Text>
          </View>
          <TouchableOpacity onPress={() => this.dial(item?.farmer_mobile)} activeOpacity={0.7}><Image source={require('./assets/call.png')} style={s.ico} /></TouchableOpacity>
          <TouchableOpacity onPress={() => this.wa(item?.farmer_mobile)} activeOpacity={0.7} style={{ marginLeft: 8 }}><Image source={require('./assets/whatsapp.png')} style={s.ico} /></TouchableOpacity>
        </View>

        {/* Route */}
        <View style={s.routeWrap}>
          <View style={s.routeRow}>
            <View style={s.routeTl}><View style={[s.dot, { backgroundColor: '#0DA60D' }]} /><View style={s.routeLine} /></View>
            <View style={s.routeBody}>
              <Text style={[s.routeLbl, { color: '#0DA60D' }]}>Pickup</Text>
              <Text style={s.routeTitle}>{ds?.name || '-'}</Text>
              {ds?.mobile ? <Text style={s.routePhone}>{ds.mobile}</Text> : null}
              <Text style={s.routeAddr}>{ds?.location || `${ds?.city || ''}${ds?.pincode ? `, ${ds.pincode}` : ''}`}</Text>
            </View>
            {ds?.mobile ? (
              <TouchableOpacity onPress={() => this.dial(ds.mobile)} activeOpacity={0.7} style={s.dsCall}>
                <Image source={require('./assets/call.png')} style={s.dsCallIco} />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={s.routeRow}>
            <View style={s.routeTl}><View style={[s.dot, { backgroundColor: '#EF4444' }]} /></View>
            <View style={[s.routeBody, { paddingBottom: 0 }]}>
              <Text style={[s.routeLbl, { color: '#EF4444' }]}>Drop</Text>
              <Text style={s.routeAddr}>{item?.shipping_address || '-'}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.dlvFoot}>
          <View style={[s.pill, { backgroundColor: '#475569' }]}><Text style={[s.pillT, { color: '#FFF' }]}>{item?.payment_mode || '-'}</Text></View>
          <View style={[s.pill, { backgroundColor: item?.payment_status === 'paid' ? '#16A34A' : '#B45309' }]}>
            <Text style={[s.pillT, { color: '#FFF' }]}>{item?.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={s.dlvAmt}>₹{this.n(item?.amount)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  a = (i) => ({ opacity: this.anims[Math.min(i,2)].o, transform: [{ translateY: this.anims[Math.min(i,2)].y }] });

  render() {
    const { loading, refreshing, query, selected, live } = this.state;
    const data = this.filtered();
    const stats = [
      { k: 'PICKUP', l: 'Picked Up', v: live?.picked_up, bg: '#E2E8F0', c: '#334155' },
      { k: 'PENDING', l: 'Pending', v: live?.pending, bg: '#FFEDD5', c: '#C2410C' },
      { k: 'DELIVERED', l: 'Delivered', v: live?.delivered, bg: '#DCFCE7', c: '#15803D' },
      { k: 'IN_TRANSIT', l: 'In-Transit', v: live?.in_transit, bg: '#DBEAFE', c: '#1D4ED8' },
      { k: 'RESCHEDULE', l: 'Reschedule', v: live?.reschedule_order, bg: '#EDE9FE', c: '#6D28D9' },
      { k: 'RTO', l: 'RTO', v: live?.rto, bg: '#FEE2E2', c: '#B91C1C' },
    ];

    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={P} />
        <NavigationEvents onWillFocus={() => {}} onDidFocus={() => this.load()} />

        <View style={s.hdr}>
          <SafeAreaView>
            <View style={s.hdrRow}>
              <TouchableOpacity onPress={() => this.props.navigation.goBack()} style={s.hdrBtn} activeOpacity={0.7}>
                <Image source={require('./assets/back.png')} style={s.hdrIco} />
              </TouchableOpacity>
              <View style={s.searchBar}>
                <Image source={require('./assets/search.png')} style={s.searchBarIco} />
                <TextInput value={query} onChangeText={t => this.setState({ query: t })} placeholder="Search orders..." placeholderTextColor="rgba(255,255,255,0.5)" style={s.searchBarInput} />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => this.setState({ query: '' })} activeOpacity={0.7} style={s.clearIco}>
                    <Image source={require('./assets/cross.png')} style={s.clearIcoImg} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </SafeAreaView>
        </View>

        {loading && !refreshing ? <ShimmerLoader /> : (
          <FlatList
            data={data}
            keyExtractor={(item, i) => `${item?.order_id || i}`}
            renderItem={this.renderItem}
            contentContainerStyle={s.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={this.refresh} tintColor={P} colors={[P]} />}
            ListHeaderComponent={
              <View>
                {/* Stats */}
                <Animated.View style={[s.card, this.a(0)]}>
                  <Text style={s.cardTitle}>Live Orders</Text>
                  <View style={s.sg}>
                    {stats.map(st => (
                      <TouchableOpacity key={st.k} activeOpacity={0.8} onPress={() => this.pick(st.k)}
                        style={[s.sb, { backgroundColor: st.bg }, selected === st.k && { borderWidth: 1.5, borderColor: st.c }]}>
                        <Text style={[s.sbV, { color: st.c }]}>{this.n(st.v)}</Text>
                        <Text style={[s.sbL, { color: st.c }]}>{st.l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {selected !== 'ALL' && (
                    <TouchableOpacity onPress={() => this.pick('ALL')} style={s.clearBtn} activeOpacity={0.7}>
                      <Text style={s.clearT}>Show All Orders</Text>
                    </TouchableOpacity>
                  )}
                </Animated.View>

                <Animated.View style={this.a(1)}>
                  <Text style={s.secTitle}>{selected === 'ALL' ? 'All Orders' : selected} ({data.length})</Text>
                </Animated.View>
              </View>
            }
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <Image source={require('./assets/dlh.png')} style={s.emptyImg} />
                <Text style={s.emptyTitle}>No Orders Found</Text>
                <Text style={s.emptySub}>There are no orders matching your criteria</Text>
              </View>
            }
          />
        )}
      </View>
    );
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E8ECF4' },

  hdr: { backgroundColor: P, paddingBottom: 8 },
  hdrRow: { height: 50, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  hdrBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  hdrIco: { width: 17, height: 17, tintColor: '#FFF', resizeMode: 'contain' },

  searchBar: { flex: 1, height: 38, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, marginLeft: 10, paddingHorizontal: 10 },
  searchBarIco: { width: 14, height: 14, resizeMode: 'contain', tintColor: 'rgba(255,255,255,0.5)', marginRight: 8 },
  searchBarInput: { flex: 1, fontSize: 14, color: '#FFF', paddingVertical: 0 },
  clearIco: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  clearIcoImg: { width: 8, height: 8, resizeMode: 'contain', tintColor: '#FFF' },

  scroll: { paddingHorizontal: 8, paddingTop: 10, paddingBottom: 20 },

  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#1E293B', marginBottom: 10 },

  sg: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: G },
  sb: { width: SW, borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  sbV: { fontSize: 18, fontWeight: '700' },
  sbL: { fontSize: 10, fontWeight: '500', marginTop: 2 },

  clearBtn: { marginTop: 10, alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 16, backgroundColor: '#EDE9FE', borderRadius: 6 },
  clearT: { fontSize: 11, fontWeight: '600', color: P },

  secTitle: { fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 8, marginTop: 6 },

  // Delivery card — same as dashboard
  dlv: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },

  dlvHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, marginBottom: 2 },
  dlvOid: { fontSize: 13, fontWeight: '600', color: P },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  chipT: { fontSize: 9, fontWeight: '600', color: '#FFF' },

  dlvPerson: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10 },
  dlvAvt: { width: 36, height: 36, borderRadius: 18, resizeMode: 'cover', marginRight: 10 },
  dlvName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  dlvPhone: { fontSize: 12, fontWeight: '400', color: '#94A3B8', marginTop: 1 },
  ico: { width: 28, height: 28, resizeMode: 'contain' },

  routeWrap: { marginHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  routeTl: { width: 14, alignItems: 'center', marginRight: 8, paddingTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  routeLine: { width: 1.5, flex: 1, minHeight: 10, backgroundColor: '#D1D5DB', marginVertical: 3 },
  routeBody: { flex: 1, paddingBottom: 10 },
  routeLbl: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3, marginBottom: 3 },
  routeTitle: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  routePhone: { fontSize: 11, fontWeight: '500', color: '#94A3B8', marginTop: 1 },
  routeAddr: { fontSize: 12, fontWeight: '400', color: '#64748B', lineHeight: 17, marginTop: 1 },
  dsCall: { marginLeft: 6, alignSelf: 'flex-start', marginTop: 4 },
  dsCallIco: { width: 30, height: 30, resizeMode: 'contain', tintColor: '#EA580C' },

  dlvFoot: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, marginRight: 6 },
  pillT: { fontSize: 10, fontWeight: '500' },
  dlvAmt: { fontSize: 15, fontWeight: '700', color: '#16A34A' },

  emptyWrap: { paddingVertical: 50, alignItems: 'center' },
  emptyImg: { width: 70, height: 70, resizeMode: 'contain', marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#475569', marginBottom: 6 },
  emptySub: { fontSize: 12, fontWeight: '400', color: '#94A3B8', textAlign: 'center', paddingHorizontal: 40 },
});

export default withV4Navigation(TrackOrders);
