// Screens/OrderDetailsScreen.js
import React, { Component } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  UIManager,
  LayoutAnimation,
  Image,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import constants from './constants';

Ionicons.loadFont?.();

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const C = {
  green: '#0F7451',
  bg: '#F3F5F7',
  card: '#FFFFFF',
  text: '#111827',
  sub: '#6B7280',
  line: '#E5E7EB',
  border: '#D7DEE6',
  badgeRed: '#EF4444',

  warnBg: '#FFF7ED',
  warnText: '#9A3412',

  okBg: '#ECFDF5',
  okText: '#065F46',

  blueBg: '#EFF6FF',
  blueText: '#1D4ED8',
};

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const toTitle = (s) => {
  const str = String(s || '').replace(/_/g, ' ').trim();
  if (!str) return '';
  return str
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const formatDateLabel = (s) => {
  const raw = String(s || '').trim();
  if (!raw) return '';
  const iso = raw.replace(' ', 'T');
  const d = new Date(iso);
  if (isNaN(d.getTime())) return raw;
  try {
    return d.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return raw;
  }
};

const mapStatus = (order_status) => {
  const s = String(order_status || '').toUpperCase();

  if (s === 'PENDING') return { label: 'Pending', tone: 'warn' };
  if (s === 'DELIVERED') return { label: 'Delivered', tone: 'ok' };
  if (s === 'CANCELLED') return { label: 'Cancelled', tone: 'cancelled' };
  if (s === 'RTO') return { label: 'RTO', tone: 'rto' };

  if (s === 'RESCHEDULE') return { label: 'Reschedule', tone: 'reschedule' };
  if (s === 'PICKUP') return { label: 'Pickup', tone: 'pickup' };
  if (s === 'PICKUPCANCELLED') return { label: 'Pickup Cancelled', tone: 'pickupcancelled' };
  if (s === 'REJECTED') return { label: 'Rejected', tone: 'rejected' };
  if (s === 'INTRANSIT') return { label: 'In Transit', tone: 'intransit' };

  return { label: s || 'Pending', tone: 'warn' };
};

export default class OrderDetails extends Component {
  constructor(props) {
    super(props);

    const orderFromNav = this.props?.navigation?.getParam?.('order') || null;
    const orderIdFromNav =
      this.props?.navigation?.getParam?.('orderId') ||
      orderFromNav?.id ||
      this.props?.route?.params?.orderId ||
      orderFromNav?.id ||
      null;

    this.state = {
      expandedProducts: true,
      expandedBilling: false,
      expandedShipping: true,
      expandedMeta: false,

      isLoading: false,
      order: orderFromNav,
      orderId: orderIdFromNav ? String(orderIdFromNav) : '',
    };
  }

  componentDidMount() {
    this.fetchOrderDetails()
  }

  fetchOrderDetails() {
    const orderId = String(this.state.orderId || '').trim();
    if (!orderId) return;

    this.setState({ isLoading: true });

    const form = new FormData();
    form.append('order_id', orderId);

    const url = String(constants.orderDetail || '').replace(/\/$/, '') + '/' + encodeURIComponent(orderId);

    console.log('OrderDetails API Request:', { url, order_id: orderId });
     
    console.log("token== ",token) 

    fetch(url, {
      headers: {
        'X-localization': 'en',
        Authorization: 'Bearer ' + global.token,
        'Accept' : 'application/json'
      },
      method: 'POST',
      body: form,
    })
     .then((r) => r.json())
        .then((res) => {
        console.log('OrderDetails API Response:', res);
        const od = res?.order || res?.data?.order || null;
        this.setState({ isLoading: false, order: od || null },()=> console.log("od== ",od));
        })
        .catch((e) => {
        console.log('OrderDetails API Error:', e);
        this.setState({ isLoading: false });
        });
  }

  updateOrderStatus(status) {
    const orderId = String(this.state.orderId || this.state?.order?.id || '').trim();
    if (!orderId) return;

    const form = new FormData();
    form.append('order_id', orderId);
    form.append('status', String(status || '').trim());

    console.log('UpdateOrderStatus API Request:', { url: constants.updateStatus, order_id: orderId, status });

    this.setState({ isLoading: true });

    fetch(constants.updateStatus, {
      headers: {
        'X-localization': 'en',
        Authorization: 'Bearer ' + global.token,
      },
      method: 'POST',
      body: form,
    })
      .then(async (r) => {
        const text = await r.text();
        console.log('UpdateOrderStatus API Raw Response:', text);
        try {
          return JSON.parse(text);
        } catch (e) {
          return { raw: text };
        }
      })
      .then((res) => {
        console.log('UpdateOrderStatus API Response:', res);
        this.setState({ isLoading: false }, () => {
          this.fetchOrderDetails();
        });
      })
      .catch((e) => {
        console.log('UpdateOrderStatus API Error:', e);
        this.setState({ isLoading: false });
      });
  }

  onBack = () => this.props?.navigation?.goBack?.();

  onConfirm = () => {
    Alert.alert('Confirm', 'Are you sure you want to confirm this order?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', onPress: () => this.updateOrderStatus('CONFIRM') },
    ]);
  };

  onCancel = () => {
    Alert.alert('Cancel', 'Are you sure you want to cancel this order?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', onPress: () => this.updateOrderStatus('CANCEL') },
    ]);
  };

  toggle = (k) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    this.setState((p) => ({ [k]: !p[k] }));
  };

  statusChipStyle(tone) {
    if (tone === 'warn') return [styles.chip, styles.chipWarn, styles.chipTextWarn];
    if (tone === 'ok') return [styles.chip, styles.chipOk, styles.chipTextOk];
    if (tone === 'rto') return [styles.chip, styles.chipRto, styles.chipTextRto];
    if (tone === 'pickup') return [styles.chip, styles.chipPickup, styles.chipTextPickup];
    if (tone === 'intransit') return [styles.chip, styles.chipIntransit, styles.chipTextIntransit];
    if (tone === 'rejected') return [styles.chip, styles.chipRejected, styles.chipTextRejected];
    if (tone === 'pickupcancelled') return [styles.chip, styles.chipPickupCancelled, styles.chipTextPickupCancelled];
    if (tone === 'reschedule') return [styles.chip, styles.chipReschedule, styles.chipTextReschedule];
    if (tone === 'cancelled') return [styles.chip, styles.chipCancelled, styles.chipTextCancelled];
    return [styles.chip, styles.chipBlue, styles.chipTextBlue];
  }

  renderHeader() {
    const o = this.state.order || {};
    const code = String(o?.code || '') || `#${String(o?.id || this.state.orderId || '--')}`;
    const statusMap = mapStatus(o?.order_status);

    const [chipStyle, chipBgStyle, chipTextStyle] = this.statusChipStyle(statusMap.tone);

    return (
      <View style={styles.headerWrap}>
        <SafeAreaView style={styles.headerSafe} />
        <StatusBar backgroundColor={C.green} barStyle="light-content" />

        <View style={styles.headerRow}>
          <TouchableOpacity onPress={this.onBack} activeOpacity={0.85} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1, paddingHorizontal: 8 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Order Details
            </Text>
            <View style={styles.headerSubRow}>
              <Text style={styles.headerSubText} numberOfLines={1}>
                {code}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
            <View style={[chipStyle, chipBgStyle]}>
              <Text style={[styles.chipText, chipTextStyle, { color: '#000' }]}>{statusMap.label}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  renderHeroCard() {
    const o = this.state.order || {};
    const ship = o?.shipping_address || {};
    const customer = String(ship?.name || '');
    const phone = String(ship?.phone || ship?.mobile || o?.phone || '');
    const addressLine = String(
      ship?.address || ship?.address1 || ship?.street || ship?.city || ship?.state || ship?.pincode || ''
    );

    const created = formatDateLabel(o?.created_at);
    const payment = toTitle(o?.payment_type);
    const itemsCount = Number(o?.sum_quantity || 0);
    const amount = Number(o?.grand_total || 0);

    const thumbUri = String(o?.first_product_image || '');
    const otp = String(o?.otp || '').trim();

    return (
      <View style={styles.cardOuter}>
        <View style={styles.card}>
          <View style={styles.heroTop}>
            <View style={styles.heroThumb}>
              {thumbUri ? (
                <Image source={{ uri: thumbUri }} style={styles.heroThumbImg} />
              ) : (
                <Ionicons name="cart-outline" size={24} color={C.green} />
              )}
            </View>

            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.heroName} numberOfLines={1}>
                {customer || '--'}
              </Text>

              <Text style={styles.heroMeta} numberOfLines={1}>
                {addressLine || '--'}
              </Text>

              <Text style={styles.heroSub} numberOfLines={1}>
                {String(itemsCount || 0)} Items • {payment || '--'} • {created || '--'}
              </Text>

              {otp ? (
                <Text style={[styles.heroSub, { marginTop: 4 }]} numberOfLines={1}>
                  OTP • {otp}
                </Text>
              ) : null}
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.heroAmount}>{money(amount)}</Text>

              
            </View>
          </View>

          <View style={styles.heroLine} />

          <View style={styles.quickRow}>
            <View style={styles.quickItem}>
              <Image style={{ height: 23, width: 23 }} source={require('./assets/bag2.png')} />
              <Text style={styles.quickText} numberOfLines={1}>
                {String(o?.code || o?.id || '--')}
              </Text>
            </View>

            <View style={styles.quickItem}>
              <Image style={{ height: 23, width: 23 }} source={require('./assets/bag3.png')} />
              <Text style={styles.quickText} numberOfLines={1}>
                {String(o?.order_status || '--')}
              </Text>
            </View>

            <View style={styles.quickItem}>
              <Image style={{ height: 23, width: 23 }} source={require('./assets/money.png')} />
              <Text style={styles.quickText} numberOfLines={1}>
                {payment || '--'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  renderSection(title, iconName, expandedKey, body) {
    const expanded = !!this.state[expandedKey];

    return (
      <View style={styles.cardOuter}>
        <View style={styles.card}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => this.toggle(expandedKey)} style={styles.sectionHead}>
            <View style={styles.sectionLeft}>
              <View style={styles.sectionIconWrap}>
                <Ionicons name={iconName} size={16} color={C.green} />
              </View>
              <Text style={styles.sectionTitle}>{title}</Text>
            </View>

            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={C.green} />
          </TouchableOpacity>

          {expanded ? (
            <View style={styles.sectionBody}>
              <View style={{ marginTop: title == 'Products' ? 0 : 10 }}>{body}</View>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  renderProducts() {
    const o = this.state.order || {};
    const products = Array.isArray(o?.products) ? o.products : [];

    const header = (
      <View style={styles.expandHeader}>
        <Text style={[styles.expandHeadText, { flex: 1.25 }]}>Product</Text>
        <Text style={[styles.expandHeadText, { flex: 0.45, textAlign: 'center' }]}>Qty</Text>
        <Text style={[styles.expandHeadText, { flex: 0.55, textAlign: 'right' }]}>Price</Text>
      </View>
    );

    const rows = products.map((x, idx) => {
      const name = String(x?.name || '');
      const qty = Number(x?.quantity || 0);
      const price = x?.price == null ? null : Number(x?.price || 0);
      const img = String(x?.thumbnail_img || x?.image || '');

      return (
        <View key={`${String(o?.id || 'o')}_${idx}`} style={styles.expandRow}>
          <View style={styles.expandLeft}>
            <View style={styles.expandImgBox}>
              {img ? (
                <Image source={{ uri: img }} style={styles.expandImg} />
              ) : (
                <Ionicons name="image-outline" size={16} color="#9CA3AF" />
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.expandName} numberOfLines={1}>
                {name || '--'}
              </Text>
            </View>
          </View>

          <Text style={[styles.expandQty, { flex: 0.45 }]} numberOfLines={1}>
            {String(qty || 0)}
          </Text>

          <Text style={[styles.expandPrice, { flex: 0.55 }]} numberOfLines={1}>
            {price == null ? '--' : money(price)}
          </Text>
        </View>
      );
    });

    const subtotal =
      o?.subtotal != null
        ? Number(o?.subtotal || 0)
        : products.reduce((sum, p) => sum + Number(p?.price || 0) * Number(p?.quantity || 0), 0);

    const shipping = o?.shipping_cost != null ? Number(o?.shipping_cost || 0) : Number(o?.shipping || 0);
    const discount = o?.discount != null ? Number(o?.discount || 0) : Number(o?.coupon_discount || 0);
    const total = o?.grand_total != null ? Number(o?.grand_total || 0) : subtotal + shipping - discount;

    const totals = (
      <View style={styles.totalsWrap}>
        <View style={styles.kvRow}>
          <Text style={styles.kvKey}>Subtotal</Text>
          <Text style={styles.kvVal}>{money(subtotal)}</Text>
        </View>
        <View style={styles.kvRow}>
          <Text style={styles.kvKey}>Discount</Text>
          <Text style={styles.kvVal}>{discount ? `- ${money(discount)}` : '₹0'}</Text>
        </View>
        <View style={styles.kvLine} />
        <View style={styles.kvRow}>
          <Text style={styles.kvKeyBold}>Total</Text>
          <Text style={styles.kvValBold}>{money(total)}</Text>
        </View>
      </View>
    );

    return (
      <View>
        {header}
        {rows.length ? rows : <Text style={styles.emptyMini}>No products</Text>}
        {totals}
      </View>
    );
  }

  renderShipping() {
    const o = this.state.order || {};
    const ship = o?.shipping_address || {};

    const name = String(ship?.name || '');
    const phone = String(ship?.phone || ship?.mobile || o?.phone || '');
    const address = String(ship?.address || ship?.address1 || ship?.street || '');
    const city = String(ship?.city || '');
    const state = String(ship?.state || '');
    const pincode = String(ship?.pincode || ship?.zip || '');
    const landmark = String(ship?.landmark || '');

    const fullAddress = [address, landmark, city, state, pincode].filter(Boolean).join(', ');

    return (
      <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
        <View style={styles.addrCard}>
          <View style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.addrName} numberOfLines={1}>
                {name || '--'}
              </Text>

              <Text style={styles.addrText}>{phone || '--'}</Text>
            </View>
            <Text style={styles.addrText}>{fullAddress || '--'}</Text>
          </View>

          {phone ? (
            <View style={styles.addrActions}>
              <TouchableOpacity activeOpacity={0.9} onPress={() => Linking.openURL(`tel:${phone}`)}>
                <Image style={{ height: 30, width: 30, tintColor: '#F68A20' }} source={require('./assets/call2.png')} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  renderBilling() {
    const o = this.state.order || {};
    const payment = toTitle(o?.payment_type);
    const paid = toTitle(o?.payment_status || o?.paid_status);

    const txn = String(o?.transaction_id || o?.txn_id || o?.razorpay_payment_id || '');
    const utr = String(o?.utr || o?.utr_number || '');
    const note = String(o?.payment_note || '');

    return (
      <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
        <View style={styles.metaBox}>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Payment Type</Text>
            <Text style={styles.kvVal}>{payment || '--'}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Payment Status</Text>
            <Text style={styles.kvVal}>{paid || '--'}</Text>
          </View>
          {txn ? (
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Transaction ID</Text>
              <Text style={styles.kvVal}>{txn}</Text>
            </View>
          ) : null}
          {utr ? (
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>UTR</Text>
              <Text style={styles.kvVal}>{utr}</Text>
            </View>
          ) : null}
          {note ? (
            <View style={[styles.kvRow, { alignItems: 'flex-start' }]}>
              <Text style={styles.kvKey}>Note</Text>
              <Text style={[styles.kvVal, { flex: 1, textAlign: 'right' }]}>{note}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  renderMeta() {
    const o = this.state.order || {};
    const created = formatDateLabel(o?.created_at);
    const updated = formatDateLabel(o?.updated_at);
    const delivery = formatDateLabel(o?.delivered_at || o?.delivery_time);
    const code = String(o?.code || o?.id || '');

    const retailerId = String(o?.retailer_id || o?.retailerId || '');

    return (
      <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
        <View style={styles.metaBox}>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Order Code</Text>
            <Text style={styles.kvVal}>{code || '--'}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Retailer ID</Text>
            <Text style={styles.kvVal}>{retailerId || '--'}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Created</Text>
            <Text style={styles.kvVal}>{created || '--'}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Updated</Text>
            <Text style={styles.kvVal}>{updated || '--'}</Text>
          </View>
          {delivery ? (
            <View style={styles.kvRow}>
              <Text style={styles.kvKey}>Delivered</Text>
              <Text style={styles.kvVal}>{delivery}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  renderBottomActions() {
    return (
      <View style={styles.bottomBar}>
        <TouchableOpacity onPress={this.onCancel} style={[styles.bottomBtn, styles.bottomBtnNav]}>
          <Ionicons name="close-circle-outline" size={19} color="#fff" />
          <Text style={styles.bottomBtnText}>Cancel</Text>
        </TouchableOpacity> 
        <TouchableOpacity onPress={this.onConfirm} style={[styles.bottomBtn, styles.bottomBtnCall]}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
          <Text style={styles.bottomBtnText}>Confirm</Text>
        </TouchableOpacity>
      </View>
    );
  }

  render() {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {this.renderHeader()}

        <ScrollView contentContainerStyle={{ paddingBottom: 18 + 120 }} showsVerticalScrollIndicator={false}>
          {this.state.isLoading ? (
            <View style={{ paddingTop: 20 }}>
              <ActivityIndicator size="small" color={C.green} />
            </View>
          ) : null}

          {this.state.order ? (
            <View>
              {this.renderHeroCard()}
              {this.renderSection('Products', 'cube-outline', 'expandedProducts', this.renderProducts())}
              {/* {this.renderSection('Shipping', 'location-outline', 'expandedShipping', this.renderShipping())} */}
              {this.renderSection('Billing', 'cash-outline', 'expandedBilling', this.renderBilling())}
              {this.renderSection('Order Info', 'information-circle-outline', 'expandedMeta', this.renderMeta())}
            </View>
          ) : (
            <View style={{ paddingHorizontal: 14, paddingTop: 40, alignItems: 'center' }}>
              <Ionicons name="receipt-outline" size={80} color="#9CA3AF" />
              <Text style={{ marginTop: 10, color: '#6B7280', fontSize: 13, fontWeight: '400', textAlign: 'center' }}>
                Order not found
              </Text>
              <TouchableOpacity activeOpacity={0.9} onPress={() => this.fetchOrderDetails()} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

       {String(this.state?.order?.order_status || '').toUpperCase() === 'PENDING' && this.renderBottomActions()}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  headerWrap: { backgroundColor: C.green },
  headerSafe: { backgroundColor: C.green },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10 },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  headerSubText: { color: '#D1FAE5', fontSize: 12, fontWeight: '500' },

  cardOuter: { paddingHorizontal: 14, marginTop: 12 },
  card: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1.1, borderColor: '#E5E7EB', overflow: 'hidden' },

  heroTop: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  heroThumb: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroThumbImg: { width: '100%', height: '100%', resizeMode: 'cover' },

  heroName: { color: C.text, fontSize: 13, fontWeight: '700' },
  heroMeta: { marginTop: 5, color: C.sub, fontSize: 12, fontWeight: '400' },
  heroSub: { color: C.sub, fontSize: 12, fontWeight: '400', marginTop: 5 },
  heroAmount: { color: C.text, fontSize: 15, fontWeight: '600' },

  callPill: {
    padding: 10,
  },
  callPillText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  heroLine: { height: 1, backgroundColor: C.line },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  quickItem: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#ebf1f9',
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  quickText: { color: C.text, fontSize: 10, fontWeight: '500', marginLeft: 3 },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { color: C.text, fontSize: 13, fontWeight: '700' },
  sectionBody: { borderTopWidth: 1, borderTopColor: C.line, backgroundColor: '#fff' },

  expandHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F3F4F6' },
  expandHeadText: { color: '#374151', fontSize: 12, fontWeight: '400' },
  expandRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.line },
  expandLeft: { flex: 1.25, flexDirection: 'row', alignItems: 'center', paddingRight: 10 },
  expandImgBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  expandImg: { width: '100%', height: '100%', resizeMode: 'cover' },

  expandName: { color: C.text, fontSize: 12, fontWeight: '600' },
  expandQty: { textAlign: 'center', color: C.text, fontSize: 12, fontWeight: '600' },
  expandPrice: { textAlign: 'right', color: C.text, fontSize: 12, fontWeight: '600' },

  totalsWrap: { paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fff' },
  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 },
  kvKey: { color: C.sub, fontSize: 12, fontWeight: '400' },
  kvVal: { color: C.text, fontSize: 12, fontWeight: '600' },
  kvLine: { height: 1, backgroundColor: C.line, marginVertical: 8 },
  kvKeyBold: { color: C.text, fontSize: 13, fontWeight: '700' },
  kvValBold: { color: C.text, fontSize: 13, fontWeight: '700' },

  metaBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  addrCard: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 16,
    paddingHorizontal: 5,
    paddingVertical: 0,
  },
  addrName: { color: C.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  addrText: { marginTop: 4, color: C.sub, fontSize: 12, fontWeight: '400', lineHeight: 16, marginTop: 7 },
  addrActions: { flexDirection: 'row', gap: 10, marginTop: 12 },

  addrBtn: { flex: 1, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, paddingHorizontal: 14 },
  addrBtnMap: { backgroundColor: '#273446' },
  addrBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  chipText: { fontSize: 10, fontWeight: '600' },

  chipWarn: { backgroundColor: '#edbf4b' },
  chipTextWarn: { color: '#FFFFFF' },

  chipOk: { backgroundColor: '#229b79' },
  chipTextOk: { color: '#FFFFFF' },

  chipBlue: { backgroundColor: '#3B82F6' },
  chipTextBlue: { color: '#FFFFFF' },

  chipCancelled: { backgroundColor: '#e55866' },
  chipTextCancelled: { color: '#FFFFFF' },

  chipRto: { backgroundColor: '#EF4444' },
  chipTextRto: { color: '#FFFFFF' },

  chipPickup: { backgroundColor: '#8B5CF6' },
  chipTextPickup: { color: '#FFFFFF' },

  chipIntransit: { backgroundColor: '#0EA5E9' },
  chipTextIntransit: { color: '#FFFFFF' },

  chipRejected: { backgroundColor: '#111827' },
  chipTextRejected: { color: '#FFFFFF' },

  chipPickupCancelled: { backgroundColor: '#F97316' },
  chipTextPickupCancelled: { color: '#FFFFFF' },

  chipReschedule: { backgroundColor: '#14B8A6' },
  chipTextReschedule: { color: '#FFFFFF' },

  emptyMini: { padding: 12, textAlign: 'center', color: C.sub, fontSize: 12, fontWeight: '400' },

  retryBtn: { marginTop: 12, height: 44, paddingHorizontal: 18, borderRadius: 16, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 25,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: C.line,
    flexDirection: 'row',
    gap: 8,
  },
  bottomBtn: {
    height: 45,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
  },
  bottomBtnCall: { flex: 1, backgroundColor: C.green },
  bottomBtnNav: { flex: 1, backgroundColor: C.badgeRed },
  bottomBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});