import React, { Component } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import constants from '../utils/constants';
import QrPayModal from './QrPayModal';

const PURPLE = '#5D3FD3';

export const isOrderAlreadyPaid = (order) => {
  const ps = String(order?.payment_status || '').toLowerCase();
  const pm = String(order?.payment_mode || '').toLowerCase();
  return ps === 'paid' && pm && pm !== 'cod' && pm !== 'cash';
};

export const getOrderTotal = (order) => {
  const n = Number(order?.grand_total ?? order?.amount ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export default class CollectPaymentCard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      qr: '',
      qrLoading: false,
      qrFailed: false,
      qrModalVisible: false,
    };
  }

  loadQr = () => {
    const id = this.props.order?.id;
    if (!id || isOrderAlreadyPaid(this.props.order)) return;
    if (this.state.qrLoading) return;

    this.setState({ qrLoading: true, qrFailed: false });
    fetch(`${constants.getQR}${id}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + global.token, Accept: 'application/json' },
    })
      .then((r) => r.json())
      .then((json) => {
        const qrUrl = json?.qr_image_url || json?.data?.qr_image_url || '';
        this.setState({ qrLoading: false, qr: qrUrl, qrFailed: !qrUrl });
      })
      .catch(() => {
        this.setState({ qrLoading: false, qr: '', qrFailed: true });
      });
  };

  onCollectCash = () => {
    this.props.onChange?.('cash');
  };

  onScanQR = () => {
    this.props.onChange?.('upi');
    this.loadQr();
    this.setState({ qrModalVisible: true });
  };

  openQrModal = () => {
    if (!this.state.qr && !this.state.qrLoading) this.loadQr();
    this.setState({ qrModalVisible: true });
  };

  closeQrModal = () => {
    this.setState({ qrModalVisible: false });
  };

  render() {
    const { order, paymentType = 'cash', variant = 'light' } = this.props;
    if (!order || isOrderAlreadyPaid(order)) return null;

    const dark = variant === 'dark';
    const total = getOrderTotal(order);
    const activeCash = paymentType === 'cash';
    const activeUpi = paymentType === 'upi' || paymentType === 'qr';
    const { qr, qrLoading, qrFailed, qrModalVisible } = this.state;

    return (
      <View style={[st.wrap, dark && st.wrapDark]}>
        <View style={[st.head, dark && st.headDark]}>
          <Image source={require('../screens/assets/crn.png')} style={st.headIco} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={[st.title, dark && st.titleDark]}>
              Collect Payment <Text style={[st.amt, dark && st.amtDark]}>₹{total}</Text>
            </Text>
          </View>
        </View>

        <View style={st.body}>
          <TouchableOpacity
            onPress={this.onCollectCash}
            activeOpacity={0.85}
            style={[st.payCard, dark && st.payCardDark, activeCash && (dark ? st.payCardActiveDark : st.payCardActive)]}
          >
            <View style={[st.radio, dark && st.radioDark, activeCash && (dark ? st.radioOnDark : st.radioOn)]}>
              {activeCash ? <View style={[st.radioDot, dark && st.radioDotDark]} /> : null}
            </View>
            <Image style={st.payIco} source={require('../screens/assets/crn.png')} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[st.payTitle, dark && st.payTitleDark, activeCash && { color: dark ? '#FCD34D' : '#16A34A' }]}>Collect Cash</Text>
              <Text style={[st.paySub, dark && st.paySubDark]}>Collect amount from farmer</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={this.onScanQR}
            activeOpacity={0.85}
            style={[st.payCard, dark && st.payCardDark, { marginBottom: 0 }, activeUpi && (dark ? st.payCardActiveDarkQr : st.payCardActive)]}
          >
            <View style={[st.radio, dark && st.radioDark, activeUpi && st.radioOn]}>
              {activeUpi ? <View style={st.radioDot} /> : null}
            </View>
            <View style={[st.qrBadge, dark && st.qrBadgeDark]}>
              <Text style={[st.qrBadgeT, dark && { color: '#FCD34D' }]}>QR</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[st.payTitle, dark && st.payTitleDark, activeUpi && { color: dark ? '#FFF' : PURPLE }]}>Scan QR Code</Text>
              <Text style={[st.paySub, dark && st.paySubDark]}>Pay via UPI / QR scan</Text>
            </View>
            {activeUpi && qr ? (
              <TouchableOpacity onPress={this.openQrModal} activeOpacity={0.85} style={st.thumbWrap}>
                <Image source={{ uri: qr }} style={st.thumb} resizeMode="contain" />
              </TouchableOpacity>
            ) : activeUpi ? (
              <View style={st.thumbWrap}>
                {qrLoading ? <ActivityIndicator size="small" color={dark ? '#FCD34D' : PURPLE} /> : <Text style={st.na}>N/A</Text>}
              </View>
            ) : null}
          </TouchableOpacity>
        </View>

        <QrPayModal
          visible={qrModalVisible}
          qr={qr}
          loading={qrLoading}
          failed={qrFailed}
          total={total}
          onClose={this.closeQrModal}
          onRetry={this.loadQr}
        />
      </View>
    );
  }
}

const st = StyleSheet.create({
  wrap: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
  wrapDark: { backgroundColor: 'rgba(0,0,0,0.18)', borderColor: 'rgba(255,255,255,0.18)', marginBottom: 0 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headDark: { backgroundColor: 'rgba(255,255,255,0.07)', borderBottomColor: 'rgba(255,255,255,0.12)' },
  headIco: { width: 22, height: 22, marginRight: 10 },
  title: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  titleDark: { color: '#FFF' },
  amt: { color: '#16A34A', fontSize: 16, fontWeight: '800' },
  amtDark: { color: '#86EFAC' },
  body: { padding: 12 },
  payCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 8 },
  payCardDark: { backgroundColor: 'rgba(0,0,0,0.12)', borderColor: 'rgba(255,255,255,0.14)' },
  payCardActive: { backgroundColor: '#FAFBFF', borderColor: PURPLE },
  payCardActiveDark: { backgroundColor: 'rgba(252,211,77,0.1)', borderColor: '#FCD34D' },
  payCardActiveDarkQr: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.35)' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  radioDark: { borderColor: 'rgba(255,255,255,0.35)' },
  radioOn: { borderColor: PURPLE },
  radioOnDark: { borderColor: '#FCD34D' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PURPLE },
  radioDotDark: { backgroundColor: '#FCD34D' },
  payIco: { width: 30, height: 30, resizeMode: 'contain' },
  payTitle: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  payTitleDark: { color: '#FFF' },
  paySub: { fontSize: 11, fontWeight: '400', color: '#94A3B8', marginTop: 2 },
  paySubDark: { color: 'rgba(255,255,255,0.55)' },
  qrBadge: { width: 30, height: 30, borderRadius: 6, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  qrBadgeDark: { backgroundColor: 'rgba(255,255,255,0.12)' },
  qrBadgeT: { fontSize: 11, fontWeight: '800', color: PURPLE },
  thumbWrap: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumb: { width: 38, height: 38 },
  na: { fontSize: 9, fontWeight: '600', color: '#94A3B8' },
});
