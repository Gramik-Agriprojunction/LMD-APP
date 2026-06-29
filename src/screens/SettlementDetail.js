import React, { Component } from 'react';
import {
  View, Text, StyleSheet, ScrollView, StatusBar, Image,
  ActivityIndicator, TouchableOpacity, Linking, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeBottomEdges } from '../utils/safeAreaInsets';
import constants from '../utils/constants';
import Toast from 'react-native-simple-toast';
import { withV4Navigation } from '../utils/v4Compat';
import ScreenHeader from '../components/ScreenHeader';
import ProofImageViewer from '../components/ProofImageViewer';
import OrderCard from '../components/OrderCard';
import { callFarmerExotel, dialDirect } from '../utils/exotelCall';
import { S } from '../utils/soilTheme';

const P = S.P;
const SCREEN_BG = '#edf1f7';

const hasVal = (v) => v !== undefined && v !== null && String(v).trim() !== '';

const fmtProofDate = (raw) => {
  if (!hasVal(raw)) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw).trim();
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const titleCase = (s) => {
  const t = String(s || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
};

const parseDetail = (json) => {
  const root = json?.data;
  if (!root || typeof root !== 'object') return null;
  if (root.settlement_data != null || Array.isArray(root.order_data)) {
    return {
      settlementData: root.settlement_data && typeof root.settlement_data === 'object' ? root.settlement_data : null,
      orderData: Array.isArray(root.order_data) ? root.order_data : [],
    };
  }
  if (Array.isArray(root) && root.length) return { legacy: root[0] };
  return { legacy: root };
};

const orderStatusMeta = (raw) => {
  const s = String(raw || '').toLowerCase();
  if (s === 'delivered' || s === 'settled' || s === 'success' || s === 'completed') {
    return { label: titleCase(s), text: S.GREEN_DARK, bg: S.GREEN_BG, bar: S.GREEN_DARK };
  }
  if (s === 'disputed' || s === 'dispute' || s === 'rejected' || s === 'cancelled') {
    return { label: titleCase(s), text: S.RED, bg: S.RED_BG, bar: S.RED };
  }
  if (s === 'pending') {
    return { label: 'Pending', text: S.ORANGE, bg: S.ORANGE_BG, bar: S.ORANGE };
  }
  if (!s) return { label: '—', text: S.SUB, bg: S.BG, bar: S.MUTED };
  return { label: titleCase(s), text: S.SUB, bg: S.BG, bar: S.MUTED };
};

const mapDarkStore = (ds) => {
  if (!ds || typeof ds !== 'object') {
    return { pickupName: '', pickupMobile: '', pickupLocation: '', pickupCity: '', pickupPincode: '' };
  }
  return {
    pickupName: hasVal(ds.name) ? String(ds.name).trim() : '',
    pickupMobile: hasVal(ds.mobile) ? String(ds.mobile).trim() : '',
    pickupCity: hasVal(ds.city) ? String(ds.city).trim() : '',
    pickupPincode: hasVal(ds.pincode) ? String(ds.pincode).trim() : '',
    pickupLocation: hasVal(ds.location)
      ? String(ds.location).trim()
      : [ds.city, ds.pincode].filter(hasVal).join(', '),
  };
};

const mapOrderRow = (o) => {
  if (!o || typeof o !== 'object') return null;
  const ds = mapDarkStore(o.dark_store);
  const farmer = o.farmer && typeof o.farmer === 'object' ? o.farmer : null;
  return {
    id: o.id,
    orderCode: hasVal(o.order_code) ? String(o.order_code).trim() : hasVal(o.order_id) ? String(o.order_id).trim() : '',
    orderId: o.order_id ?? o.id,
    amount: o.amount ?? o.order_amount,
    paymentMode: hasVal(o.payment_mode) ? String(o.payment_mode).trim() : '',
    paymentStatus: hasVal(o.payment_status) ? String(o.payment_status).trim() : '',
    orderStatus: hasVal(o.status) ? String(o.status).trim() : hasVal(o.order_status) ? String(o.order_status).trim() : '',
    priority: hasVal(o.priority) ? String(o.priority).trim() : '',
    farmerName: hasVal(o.farmer_name) ? String(o.farmer_name).trim() : farmer?.name ? String(farmer.name).trim() : '',
    farmerPhone: hasVal(o.farmer_mobile) ? String(o.farmer_mobile).trim() : farmer?.phone ? String(farmer.phone).trim() : '',
    farmerImage: farmer?.image ? String(farmer.image).trim() : '',
    dropAddress: hasVal(o.shipping_address) ? String(o.shipping_address).trim() : '',
    dark_store: o.dark_store,
    ...ds,
    orderItems: Array.isArray(o.order_items) ? o.order_items : [],
    deliveryProof: Array.isArray(o.delivery_proof) ? o.delivery_proof.filter((p) => hasVal(p?.image)) : [],
    slot: hasVal(o.slot) ? String(o.slot).trim() : '',
    orderDate: hasVal(o.order_date) ? String(o.order_date).trim() : '',
    deliveredAt: hasVal(o.delivered_at) ? String(o.delivered_at).trim() : hasVal(o.delivery_date) ? String(o.delivery_date).trim() : '',
    settlementSubmitted: hasVal(o.settlement_submitted) ? String(o.settlement_submitted).trim() : '',
    settlementApproveReject: hasVal(o.settlement_approve_reject) ? String(o.settlement_approve_reject).trim() : '',
    settlementStatus: hasVal(o.settlement_status) ? String(o.settlement_status).trim() : '',
    penaltyText: hasVal(o.penalty_text) ? String(o.penalty_text).trim() : '',
    receipt: o.settlement?.reciept || o.settlement?.receipt || o.receipt || '',
    settlementRef: o.settlement?.settlement_id ? String(o.settlement.settlement_id).trim() : '',
    settlementType: o.settlement?.type ? String(o.settlement.type).trim().toUpperCase() : '',
    settlementComment: o.settlement?.comment ? String(o.settlement.comment).trim() : '',
    settlementAmount: o.settlement_amount ?? o.settlement?.amount,
    collectedAmount: o.collected_amount,
    depositAmount: o.deposite_amount ?? o.deposit_amount,
    utrNumber: hasVal(o.utr_number) ? String(o.utr_number).trim() : '',
    transactionId: hasVal(o.transaction_id) ? String(o.transaction_id).trim() : '',
  };
};

const resolveLegacy = (d) => {
  const farmer = d.farmer && typeof d.farmer === 'object' ? d.farmer : null;
  const settlement = d.settlement && typeof d.settlement === 'object' ? d.settlement : null;
  const ds = mapDarkStore(d.dark_store);
  const row = mapOrderRow({
    ...d,
    farmer_name: d.farmer_name || farmer?.name,
    farmer_mobile: d.farmer_mobile || farmer?.phone,
    order_code: d.order_code,
    order_id: d.order_id,
    status: d.order_status || d.status,
    amount: d.order_amount ?? d.amount ?? d.settlement_amount,
    settlement,
  });
  if (!row) return null;
  return {
    ...row,
    settlementRef: settlement?.settlement_id ? String(settlement.settlement_id).trim() : row.settlementRef,
    approvalDate: settlement?.approval_date != null ? String(settlement.approval_date).trim() : '',
    disputedDate: settlement?.disputed_date != null ? String(settlement.disputed_date).trim() : '',
    settlementComment: settlement?.comment != null ? String(settlement.comment).trim() : '',
    selectedBank: settlement?.selected_bank && typeof settlement.selected_bank === 'object'
      ? settlement.selected_bank
      : null,
    ledgerStatus: hasVal(d.status) ? String(d.status).trim() : '',
    orderType: hasVal(d.type) ? String(d.type).trim() : '',
    orders: [row],
    totalAmount: row.amount,
    orderCount: 1,
  };
};

const resolveDetail = (parsed) => {
  if (!parsed) return null;

  if (parsed.legacy) {
    return resolveLegacy(parsed.legacy);
  }

  const s = parsed.settlementData || {};
  const orders = (parsed.orderData || []).map(mapOrderRow).filter(Boolean);
  const base = mapOrderRow({
    ...s,
    order_code: s.order_code,
    order_id: s.order_id,
    status: s.status,
    amount: s.amount,
  }) || {};

  const primary = orders[0] || base;
  const ds = mapDarkStore(s.dark_store || primary.dark_store);

  const amounts = orders.map((o) => Number(o.amount)).filter((n) => Number.isFinite(n));
  const totalAmount = amounts.length
    ? amounts.reduce((a, b) => a + b, 0)
    : (Number(s.amount) || Number(primary.amount) || 0);

  const allItems = orders.reduce((acc, o) => acc.concat(o.orderItems || []), []);
  const allProof = orders.reduce((acc, o) => acc.concat(o.deliveryProof || []), []);

  return {
    ledgerId: s.id,
    settlementRef: hasVal(s.settlement_id) ? String(s.settlement_id).trim() : (s.id != null ? `Ledger #${s.id}` : ''),
    orderCode: hasVal(s.order_code) ? String(s.order_code).trim() : primary.orderCode,
    orderId: s.order_id ?? primary.orderId,
    amount: s.amount ?? primary.amount,
    totalAmount,
    orderCount: orders.length || 1,
    paymentMode: s.payment_mode || primary.paymentMode,
    paymentStatus: s.payment_status || primary.paymentStatus,
    orderStatus: s.status || primary.orderStatus,
    settlementStatus: hasVal(s.settlement_status) ? String(s.settlement_status).trim() : primary.settlementStatus,
    priority: s.priority || primary.priority,
    farmerName: s.farmer_name || primary.farmerName,
    farmerPhone: s.farmer_mobile || primary.farmerPhone,
    farmerImage: primary.farmerImage,
    dropAddress: s.shipping_address || primary.dropAddress,
    pickupName: ds.pickupName || primary.pickupName,
    pickupMobile: ds.pickupMobile || primary.pickupMobile,
    pickupCity: ds.pickupCity || primary.pickupCity || '',
    pickupPincode: ds.pickupPincode || primary.pickupPincode || '',
    pickupLocation: ds.pickupLocation || primary.pickupLocation,
    orders: orders.length ? orders : [primary],
    orderItems: allItems.length ? allItems : primary.orderItems,
    deliveryProof: allProof.length ? allProof : primary.deliveryProof,
    slot: primary.slot,
    orderDate: primary.orderDate,
    deliveredAt: primary.deliveredAt,
    settlementSubmitted: primary.settlementSubmitted,
    approvalDate: s.approval_date != null ? String(s.approval_date).trim() : '',
    penaltyText: primary.penaltyText,
    receipt: hasVal(s.receipt) ? String(s.receipt).trim() : primary.receipt,
    settlementType: primary.settlementType,
    settlementComment: s.comment != null ? String(s.comment).trim() : '',
    settlementAmount: s.amount ?? primary.settlementAmount,
    collectedAmount: primary.collectedAmount,
    depositAmount: primary.depositAmount,
    utrNumber: primary.utrNumber,
    transactionId: primary.transactionId,
    disputedDate: s.disputed_date != null ? String(s.disputed_date).trim() : '',
    selectedBank: s.selected_bank && typeof s.selected_bank === 'object' ? s.selected_bank : null,
    ledgerStatus: '',
    orderType: '',
  };
};

const buildBankRows = (selectedBank) => {
  const b = selectedBank && typeof selectedBank === 'object' ? selectedBank : null;
  return [
    { label: 'Bank name', value: (b && (b.bank_name || b.name)) || '' },
    { label: 'Account no.', value: (b && b.account_no) || '' },
    { label: 'IFSC', value: (b && b.ifsc_code) || '' },
    { label: 'Address', value: (b && b.address) || '' },
  ];
};

function Card({ children, bar, style }) {
  return (
    <View style={[st.card, bar ? { borderLeftColor: bar } : null, style]}>
      {children}
    </View>
  );
}

function InfoRow({ label, value, last, always, emptyText }) {
  if (!always && !hasVal(value)) return null;
  const display = hasVal(value) ? String(value).trim() : (emptyText || '—');
  const empty = !hasVal(value);
  return (
    <View style={[st.row, !last && st.rowBorder]}>
      <Text style={st.rowLbl}>{label}</Text>
      <Text style={[st.rowVal, empty && st.rowValEmpty]} numberOfLines={4}>{display}</Text>
    </View>
  );
}

class SettlementDetail extends Component {
  state = { loading: true, refreshing: false, detail: null, imagePreview: null, previewTitle: '' };

  componentDidMount() {
    this.fetchDetail();
  }

  settlementId = () => {
    const id = this.props?.navigation?.getParam('settlementId');
    return id != null && String(id).trim() ? String(id).trim() : '';
  };

  fetchDetail = (fromRefresh = false) => {
    const id = this.settlementId();
    if (!id) {
      Toast.show('Settlement ID nahi mila', Toast.SHORT);
      this.setState({ loading: false, refreshing: false });
      return;
    }
    if (!fromRefresh) this.setState({ loading: true });

    fetch(`${constants.settleDetail}${id}`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + global.token,
        Accept: 'application/json',
        'X-localization': 'en',
      },
    })
      .then((r) => r.json())
      .then((json) => {
        const api = parseDetail(json);
        if (api) this.setState({ loading: false, refreshing: false, detail: api });
        else {
          Toast.show(json?.message || 'Detail nahi mila', Toast.SHORT);
          this.setState({ loading: false, refreshing: false, detail: null });
        }
      })
      .catch(() => {
        Toast.show('Detail load nahi ho paya', Toast.SHORT);
        this.setState({ loading: false, refreshing: false });
      });
  };

  onRefresh = () => this.setState({ refreshing: true }, () => this.fetchDetail(true));
  goBack = () => this.props?.navigation?.goBack?.();

  openImagePreview = (uri, title) => {
    if (!hasVal(uri)) return;
    this.setState({ imagePreview: uri, previewTitle: title || '' });
  };

  closeImagePreview = () => this.setState({ imagePreview: null, previewTitle: '' });

  money = (v) => {
    if (!hasVal(v)) return '';
    const s = String(v);
    return s.endsWith('.00') ? s.replace('.00', '') : s;
  };

  fmtAmt = (v) => (hasVal(v) ? `₹${this.money(v)}` : '');

  callFarmer = (phone, orderId) => callFarmerExotel({ orderId, toPhone: phone, context: 'delivery' });
  dial = (phone) => dialDirect(phone);

  whatsapp = (phone) => {
    if (!hasVal(phone)) return;
    Linking.openURL(`https://wa.me/91${String(phone).replace(/[^\d]/g, '')}`).catch(() => {});
  };

  toOrderCardData = (order) => ({
    order_id: order.orderId ?? order.id,
    order_code: order.orderCode,
    farmer_name: order.farmerName,
    farmer_mobile: order.farmerPhone,
    shipping_address: order.dropAddress,
    dark_store: order.dark_store || {
      name: order.pickupName,
      mobile: order.pickupMobile,
      location: order.pickupLocation,
    },
    amount: order.amount,
    payment_mode: order.paymentMode,
    payment_status: order.paymentStatus,
    status: order.orderStatus,
    priority: order.priority,
  });

  openOrder = (order) => {
    const raw = this.toOrderCardData(order);
    if (raw?.order_id || raw?.order_code) {
      this.props?.navigation?.navigate('DeliveryDetails', { order: raw });
    }
  };

  renderProductItem = (item, idx, total) => {
    const img = item?.image ? String(item.image).trim() : '';
    const sub = [
      hasVal(item?.variation) ? String(item.variation).trim() : '',
      item?.quantity != null ? `Qty ${item.quantity}` : '',
    ].filter(Boolean).join(' · ');
    return (
      <View key={`${item?.product_id ?? idx}`} style={[st.prodRow, idx < total - 1 && st.prodBorder]}>
        {!!img ? (
          <Image source={{ uri: img }} style={st.prodImg} resizeMode="cover" />
        ) : (
          <View style={[st.prodImg, st.prodImgPh]}>
            <Image source={require('./assets/organic.png')} style={st.prodImgIco} resizeMode="contain" />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          {hasVal(item?.product_name) && (
            <Text style={st.prodName} numberOfLines={2}>{item.product_name}</Text>
          )}
          {!!sub && <Text style={st.prodSub} numberOfLines={2}>{sub}</Text>}
        </View>
        {hasVal(item?.total_price) && <Text style={st.prodAmt}>{this.fmtAmt(item.total_price)}</Text>}
      </View>
    );
  };

  render() {
    const { loading, refreshing, detail, imagePreview, previewTitle } = this.state;
    const r = resolveDetail(detail);

    if (loading || !r) {
      return (
        <View style={st.root}>
          <StatusBar barStyle="light-content" backgroundColor={P} />
          <ScreenHeader bg={P} title="Settlement Detail" onBack={this.goBack} />
          <View style={st.loader}><ActivityIndicator color={P} size="small" /></View>
        </View>
      );
    }

    const orderMeta = orderStatusMeta(r.orderStatus);
    const settleMeta = orderStatusMeta(r.settlementStatus);
    const displayAmount = r.totalAmount || r.amount;
    const NA = '- Not Available';
    const bankRows = buildBankRows(r.selectedBank);
    const extraSettlementRows = [
      r.settlementSubmitted && { label: 'Submitted', value: r.settlementSubmitted },
      r.settlementType && { label: 'Type', value: r.settlementType },
      r.utrNumber && { label: 'UTR', value: r.utrNumber },
      r.transactionId && { label: 'Transaction ID', value: r.transactionId },
    ].filter(Boolean);

    return (
      <View style={st.root}>
        <StatusBar barStyle="light-content" backgroundColor={P} />
        <ScreenHeader
          bg={P}
          title={r.orderCode || 'Settlement Detail'}
          kicker={r.settlementRef || undefined}
          onBack={this.goBack}
        />

        <SafeAreaView edges={safeBottomEdges()} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={st.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={(
              <RefreshControl
                refreshing={refreshing}
                onRefresh={this.onRefresh}
                colors={[P]}
                tintColor={P}
                title="Refresh karein"
                titleColor={S.SUB}
              />
            )}
          >
            {/* Settlement summary — amount, status & receipt only */}
            <Card bar={settleMeta.bar} style={st.summaryCard}>
              <View style={st.summaryTop}>
                <View style={st.summaryPills}>
                  {!!r.settlementStatus && (
                    <View style={[st.pill, { backgroundColor: settleMeta.bg }]}>
                      <View style={[st.pillDot, { backgroundColor: settleMeta.bar }]} />
                      <Text style={[st.pillT, { color: settleMeta.text }]}>{settleMeta.label}</Text>
                    </View>
                  )}
                  {!!r.orderStatus && (
                    <View style={[st.pill, { backgroundColor: orderMeta.bg }]}>
                      <Text style={[st.pillT, { color: orderMeta.text }]}>{orderMeta.label}</Text>
                    </View>
                  )}
                </View>
                {hasVal(displayAmount) && (
                  <View style={st.summaryAmtWrap}>
                    <Text style={st.summaryAmtLbl}>Cash to settle</Text>
                    <Text style={st.summaryAmt}>{this.fmtAmt(displayAmount)}</Text>
                  </View>
                )}
              </View>

              {!!r.receipt && (
                <TouchableOpacity
                  style={st.receiptCard}
                  activeOpacity={0.88}
                  onPress={() => this.openImagePreview(r.receipt, 'Payment receipt')}
                >
                  <Image source={{ uri: r.receipt }} style={st.receiptImg} resizeMode="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={st.receiptTitle}>Payment receipt</Text>
                    <Text style={st.receiptSub}>Tap to view full image</Text>
                  </View>
                  <Text style={st.receiptChev}>›</Text>
                </TouchableOpacity>
              )}

              <View style={st.metaList}>
                <Text style={st.metaTitle}>Settlement info</Text>
                <InfoRow label="Approval date" value={r.approvalDate} always emptyText={NA} />
                <InfoRow label="Disputed date" value={r.disputedDate} always emptyText={NA} />
                {hasVal(r.settlementComment) ? (
                  <View style={st.commentBox}>
                    <Text style={st.commentLbl}>Comment</Text>
                    <Text style={st.commentTxt}>{r.settlementComment}</Text>
                  </View>
                ) : (
                  <InfoRow label="Comment" value={r.settlementComment} always emptyText={NA} />
                )}
                <Text style={st.metaSubTitle}>Bank details</Text>
                {bankRows.map((row, i) => (
                  <InfoRow
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    always
                    emptyText={NA}
                    last={i === bankRows.length - 1 && extraSettlementRows.length === 0}
                  />
                ))}
                {extraSettlementRows.map((row, i) => (
                  <InfoRow key={row.label} label={row.label} value={row.value} last={i === extraSettlementRows.length - 1} />
                ))}
              </View>

              {!!r.penaltyText && (
                <View style={st.penalty}>
                  <Image source={require('./assets/warn.png')} style={st.penaltyIco} />
                  <Text style={st.penaltyTxt}>{r.penaltyText}</Text>
                </View>
              )}
            </Card>

            {/* Order — farmer, route, payment */}
            {r.orders.length > 0 && (
              <View style={st.ordersBlock}>
                {r.orders.length > 1 && (
                  <View style={st.secHead}>
                    <Text style={[st.secTitle, st.secHeadTitle]}>Orders</Text>
                    <View style={st.badge}><Text style={st.badgeT}>{r.orders.length}</Text></View>
                  </View>
                )}
                {r.orders.map((order, idx) => (
                  <View key={`${order.id ?? order.orderCode ?? idx}`} style={idx > 0 ? st.orderGap : null}>
                    <OrderCard
                      order={this.toOrderCardData(order)}
                      compactChips
                      useFarmerNew
                      onPress={() => this.openOrder(order)}
                      onCall={(p, id) => this.callFarmer(p, id)}
                      onWhatsApp={(p) => this.whatsapp(p)}
                      onCallStore={(p) => this.dial(p)}
                    />
                  </View>
                ))}
              </View>
            )}

            {/* Products */}
            {r.orderItems.length > 0 && (
              <Card bar={S.MUTED} style={st.itemsCard}>
                <View style={st.secHeadInline}>
                  <Text style={[st.secTitle, st.secHeadTitle]}>Order items</Text>
                  <View style={st.badge}><Text style={st.badgeT}>{r.orderItems.length}</Text></View>
                </View>
                {r.orderItems.map((item, idx) => this.renderProductItem(item, idx, r.orderItems.length))}
              </Card>
            )}

            {r.deliveryProof.length > 0 && (
              <Card>
                <View style={st.secHeadInline}>
                  <Text style={[st.secTitle, st.secHeadTitle]}>Delivery proof</Text>
                  <View style={st.badge}><Text style={st.badgeT}>{r.deliveryProof.length}</Text></View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.proofScroll}>
                  {r.deliveryProof.map((p, idx) => {
                    const when = fmtProofDate(p.uploaded_at);
                    return (
                      <TouchableOpacity
                        key={`${p.image}-${idx}`}
                        activeOpacity={0.85}
                        style={st.proofItem}
                        onPress={() => this.openImagePreview(p.image, 'Delivery proof')}
                      >
                        <Image source={{ uri: p.image }} style={st.proofThumb} />
                        {!!when && <Text style={st.proofWhen} numberOfLines={2}>{when}</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </Card>
            )}

            {(r.slot || r.deliveredAt || r.orderDate) && (
              <Card>
                <Text style={st.secTitle}>Timeline</Text>
                <InfoRow label="Slot" value={r.slot} />
                <InfoRow label="Delivered" value={r.deliveredAt} />
                <InfoRow label="Ordered" value={r.orderDate} last />
              </Card>
            )}
          </ScrollView>
        </SafeAreaView>

        <ProofImageViewer visible={!!imagePreview} uri={imagePreview} title={previewTitle} onClose={this.closeImagePreview} />
      </View>
    );
  }
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: SCREEN_BG },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 6, paddingBottom: 16, gap: 5 },

  card: {
    backgroundColor: S.CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8ECF1',
    borderLeftWidth: 3,
    borderLeftColor: S.MUTED,
    padding: 9,
    overflow: 'hidden',
  },

  summaryCard: { paddingVertical: 10 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  summaryPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, flex: 1 },
  summaryAmtWrap: { alignItems: 'flex-end', flexShrink: 0 },
  summaryAmtLbl: { fontSize: 10, fontWeight: '500', color: S.SUB },
  summaryAmt: { fontSize: 22, fontWeight: '800', color: S.GREEN_DARK, marginTop: 1 },

  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  pillDot: { width: 5, height: 5, borderRadius: 2.5 },
  pillT: { fontSize: 10, fontWeight: '700' },

  penalty: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8,
    backgroundColor: S.AMBER_BG, borderRadius: 8, padding: 8,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  penaltyIco: { width: 14, height: 14, tintColor: S.AMBER, marginTop: 1 },
  penaltyTxt: { flex: 1, fontSize: 11, color: '#78350F', lineHeight: 15 },

  ordersBlock: { gap: 0 },
  orderGap: { marginTop: 5 },
  itemsCard: { paddingBottom: 6 },

  secTitle: { fontSize: 10, fontWeight: '700', color: S.MUTED, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, paddingHorizontal: 2 },
  secHeadInline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  secHeadTitle: { marginBottom: 0 },
  badge: { backgroundColor: S.P_SOFT, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  badgeT: { fontSize: 10, fontWeight: '700', color: P },

  receiptCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    backgroundColor: S.BG, borderRadius: 8, padding: 7,
    borderWidth: 1, borderColor: '#E8ECF1',
  },
  receiptImg: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#E2E8F0' },
  receiptTitle: { fontSize: 12, fontWeight: '700', color: S.TXT },
  receiptSub: { fontSize: 10, color: S.SUB, marginTop: 1 },
  receiptChev: { fontSize: 18, color: S.MUTED },
  metaList: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8ECF1' },
  metaTitle: {
    fontSize: 10, fontWeight: '700', color: S.MUTED, textTransform: 'uppercase',
    letterSpacing: 0.4, marginBottom: 4,
  },
  metaSubTitle: {
    fontSize: 9.5, fontWeight: '700', color: P, textTransform: 'uppercase',
    letterSpacing: 0.4, marginTop: 8, marginBottom: 2,
  },
  commentBox: {
    backgroundColor: S.ORANGE_BG, borderRadius: 8, padding: 8, marginVertical: 4,
    borderWidth: 1, borderColor: '#FED7AA',
  },
  commentLbl: { fontSize: 10, fontWeight: '700', color: S.ORANGE, marginBottom: 3 },
  commentTxt: { fontSize: 11, color: '#9A3412', lineHeight: 15 },

  prodRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  prodBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F1F5F9' },
  prodImg: { width: 40, height: 40, borderRadius: 8, backgroundColor: S.BG },
  prodImgPh: { alignItems: 'center', justifyContent: 'center' },
  prodImgIco: { width: 22, height: 22, opacity: 0.7 },
  prodName: { fontSize: 12, fontWeight: '600', color: S.TXT, lineHeight: 16 },
  prodSub: { fontSize: 10, color: S.SUB, marginTop: 1 },
  prodAmt: { fontSize: 12, fontWeight: '800', color: S.TXT },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 10 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F1F5F9' },
  rowLbl: { fontSize: 11, color: S.SUB, flex: 1 },
  rowVal: { fontSize: 11, fontWeight: '600', color: S.TXT, textAlign: 'right', maxWidth: '58%' },
  rowValEmpty: { color: S.MUTED, fontWeight: '500' },

  proofScroll: { gap: 8, paddingRight: 4 },
  proofItem: { width: 72 },
  proofThumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: S.BG },
  proofWhen: { fontSize: 9, color: S.SUB, marginTop: 4, textAlign: 'center', lineHeight: 12 },
});

export default withV4Navigation(SettlementDetail);
