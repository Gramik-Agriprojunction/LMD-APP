/**
 * OrderCard — single visual treatment for an order row used across the whole app
 * (TrackOrders list, LMDDashboard today's deliveries, PenaltyOrders list, and
 * the order summary inside MarkDispute / RejectDelivery / OrderOtpVerify).
 *
 *   <OrderCard
 *     order={item}              // raw order object from API (any shape)
 *     onPress={() => ...}       // optional — wraps the card in a TouchableOpacity
 *     onCall={(phone, orderId) => ...}   // farmer call (orderId = API order_id)
 *     onWhatsApp={(phone) => .} // farmer WhatsApp
 *     onCallStore={(phone)=>..} // pickup darkstore call
 *     onCopyOrderId={(id)=>.}   // header copy icon
 *     onLongPress={...}         // for selection
 *     selected={false}          // shows the selected purple ring + tint
 *     showCheckbox={false}      // visible only on the Pending tab in TrackOrders
 *     onToggleSelect={...}      // for the checkbox tap
 *     theme="light" | "dark"    // "dark" tints the card for colored backgrounds (Mark Dispute, etc.)
 *     hideFooter={false}        // hide the COD/Paid/Amount footer (used inside colored summary cards)
 *     extraHeaderRight={...}    // extra node next to the status chip
 *   />
 */
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Linking } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-simple-toast';
import { getStatus, getPriority, normalizeStatus } from '../utils/statusColors';
import { COLORS } from '../theme/tokens';
import moment from 'moment';

const P = COLORS.primary;

// Opens turn-by-turn directions in Google Maps (delivery-partner navigation).
const openMaps = (addr) => {
  const q = String(addr || '').trim();
  if (!q || q === '-') {
    try { Toast.show('Address available nahi hai', Toast.SHORT); } catch (_) {}
    return;
  }
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=two-wheeler`)
    .catch(() => { try { Toast.show('Maps nahi khul paya', Toast.SHORT); } catch (_) {} });
};

const CALL_PURPLE = require('../screens/assets/call.png');
const CALL_ORANGE = require('../screens/assets/phone.png');

const mask = (p) => {
  if (!p) return '';
  const s = String(p);
  if (s.length < 6) return s;
  return s.slice(0, 2) + '****' + s.slice(-2);
};

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtRescheduleDate = (raw) => {
  if (!raw) return '';
  const s = String(raw).trim();
  const m = moment(s, ['MMM DD YYYY hh:mm A', 'MMM D YYYY hh:mm A', 'MMM DD YYYY', 'MMM D YYYY', 'YYYY-MM-DD', moment.ISO_8601], true);
  if (m.isValid()) return m.format('DD MMM, YYYY');
  const loose = moment(s);
  return loose.isValid() ? loose.format('DD MMM, YYYY') : s;
};

// Field-resolver: orders come back in two shapes (`farmer_name`/`farmer_mobile`
// from `orderList` vs. `farmer_data.{name,phone}` from `orderDetails`).
const resolve = (o = {}) => {
  const farmerName = o.farmer_name || o.farmer_data?.name || '';
  const farmerPhone = o.farmer_mobile || o.farmer_data?.phone || '';
  const orderCode = o.order_code ? String(o.order_code).split(/\s+/)[0] : '';
  const apiOrderId =
    o.order_id != null && o.order_id !== ''
      ? String(o.order_id)
      : o.id != null && o.id !== ''
        ? String(o.id)
        : '';
  const orderId = orderCode || apiOrderId;
  const status = String(o.status || o.order_status || '').toLowerCase();
  const amount = toNum(o.amount ?? o.grand_total ?? o.cod_amount);
  const ds = o.dark_store || {};
  const fa = o.farmer_address || {};
  const dropAddress =
    o.shipping_address ||
    [fa.address, fa.block, fa.city, fa.state, fa.pincode].filter(Boolean).join(', ') ||
    '';
  const paymentMode = o.payment_mode || '';
  const paymentStatus = String(o.payment_status || '').toLowerCase();
  const priorityRaw = o.priority ?? o.group_title;
  const priority = priorityRaw ? String(priorityRaw).trim().toLowerCase() : '';
  const markStatus = String(o.mark_status ?? o.markStatus ?? '').trim().toLowerCase();
  const rescheduleRaw = o.reschedule_date ?? o.rescheduleDate;
  const rescheduleDate = fmtRescheduleDate(rescheduleRaw);
  const rescheduleSlot = String(o.reschedule_slot || o.slot || '').trim();
  const deliveryTimeText = String(o.delivery_time ?? o.deliveryTime ?? '').trim();
  const pickReadyRaw = o.pick_ready ?? o.pickReady;
  const pickReady = (() => {
    if (typeof pickReadyRaw === 'boolean') return pickReadyRaw;
    if (pickReadyRaw === 1 || pickReadyRaw === '1' || String(pickReadyRaw).toLowerCase() === 'true') return true;
    if (pickReadyRaw === 0 || pickReadyRaw === '0' || String(pickReadyRaw).toLowerCase() === 'false') return false;
    return null;
  })();
  return {
    orderId, apiOrderId, status, markStatus, rescheduleDate, rescheduleSlot, deliveryTimeText, pickReady,
    farmerName, farmerPhone, amount, ds, dropAddress, paymentMode, paymentStatus, priority,
  };
};

export default function OrderCard({
  order,
  onPress,
  onLongPress,
  delayLongPress = 250,
  onCall,
  onWhatsApp,
  onCallStore,
  onCopyOrderId,
  selected = false,
  showCheckbox = false,
  isChecked = false,
  onToggleSelect,
  theme = 'light',
  hideFooter = false,
  hideRoute = false,
  hidePickReadyPill = false,
  style = null,
  extraHeaderRight = null,
  compactChips = false,
  children = null,
  onHeaderPress = null,
  onBodyPress = null,
  checkboxInHeader = false,
  useFarmerNew = false,
}) {
  const o = resolve(order);
  const stColor = getStatus(o.status);
  const dark = theme === 'dark';
  const chipBox = compactChips ? s.chipSm : s.chip;
  const chipText = compactChips ? s.chipTSm : s.chipT;
  const markStatusMeta = o.markStatus && o.markStatus !== o.status && !o.markStatus.includes('reschedule')
    ? getStatus(o.markStatus)
    : null;
  const markStatusLabel = markStatusMeta
    ? (normalizeStatus(o.markStatus) !== 'ALL' ? markStatusMeta.label : String(o.markStatus).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    : '';
  const showScheduleBanner = !!o.rescheduleDate;
  const Wrap = onPress && !onBodyPress ? TouchableOpacity : View;
  const wrapProps = onPress && !onBodyPress ? { activeOpacity: 0.75, onPress, onLongPress, delayLongPress } : {};
  const farmerImg = useFarmerNew
    ? require('../screens/assets/farmernew.png')
    : require('../screens/assets/farmer.png');
  const HeaderWrap = onHeaderPress ? TouchableOpacity : View;
  const headerWrapProps = onHeaderPress
    ? { activeOpacity: 0.85, onPress: onHeaderPress }
    : {};
  const BodyWrap = onBodyPress ? TouchableOpacity : View;
  const bodyWrapProps = onBodyPress
    ? { activeOpacity: 0.92, onPress: onBodyPress }
    : {};

  const copyOrderId = () => {
    if (!o.orderId) return;
    try {
      Clipboard.setString(String(o.orderId));
      Toast.show(`Copied #${o.orderId}`, Toast.SHORT);
    } catch (e) {
      try { Toast.show('Could not copy', Toast.SHORT); } catch (_) {}
    }
    if (typeof onCopyOrderId === 'function') onCopyOrderId(o.orderId);
  };

  const txt = dark ? '#FFF' : '#171A2A';
  const sub = dark ? 'rgba(255,255,255,0.72)' : '#64748B';
  const pillBase = dark
    ? { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }
    : null;
  const dropText = o.dropAddress || '-';
  // Navigation target: until the parcel is picked up -> dark store; after pickup -> farmer drop.
  const stKey = normalizeStatus(o.status);
  const isPickedUp = ['PICKUP', 'DELIVERED', 'DISPUTED'].includes(stKey);
  const storeQuery = [o.ds.name, o.ds.location || [o.ds.city, o.ds.pincode].filter(Boolean).join(', ')]
    .filter(Boolean).join(', ');
  const navToStore = !isPickedUp;
  const navTarget = navToStore ? storeQuery : o.dropAddress;
  const pickText = o.ds.location || [o.ds.city, o.ds.pincode].filter(Boolean).join(', ') || '-';

  // Action buttons: call / WhatsApp / navigate — big, labelled tap targets.
  const actionBar = (onCall || onWhatsApp || !hideRoute) ? (
    <View style={s.actionBar}>
      {!!onCall && (
        <TouchableOpacity
          onPress={() => onCall(o.farmerPhone, o.apiOrderId || o.orderId)}
          activeOpacity={0.8}
          style={[s.actBtn, { backgroundColor: dark ? 'rgba(255,255,255,0.14)' : '#EDE9FE' }]}
        >
          <MaterialCommunityIcons name="phone" size={17} color={dark ? '#FFF' : '#5D3FD3'} />
          <Text style={[s.actTxt, { color: dark ? '#FFF' : '#4C1D95' }]}>Call</Text>
        </TouchableOpacity>
      )}
      {!!onWhatsApp && (
        <TouchableOpacity
          onPress={() => onWhatsApp(o.farmerPhone)}
          activeOpacity={0.8}
          style={[s.actBtn, { backgroundColor: dark ? 'rgba(255,255,255,0.14)' : '#DCFCE7' }]}
        >
          <MaterialCommunityIcons name="whatsapp" size={18} color={dark ? '#FFF' : '#15803D'} />
          <Text style={[s.actTxt, { color: dark ? '#FFF' : '#166534' }]}>WhatsApp</Text>
        </TouchableOpacity>
      )}
      {!hideRoute && (
        <TouchableOpacity
          onPress={() => openMaps(navTarget)}
          activeOpacity={0.8}
          style={[s.actBtn, { backgroundColor: dark ? 'rgba(255,255,255,0.14)' : '#DBEAFE' }]}
        >
          <MaterialCommunityIcons name="navigation-variant" size={17} color={dark ? '#FFF' : '#2563EB'} />
          <Text style={[s.actTxt, { color: dark ? '#FFF' : '#1D4ED8' }]}>{navToStore ? 'To Store' : 'To Drop'}</Text>
        </TouchableOpacity>
      )}
    </View>
  ) : null;

  return (
    <Wrap {...wrapProps} style={[s.card, dark && s.cardDark, selected && s.cardSelected, style]}>
      {!dark ? <View style={[s.statusStrip, { backgroundColor: stColor.bg }]} /> : null}

      {/* Header — order id + chips, farmer, amount */}
      <HeaderWrap {...headerWrapProps} style={[s.top, selected && s.topSelected]}>
        <View style={s.head}>
          <View style={s.headLeft}>
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={copyOrderId}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              style={s.oidWrap}
              disabled={!o.orderId}
            >
              <Text style={[s.oid, dark && { color: '#FFF' }]}>#{o.orderId || '-'}</Text>
              {!!o.orderId && (
                <MaterialCommunityIcons
                  name="content-copy"
                  size={13}
                  color={dark ? 'rgba(255,255,255,0.75)' : '#8B93A7'}
                  style={{ marginLeft: 6 }}
                />
              )}
            </TouchableOpacity>
          </View>
          <View style={s.headChips}>
            {!!o.priority && (() => {
              const pri = getPriority(o.priority);
              return (
                <View style={[chipBox, s.priChip, { backgroundColor: pri.tint }]}>
                  <Text style={[chipText, { color: pri.accent }]}>{pri.label}</Text>
                </View>
              );
            })()}
            {!!markStatusMeta && (
              <View style={[chipBox, s.markChip, { backgroundColor: markStatusMeta.tint }]}>
                <Text style={[chipText, { color: markStatusMeta.accent }]}>{markStatusLabel}</Text>
              </View>
            )}
            <View style={[chipBox, { backgroundColor: stColor.tint }]}>
              <View style={[s.chipDot, { backgroundColor: stColor.bg }]} />
              <Text style={[chipText, { color: stColor.accent }]}>{stColor.label}</Text>
            </View>
            {extraHeaderRight}
          </View>
        </View>

        {showScheduleBanner && (
          <View style={[s.scheduleStrip, dark && s.scheduleStripDark]}>
            <Text style={[s.scheduleLine, dark && s.scheduleLineDark]} numberOfLines={2}>
              <Text style={[s.schedulePrefix, dark && s.scheduleLineDark]}>Order scheduled for </Text>
              <Text style={[s.scheduleHighlight, dark && s.scheduleHighlightDark]}>{o.rescheduleDate}</Text>
              {!!o.rescheduleSlot && (
                <Text style={[s.schedulePrefix, dark && s.scheduleLineDark]}> · {o.rescheduleSlot}</Text>
              )}
            </Text>
          </View>
        )}

        {!showScheduleBanner && !!o.deliveryTimeText ? (
          <View style={[s.deliveryTimeStrip, dark && s.deliveryTimeStripDark]}>
            <MaterialCommunityIcons name="clock-outline" size={14} color={dark ? '#86EFAC' : '#16A34A'} />
            <Text style={[s.deliveryTimeLine, dark && s.deliveryTimeLineDark]} numberOfLines={2}>
              {o.deliveryTimeText}
            </Text>
          </View>
        ) : null}

        <View style={s.person}>
          {showCheckbox && checkboxInHeader && (
            <View style={[s.checkBoxHead, isChecked && s.checkBoxOn, { marginRight: 8 }]}>
              {isChecked ? <Text style={s.checkTick}>✓</Text> : null}
            </View>
          )}
          <Image source={farmerImg} style={[s.avt, useFarmerNew && s.avtNew]} />
          <View style={{ flex: 1 }}>
            <Text style={[s.name, { color: txt }]} numberOfLines={1}>{o.farmerName || '-'}</Text>
            {!!o.farmerPhone && (
              <Text style={[s.phone, { color: sub }]}>{mask(o.farmerPhone)}</Text>
            )}
          </View>
          {!hideFooter && (
            <Text style={[s.amt, dark && { color: '#FCD34D' }]}>₹{o.amount}</Text>
          )}
        </View>
      </HeaderWrap>

      <BodyWrap {...bodyWrapProps}>
        {/* Route — compact timeline, no nested boxes */}
        {!hideRoute && (
          <View style={[s.routeWrap, dark && s.routeWrapDark]}>
            <View style={s.stopRow}>
              <View style={s.rail}>
                <View style={[s.dot, { backgroundColor: '#16A34A' }]} />
                <View style={[s.railLine, dark && { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
              </View>
              <View style={s.stopBody}>
                <Text style={[s.stopLbl, { color: dark ? '#86EFAC' : '#15803D' }]}>PICKUP</Text>
                <Text style={[s.stopTitle, { color: txt }]} numberOfLines={1}>{o.ds.name || '-'}</Text>
                <Text style={[s.stopAddr, { color: sub }]} numberOfLines={2}>{pickText}</Text>
              </View>
              {o.ds.mobile && onCallStore ? (
                <TouchableOpacity
                  onPress={() => onCallStore(o.ds.mobile)}
                  activeOpacity={0.75}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={s.storeCall}
                >
                  <MaterialCommunityIcons name="phone-outline" size={16} color="#EA580C" />
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={s.stopRow}>
              <View style={s.rail}>
                <View style={[s.dot, { backgroundColor: dark ? '#F87171' : '#EF4444' }]} />
              </View>
              <View style={[s.stopBody, { paddingBottom: 0 }]}>
                <Text style={[s.stopLbl, { color: dark ? '#FCA5A5' : '#DC2626' }]}>DROP</Text>
                <Text style={[s.dropTxt, { color: txt }]} numberOfLines={3}>{dropText}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Footer — payment / readiness pills (+ selection checkbox) */}
        {!hideFooter && (
          <View style={s.foot}>
            {showCheckbox && !checkboxInHeader && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={(e) => {
                  try { e?.stopPropagation?.(); } catch (_) {}
                  if (typeof onToggleSelect === 'function') onToggleSelect();
                }}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                style={[s.checkBoxFoot, isChecked && s.checkBoxOn]}
              >
                {isChecked ? <Text style={s.checkTick}>✓</Text> : null}
              </TouchableOpacity>
            )}
            {!!o.paymentMode && (
              <View style={[s.pill, pillBase || { backgroundColor: '#EEF2F7' }]}>
                <Text style={[s.pillT, { color: dark ? '#FFF' : '#475569' }]}>{String(o.paymentMode).toUpperCase()}</Text>
              </View>
            )}
            {!!o.paymentStatus && (
              <View style={[s.pill, pillBase || { backgroundColor: o.paymentStatus === 'paid' ? '#DCFCE7' : '#FEF3C7' }]}>
                <Text style={[s.pillT, { color: dark ? '#FFF' : (o.paymentStatus === 'paid' ? '#15803D' : '#B45309') }]}>
                  {o.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
                </Text>
              </View>
            )}
            {o.pickReady !== null && !hidePickReadyPill ? (
              <View style={[s.pill, pillBase || { backgroundColor: o.pickReady ? '#DCFCE7' : '#FFEDD5' }]}>
                <Text style={[s.pillT, { color: dark ? '#FFF' : (o.pickReady ? '#15803D' : '#C2410C') }]}>
                  {o.pickReady ? (compactChips ? 'READY' : 'PICK READY') : (compactChips ? 'WAITING' : 'NOT READY')}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {actionBar}
      </BodyWrap>

      {/* Optional slot that lives inside the same card (penalty extras, etc.) */}
      {children}
    </Wrap>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#1A1F3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  statusStrip: {
    position: 'absolute',
    left: 0,
    top: 16,
    height: 28,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    zIndex: 2,
  },
  cardDark: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderColor: 'rgba(255,255,255,0.18)',
    shadowOpacity: 0,
    elevation: 0,
  },
  cardSelected: { borderColor: '#08081c', borderWidth: 2, backgroundColor: '#EEF0FA' },

  top: { backgroundColor: 'transparent' },
  topSelected: { backgroundColor: '#E4DEFA' },

  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    rowGap: 4,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  headLeft: { flexShrink: 1, marginRight: 8 },
  headChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
    maxWidth: '100%',
  },
  oidWrap: { flexDirection: 'row', alignItems: 'center' },
  oid: { fontSize: 14, fontWeight: '900', color: COLORS.primaryDark, letterSpacing: 0.3, includeFontPadding: false },

  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  chipT: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  chipSm: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  chipTSm: { fontSize: 8, fontWeight: '800', letterSpacing: 0.2, includeFontPadding: false, lineHeight: 11 },
  chipDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  priChip: { marginRight: 6 },
  markChip: { marginRight: 6 },

  scheduleStrip: {
    marginHorizontal: 14,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  scheduleStripDark: {
    backgroundColor: 'rgba(147,51,234,0.12)',
    borderColor: 'rgba(196,181,253,0.35)',
  },
  scheduleLine: { fontSize: 12, fontWeight: '500', color: '#64748B', lineHeight: 17 },
  scheduleLineDark: { color: 'rgba(255,255,255,0.8)' },
  schedulePrefix: { fontSize: 12, fontWeight: '500', color: '#64748B' },
  scheduleHighlight: { fontSize: 12, fontWeight: '800', color: '#7E22CE' },
  scheduleHighlightDark: { color: '#F3E8FF' },

  deliveryTimeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
  },
  deliveryTimeStripDark: { backgroundColor: 'rgba(22,163,74,0.15)' },
  deliveryTimeLine: { flex: 1, fontSize: 12, fontWeight: '700', color: '#16A34A', lineHeight: 17 },
  deliveryTimeLineDark: { color: '#86EFAC' },

  person: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12 },
  avt: { width: 40, height: 40, borderRadius: 20, resizeMode: 'cover', marginRight: 11, backgroundColor: '#EDE9FE' },
  avtNew: { width: 40, height: 40, borderRadius: 12, resizeMode: 'contain' },
  name: { fontSize: 15.5, fontWeight: '800' },
  phone: { fontSize: 12, fontWeight: '500', marginTop: 1 },
  amt: { fontSize: 20, fontWeight: '900', color: '#16A34A', letterSpacing: -0.4 },

  routeWrap: {
    marginHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  routeWrapDark: { borderTopColor: 'rgba(255,255,255,0.15)' },
  stopRow: { flexDirection: 'row', alignItems: 'stretch' },
  rail: { width: 16, alignItems: 'center', marginRight: 10, paddingTop: 3 },
  dot: { width: 11, height: 11, borderRadius: 5.5, borderWidth: 2.5, borderColor: '#FFF' },
  railLine: { flex: 1, width: 2, borderRadius: 1, backgroundColor: '#DDD6F0', marginTop: 3, marginBottom: -2 },
  stopBody: { flex: 1, paddingBottom: 14 },
  stopLbl: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 2 },
  stopTitle: { fontSize: 14, fontWeight: '800' },
  stopAddr: { fontSize: 12, fontWeight: '400', lineHeight: 17, marginTop: 2 },
  dropTxt: { fontSize: 13.5, fontWeight: '600', lineHeight: 19 },
  storeCall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  foot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4, gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pillT: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

  actionBar: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14 },
  actBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actTxt: { fontSize: 12.5, fontWeight: '800' },

  checkBoxFoot: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  checkBoxHead: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkBoxOn: { backgroundColor: '#08081c', borderColor: '#08081c' },
  checkTick: { color: '#FCD34D', fontSize: 15, fontWeight: '900', marginTop: -1, lineHeight: 17 },
});
