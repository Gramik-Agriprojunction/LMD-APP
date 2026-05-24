import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-simple-toast';
import constants from '../utils/constants';
import { withV4Navigation } from '../utils/v4Compat';
import { invalidateOrderRelated } from '../utils/dataCache';
import ScreenHeader from '../components/ScreenHeader';
import { getStatus, STATUS } from '../utils/statusColors';
import BottomSheet from '../components/BottomSheet';
import OrderCard from '../components/OrderCard';

const P = '#5D3FD3';
const DANGER = '#DC2626';

// Per-reason icon hint — keyed by best-effort match against the API label.
// Falls back to a yellow warning when no specific icon matches.
const REASON_ICON = (label = '') => {
  const t = String(label).toLowerCase();
  if (t.includes('far') || t.includes('distance') || (t.includes('location') && !t.includes('wrong'))) return '📍';
  if (t.includes('wrong') && (t.includes('pickup') || t.includes('location') || t.includes('address'))) return '🗺️';
  if (t.includes('servic')) return '🚫';
  if (t.includes('vehicl') || t.includes('bike') || t.includes('scoot')) return '🛵';
  if (t.includes('health') || t.includes('sick') || t.includes('ill') || t.includes('fever')) return '🤒';
  if (t.includes('heavy') || t.includes('weight') || t.includes('big') || t.includes('bulk')) return '📦';
  if (t.includes('shop') && t.includes('clos')) return '🏪';
  if (t.includes('another order') || t.includes('handling') || t.includes('busy') || t.includes('already')) return '🚦';
  if (t.includes('network') || t.includes('signal') || t.includes('internet')) return '📶';
  if (t.includes('safety') || t.includes('unsafe') || t.includes('danger')) return '🛡️';
  if (t.includes('weather') || t.includes('rain') || t.includes('storm')) return '🌧️';
  if (t.includes('wallet') || t.includes('balance') || t.includes('cash')) return '💳';
  if (t.includes('shift') && (t.includes('end') || t.includes('over'))) return '🕔';
  if (t.includes('personal') || t.includes('family') || t.includes('emergency')) return '🙏';
  if (t.includes('time') || t.includes('late')) return '⏰';
  if (t.includes('payment')) return '💰';
  if (t.includes('other') || t.includes('misc')) return '❓';
  if (t.includes('wrong') || t.includes('incorrect')) return '⚠️';
  return '⚠️';
};

class RejectDelivery extends Component {
  constructor(props) {
    super(props);
    this.state = {
      reasonsLoading: false,
      reasons: {},
      selectedKey: '',
      submitting: false,
      show_confirm: false,
    };
    // Entrance animations
    this.headerFade = new Animated.Value(0);
    this.headerY = new Animated.Value(-10);
    this.cardFade = new Animated.Value(0);
    this.cardY = new Animated.Value(20);
    this.reasonsFade = new Animated.Value(0);
    this.selectedScale = new Animated.Value(1);
    this.reasonAnims = []; // per-row staggered entrance values, set when reasons load
    this.ctaFade = new Animated.Value(0);
    this.ctaY = new Animated.Value(18);
  }

  componentDidMount() {
    this.fetchReasons();
    Animated.parallel([
      Animated.timing(this.headerFade, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(this.headerY, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(this.cardFade, { toValue: 1, duration: 380, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(this.cardY, { toValue: 0, delay: 120, friction: 8, tension: 60, useNativeDriver: true }),
    ]).start();
    Animated.timing(this.reasonsFade, { toValue: 1, duration: 320, delay: 260, useNativeDriver: true }).start();
    Animated.parallel([
      Animated.timing(this.ctaFade, { toValue: 1, duration: 360, delay: 340, useNativeDriver: true }),
      Animated.spring(this.ctaY, { toValue: 0, delay: 340, friction: 8, tension: 70, useNativeDriver: true }),
    ]).start();
  }

  componentDidUpdate(_, prev) {
    if (prev.reasonsLoading && !this.state.reasonsLoading) {
      this.animateReasonsIn();
    }
    if (prev.selectedKey !== this.state.selectedKey && this.state.selectedKey) {
      this.selectedScale.setValue(0.92);
      Animated.spring(this.selectedScale, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }).start();
    }
  }

  animateReasonsIn = () => {
    const n = Object.keys(this.state.reasons || {}).length;
    this.reasonAnims = Array.from({ length: n }, () => new Animated.Value(0));
    Animated.stagger(
      45,
      this.reasonAnims.map((v) =>
        Animated.spring(v, { toValue: 1, friction: 8, tension: 65, useNativeDriver: true }),
      ),
    ).start();
  };

  getOrder = () => this.props?.navigation?.getParam('order', null) || {};

  // Normalise the order data — works with both `details` (orderDetails API)
  // and a row from orderList (different field shapes).
  resolveOrder = () => {
    const o = this.getOrder();
    const farmerName = o?.farmer_name || o?.farmer_data?.name || '';
    const farmerPhone = o?.farmer_mobile || o?.farmer_data?.phone || '';
    // Some APIs return `order_code` like "AGRI12345 Fatehpur, UP …" — keep only
    // the first whitespace-delimited token so the header reads as a clean ID.
    const rawId = o?.order_id || o?.order_code || '';
    const orderId = String(rawId).trim().split(/\s+/)[0] || '';
    const status = String(o?.status || o?.order_status || '').toLowerCase();
    const amount = this.toNum(o?.amount ?? o?.grand_total ?? o?.cod_amount);
    const ds = o?.dark_store || {};
    const fa = o?.farmer_address || {};
    const dropAddress =
      o?.shipping_address ||
      [fa?.address, fa?.block, fa?.city, fa?.state, fa?.pincode].filter(Boolean).join(', ') ||
      '';
    return { id: o?.id, orderId, status, farmerName, farmerPhone, amount, ds, dropAddress, raw: o };
  };

  fetchReasons = () => {
    this.setState({ reasonsLoading: true });
    fetch(constants.rejectReasons, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + global.token,
        Accept: 'application/json',
      },
    })
      .then((r) => r.json())
      .then((json) => {
        console.log('Reject Reasons API response== ', JSON.stringify(json));
        const data = json?.data;
        const hasData = data && typeof data === 'object' && Object.keys(data).length > 0;
        this.setState({
          reasons: hasData ? data : {},
          reasonsLoading: false,
        });
      })
      .catch((e) => {
        console.log('Reject Reasons API error== ', e);
        this.setState({ reasons: {}, reasonsLoading: false });
      });
  };

  toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  mask = (p) => {
    if (!p) return '';
    const s = String(p);
    if (s.length < 6) return s;
    return s.slice(0, 2) + '****' + s.slice(-2);
  };

  goBack = () => {
    const nav = this.props?.navigation;
    if (nav?.goBack) nav.goBack();
  };

  dial = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${String(phone).replace(/\s+/g, '')}`).catch(() => {});
  };

  wa = (phone) => {
    if (!phone) return;
    const c = String(phone).replace(/[^\d]/g, '');
    Linking.openURL(`whatsapp://send?phone=${c}`).catch(() =>
      Linking.openURL(`https://wa.me/${c}`).catch(() => {}),
    );
  };

  confirm = () => {
    const { selectedKey, submitting } = this.state;
    if (!selectedKey || submitting) return;
    const order = this.resolveOrder();
    if (!order.id) {
      Toast.show('Order id missing', Toast.SHORT);
      return;
    }
    this.setState({ show_confirm: true });
  };

  closeConfirm = () => {
    this.confirmSheetRef?.close();
  };

  confirmReject = () => {
    const key = this.state.selectedKey;
    this.confirmSheetRef?.close();
    // Give the close animation a moment before kicking off the network call
    setTimeout(() => this.submit(key), 200);
  };

  submit = (reasonKey) => {
    const order = this.resolveOrder();
    const body = {
      status: 'reject',
      order_id: order.id,
      type: '',
      reason: reasonKey || '',
    };
    console.log('Reject Delivery payload== ', body);
    this.setState({ submitting: true });

    fetch(constants.updateStatus, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + global.token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((json) => {
        console.log('Reject Delivery API response== ', JSON.stringify(json));
        this.setState({ submitting: false });
        Toast.show(json?.message || (json?.status ? 'Delivery rejected' : 'Failed'), Toast.SHORT);
        if (json?.status) {
          invalidateOrderRelated();
          const nav = this.props?.navigation;
          if (nav?.goBack) nav.goBack();
        }
      })
      .catch((e) => {
        console.log('Reject Delivery API error== ', e);
        this.setState({ submitting: false });
        Toast.show('Network error. Please try again.', Toast.SHORT);
      });
  };

  renderReason = (k, label, theme, index) => {
    const selected = this.state.selectedKey === k;
    const ico = REASON_ICON(label);
    const anim = this.reasonAnims[index] || this.reasonsFade;
    return (
      <Animated.View
        key={k}
        style={{
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        }}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => this.setState({ selectedKey: k })}
          style={[s.reasonRow, selected && { borderColor: theme.bg, backgroundColor: theme.tint }]}
        >
          <View style={s.reasonIco}>
            <Text style={s.reasonIcoT}>{ico}</Text>
          </View>
          <Text
            style={[s.reasonText, selected && { color: theme.accent, fontWeight: '700' }]}
            numberOfLines={2}
          >
            {label}
          </Text>
          <View style={[s.radioOuter, selected && { borderColor: theme.bg }]}>
            {selected && <View style={[s.radioInner, { backgroundColor: theme.bg }]} />}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  renderReasons = (theme) => {
    const { reasons, reasonsLoading } = this.state;
    if (reasonsLoading) {
      return (
        <View style={{ paddingVertical: 30, alignItems: 'center' }}>
          <ActivityIndicator size="small" color={DANGER} />
          <Text style={{ marginTop: 8, fontSize: 12, color: '#64748B' }}>Loading reasons…</Text>
        </View>
      );
    }
    const keys = Object.keys(reasons || {});
    if (!keys.length) {
      return (
        <Text style={{ textAlign: 'center', marginTop: 20, color: '#94A3B8' }}>
          No reject reasons available
        </Text>
      );
    }
    return keys.map((k, i) => this.renderReason(k, reasons[k], theme, i));
  };

  render() {
    const order = this.resolveOrder();
    // The screen represents the REJECTED state (the action the user is about
    // to perform), not the order's current status — so all themed surfaces
    // (header, accents, full-screen bg, pill) use the REJECTED palette.
    const theme = STATUS.REJECTED;
    const { selectedKey, submitting } = this.state;
    const canConfirm = !!selectedKey && !submitting;

    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
        <ScreenHeader bg={theme.bg} kicker="Action Zaroori" title="Delivery Reject Karein" onBack={this.goBack} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 10, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Order info card — shared OrderCard component */}
          <Animated.View style={{ opacity: this.cardFade, transform: [{ translateY: this.cardY }] }}>
            <OrderCard
              order={order.raw || order}
              onCall={(p) => this.dial(p)}
              onWhatsApp={(p) => this.wa(p)}
              onCallStore={(p) => this.dial(p)}
            />
          </Animated.View>

          {/* Reasons */}
          <Animated.View
            style={[
              s.card,
              s.reasonsCard,
              { marginTop: 10, opacity: this.cardFade, transform: [{ translateY: this.cardY }] },
            ]}
          >
            <View style={s.sectionHead}>
              <View style={[s.sectionIco, { backgroundColor: theme.bg }]}>
                <Text style={s.sectionIcoT}>!</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionTitle}>Kyun reject kar rahe hain?</Text>
                <Text style={s.sectionSub}>Sabse milta reason chunein. Warehouse ko bata diya jaayega.</Text>
              </View>
            </View>
            <View style={{ marginTop: 10 }}>{this.renderReasons(theme)}</View>
          </Animated.View>
        </ScrollView>

        {/* Bottom confirm — solid theme-colored CTA on a clean white footer.
            iOS already lifts the button above the home indicator visually, so
            we skip the safe-area inset there. Android still respects gesture-bar
            inset via the SafeAreaView bottom edge. */}
        <SafeAreaView edges={Platform.OS === 'ios' ? [] : ['bottom']} style={s.bottomWrap}>
          <Animated.View style={{ opacity: this.ctaFade, transform: [{ translateY: this.ctaY }] }}>
            <TouchableOpacity
              disabled={!canConfirm}
              onPress={this.confirm}
              activeOpacity={0.88}
              style={[
                s.confirmBtn,
                { backgroundColor: theme.bg },
                !canConfirm && { opacity: 0.45 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <View style={s.confirmBtnIcoWrap}>
                    <Text style={s.confirmBtnIco}>✕</Text>
                  </View>
                  <Text style={s.confirmBtnT}>DELIVERY REJECT KAREIN</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>

        {/* Animated confirm sheet — replaces the native Alert.
            Dragging anywhere in the sheet pans it down to close (pan handlers
            live on the outer Animated.View of BottomSheet itself). */}
        {this.state.show_confirm ? (
          <BottomSheet
            ref={(r) => (this.confirmSheetRef = r)}
            visible={true}
            enablePanDownToClose={true}
            onSheetClose={() => this.setState({ show_confirm: false })}
            onChange={(status) => (status === -1 ? this.setState({ show_confirm: false }) : '')}
          >
            <View style={s.sheetWrap}>
              {/* Compact order-info strip */}
              <View style={s.sheetOrderRow}>
                <Image source={require('./assets/farmer.png')} style={s.sheetOrderAvt} />
                <View style={{ flex: 1, paddingHorizontal: 10 }}>
                  <Text style={s.sheetOrderId} numberOfLines={1}>
                    #{order.orderId || '—'}
                  </Text>
                  <Text style={s.sheetOrderName} numberOfLines={1}>
                    {order.farmerName || 'Unknown farmer'}
                  </Text>
                </View>
                <View style={s.sheetOrderAmtWrap}>
                  <Text style={s.sheetOrderAmtLbl}>AMOUNT</Text>
                  <Text style={s.sheetOrderAmt}>₹ {order.amount}</Text>
                </View>
              </View>

              <View style={s.sheetDivider} />

              <View style={s.sheetCenter}>
                <View style={[s.sheetIcoWrap, { backgroundColor: theme.tint }]}>
                  <Text style={[s.sheetIco, { color: theme.bg }]}>✕</Text>
                </View>
                <Text style={s.sheetTitle}>Reject this delivery?</Text>
                <Text style={s.sheetSub}>
                  The warehouse will be notified. This can't be undone.
                </Text>
              </View>

              <View
                style={[
                  s.sheetReasonChip,
                  { backgroundColor: theme.tint, borderColor: theme.bg + '40' },
                ]}
              >
                <Text style={[s.sheetReasonLbl, { color: theme.accent }]}>REASON</Text>
                <Text style={s.sheetReasonText} numberOfLines={2}>
                  {this.state.reasons[this.state.selectedKey] || this.state.selectedKey || '—'}
                </Text>
              </View>

              <View style={s.sheetBtnRow}>
                <TouchableOpacity
                  onPress={this.closeConfirm}
                  activeOpacity={0.85}
                  style={[s.sheetBtn, s.sheetBtnSecondary]}
                >
                  <Text style={s.sheetBtnSecondaryT}>Nahi</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={this.confirmReject}
                  activeOpacity={0.85}
                  style={[s.sheetBtn, { backgroundColor: theme.bg, marginLeft: 10 }]}
                >
                  <Text style={s.sheetBtnPrimaryT}>Haan, Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BottomSheet>
        ) : null}
      </View>
    );
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#D9DEE6' },

  headerRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  headerIco: { width: 17, height: 17, tintColor: '#FFF', resizeMode: 'contain' },
  headerKicker: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.65)', letterSpacing: 1 },
  headerTitle: { color: '#FFF', fontSize: 14.5, fontWeight: '700', letterSpacing: 0.2, marginTop: 1 },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTop: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 },
  reasonsCard: { padding: 12 },

  orderHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  orderId: { flex: 1, fontSize: 11.5, fontWeight: '700', color: P, letterSpacing: 0.2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  statusPillT: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  farmerRow: { flexDirection: 'row', alignItems: 'center' },
  farmerAvt: { width: 32, height: 32, borderRadius: 16, marginRight: 10, resizeMode: 'cover' },
  farmerName: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  farmerPhone: { fontSize: 11, fontWeight: '400', color: '#94A3B8', marginTop: 1 },
  actionIco: { width: 32, height: 32, resizeMode: 'contain' },

  routeWrap: { paddingHorizontal: 12, paddingVertical: 10 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  routeTl: { width: 12, alignItems: 'center', marginRight: 6, paddingTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  routeLine: { width: 1.5, flex: 1, minHeight: 12, backgroundColor: '#E2E8F0', marginVertical: 3 },
  routeLbl: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6, marginBottom: 2 },
  routeTitle: { fontSize: 12, fontWeight: '600', color: '#1E293B' },
  routePhone: { fontSize: 11, fontWeight: '400', color: '#94A3B8', marginTop: 1 },
  routeAddr: { fontSize: 11.5, fontWeight: '400', color: '#64748B', lineHeight: 15, marginTop: 1 },

  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 9, paddingBottom: 11, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FAFBFC' },
  amountLbl: { fontSize: 11, fontWeight: '500', color: '#64748B' },
  amountVal: { fontSize: 14, fontWeight: '700', color: '#16A34A' },

  sectionHead: { flexDirection: 'row', alignItems: 'center' },
  sectionIco: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  sectionIcoT: { color: '#FFF', fontSize: 13, fontWeight: '800', lineHeight: 15 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  sectionSub: { fontSize: 11, fontWeight: '400', color: '#94A3B8', marginTop: 1, marginBottom: 5 },

  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
    marginBottom: 6,
  },
  reasonIco: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  reasonIcoT: { fontSize: 20, lineHeight: 24 },
  reasonText: { flex: 1, fontSize: 12.5, fontWeight: '500', color: '#475569' },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 8, height: 8, borderRadius: 4 },

  bottomWrap: { backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingHorizontal: 28, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 22 : 12 },
  confirmBtn: {
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 0,
  },
  confirmBtnIcoWrap: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginRight: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  confirmBtnIco: { color: '#FFF', fontSize: 11, fontWeight: '800', lineHeight: 13 },
  confirmBtnT: { color: '#FFF', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },

  // Confirm bottom sheet
  sheetWrap: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },

  // Compact order-info strip at the top of the sheet
  sheetOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  sheetOrderAvt: { width: 36, height: 36, borderRadius: 18, resizeMode: 'cover' },
  sheetOrderId: { fontSize: 11, fontWeight: '700', color: P, letterSpacing: 0.2 },
  sheetOrderName: { fontSize: 13, fontWeight: '600', color: '#1E293B', marginTop: 2 },
  sheetOrderAmtWrap: { alignItems: 'flex-end' },
  sheetOrderAmtLbl: { fontSize: 9, fontWeight: '600', color: '#94A3B8', letterSpacing: 0.6 },
  sheetOrderAmt: { fontSize: 14, fontWeight: '700', color: '#16A34A', marginTop: 1 },

  sheetDivider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 16 },

  sheetCenter: { alignItems: 'center' },
  sheetIcoWrap: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  sheetIco: { fontSize: 22, fontWeight: '800', lineHeight: 24 },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', textAlign: 'center', marginBottom: 4 },
  sheetSub: { fontSize: 12, fontWeight: '400', color: '#64748B', textAlign: 'center', lineHeight: 17, marginBottom: 16 },

  sheetReasonChip: { width: '100%', borderRadius: 10, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 16 },
  sheetReasonLbl: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.8, marginBottom: 2 },
  sheetReasonText: { fontSize: 13, fontWeight: '600', color: '#1E293B' },

  sheetBtnRow: { flexDirection: 'row', width: '100%' },
  sheetBtn: { flex: 1, height: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sheetBtnSecondary: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  sheetBtnSecondaryT: { color: '#475569', fontSize: 13.5, fontWeight: '600' },
  sheetBtnPrimaryT: { color: '#FFF', fontSize: 13.5, fontWeight: '700', letterSpacing: 0.3 },
});

export default withV4Navigation(RejectDelivery);
