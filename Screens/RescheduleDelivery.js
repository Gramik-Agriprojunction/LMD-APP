import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import DatePicker from 'react-native-date-picker';
import Toast from 'react-native-simple-toast';
import constants from './constants';
import moment from 'moment';

export default class RescheduleDelivery extends Component {
  constructor(props) {
    super(props);
    this.state = {
      details: null, // ✅ only from navigation param (DeliveryDetails -> this.state.details)
      dateObj: null, // ✅ selected Date object
      slot: '', // ✅ selected slot string
      note: '', // ✅ optional
      showDateModal: false,
      showSlotPicker: false,
      submitting: false,
    };
  }

  // ✅ Comes from DeliveryDetails:
  // navigate('RescheduleDelivery', { order: this.state.details })
  getOrder = () => this.props?.navigation?.getParam('order', null);

  componentDidMount() {
    const o = this.getOrder();
    if (o) this.setState({ details: o });
    else console.log('RescheduleDelivery: navigation param "order" missing');
  }

  goBack = () => {
    const nav = this.props?.navigation;
    if (nav?.goBack) nav.goBack();
  };

  // ------------------- Helpers -------------------
  formatDate = (d) => {
    if (!d) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mon = months[d.getMonth()];
    const yyyy = d.getFullYear();
    return `${dd} ${mon} ${yyyy}`;
  };

  toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  SLOT_OPTIONS = [
    'Morning (9am-12pm)',
    'Afternoon (12pm-3pm)',
    'Evening (3pm-6pm)',
    'Night (6pm-9pm)',
  ];

  canConfirm = () => {
    const { details, dateObj, slot, submitting } = this.state;
    return !!details?.id && !!dateObj && !!slot && !submitting;
  };

  // ------------------- Actions -------------------
  openDatePicker = () => this.setState({ showDateModal: true });

  toggleSlotPicker = () => this.setState((p) => ({ showSlotPicker: !p.showSlotPicker }));

  selectSlot = (slot) => this.setState({ slot, showSlotPicker: false });

  onCall = async () => { 
    const phoneRaw = this.state?.details?.farmer_data?.phone;
    if (!phoneRaw) return console.log('RescheduleDelivery: farmer_data.phone missing');

    const phone = String(phoneRaw).replace(/\s+/g, '');
    const url = `tel:${phone}`;

    try {
      const can = await Linking.canOpenURL(url);
      if (can) return Linking.openURL(url);
      console.log('Cannot open dialer:', url);
    } catch (e) {
      console.log('Call error:', e);
    }
  };

  onWhatsApp = async () => {
    const phoneRaw = this.state?.details?.farmer_data?.phone;
    if (!phoneRaw) return console.log('RescheduleDelivery: farmer_data.phone missing');

    const phone = String(phoneRaw).replace(/[^\d]/g, '');
    if (!phone) return console.log('Invalid phone for WhatsApp:', phoneRaw);

    const url = `whatsapp://send?phone=${phone}`;

    try {
      const can = await Linking.canOpenURL(url);
      if (can) return Linking.openURL(url);

      const waWeb = `https://wa.me/${phone}`;
      const canWeb = await Linking.canOpenURL(waWeb);
      if (canWeb) return Linking.openURL(waWeb);

      console.log('WhatsApp not available');
    } catch (e) {
      console.log('WhatsApp error:', e);
    }
  };

  // ✅ reschedule API via updateStatus
  orderStatusApi = (status) => {
    const { details, dateObj, slot, note } = this.state;

    const orderId = details?.id;
    if (!orderId) return console.log('RescheduleDelivery: details.id missing');
    if (!dateObj || !slot) return console.log('RescheduleDelivery: date/slot missing');

    const formData = new FormData();
    formData.append('status', status); // "reschedule"
    formData.append('order_id', String(orderId));
    formData.append('type', '');
    formData.append('reason', this.state.note || '');
    formData.append('date', moment(dateObj).format('YYYY-MM-DD'));
    formData.append('slot', String(slot));
    if (note) formData.append('note', String(note));

    console.log("update order formData== ",formData)

    this.setState({ submitting: true }, () => {
      fetch(constants.updateStatus, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + global.token,
          Accept: 'application/json',
        },
        body: formData,
      })
        .then((r) => r.json())
        .then((json) => {
            console.log('reschedule api response =>', json);
          this.setState({ submitting: false });
          Toast.show(json?.message || 'Updated', Toast.SHORT);
          if (json?.status) this.goBack();
        })
        .catch((e) => {
          console.log('reschedule api error =>', e);
          this.setState({ submitting: false });
        });
    });
  };

  onConfirm = () => {
    if (!this.canConfirm()) return;
    this.orderStatusApi('reschedule');
  };

  // ------------------- UI -------------------
  render() {
    const { details, dateObj, slot, note, submitting, showDateModal, showSlotPicker } = this.state;

    const orderCode = details?.order_code || '';
    const orderDate = details?.order_date || '';
    const statusText = details?.order_status || '';

    const farmerName = details?.farmer_data?.name || '';
    const farmerPhone = details?.farmer_data?.phone || '';
    const farmerAddress = details?.farmer_data?.address || '';
    const farmerImage = details?.farmer_data?.image || '';

    const total = this.toNum(details?.grand_total);

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#1C8A62" />

        {/* Header (same theme as DeliveryDetails) */}
        <View style={styles.headerWrap}>
          <SafeAreaView style={styles.headerSafe}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={this.goBack} style={styles.headerIconBtn} activeOpacity={0.8}>
                <Image style={styles.backImg} source={require('./assets/back.png')} />
              </TouchableOpacity>

              <Text style={styles.headerTitle} numberOfLines={1}>
                Re-schedule Delivery
              </Text>

              <View style={{ width: 42, height: 42 }} />
            </View>
          </SafeAreaView>
        </View>

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {!details ? (
            <View style={styles.pageBox}>
              <Text style={styles.pageErrorText}>Order data not found</Text>
            </View>
          ) : (
            <>
              {/* Top meta (same style as DeliveryDetails) */}
              <View style={styles.topMeta}>
                <View style={{ flex: 1 }}>
                  {orderCode ? (
                    <Text style={styles.orderIdLine}>
                      ORDER : <Text style={styles.orderIdBold}>{orderCode}</Text>
                    </Text>
                  ) : null}

                  {orderDate ? <Text style={styles.smallMeta}>{orderDate}</Text> : null}
                </View>

                {statusText ? (
                  <View style={[styles.statusPill, { alignSelf: 'center' }]}>
                    <Text style={styles.statusPillText}>{String(statusText).toUpperCase()}</Text>
                  </View>
                ) : null}
              </View>

              {/* Farmer card */}
              <View style={styles.card}>
                <View style={styles.farmerRow}>
                  <View style={styles.avatar}>
                    {farmerImage ? <Image style={styles.avatarImg} source={{ uri: farmerImage }} /> : <View style={styles.avatarFallback} />}
                  </View>

                  <View style={{ flex: 1, paddingRight: 8 }}>
                    {farmerName ? (
                      <Text style={styles.farmerName} numberOfLines={1}>
                        {farmerName}
                      </Text>
                    ) : null}

                    {farmerAddress ? (
                      <View style={styles.addrRow}>
                        <Image style={styles.gpsImg} source={require('./assets/gps.png')} />
                        <Text style={styles.farmerMeta} numberOfLines={2}>
                          {farmerAddress}
                        </Text>
                      </View>
                    ) : null}

                    {farmerPhone ? (
                      <Text style={styles.phoneMeta} numberOfLines={1}>
                        {farmerPhone}
                      </Text>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: 'row' }}>
                    <TouchableOpacity onPress={this.onCall} activeOpacity={0.85}>
                      <Image source={require('./assets/phn.png')} style={styles.callIconImg} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={this.onWhatsApp} activeOpacity={0.85} style={{ marginLeft: 15 }}>
                      <Image source={require('./assets/wht.png')} style={styles.callIconImg} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Info card */}
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Re-schedule this delivery</Text>
                <Text style={styles.infoSub}>Select a new date/time and add an optional note.</Text>
              </View>

              <Text style={styles.sectionTitle}>Select New Delivery Date & Time</Text>

              {/* Date */}
              <TouchableOpacity style={styles.selectRow} activeOpacity={0.85} onPress={this.openDatePicker}>
                <Text style={styles.selectIcon}>📅</Text>
                <Text style={styles.selectText}>{dateObj ? this.formatDate(dateObj) : 'Select date'}</Text>
                <Text style={styles.selectChevron}>⌄</Text>
              </TouchableOpacity>

              {/* Slot */}
              <TouchableOpacity style={[styles.selectRow, styles.selectRowAlt]} activeOpacity={0.85} onPress={this.toggleSlotPicker}>
                <Text style={styles.selectIcon}>🕒</Text>
                <Text style={styles.selectText}>{slot ? slot : 'Select slot'}</Text>
                <Text style={styles.selectChevron}>⌄</Text>
              </TouchableOpacity>

              {/* Slot dropdown */}
              {showSlotPicker ? (
                <View style={styles.slotBox}>
                  {this.SLOT_OPTIONS.map((s, i) => (
                    <TouchableOpacity
                      key={`${s}-${i}`}
                      style={[styles.slotRow, i !== 0 && styles.slotSep]}
                      activeOpacity={0.85}
                      onPress={() => this.selectSlot(s)}
                    >
                      <Text style={styles.slotText}>{s}</Text>
                      {slot === s ? <Text style={styles.slotTick}>✓</Text> : <View style={{ width: 12 }} />}
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              {/* Note */}
              <Text style={styles.noteLabel}>
                Note <Text style={styles.noteOptional}>(Optional)</Text>
              </Text>

              <View style={styles.noteBox}>
                <TextInput
                  value={note}
                  onChangeText={(t) => this.setState({ note: t })}
                  style={styles.noteInput}
                  multiline
                  placeholder="Write note..."
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Footer */}
              <View style={styles.footerBox}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Grand Total</Text>
                  <Text style={styles.codValue}>{`₹ ${total}`}</Text>
                </View>

                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity style={[styles.primaryBtn, { flex: 1, marginRight: 5 }]} onPress={this.onCall} activeOpacity={0.9}>
                    <Text style={styles.primaryText}>CALL</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.confirmBtn,
                      { flex: 1, marginLeft: 5 },
                      (!this.canConfirm()) && styles.confirmBtnDisabled,
                    ]}
                    onPress={this.onConfirm}
                    activeOpacity={0.9}
                    disabled={!this.canConfirm()}
                  >
                    {!submitting ? <Text style={styles.confirmText}>CONFIRM</Text> : <ActivityIndicator size="small" color="#FFF" />}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Date Picker Modal */}
              <DatePicker
                modal
                open={showDateModal}
                date={dateObj || new Date()}
                mode="date"
                minimumDate={new Date()}
                onConfirm={(d) => this.setState({ showDateModal: false, dateObj: d })}
                onCancel={() => this.setState({ showDateModal: false })}
              />

              <View style={{ height: 14 }} />
            </>
          )}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F5F7' },

  headerWrap: { backgroundColor: '#1C8A62' },
  headerSafe: { backgroundColor: '#1C8A62' },
  headerRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  backImg: { width: 25, height: 25, resizeMode: 'contain', tintColor: '#FFF' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 15, fontWeight: '800' },

  container: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16 },

  pageBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageErrorText: { fontSize: 12, fontWeight: '800', color: '#6B7280' },

  topMeta: { marginBottom: 10, flexDirection: 'row' },
  statusPill: { backgroundColor: '#F37A20', borderRadius: 60, paddingHorizontal: 18, paddingVertical: 5 },
  statusPillText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3, color: '#FFF' },
  orderIdLine: { marginTop: 8, fontSize: 11, fontWeight: '800', color: '#111827' },
  orderIdBold: { fontSize: 11, fontWeight: '800', color: '#F68A20', letterSpacing: 0.3 },
  smallMeta: { fontSize: 15, color: '#111827', marginTop: 7, fontWeight: '700' },

  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E6EAF0', padding: 12, marginBottom: 12, marginTop: 10 },

  farmerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 10, overflow: 'hidden', backgroundColor: '#F3F4F6' },
  avatarImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarFallback: { flex: 1, backgroundColor: '#F3F4F6' },

  farmerName: { fontSize: 12, fontWeight: '700', color: '#111827' },
  addrRow: { flexDirection: 'row', marginTop: 7 },
  gpsImg: { height: 20, width: 20, resizeMode: 'contain', alignSelf: 'center' },
  farmerMeta: { fontSize: 12, color: '#4B5563', marginLeft: 3, alignSelf: 'center', flex: 1 },
  phoneMeta: { marginTop: 7, fontSize: 12, color: '#111827' },

  callIconImg: { width: 30, height: 30, resizeMode: 'contain' },

  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    padding: 12,
    marginBottom: 15,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#000' },
  infoSub: { marginTop: 5, fontSize: 13,  color: '#6B7280' },

  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#111827', marginBottom: 10 },

  selectRow: {
    height: 52,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  selectRowAlt: { backgroundColor: '#FFF7E6', borderColor: '#F3E1B8' },
  selectIcon: { fontSize: 16, marginRight: 10 },
  selectText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#111827' },
  selectChevron: { fontSize: 22, color: '#6B7280' },

  slotBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    marginBottom: 10,
    overflow: 'hidden',
  },
  slotRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotSep: { borderTopWidth: 1, borderTopColor: '#EEF2F6' },
  slotText: { fontSize: 13, fontWeight: '700', color: '#111827' },
  slotTick: { fontSize: 14, fontWeight: '900', color: '#1C8A62' },

  noteLabel: { marginTop: 6, fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8 },
  noteOptional: { color: '#6B7280', fontWeight: '500',fontSize:13 },
  noteBox: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E6EAF0', padding: 10 },
  noteInput: { minHeight: 44, fontSize: 14, fontWeight: '500', color: '#111827' },

  footerBox: {
    marginTop: 12,
    padding: 15,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFF',
    width: '100%',
    alignSelf: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12 },
  totalLabel: { fontSize: 15, fontWeight: '800', color: '#36454F' },
  codValue: { fontSize: 20, fontWeight: '800', color: '#F37A20' },

  primaryBtn: {
    height: 45,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C8A62',
  },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },

  confirmBtn: {
    height: 45,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6495ED',
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmText: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
});