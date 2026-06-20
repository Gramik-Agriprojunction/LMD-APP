/**
 * OrderCard — single visual treatment for an order row used across the whole app
 * (TrackOrders list, LMDDashboard today's deliveries, PenaltyOrders list, and
 * the order summary inside MarkDispute / RejectDelivery / OrderOtpVerify).
 *
 *   <OrderCard
 *     order={item}              // raw order object from API (any shape)
 *     onPress={() => ...}       // optional — wraps the card in a TouchableOpacity
 *     onCall={(phone) => ...}   // farmer call
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
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-simple-toast';
import { getStatus, getPriority } from '../utils/statusColors';

const P = '#5D3FD3';

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

// Field-resolver: orders come back in two shapes (`farmer_name`/`farmer_mobile`
// from `orderList` vs. `farmer_data.{name,phone}` from `orderDetails`).
const resolve = (o = {}) => {
  const farmerName = o.farmer_name || o.farmer_data?.name || '';
  const farmerPhone = o.farmer_mobile || o.farmer_data?.phone || '';
  const orderId = o.order_id || (o.order_code ? String(o.order_code).split(/\s+/)[0] : '');
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
  const priority = String(o.priority || 'low').toLowerCase();
  return { orderId, status, farmerName, farmerPhone, amount, ds, dropAddress, paymentMode, paymentStatus, priority };
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
  extraHeaderRight = null,
  compactChips = false,
  children = null,
}) {
  const o = resolve(order);
  const stColor = getStatus(o.status);
  const dark = theme === 'dark';
  const chipBox = compactChips ? s.chipSm : s.chip;
  const chipText = compactChips ? s.chipTSm : s.chipT;
  const Wrap = onPress ? TouchableOpacity : View;
  const wrapProps = onPress ? { activeOpacity: 0.75, onPress, onLongPress, delayLongPress } : {};

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

  return (
    <Wrap {...wrapProps} style={[s.card, dark && s.cardDark, selected && s.cardSelected]}>
      {/* Greyish header — order id (with copy) + status chip + farmer + call/wa */}
      <View style={[s.top, dark && s.topDark, selected && s.topSelected]}>
        <View style={s.head}>
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={copyOrderId}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            style={s.oidWrap}
            disabled={!o.orderId}
          >
            <Text style={[s.oid, dark && { color: '#FFF' }]}>#{o.orderId || '-'}</Text>
            {!!o.orderId && (
              <Text style={[s.oidCopy, dark && { color: 'rgba(255,255,255,0.75)' }]}>⎘</Text>
            )}
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {!!o.priority && (() => {
            const pri = getPriority(o.priority);
            return (
              <View style={[chipBox, s.priChip, { backgroundColor: pri.bg }]}>
                <Text style={chipText}>{pri.label}</Text>
              </View>
            );
          })()}
          <View style={[chipBox, { backgroundColor: stColor.bg }]}>
            <Text style={chipText}>{stColor.label}</Text>
          </View>
          {extraHeaderRight}
        </View>

        <View style={s.person}>
          <Image source={require('../screens/assets/farmer.png')} style={s.avt} />
          <View style={{ flex: 1 }}>
            <Text style={[s.name, dark && { color: '#FFF' }]} numberOfLines={1}>{o.farmerName || '-'}</Text>
            {!!o.farmerPhone && (
              <Text style={[s.phone, dark && { color: 'rgba(255,255,255,0.7)' }]}>{mask(o.farmerPhone)}</Text>
            )}
          </View>
          {!!onCall && (
            <TouchableOpacity onPress={() => onCall(o.farmerPhone)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.actBtn}>
              <Image source={CALL_PURPLE} style={s.actIco} />
            </TouchableOpacity>
          )}
          {!!onWhatsApp && (
            <TouchableOpacity onPress={() => onWhatsApp(o.farmerPhone)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={[s.actBtn, { marginLeft: 6 }]}>
              <Image source={require('../screens/assets/whatsapp.png')} style={s.actIco} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Route */}
      {!hideRoute && (
        <View style={[s.routeWrap, dark && s.routeWrapDark]}>
          <View style={s.routeRow}>
            <View style={s.routeTl}>
              <View style={[s.dot, { backgroundColor: '#0DA60D' }]} />
              <View style={[s.routeLine, dark && { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
            </View>
            <View style={s.routeBody}>
              <Text style={[s.routeLbl, { color: '#0DA60D' }]}>PICKUP</Text>
              <Text style={[s.routeTitle, dark && { color: '#FFF' }]}>{o.ds.name || '-'}</Text>
              {o.ds.mobile ? <Text style={[s.routePhone, dark && { color: 'rgba(255,255,255,0.7)' }]}>{o.ds.mobile}</Text> : null}
              <Text style={[s.routeAddr, dark && { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={2}>
                {o.ds.location || [o.ds.city, o.ds.pincode].filter(Boolean).join(', ') || '-'}
              </Text>
            </View>
            {o.ds.mobile && onCallStore ? (
              <TouchableOpacity onPress={() => onCallStore(o.ds.mobile)} activeOpacity={0.7} style={s.dsCall}>
                <Image source={CALL_ORANGE} style={s.dsCallIco} />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={s.routeRow}>
            <View style={s.routeTl}>
              <View style={[s.dot, { backgroundColor: dark ? '#F87171' : '#EF4444' }]} />
            </View>
            <View style={[s.routeBody, { paddingBottom: 0 }]}>
              <Text style={[s.routeLbl, { color: dark ? '#FCA5A5' : '#EF4444' }]}>DROP</Text>
              <Text style={[s.routeAddr, dark && { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={3}>
                {o.dropAddress || '-'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Footer */}
      {!hideFooter && (
        <View style={[s.foot, dark && s.footDark]}>
          {showCheckbox && (
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
            <View style={[s.pill, dark
              ? { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }
              : { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' }]}>
              <Text style={[s.pillT, { color: dark ? '#FFF' : '#475569' }]}>{String(o.paymentMode).toUpperCase()}</Text>
            </View>
          )}
          {!!o.paymentStatus && (
            <View style={[s.pill, dark
              ? { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }
              : { backgroundColor: o.paymentStatus === 'paid' ? '#DCFCE7' : '#FEF3C7', borderWidth: 1, borderColor: o.paymentStatus === 'paid' ? '#86EFAC' : '#FCD34D' }]}>
              <Text style={[s.pillT, { color: dark ? '#FFF' : (o.paymentStatus === 'paid' ? '#15803D' : '#B45309') }]}>
                {o.paymentStatus === 'paid' ? 'PAID' : 'UNPAID'}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Text style={[s.amt, dark && { color: '#FCD34D' }]}>₹{o.amount}</Text>
        </View>
      )}

      {/* Optional slot that lives inside the same card (penalty extras, etc.) */}
      {children}
    </Wrap>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  // When the card sits on a coloured/full-screen background, use translucent
  // surfaces instead of opaque white so it blends with the screen theme.
  cardDark: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderColor: 'rgba(255,255,255,0.18)',
    shadowOpacity: 0,
    elevation: 0,
  },
  cardSelected: { borderColor: '#08081c', borderWidth: 2, backgroundColor: '#EEF0FA', shadowOpacity: 0.12 },

  top: { backgroundColor: '#F1F5F9' },
  topDark: { backgroundColor: 'rgba(255,255,255,0.07)' },
  topSelected: { backgroundColor: '#E0E7FF' },

  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  oidWrap: { flexDirection: 'row', alignItems: 'center' },
  oid: { fontSize: 10.5, fontWeight: '600', color: P, letterSpacing: 0.2, includeFontPadding: false },
  oidCopy: { fontSize: 18, fontWeight: '500', color: P, marginLeft: 6, opacity: 0.75, includeFontPadding: false, lineHeight: 20 },

  chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  chipT: { fontSize: 9, fontWeight: '700', color: '#FFF', letterSpacing: 0.3 },
  chipSm: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  chipTSm: { fontSize: 7.5, fontWeight: '700', color: '#FFF', letterSpacing: 0.2, includeFontPadding: false, lineHeight: 10 },
  priChip: { marginRight: 6 },

  // Selection checkbox lives in the FOOTER on the left, alongside the payment
  // pills and the amount. Visual size is still 26 × 26; hitSlop on the
  // TouchableOpacity stretches the actual tap zone to ~58 × 58 so it's easy
  // to hit without colliding with the COD/PAID pills or the amount text.
  checkBoxFoot: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkBoxOn: { backgroundColor: '#08081c', borderColor: '#08081c' },
  checkTick: { color: '#FCD34D', fontSize: 15, fontWeight: '900', marginTop: -1, lineHeight: 17 },

  person: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  avt: { width: 30, height: 30, borderRadius: 15, resizeMode: 'cover', marginRight: 10 },
  name: { fontSize: 13.5, fontWeight: '700', color: '#1E293B' },
  phone: { fontSize: 11.5, fontWeight: '500', color: '#94A3B8', marginTop: 1 },
  actBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  actIco: { width: 28, height: 28, resizeMode: 'contain' },
  dsCall: { marginLeft: 6, alignSelf: 'flex-start', marginTop: 2, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  dsCallIco: { width: 28, height: 28, resizeMode: 'contain' },

  routeWrap: { marginHorizontal: 12, paddingTop: 12, paddingBottom: 10 },
  routeWrapDark: {},
  routeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  routeTl: { width: 14, alignItems: 'center', marginRight: 8, paddingTop: 3 },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  routeLine: { width: 1.5, flex: 1, minHeight: 10, backgroundColor: '#D1D5DB', marginTop: 3, marginBottom: 0 },
  routeBody: { flex: 1, paddingBottom: 10 },
  routeLbl: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
  routeTitle: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  routePhone: { fontSize: 11, fontWeight: '500', color: '#94A3B8', marginTop: 1 },
  routeAddr: { fontSize: 12, fontWeight: '400', color: '#64748B', lineHeight: 16, marginTop: 1 },

  foot: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FAFBFC' },
  footDark: { backgroundColor: 'rgba(255,255,255,0.05)', borderTopColor: 'rgba(255,255,255,0.15)' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginRight: 6 },
  pillT: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.3 },
  amt: { fontSize: 16, fontWeight: '800', color: '#16A34A' },
});
