import React, { Component } from 'react';
import { withV4Navigation } from '../utils/v4Compat';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  StatusBar, Image, Linking, ActivityIndicator, Animated, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatePicker from 'react-native-date-picker';
import Toast from 'react-native-simple-toast';
import constants from '../utils/constants';
import moment from 'moment';
import { invalidateOrderRelated } from '../utils/dataCache';
import { getStatus } from '../utils/statusColors';
import ScreenHeader from '../components/ScreenHeader';
import { callFarmerExotel, dialDirect } from '../utils/exotelCall';
import { prefetchVerifyLocation, resolveCoordsForStatusUpdate, requestStatusLocationAccess } from '../utils/locationHelper';

const P = '#5D3FD3';

class RescheduleDelivery extends Component {
  constructor(props) {
    super(props);
    this.state = {
      details: null, dateObj: null, slot: '', note: '',
      reasons: {}, selectedReason: '', reasonsLoading: false,
      showDateModal: false, showSlotPicker: false, submitting: false,
    };
    // Start fully visible — animating opacity on Android causes elevation shadows to appear huge.
    this.anims = [0,1,2,3,4].map(() => ({ o: new Animated.Value(1), y: new Animated.Value(0) }));
  }

  getOrder = () => this.props?.navigation?.getParam('order', null);

  componentDidMount() {
    const o = this.getOrder();
    if (o) this.setState({ details: o }, () => {
      this.animateIn();
      this.loadReasons();
      this.fetchOrderDetails();
      requestStatusLocationAccess('delivery').then(() => this.startLocationPrefetch());
    });
  }

  startLocationPrefetch = () => {
    prefetchVerifyLocation((coords) => {
      this._verifyCoords = coords;
    });
  };

  normaliseReasons = (raw) => {
    if (!raw) return {};
    if (Array.isArray(raw)) {
      const out = {};
      raw.forEach((r) => {
        if (!r) return;
        if (typeof r === 'string') out[r] = r;
        else if (typeof r === 'object') {
          const k = r.code || r.key || r.id || r.label;
          if (k) out[String(k)] = r.label || r.title || String(k);
        }
      });
      return out;
    }
    if (typeof raw === 'object') return raw;
    return {};
  };

  loadReasons = () => {
    const navReasons = this.props?.navigation?.getParam('reasons', null);
    const reasons = this.normaliseReasons(navReasons);
    if (Object.keys(reasons).length) {
      this.setState({ reasons, reasonsLoading: false });
    }
  };

  fetchOrderDetails = () => {
    const order = this.getOrder();
    const orderId = order?.id || order?.order_id;
    if (!orderId) return;

    this.setState({ reasonsLoading: true });
    fetch(constants.orderDetails, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + global.token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ order_id: String(orderId) }),
    })
      .then((r) => r.json())
      .then((json) => {
        console.log('Reschedule Order Details API response== ', JSON.stringify(json));
        if (json?.status && json?.order) {
          const reasons = this.normaliseReasons(json?.rescheduled_reasons);
          this.setState((prev) => ({
            details: { ...prev.details, ...json.order },
            reasons: Object.keys(reasons).length ? reasons : prev.reasons,
            reasonsLoading: false,
          }));
        } else {
          this.setState({ reasonsLoading: false });
        }
      })
      .catch((e) => {
        console.log('Reschedule Order Details API error== ', e);
        this.setState({ reasonsLoading: false });
      });
  };

  animateIn = () => {
    // No-op: cards are at their final state to avoid Android elevation-shadow artifacts.
    return;
    this.anims.forEach((a, i) => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(a.o, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.spring(a.y, { toValue: 0, friction: 8, useNativeDriver: true }),
        ]).start();
      }, i * 80);
    });
  };

  a = (i) => ({ opacity: this.anims[Math.min(i,3)].o, transform: [{ translateY: this.anims[Math.min(i,3)].y }] });

  goBack = () => { if (this.props?.navigation?.goBack) this.props.navigation.goBack(); };
  mask = (p) => { if (!p) return ''; const s = String(p); if (s.length < 6) return s; return s.slice(0,2) + '****' + s.slice(-2); };
  toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  formatDate = (d) => {
    if (!d) return '';
    return `${String(d.getDate()).padStart(2,'0')} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()}`;
  };

  DEFAULT_SLOTS = ['Morning (9am-12pm)', 'Afternoon (12pm-3pm)', 'Evening (3pm-6pm)', 'Night (6pm-9pm)'];

  getSlots = () => {
    const slots = this.state.details?.delivery_slot;
    if (Array.isArray(slots) && slots.length) {
      return slots.map((s) => `${s.label} (${s.time})`);
    }
    return this.DEFAULT_SLOTS;
  };

  isOtherReason = () => {
    const { selectedReason, reasons } = this.state;
    if (!selectedReason) return false;
    const label = reasons?.[selectedReason] || selectedReason;
    return String(label).toLowerCase().trim() === 'other';
  };

  canConfirm = () => {
    const { details, dateObj, slot, selectedReason, note, submitting } = this.state;
    if (!details?.id || !dateObj || !slot || !selectedReason || submitting) return false;
    if (this.isOtherReason() && !note.trim()) return false;
    return true;
  };

  callFarmer = () => {
    const { details } = this.state;
    callFarmerExotel({
      orderId: details?.id,
      toPhone: details?.farmer_data?.phone,
      context: 'delivery',
    });
  };
  dial = async (p) => dialDirect(p);

  wa = async (p) => {
    if (!p) return;
    const c = String(p).replace(/[^\d]/g, '');
    const can = await Linking.canOpenURL(`whatsapp://send?phone=${c}`);
    if (can) Linking.openURL(`whatsapp://send?phone=${c}`);
    else Linking.openURL(`https://wa.me/${c}`).catch(() => Alert.alert('WhatsApp', `${p}`));
  };

  orderStatusApi = async () => {
    const { details, dateObj, slot, note, selectedReason, reasons } = this.state;
    if (!this.canConfirm()) return;

    const reasonLabel = reasons?.[selectedReason] || selectedReason || '';
    const reason = this.isOtherReason() ? (note.trim() || reasonLabel) : reasonLabel;
    this.setState({ submitting: true });

    const { lat, long } = await resolveCoordsForStatusUpdate(this._verifyCoords);
    const body = {
      status: 'reschedule', order_id: String(details.id), type: '', reason,
      date: moment(dateObj).format('YYYY-MM-DD'), slot: String(slot),
      lat,
      long,
    };
    if (note) body.note = String(note);
    console.log('Reschedule API payload== ', body);

    fetch(constants.updateStatus, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + global.token, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      })
        .then(r => r.json())
        .then(j => {
          console.log('Reschedule API response== ', j);
          this.setState({ submitting: false });
          Toast.show(j?.message || 'Updated', Toast.SHORT);
          if (j?.status) {
            invalidateOrderRelated();
            this.goBack();
          }
        })
        .catch(e => { this.setState({ submitting: false }); });
  };

  getStatusColors = (statusRaw) => {
    const st = getStatus(statusRaw);
    return { bg: st.tint, text: st.accent };
  };

  renderReasons = () => {
    const { reasons, reasonsLoading, selectedReason } = this.state;
    const keys = Object.keys(reasons || {});
    if (reasonsLoading && !keys.length) {
      return <ActivityIndicator style={{ marginVertical: 12 }} size="small" color={P} />;
    }
    if (!keys.length) {
      return (
        <Text style={{ textAlign: 'center', marginVertical: 12, color: '#94A3B8', fontWeight: '500' }}>
          No reschedule reasons available
        </Text>
      );
    }
    return keys.map((k) => {
      const label = reasons[k];
      const selected = selectedReason === k;
      return (
        <TouchableOpacity
          key={k}
          activeOpacity={0.8}
          onPress={() => this.setState({ selectedReason: k })}
          style={[$.reasonRow, selected && $.reasonRowActive]}
        >
          <View style={[$.radioOuter, selected && $.radioOuterActive]}>
            {selected ? <View style={$.radioInner} /> : null}
          </View>
          <Text style={[$.reasonText, selected && $.reasonTextActive]}>{label}</Text>
        </TouchableOpacity>
      );
    });
  };

  render() {
    const { details, dateObj, slot, note, submitting, showDateModal, showSlotPicker } = this.state;
    const slots = this.getSlots();
    const noteOptional = !this.isOtherReason();
    const rawCode = details?.order_code || '';
    const orderId = rawCode.includes(' ') ? rawCode.split(' ')[0] : rawCode;
    const farmerName = details?.farmer_data?.name || '';
    const farmerPhone = details?.farmer_data?.phone || '';
    const farmerAddr = details?.farmer_data?.address || '';
    const farmerFull = details?.farmer_address || {};
    const total = this.toNum(details?.grand_total);
    const orderDate = details?.order_date || '';
    const paymentMode = details?.payment_mode || '';
    const paymentStatus = details?.payment_status || '';
    const codAmount = this.toNum(details?.cod_amount);
    const items = Array.isArray(details?.order_items) ? details.order_items : [];
    const totalItems = this.toNum(details?.total_items) || items.length;
    const sc = this.getStatusColors(details?.order_status);

    return (
      <View style={$.root}>
        <StatusBar barStyle="light-content" backgroundColor={P} />

        <ScreenHeader bg={P} title="Re-schedule Delivery" onBack={this.goBack} />

        <ScrollView contentContainerStyle={$.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {!details ? (
            <View style={$.emptyBox}><Text style={$.emptyT}>Order data not found</Text></View>
          ) : (
            <>
              {/* Reschedule reason */}
              <Animated.View style={this.a(0)}>
                <Text style={$.secTitle}>Select Reason</Text>
                <View style={$.reasonBox}>{this.renderReasons()}</View>
              </Animated.View>

              {/* Date & Time */}
              <Animated.View style={this.a(1)}>
                <Text style={$.secTitle}>Select New Date & Time</Text>

                <TouchableOpacity style={[$.selectRow, dateObj && $.selectRowActive]} activeOpacity={0.8} onPress={() => this.setState({ showDateModal: true })}>
                  <Image source={require('./assets/clock.png')} style={[$.selectIco, dateObj && { tintColor: '#16A34A' }]} />
                  <Text style={[$.selectText, dateObj && { color: '#1E293B', fontWeight: '600' }]}>{dateObj ? this.formatDate(dateObj) : 'Select date'}</Text>
                  <Image source={require('./assets/down.png')} style={$.selectChev} />
                </TouchableOpacity>

                <TouchableOpacity style={[$.selectRow, slot && $.selectRowActive]} activeOpacity={0.8} onPress={() => this.setState(p => ({ showSlotPicker: !p.showSlotPicker }))}>
                  <Image source={require('./assets/clock.png')} style={[$.selectIco, slot && { tintColor: '#16A34A' }]} />
                  <Text style={[$.selectText, slot && { color: '#1E293B', fontWeight: '600' }]}>{slot || 'Select time slot'}</Text>
                  <Image source={require('./assets/down.png')} style={[$.selectChev, showSlotPicker && { transform: [{ rotate: '180deg' }] }]} />
                </TouchableOpacity>

                {showSlotPicker ? (
                  <View style={$.slotBox}>
                    {slots.map((s, i) => (
                      <TouchableOpacity key={i} style={[$.slotRow, i !== 0 && $.slotSep, slot === s && $.slotActive]} activeOpacity={0.8} onPress={() => this.setState({ slot: s, showSlotPicker: false })}>
                        <Text style={[$.slotText, slot === s && { color: P, fontWeight: '600' }]}>{s}</Text>
                        {slot === s ? <Text style={$.slotCheck}>✓</Text> : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </Animated.View>

              {/* Note */}
              <Animated.View style={this.a(2)}>
                <Text style={$.secTitle}>
                  Note{' '}
                  <Text style={{ fontWeight: '400', color: '#94A3B8' }}>
                    ({noteOptional ? 'Optional' : 'Required for Other'})
                  </Text>
                </Text>
                <View style={$.noteBox}>
                  <TextInput value={note} onChangeText={t => this.setState({ note: t })} style={$.noteInput}
                    multiline placeholder="Add a note..." placeholderTextColor="#94A3B8" />
                </View>
              </Animated.View>

              {/* Order Card — same as DeliveryDetails */}
              <Animated.View style={[$.card, this.a(3)]}>
                {/* Order ID + Status */}
                <View style={$.ddHero}>
                  <View style={{ flex: 1 }}>
                    <Text style={$.heroOid}>#{orderId}</Text>
                    <Text style={$.ddDate}>{details?.order_date || ''}</Text>
                  </View>
                  <View style={[$.ddChip, { backgroundColor: sc.bg }]}><Text style={[$.ddChipT, { color: sc.text }]}>{String(details?.order_status || '').toUpperCase()}</Text></View>
                </View>

                {/* Farmer */}
                <View style={$.personRow}>
                  <Image source={require('./assets/farmer.png')} style={$.personAvt} />
                  <View style={{ flex: 1 }}>
                    <Text style={$.personName}>{farmerName || '-'}</Text>
                    <Text style={$.personPhone}>{this.mask(farmerPhone)}</Text>
                  </View>
                  <TouchableOpacity onPress={this.callFarmer} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                    <Image source={require('./assets/call.png')} style={$.personIco} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => this.wa(farmerPhone)} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}} style={{ marginLeft: 10 }}>
                    <Image source={require('./assets/whatsapp.png')} style={$.personIco} />
                  </TouchableOpacity>
                </View>

                {/* Payment pills + amount */}
                <View style={$.ddPayRow}>
                  <View style={[$.ddPill, { backgroundColor: '#475569' }]}><Text style={$.ddPillT}>{paymentMode.toUpperCase() || '-'}</Text></View>
                  <View style={[$.ddPill, { backgroundColor: paymentStatus === 'paid' ? '#16A34A' : '#B45309' }]}><Text style={$.ddPillT}>{paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}</Text></View>
                  <View style={{ flex: 1 }} />
                  <Text style={$.orderTotal}>₹{total}</Text>
                </View>
              </Animated.View>

              {/* Route Card */}
              <Animated.View style={[$.card, this.a(4)]}>
                <View style={$.routeWrap}>
                  <View style={$.routeRow}>
                    <View style={$.routeTl}><View style={[$.routeDot, { backgroundColor: '#0DA60D' }]} /><View style={$.routeLine} /></View>
                    <View style={$.routeBody}>
                      <Text style={[$.routeLbl, { color: '#0DA60D' }]}>Pickup</Text>
                      <Text style={$.routeTitle}>{details?.dark_store?.name || '-'}</Text>
                      <Text style={$.routeAddr}>{details?.dark_store?.location || `${details?.dark_store?.city || ''}${details?.dark_store?.pincode ? `, ${details.dark_store.pincode}` : ''}`}</Text>
                    </View>
                  </View>
                  <View style={$.routeRow}>
                    <View style={$.routeTl}><View style={[$.routeDot, { backgroundColor: '#EF4444' }]} /></View>
                    <View style={[$.routeBody, { paddingBottom: 0 }]}>
                      <Text style={[$.routeLbl, { color: '#EF4444' }]}>Drop</Text>
                      <Text style={$.routeAddr}>
                        {farmerFull?.address || farmerAddr}
                        {farmerFull?.city ? `, ${farmerFull.city}` : ''}
                        {farmerFull?.state ? `, ${farmerFull.state}` : ''}
                      </Text>
                    </View>
                  </View>
                </View>
              </Animated.View>

              <DatePicker modal open={showDateModal} date={dateObj || new Date()} mode="date" minimumDate={new Date()}
                onConfirm={d => this.setState({ showDateModal: false, dateObj: d })}
                onCancel={() => this.setState({ showDateModal: false })} />

              <View style={{ height: 20 }} />
            </>
          )}
        </ScrollView>

        {details ? (
          <View style={$.bottomBar}>
            <TouchableOpacity style={[$.confirmBtn, !this.canConfirm() && { opacity: 0.4 }]}
              onPress={this.orderStatusApi} disabled={!this.canConfirm()} activeOpacity={0.85}>
              {submitting ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={$.confirmBtnT}>Confirm Re-schedule</Text>}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  }
}

const $ = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E8ECF4' },

  hdr: { backgroundColor: P, paddingBottom: 4 },
  hdrRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  hdrBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  hdrIco: { width: 17, height: 17, tintColor: '#FFF', resizeMode: 'contain' },
  hdrTitle: { flex: 1, textAlign: 'center', color: '#FFF', fontSize: 15, fontWeight: '600' },

  scroll: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 20 },

  emptyBox: { backgroundColor: '#FFF', borderRadius: 14, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  emptyT: { fontSize: 13, fontWeight: '500', color: '#94A3B8' },

  card: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 8, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },

  orderTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 },
  orderLabel: { fontSize: 10, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 2 },
  ddHero: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, paddingBottom: 8 },
  heroOid: { fontSize: 14, fontWeight: '700', color: P },
  ddDate: { fontSize: 11, fontWeight: '400', color: '#94A3B8', marginTop: 2 },
  ddChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  ddChipT: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  ddPayRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12 },
  ddPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, marginRight: 6 },
  ddPillT: { fontSize: 10, fontWeight: '600', color: '#FFF' },
  orderDate: { fontSize: 12, color: '#6B7280', fontWeight: '500', marginTop: 2 },

  statusPill: { borderRadius: 60, paddingHorizontal: 12, paddingVertical: 5 },
  statusPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  metaDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
  metaRow: { flexDirection: 'row' },
  metaItem: { flex: 1, alignItems: 'center' },
  metaLabel: { fontSize: 11, fontWeight: '500', color: '#9CA3AF', marginBottom: 4 },
  metaValue: { fontSize: 13, fontWeight: '700', color: '#111827' },

  itemsSummaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemsSummaryText: { fontSize: 13, fontWeight: '500', color: '#4B5563' },
  itemsSummaryTotal: { fontSize: 14, fontWeight: '700', color: '#059669' },

  personRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  personAvt: { width: 36, height: 36, borderRadius: 18, resizeMode: 'cover', marginRight: 10 },
  personName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  personPhone: { fontSize: 11, fontWeight: '400', color: '#94A3B8', marginTop: 1 },
  personIco: { width: 26, height: 26, resizeMode: 'contain' },

  routeWrap: { paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  routeTl: { width: 14, alignItems: 'center', marginRight: 8, paddingTop: 3 },
  routeDot: { width: 8, height: 8, borderRadius: 4 },
  routeLine: { width: 1.5, flex: 1, minHeight: 10, backgroundColor: '#D1D5DB', marginVertical: 3 },
  routeBody: { flex: 1, paddingBottom: 10 },
  routeLbl: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3, marginBottom: 3 },
  routeTitle: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  routeAddr: { fontSize: 12, fontWeight: '400', color: '#64748B', lineHeight: 17, marginTop: 1 },

  secTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 10, marginTop: 8 },

  reasonBox: { backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', padding: 8, marginBottom: 8 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 8, borderRadius: 8, marginBottom: 2 },
  reasonRowActive: { backgroundColor: '#F5F3FF' },
  radioOuter: { height: 22, width: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radioOuterActive: { borderColor: P, borderWidth: 2 },
  radioInner: { height: 12, width: 12, borderRadius: 6, backgroundColor: P },
  reasonText: { flex: 1, color: '#475569', fontWeight: '500', fontSize: 14 },
  reasonTextActive: { color: P, fontWeight: '600' },

  selectRow: { height: 46, backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 8 },
  selectRowActive: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  selectIco: { width: 16, height: 16, resizeMode: 'contain', tintColor: '#94A3B8', marginRight: 10 },
  selectText: { flex: 1, fontSize: 13, fontWeight: '500', color: '#94A3B8' },
  selectChev: { width: 12, height: 12, resizeMode: 'contain', tintColor: '#94A3B8' },

  slotBox: { backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 8, overflow: 'hidden' },
  slotRow: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slotSep: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  slotActive: { backgroundColor: '#F5F3FF' },
  slotText: { fontSize: 14, fontWeight: '500', color: '#475569' },
  slotCheck: { fontSize: 16, fontWeight: '800', color: P },

  noteBox: { backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', padding: 10, marginBottom: 8 },
  noteInput: { minHeight: 70, fontSize: 14, fontWeight: '500', color: '#1E293B', textAlignVertical: 'top' },

  orderTotal: { fontSize: 16, fontWeight: '700', color: '#16A34A' },

  bottomBar: { paddingHorizontal: 40, paddingTop: 8, paddingBottom: 10, backgroundColor: '#E8ECF4' },
  confirmBtn: { height: 46, borderRadius: 10, backgroundColor: P, alignItems: 'center', justifyContent: 'center' },
  confirmBtnT: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});

export default withV4Navigation(RescheduleDelivery);
