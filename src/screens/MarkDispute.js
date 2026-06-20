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
  Linking,
  Animated,
  Easing,
  Platform,
  TextInput,
  Keyboard,
} from 'react-native';
import { SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import Toast from 'react-native-simple-toast';
import constants from '../utils/constants';
import { withV4Navigation } from '../utils/v4Compat';
import { invalidateOrderRelated } from '../utils/dataCache';
import { getStatus, STATUS } from '../utils/statusColors';
import BottomSheet from '../components/BottomSheet';
import ScreenHeader from '../components/ScreenHeader';

const SAFE_BOTTOM = initialWindowMetrics?.insets?.bottom ?? 0;
import OrderCard from '../components/OrderCard';

const P = '#5D3FD3';

// Per-reason icon hint — keyed by best-effort match against the API label.
// Falls back to a yellow warning when no specific icon matches.
const REASON_ICON = (label = '') => {
  const t = String(label).toLowerCase();
  if (t.includes('not available') || t.includes('not reach') || t.includes('not respond')) return '🚪';
  if (t.includes('refus')) return '🙅';
  if (t.includes('wrong otp') || t.includes('otp mismatch') || t.includes('otp verif')) return '🔢';
  if (t.includes('otp')) return '📵';
  if (t.includes('reschedul')) return '🔄';
  if (t.includes('address') && (t.includes('wrong') || t.includes('incorrect') || t.includes('outside'))) return '🗺️';
  if (t.includes('location') && (t.includes('not reach') || t.includes('outside'))) return '📍';
  if (t.includes('phone')) return '📞';
  if (t.includes('damag')) return '📦';
  if (t.includes('tamper') || t.includes('opened')) return '🔓';
  if (t.includes('missing') || t.includes('partial')) return '📭';
  if (t.includes('payment')) return '💰';
  if (t.includes('cancel')) return '❌';
  if (t.includes('duplicate')) return '🔁';
  if (t.includes('fake')) return '🚨';
  if (t.includes('vehicl') || t.includes('breakdown')) return '🛵';
  if (t.includes('weather') || t.includes('rain') || t.includes('storm')) return '🌧️';
  if (t.includes('late') || t.includes('delay')) return '⏰';
  if (t.includes('signature')) return '✍️';
  if (t.includes('proof')) return '🧾';
  if (t.includes('unhappy') || t.includes('complain')) return '😞';
  if (t.includes('wrong')) return '⚠️';
  if (t.includes('quantity') || t.includes('short')) return '📉';
  if (t.includes('other') || t.includes('misc')) return '❓';
  return '⚠️';
};

const DISPUTED = STATUS.DISPUTED;

class MarkDispute extends Component {
  constructor(props) {
    super(props);
    this.state = {
      reasonsLoading: false,
      reasons: {},
      selectedKey: '',
      submitting: false,
      show_confirm: false,
      customReason: '',
    };
    this.headerFade = new Animated.Value(0);
    this.headerY = new Animated.Value(-10);
    this.cardFade = new Animated.Value(0);
    this.cardY = new Animated.Value(20);
    this.reasonsFade = new Animated.Value(0);
    this.reasonAnims = [];
    this.ctaFade = new Animated.Value(0);
    this.ctaY = new Animated.Value(18);
    this.otherAnim = new Animated.Value(0); // expands the custom-reason textinput
    this.scrollRef = React.createRef();
  }

  isOtherKey = (k) => {
    if (!k) return false;
    const label = this.state.reasons?.[k] || k;
    return String(label).toLowerCase().trim() === 'other';
  };

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

    if (prev.selectedKey !== this.state.selectedKey) {
      const nowOther = this.isOtherKey(this.state.selectedKey);
      const wasOther = this.isOtherKey(prev.selectedKey);
      if (nowOther && !wasOther) {
        Animated.spring(this.otherAnim, {
          toValue: 1,
          friction: 8,
          tension: 70,
          useNativeDriver: false,
        }).start();
        // Wait for the slide-in to begin, then scroll to it and focus.
        setTimeout(() => {
          this.scrollRef.current?.scrollToEnd({ animated: true });
          this.otherInputRef?.focus?.();
        }, 220);
      } else if (!nowOther && wasOther) {
        Keyboard.dismiss();
        Animated.timing(this.otherAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: false,
        }).start();
      }
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

  normaliseReasons = (raw) => {
    // Accepts: { key: label }, [ "label", ... ], or [ {code, label}, ... ]
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

  fetchReasons = () => {
    // Prefer reasons already passed in via navigation (the order-details API
    // returns `dispute_reasons` alongside the order, so we avoid an extra call
    // to a dedicated `/lmd/dispute-reason` endpoint that may not exist).
    const navReasons = this.props?.navigation?.getParam('reasons', null);
    const normalised = this.normaliseReasons(navReasons);
    if (Object.keys(normalised).length) {
      this.setState({ reasons: normalised, reasonsLoading: false });
      return;
    }

    this.setState({ reasonsLoading: true });
    fetch(constants.disputeReasons, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + global.token,
        Accept: 'application/json',
      },
    })
      .then((r) => r.json())
      .then((json) => {
        console.log('Dispute Reasons API response== ', JSON.stringify(json));
        const data = json?.data ?? json?.dispute_reasons ?? json;
        const reasons = this.normaliseReasons(data);
        this.setState({
          reasons: Object.keys(reasons).length ? reasons : {},
          reasonsLoading: false,
        });
      })
      .catch((e) => {
        console.log('Dispute Reasons API error== ', e);
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

  confirmDispute = () => {
    const key = this.state.selectedKey;
    this.confirmSheetRef?.close();
    setTimeout(() => this.submit(key), 200);
  };

  submit = (reasonKey) => {
    const order = this.resolveOrder();
    const isOther = this.isOtherKey(reasonKey);
    const reasonLabel = this.state.reasons?.[reasonKey] || reasonKey || '';
    const reason = isOther
      ? (this.state.customReason.trim() || reasonLabel)
      : reasonLabel;
    const body = {
      status: 'disputed',
      order_id: order.id,
      type: '',
      reason,
    };
    console.log('Mark Dispute payload== ', body);
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
        console.log('Mark Dispute API response== ', JSON.stringify(json));
        this.setState({ submitting: false });
        Toast.show(json?.message || (json?.status ? 'Marked as disputed' : 'Failed'), Toast.SHORT);
        if (json?.status) {
          invalidateOrderRelated();
          const nav = this.props?.navigation;
          if (nav?.goBack) nav.goBack();
        }
      })
      .catch((e) => {
        console.log('Mark Dispute API error== ', e);
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
          <ActivityIndicator size="small" color={theme.bg} />
          <Text style={{ marginTop: 8, fontSize: 12, color: '#64748B' }}>Loading reasons…</Text>
        </View>
      );
    }
    const keys = Object.keys(reasons || {});
    if (!keys.length) {
      return (
        <Text style={{ textAlign: 'center', marginTop: 20, color: '#94A3B8' }}>
          No dispute reasons available
        </Text>
      );
    }
    return keys.map((k, i) => this.renderReason(k, reasons[k], theme, i));
  };

  render() {
    const order = this.resolveOrder();
    const theme = DISPUTED;
    const { selectedKey, submitting, customReason } = this.state;
    const isOtherSelected = this.isOtherKey(selectedKey);
    const canConfirm =
      !!selectedKey && !submitting && (!isOtherSelected || customReason.trim().length > 0);
    const orderStatusTheme = getStatus(order.status);

    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
        <ScreenHeader bg={theme.bg} kicker="Action Zaroori" title="Dispute Lagayein" onBack={this.goBack} />

        <ScrollView
          ref={this.scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 10, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
                <Text style={s.sectionTitle}>Kyun dispute laga rahe hain?</Text>
                <Text style={s.sectionSub}>Sabse milta reason chunein. Back-office ko bhej dia jaayega.</Text>
              </View>
            </View>
            <View style={{ marginTop: 10 }}>{this.renderReasons(theme)}</View>

            {/* Custom reason input — animates in when "Other" is selected */}
            <Animated.View
              pointerEvents={isOtherSelected ? 'auto' : 'none'}
              style={{
                opacity: this.otherAnim,
                maxHeight: this.otherAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 160] }),
                transform: [{ translateY: this.otherAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
                overflow: 'hidden',
              }}
            >
              <View style={s.otherWrap}>
                <Text style={[s.otherLbl, { color: theme.accent }]}>
                  BATAYEIN KYA HUA
                </Text>
                <TextInput
                  ref={(r) => (this.otherInputRef = r)}
                  multiline
                  maxLength={300}
                  value={customReason}
                  onChangeText={(t) => this.setState({ customReason: t })}
                  placeholder="Back-office ke liye reason likhein…"
                  placeholderTextColor="#94A3B8"
                  style={[s.otherInput, { borderColor: theme.bg + '40' }]}
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={Keyboard.dismiss}
                />
                <Text style={s.otherHint}>{customReason.trim().length}/300</Text>
              </View>
            </Animated.View>
          </Animated.View>
        </ScrollView>

        {/* Bottom CTA */}
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
                    <Text style={s.confirmBtnIco}>⚑</Text>
                  </View>
                  <Text style={s.confirmBtnT}>DISPUTE LAGAYEIN</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>

        {/* Animated confirm sheet */}
        {this.state.show_confirm ? (
          <BottomSheet
            ref={(r) => (this.confirmSheetRef = r)}
            visible={true}
            dynamicSize
            enablePanDownToClose={true}
            onSheetClose={() => this.setState({ show_confirm: false })}
            onChange={(status) => (status === -1 ? this.setState({ show_confirm: false }) : '')}
          >
            <View style={s.sheetWrap}>
              {/* Hero — solid theme circle with white flag */}
              <View style={s.sheetHero}>
                <View style={[s.sheetIcoWrap, { backgroundColor: theme.bg }]}>
                  <Text style={s.sheetIco}>⚑</Text>
                </View>
                <Text style={s.sheetTitle}>Is delivery par dispute lagayein?</Text>
                <Text style={s.sheetSub}>
                  Back-office ko bata diya jaayega taaki vo dekh sakein.
                </Text>
              </View>

              {/* Compact order chip */}
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
                <Text style={s.sheetOrderAmt}>₹ {order.amount}</Text>
              </View>

              {/* Selected reason — left-aligned quote style */}
              <View
                style={[
                  s.sheetReasonChip,
                  { backgroundColor: theme.tint, borderLeftColor: theme.bg },
                ]}
              >
                <Text style={[s.sheetReasonLbl, { color: theme.accent }]}>CHUNA HUA REASON</Text>
                <Text style={s.sheetReasonText} numberOfLines={3}>
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
                  onPress={this.confirmDispute}
                  activeOpacity={0.85}
                  style={[s.sheetBtn, { backgroundColor: theme.bg, marginLeft: 10 }]}
                >
                  <Text style={s.sheetBtnPrimaryT}>Haan, Dispute</Text>
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
  root: { flex: 1, backgroundColor: '#E8ECF4' },

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

  sectionHead: { flexDirection: 'row', alignItems: 'flex-start' },
  sectionIco: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 },
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

  // Custom reason input (revealed when "Other" is selected)
  otherWrap: { marginTop: 8 },
  otherLbl: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6 },
  otherInput: {
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: '#FAFBFC',
    padding: 12,
    minHeight: 90,
    fontSize: 13,
    fontWeight: '500',
    color: '#0F172A',
    textAlignVertical: 'top',
  },
  otherHint: { fontSize: 10, fontWeight: '500', color: '#94A3B8', marginTop: 6, textAlign: 'right' },

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
  confirmBtnIco: { color: '#FFF', fontSize: 12, fontWeight: '800', lineHeight: 14 },
  confirmBtnT: { color: '#FFF', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },

  // Confirm bottom sheet — iOS already gets the home-indicator inset from the
  // BottomSheet's inner SafeAreaView, so we drop the explicit bottom padding on
  // iOS to keep the action buttons close to the bottom edge.
  sheetWrap: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12 + SAFE_BOTTOM },

  // Hero block: theme-filled circle with white icon + title + sub. No shadow.
  sheetHero: { alignItems: 'center', marginBottom: 16 },
  sheetIcoWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 0,
  },
  sheetIco: { color: '#FFF', fontSize: 24, fontWeight: '600', lineHeight: 26 },
  sheetTitle: { fontSize: 15.5, fontWeight: '600', color: '#0F172A', textAlign: 'center', marginBottom: 6, paddingHorizontal: 8 },
  sheetSub: { fontSize: 12.5, fontWeight: '400', color: '#64748B', textAlign: 'center', lineHeight: 18, paddingHorizontal: 6 },

  // Compact order chip
  sheetOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E6EBF1',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  sheetOrderAvt: { width: 32, height: 32, borderRadius: 16, resizeMode: 'cover' },
  sheetOrderId: { fontSize: 11, fontWeight: '600', color: P, letterSpacing: 0.2 },
  sheetOrderName: { fontSize: 12.5, fontWeight: '500', color: '#1E293B', marginTop: 1 },
  sheetOrderAmt: { fontSize: 13.5, fontWeight: '600', color: '#16A34A' },

  // Selected reason — left-bordered quote-style chip
  sheetReasonChip: {
    width: '100%',
    borderRadius: 10,
    borderLeftWidth: 3,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  sheetReasonLbl: { fontSize: 9.5, fontWeight: '600', letterSpacing: 0.8, marginBottom: 4 },
  sheetReasonText: { fontSize: 13, fontWeight: '500', color: '#1E293B', lineHeight: 18 },

  sheetBtnRow: { flexDirection: 'row', width: '100%' },
  sheetBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sheetBtnSecondary: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  sheetBtnSecondaryT: { color: '#475569', fontSize: 13.5, fontWeight: '500' },
  sheetBtnPrimaryT: { color: '#FFF', fontSize: 13.5, fontWeight: '600', letterSpacing: 0.3 },
});

export default withV4Navigation(MarkDispute);
