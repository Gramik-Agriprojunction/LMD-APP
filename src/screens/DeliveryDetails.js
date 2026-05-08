// DeliveryDetails.js
import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Image,
  ActivityIndicator,
  Linking,
  Animated,
  Dimensions,
  Modal,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import ShimmerLoader from '../components/ShimmerLoader';
import constants from '../utils/constants';
import BottomSheet from '../components/BottomSheet';
import Toast from 'react-native-simple-toast';
import { NavigationEvents, withV4Navigation } from '../utils/v4Compat';

class DeliveryDetails extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: false,
      refreshing: false,
      details: null,
      hasError: false,

      show_pickup_confirm: false,
      popup_type: '',

      // cancel reasons
      reasonsLoading: false,
      cancelReasons: {}, // {key: label}
      selectedCancelReason: '',

      // reject reasons
      rejectReasonsLoading: false,
      rejectReasons: {}, // {key: label}
      selectedRejectReason: '',

      // ✅ Payment UI state (added)
      payment_type: 'cash',
      qr: '',
      qrLoading: false,
      qrFailed: false,
      qrErrorText: '',
      qrModalVisible: false,
    };

    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    this.fadeAnim = new Animated.Value(0);
    this.slideAnim = new Animated.Value(24);
    this.pickupPulse = new Animated.Value(1);
  }

  mask = (p) => { if (!p) return ''; const s = String(p); if (s.length < 6) return s; return s.slice(0,2) + '****' + s.slice(-2); };

  startPickupPulse = () => {
    const run = () => {
      Animated.sequence([
        Animated.timing(this.pickupPulse, { toValue: 1.03, duration: 800, useNativeDriver: true }),
        Animated.timing(this.pickupPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]).start(() => run());
    };
    run();
  };

  getOrder = () => this.props?.navigation?.getParam('order', null);

  componentDidMount() {
    const order = this.getOrder();
    const id = order?.id;

    if (id) this.deliverDetailsAPI(id);
    else console.log('DeliveryDetails: navigation order.id missing');

    this.cancelReasonsApi();
    this.rejectReasonsApi();
  }

  goBack = () => {
    const nav = this.props?.navigation;
    if (nav?.goBack) nav.goBack();
  };

  onRefresh = () => {
    const order = this.getOrder();
    const id = order?.id;
    if (id) {
      this.setState({ refreshing: true });
      this.deliverDetailsAPI(id);
    }
  };

  deliverDetailsAPI = (id) => {
    const body = { order_id: String(id) };

    this.setState({ isLoading: true, hasError: false });
    console.log('Order Details API payload== ', body);

    fetch(constants.orderDetails, {
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
        console.log('Order Details API response== ', JSON.stringify(json));
        this.setState({ isLoading: false, refreshing: false });

        if (json?.status && json?.order) {
          this.fadeAnim.setValue(0);
          this.slideAnim.setValue(24);
          this.setState({ details: json.order }, () => {
            const oid = json?.order?.id;
            if (oid) this.getQR(oid);
            Animated.parallel([
              Animated.timing(this.fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
              Animated.timing(this.slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
            ]).start(() => this.startPickupPulse());
          });
        } else {
          this.setState({ details: null, hasError: true });
          console.log('Order Details API error== ', json?.message || 'Invalid response');
        }
      })
      .catch((e) => {
        console.log('Order Details API error== ', e);
        this.setState({ isLoading: false, refreshing: false, details: null, hasError: true });
      });
  };

  // ✅ Cancel reasons API (GET)
  cancelReasonsApi = () => {
    this.setState({ reasonsLoading: true }, () => {
      fetch(constants.cancelReasons, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + global.token,
          Accept: 'application/json',
        },
      })
        .then((response) => response.json())
        .then((responseJson) => {
          console.log('Cancel Reasons API response== ', JSON.stringify(responseJson));
          this.setState({ reasonsLoading: false });
          if (responseJson?.status) {
            this.setState({ cancelReasons: responseJson?.data || {} });
          }
        })
        .catch((error) => {
          console.log('Cancel Reasons API error== ', error);
          this.setState({ reasonsLoading: false });
        });
    });
  };

  // ✅ Reject reasons API (GET)
  rejectReasonsApi = () => {
    this.setState({ rejectReasonsLoading: true }, () => {
      fetch(constants.rejectReasons, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + global.token,
          Accept: 'application/json',
        },
      })
        .then((response) => response.json())
        .then((responseJson) => {
          console.log('Reject Reasons API response== ', JSON.stringify(responseJson));
          this.setState({ rejectReasonsLoading: false });
          if (responseJson?.status) {
            this.setState({ rejectReasons: responseJson?.data || {} });
          }
        })
        .catch((error) => {
          console.log('Reject Reasons API error== ', error);
          this.setState({ rejectReasonsLoading: false });
        });
    });
  };

  // ✅ Cancel reason list UI
  renderCancelReasons = () => {
    const { cancelReasons, selectedCancelReason, reasonsLoading } = this.state;

    if (reasonsLoading) {
      return <ActivityIndicator style={{ marginTop: 12 }} size="small" color="#5D3FD3" />;
    }

    const keys = Object.keys(cancelReasons || {});
    if (!keys.length) {
      return (
        <Text style={{ textAlign: 'center', marginTop: 12, color: '#6B7280', fontWeight: '700' }}>
          No cancel reasons found
        </Text>
      );
    }

    return keys.map((k) => {
      const label = cancelReasons[k];
      const selected = selectedCancelReason === k;
      return (
        <TouchableOpacity
          key={k}
          activeOpacity={0.7}
          onPress={() => {
            LayoutAnimation.configureNext({
              duration: 250,
              create: { type: 'easeInEaseOut', property: 'opacity' },
              update: { type: 'spring', springDamping: 0.8 },
              delete: { type: 'easeInEaseOut', property: 'opacity' },
            });
            this.setState({ selectedCancelReason: k });
          }}
          style={[styles.reasonRow, selected && styles.reasonRowActive]}
        >
          <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
            {selected ? <View style={styles.radioInner} /> : null}
          </View>
          <Text style={[styles.reasonText, selected && styles.reasonTextActive]}>{label}</Text>
        </TouchableOpacity>
      );
    });
  };

  // ✅ Reject reason list UI
  renderRejectReasons = () => {
    const { rejectReasons, selectedRejectReason, rejectReasonsLoading } = this.state;

    if (rejectReasonsLoading) {
      return <ActivityIndicator style={{ marginTop: 12 }} size="small" color="#5D3FD3" />;
    }

    const keys = Object.keys(rejectReasons || {});
    if (!keys.length) {
      return (
        <Text style={{ textAlign: 'center', marginTop: 12, color: '#6B7280', fontWeight: '700' }}>
          No reject reasons found
        </Text>
      );
    }

    return keys.map((k) => {
      const label = rejectReasons[k];
      const selected = selectedRejectReason === k;
      return (
        <TouchableOpacity
          key={k}
          activeOpacity={0.7}
          onPress={() => {
            LayoutAnimation.configureNext({
              duration: 250,
              create: { type: 'easeInEaseOut', property: 'opacity' },
              update: { type: 'spring', springDamping: 0.8 },
              delete: { type: 'easeInEaseOut', property: 'opacity' },
            });
            this.setState({ selectedRejectReason: k });
          }}
          style={[styles.reasonRow, selected && styles.reasonRowActive]}
        >
          <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
            {selected ? <View style={styles.radioInner} /> : null}
          </View>
          <Text style={[styles.reasonText, selected && styles.reasonTextActive]}>{label}</Text>
        </TouchableOpacity>
      );
    });
  };

  // ---------- ACTIONS ----------
  onCall = async () => {
    const phoneRaw = this.state?.details?.farmer_data?.phone;
    if (!phoneRaw) return console.log('farmer_data.phone missing');

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
    if (!phoneRaw) return console.log('farmer_data.phone missing');

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

  onPickUp() {
    this.setState({ show_pickup_confirm: true });
  }

  toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  getStatusColors = (statusRaw) => {
    const s = String(statusRaw || '').toLowerCase();
    if (s === 'pending') return { bg: '#EA580C', text: '#FFF' };
    if (s === 'pickup' || s === 'pickedup' || s === 'picked_up') return { bg: '#7C3AED', text: '#FFF' };
    if (s === 'delivered' || s === 'deliver') return { bg: '#16A34A', text: '#FFF' };
    if (s === 'intransit' || s === 'in_transit') return { bg: '#2563EB', text: '#FFF' };
    if (s === 'reschedule') return { bg: '#7C3AED', text: '#FFF' };
    if (s === 'cancelled' || s === 'canceled') return { bg: '#DC2626', text: '#FFF' };
    if (s === 'rto') return { bg: '#DC2626', text: '#FFF' };
    return { bg: '#475569', text: '#FFF' };
  };

  openSurvey = () => {
    this.props?.navigation?.navigate('Survey', { order_data: this.state?.details });
  };

  orderStatusApi(status, cancelReasonKey = '') {
    const body = {
      status: status == 'deliver' ? 'delivered' : status,
      order_id: this.state.details?.id,
      type: '',
      reason: cancelReasonKey || '',
    };

    this.setState({ isLoading: true }, () => {
      console.log('Update Status API payload== ', body);

      fetch(constants.updateStatus, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + global.token,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      })
        .then((response) => response.json())
        .then((responseJson) => {
          console.log('Update Status API response== ', JSON.stringify(responseJson));
          this.setState({ isLoading: false });
          Toast.show(responseJson.message, Toast.SHORT);
          if (responseJson.status) {
            this.deliverDetailsAPI(this.state.details?.id);
            this.setState({ show_pickup_confirm: false, selectedCancelReason: '', selectedRejectReason: '' });
          }
        })
        .catch((error) => {
          console.log('Update Status API error== ', error);
          this.setState({ isLoading: false, order_list: [] });
        });
    });
  }

  maskPhone = (phoneRaw) => {
    if (!phoneRaw) return '';

    const raw = String(phoneRaw).trim();
    const hasPlus = raw.startsWith('+');
    let digits = raw.replace(/[^\d]/g, '');

    let cc = '';
    if (hasPlus && digits.length > 10) {
      cc = digits.slice(0, digits.length - 10);
      digits = digits.slice(-10);
    }

    if (digits.length < 5) return (hasPlus ? '+' : '') + (cc ? cc : '') + '***';

    const first3 = digits.slice(0, 3);
    const last2 = digits.slice(-2);
    const masked = first3 + '*'.repeat(Math.max(0, digits.length - 5)) + last2;

    return (hasPlus ? '+' : '') + (cc ? cc : '') + masked;
  };

  // ✅ Payment helpers (added)
  isAlreadyPaid = (order) => {
    const ps = String(order?.payment_status || '').toLowerCase();
    const pm = String(order?.payment_mode || '').toLowerCase();
    return ps === 'paid' && pm && pm !== 'cod' && pm !== 'cash';
  };

  onCollectCash = () => {
    this.setState({ payment_type: 'cash' });
  };

  onScanQR = () => {
    this.setState({ payment_type: 'qr' });
    if (this.state.qr) this.setState({ qrModalVisible: true });
  };

  getQR = (id) => {
    this.setState({ qrLoading: true, qrFailed: false, qrErrorText: '' });

    const url = `${constants.getQR}${id}`;
    console.log('Get QR API payload== ', url);

    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + global.token,
        Accept: 'application/json',
      },
    })
      .then((r) => r.json())
      .then((json) => {
        console.log('Get QR API response== ', JSON.stringify(json));
        const qrUrl = json?.qr_image_url || '';
        console.log('qr_image_url =>', qrUrl);

        if (Platform.OS === 'ios' && qrUrl?.startsWith('http://')) {
          console.log('⚠️ iOS ATS: QR URL is HTTP. It may not load unless ATS allows it.');
        }

        this.setState({
          qrLoading: false,
          qr: qrUrl,
          qrFailed: !qrUrl,
          qrErrorText: !qrUrl ? 'QR url missing' : '',
        });
      })
      .catch((e) => {
        console.log('Get QR API error== ', e);
        this.setState({ qrLoading: false, qr: '', qrFailed: true, qrErrorText: String(e) });
      });
  };

  getQrImageSource = () => {
    const { qr } = this.state;
    if (!qr) return null;
    return { uri: qr };
  };

  renderQrTile = () => {
    const { qr, qrLoading, qrFailed } = this.state;
    const source = this.getQrImageSource();

    return (
      <TouchableOpacity style={styles.payTile} onPress={this.onScanQR} activeOpacity={0.9}>
        <View style={[styles.payImg, { backgroundColor: '#E8F1FF' }]}>
          {qrLoading ? <ActivityIndicator size="small" color="#5D3FD3" /> : null}

          {!qrLoading && !!qr ? (
            <Image
              source={source}
              resizeMode="cover"
              style={styles.qrThumb}
              onError={(e) => {
                const msg = JSON.stringify(e?.nativeEvent || {});
                console.log('QR THUMB onError =>', msg);
                this.setState({ qrFailed: true, qrErrorText: msg });
              }}
            />
          ) : null}

          {!qrLoading && !qr && qrFailed ? (
            <View style={{ paddingHorizontal: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#E35335', textAlign: 'center' }}>
                QR not available
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.payFooterPrimary}>
          <Text style={styles.payTileText}>Scan QR Code</Text>
        </View>
      </TouchableOpacity>
    );
  };

  render() {
    const { isLoading, details, hasError } = this.state;

    const rawCode = details?.order_code || '';
    const orderIdText = rawCode.includes(' ') ? rawCode.split(' ')[0] : rawCode;
    const orderDate = details?.order_date || '';
    const totalItems = this.toNum(details?.total_items);

    const farmerName = details?.farmer_data?.name || '';
    const farmerAddress = details?.farmer_data?.address || '';
    const farmerFullAddress = details?.farmer_address || {};
    const total = this.toNum(details?.grand_total);
    const items = Array.isArray(details?.order_items) ? details.order_items : [];
    const darkStore = details?.dark_store || {};

    const isPaid = this.isAlreadyPaid(details);
    const paymentMode = details?.payment_mode || '';
    const paymentStatus = details?.payment_status || '';
    const codAmount = this.toNum(details?.cod_amount);

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#5D3FD3" />

        <NavigationEvents
          onWillFocus={() => {}}
          onDidFocus={() => {
            const id = this.state.details?.id || this.getOrder()?.id;
            if (id) this.deliverDetailsAPI(id);
          }}
        />

        <View style={styles.headerWrap}>
          <SafeAreaView style={styles.headerSafe}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={this.goBack} style={styles.headerIconBtn} activeOpacity={0.8}>
                <Image style={styles.backImg} source={require('./assets/back.png')} />
              </TouchableOpacity>

              <Text style={styles.headerTitle} numberOfLines={1}>
                Delivery Details
              </Text>

              <View style={{ width: 42, height: 42 }} />
            </View>
          </SafeAreaView>
        </View>

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={this.state.refreshing} onRefresh={this.onRefresh} />}>
          {isLoading ? (
            <ShimmerLoader />
          ) : null}

          {!isLoading && !details && hasError ? (
            <View style={styles.pageBox}>
              <Text style={styles.pageErrorText}>Unable to load details</Text>
            </View>
          ) : null}

          {details ? (
            <>
              {/* Hero Card — Order + Farmer + Payment */}
              <View style={styles.ddCard}>
                {/* Order header */}
                <View style={styles.ddHero}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ddOid}>#{orderIdText}</Text>
                    <Text style={styles.ddDate}>{orderDate || '-'}</Text>
                  </View>
                  {(() => {
                    const sc = this.getStatusColors(details?.order_status);
                    return <View style={[styles.ddChip, { backgroundColor: sc.bg }]}><Text style={styles.ddChipT}>{details?.order_status?.toUpperCase()}</Text></View>;
                  })()}
                </View>

                {/* Farmer */}
                <View style={styles.ddPerson}>
                  <Image source={require('./assets/farmer.png')} style={styles.ddAvt} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ddName}>{farmerName || '-'}</Text>
                    <Text style={styles.ddPhone}>{this.mask(details?.farmer_data?.phone)}</Text>
                  </View>
                  <TouchableOpacity onPress={this.onCall} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                    <Image source={require('./assets/call.png')} style={styles.ddIco} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={this.onWhatsApp} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}} style={{ marginLeft: 10 }}>
                    <Image source={require('./assets/whatsapp.png')} style={styles.ddIco} />
                  </TouchableOpacity>
                </View>

                {/* Payment row */}
                <View style={styles.ddPayRow}>
                  <View style={[styles.ddPill, { backgroundColor: '#475569' }]}><Text style={styles.ddPillT}>{paymentMode.toUpperCase() || '-'}</Text></View>
                  <View style={[styles.ddPill, { backgroundColor: paymentStatus === 'paid' ? '#16A34A' : '#B45309' }]}><Text style={styles.ddPillT}>{paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}</Text></View>
                  <View style={{ flex: 1 }} />
                  <Text style={styles.ddHeroAmt}>₹{codAmount}</Text>
                </View>
              </View>

              {/* Route: Pickup → Drop */}
              <View style={styles.ddCard}>
                <View style={styles.ddRoute}>
                  <View style={styles.ddRouteRow}>
                    <View style={styles.ddTl}><View style={[styles.ddDot, { backgroundColor: '#0DA60D' }]} /><View style={styles.ddLine} /></View>
                    <View style={styles.ddRouteBody}>
                      <Text style={[styles.ddRouteLbl, { color: '#0DA60D' }]}>Pickup</Text>
                      <Text style={styles.ddRouteTitle}>{darkStore?.name || '-'}</Text>
                      {darkStore?.mobile ? <Text style={styles.ddRoutePhone}>{darkStore.mobile}</Text> : null}
                      <Text style={styles.ddRouteAddr}>{darkStore?.location || `${darkStore?.city || ''}${darkStore?.pincode ? `, ${darkStore.pincode}` : ''}`}</Text>
                    </View>
                    {darkStore?.mobile ? (
                      <TouchableOpacity onPress={() => { const p = darkStore.mobile; if(p) Linking.openURL(`tel:${p}`).catch(()=>{}); }} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}} style={{ marginTop: 4 }}>
                        <Image source={require('./assets/call.png')} style={styles.ddIcoOrange} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={styles.ddRouteRow}>
                    <View style={styles.ddTl}><View style={[styles.ddDot, { backgroundColor: '#EF4444' }]} /></View>
                    <View style={[styles.ddRouteBody, { paddingBottom: 0 }]}>
                      <Text style={[styles.ddRouteLbl, { color: '#EF4444' }]}>Drop</Text>
                      <Text style={styles.ddRouteAddr}>
                        {farmerFullAddress?.address || farmerAddress}
                        {farmerFullAddress?.block ? `, ${farmerFullAddress.block}` : ''}
                        {farmerFullAddress?.city ? `, ${farmerFullAddress.city}` : ''}
                        {farmerFullAddress?.state ? `, ${farmerFullAddress.state}` : ''}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Delivery Slots */}
              {details?.delivery_slot?.length > 0 ? (
                <View style={styles.ddCard}>
                  <View style={{ padding: 12 }}>
                    <Text style={styles.ddInfoLabel}>Delivery Slots</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                      {details.delivery_slot.map((sl, i) => (
                        <View key={i} style={styles.ddSlot}>
                          <Text style={styles.ddSlotT}>{sl.label}: {sl.time}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Items */}
              <Text style={styles.ddSecTitle}>{`${totalItems || items.length || 0} Item(s)`}  <Text style={{ color: '#16A34A' }}>₹ {total}</Text></Text>
              {items.length ? items.map((it, idx) => (
                <View key={`${it?.variant_id || it?.product_id || idx}`} style={styles.ddCard}>
                  <View style={styles.ddItemRow}>
                    <View style={styles.ddItemImg}>
                      {it?.image ? <Image source={{ uri: it.image }} style={styles.ddProductImg} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ddItemName}>{String(it?.product_name || '-')}</Text>
                      <View style={styles.ddItemMeta}>
                        {it?.variation ? <View style={styles.ddItemVarPill}><Text style={styles.ddItemVar}>{it.variation}</Text></View> : null}
                        <Text style={styles.ddItemQty}>Qty: {this.toNum(it?.quantity)}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.ddItemPrice}>₹{this.toNum(it?.total_price || it?.price)}</Text>
                      {it?.price && it?.quantity > 1 ? <Text style={styles.ddItemUnit}>₹{this.toNum(it?.price)} each</Text> : null}
                    </View>
                  </View>
                </View>
              )) : <View style={styles.ddCard}><Text style={styles.emptyItemsText}>No items</Text></View>}

              {/* ✅ Payment / Collect Payment (added exactly like your UI) */}
              {/* <View style={[styles.card, { padding: 12 }]}>
                {isPaid ? (
                  <>
                    <Text style={styles.receiveTitle}>Payment</Text>

                    <View style={styles.methodRow}>
                      <View style={[styles.methodIcon, { backgroundColor: '#E7FAF3' }]}>
                        <Text style={{ fontSize: 22, fontWeight: '900', color: '#0F7451' }}>✓</Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={[styles.methodTitle, { color: '#0F7451' }]}>
                          {String(paymentStatus || 'Paid').toUpperCase()}
                        </Text>

                        {!!paymentMode ? (
                          <Text style={styles.methodSub}>{paymentMode}</Text>
                        ) : (
                          <Text style={styles.methodSub}>Online</Text>
                        )}
                      </View>
                    </View>

                    <View style={{ marginTop: 6 }}>
                      <Text style={{ color: '#6B7280', fontWeight: '700', fontSize: 12 }}>
                        Amount : ₹ {total}
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.receiveTitle}>Collect Payment</Text>

                    <View style={styles.methodRow}>
                      <View style={styles.methodIcon}>
                        <Image style={{ height: 30, width: 30, resizeMode: 'contain' }} source={require('./assets/crn.png')} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.methodTitle}>
                          {this.state.payment_type === 'cash' ? 'Collect Cash' : 'Scan QR Code'}
                        </Text>
                        <Text style={styles.methodSub}>{`₹ ${total}`}</Text>
                      </View>
                    </View>

                    <View style={styles.payTiles}>
                      <TouchableOpacity
                        style={[
                          styles.payTile,
                          {
                            borderWidth: this.state.payment_type == 'cash' ? 5 : 1,
                            borderColor: this.state.payment_type == 'cash' ? '#F37A20' : 'grey',
                          },
                        ]}
                        onPress={this.onCollectCash}
                        activeOpacity={0.9}
                      >
                        <View style={styles.payImg}>
                          <Image style={{ height: 80, width: 80 }} source={require('./assets/crn.png')} />
                        </View>
                        <View style={styles.payFooterPrimary}>
                          <Text style={styles.payTileText}>Collect Cash</Text>
                        </View>
                      </TouchableOpacity>

                      {this.renderQrTile()}
                    </View>
                  </>
                )}
              </View> */}

              <View style={{ height: 14 }} />
            </>
          ) : null}
        </ScrollView>

        {/* ✅ Bottom white actions panel */}
        <View style={styles.bottomPanel}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.codValue}>{`₹ ${this.toNum(details?.grand_total)}`}</Text>
          </View>

          {details?.order_status == 'delivered' ? (
            <View style={{ height: 48, borderRadius: 10, backgroundColor: '#F0FDF4', borderWidth: 1.5, borderColor: '#16A34A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>{'✓'}</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#16A34A' }}>Delivered</Text>
            </View>
          ) : null}

          {(details?.order_status == 'pending' || details?.order_status == 'reschedule') &&
          details?.order_status != 'cancelled' &&
          details?.order_status != 'delivered' ? (
            <>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { marginRight: 6, backgroundColor: '#DC2626' }]}
                  onPress={() => this.setState({ popup_type: 'reject', selectedRejectReason: '' }, () => this.onPickUp())}
                  activeOpacity={0.85}
                >
                  <Text style={styles.actionBtnText}>Reject</Text>
                </TouchableOpacity>

                {details?.order_status == 'pending' ? (
                  <TouchableOpacity
                    onPress={() => this.props.navigation.navigate('RescheduleDelivery', { order: details })}
                    style={[styles.actionBtn, { marginLeft: 6, backgroundColor: '#5D3FD3' }]}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.actionBtnText}>Re-schedule</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.pickupBtn}
                onPress={() => this.props.navigation.navigate('OrderOtpVerify', { orderId: details?.id, actionType: 'pickup', order: details })}
                activeOpacity={0.85}
              >
                <Text style={styles.pickupBtnText}>Pickup Order</Text>
                <Animated.View style={{ marginLeft: 10, transform: [{ translateX: this.pickupPulse.interpolate({ inputRange: [1, 1.03], outputRange: [0, 6] }) }] }}>
                  <Image source={require('./assets/arrow.png')} style={styles.pickupArrow} />
                </Animated.View>
              </TouchableOpacity>
            </>
          ) : null}

          {details?.order_status == 'pickup' ? (
            <>
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { marginRight: 6, backgroundColor: '#DC2626' }]}
                  onPress={() => this.setState({ popup_type: 'cancel', selectedCancelReason: '' }, () => this.onPickUp())}
                  activeOpacity={0.85}
                >
                  <Text style={styles.actionBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => this.props.navigation.navigate('OrderOtpVerify', { orderId: details?.id, actionType: 'deliver', order: details })}
                  style={[styles.actionBtn, { marginLeft: 6, backgroundColor: '#16A34A' }]}
                  activeOpacity={0.85}
                >
                  <Text style={styles.actionBtnText}>Deliver Order</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {details?.order_status == 'cancelled' ? (
            <Text style={{ fontSize: 13, color: '#DC2626', alignSelf: 'center', fontWeight: '600' }}>
              This order has been cancelled
            </Text>
          ) : null}
        </View>

        {/* ✅ QR Fullscreen Modal (same behavior as DeliverToFarmer) */}
        <Modal
          visible={this.state.qrModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => this.setState({ qrModalVisible: false })}
        >
          <View style={styles.qrModalWrap}>
            <View style={styles.qrModalHeader}>
              <TouchableOpacity
                onPress={() => this.setState({ qrModalVisible: false })}
                activeOpacity={0.85}
                style={styles.qrCloseBtn}
              >
                <Text style={styles.qrCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.qrModalBody}>
              <Image
                source={this.getQrImageSource()}
                resizeMode="contain"
                style={styles.qrModalImage}
                onError={(e) => {
                  const msg = JSON.stringify(e?.nativeEvent || {});
                  console.log('QR MODAL onError =>', msg);
                  this.setState({ qrFailed: true, qrErrorText: msg });
                }}
              />

              {!!this.state.qrErrorText ? (
                <View style={{ marginTop: 14, paddingHorizontal: 18 }}>
                  <Text style={{ color: '#fff', fontWeight: '800', textAlign: 'center' }}>QR failed to load</Text>
                  <Text style={{ color: '#cbd5e1', fontWeight: '700', textAlign: 'center', marginTop: 6, fontSize: 11 }}>
                    {this.state.qrErrorText}
                  </Text>
                  {Platform.OS === 'ios' && this.state.qr?.startsWith('http://') ? (
                    <Text style={{ color: '#fca5a5', fontWeight: '800', textAlign: 'center', marginTop: 8, fontSize: 11 }}>
                      iOS ATS may block HTTP. Use HTTPS or allow ATS for this domain.
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </Modal>

        {/* BottomSheet confirm */}
        {this.state.show_pickup_confirm ? (
          <BottomSheet
            ref={r => this.bottomSheetRef = r}
            visible={this.state.show_pickup_confirm}
            onSheetClose={() => this.setState({ show_pickup_confirm: false })}
            enablePanDownToClose={true}
            onChange={(status) => (status == -1 ? this.setState({ show_pickup_confirm: false }) : '')}
          >
            <View style={styles.bsContent}>
              {/* Header */}
              <View style={styles.bsHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bsTitle, { color: this.state.popup_type == 'reject' || this.state.popup_type == 'cancel' ? '#DC2626' : '#5D3FD3' }]}>
                    {this.state.popup_type == 'pickup' ? 'Pickup' : this.state.popup_type == 'cancel' ? 'Cancel' : 'Reject'} Confirmation
                  </Text>
                  <Text style={styles.bsSub}>
                    {this.state.popup_type == 'cancel'
                      ? 'Select a cancel reason to proceed'
                      : this.state.popup_type == 'reject'
                      ? 'Select a reject reason to proceed'
                      : 'Confirm order pickup?'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => this.bottomSheetRef?.close()} style={styles.bsCloseBtn} activeOpacity={0.7}>
                  <Text style={styles.bsCloseX}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Reasons list */}
              {(this.state.popup_type == 'cancel' || this.state.popup_type == 'reject') ? (
                <>
                  <View style={styles.bsDivider} />
                  <ScrollView
                    style={{ maxHeight: Dimensions.get('window').height * 0.38 }}
                    bounces={false}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    {this.state.popup_type == 'cancel' ? this.renderCancelReasons() : null}
                    {this.state.popup_type == 'reject' ? this.renderRejectReasons() : null}
                  </ScrollView>
                </>
              ) : null}

              {/* Action button */}
              <View style={styles.bsDivider} />
              <View style={styles.bsBtnWrap}>
                <TouchableOpacity
                  disabled={
                    ((this.state.popup_type == 'cancel' && !this.state.selectedCancelReason) ||
                      (this.state.popup_type == 'reject' && !this.state.selectedRejectReason)) ||
                    this.state.isLoading
                  }
                  onPress={() => {
                    if (this.state.popup_type == 'cancel') this.orderStatusApi(this.state.popup_type, this.state.selectedCancelReason);
                    else if (this.state.popup_type == 'reject') this.orderStatusApi(this.state.popup_type, this.state.selectedRejectReason);
                    else this.orderStatusApi(this.state.popup_type);
                  }}
                  style={[styles.bsConfirmBtn, {
                    backgroundColor: this.state.popup_type == 'reject' || this.state.popup_type == 'cancel' ? '#DC2626' : '#5D3FD3',
                    opacity: ((this.state.popup_type == 'cancel' && !this.state.selectedCancelReason) ||
                      (this.state.popup_type == 'reject' && !this.state.selectedRejectReason)) || this.state.isLoading ? 0.35 : 1,
                  }]}
                  activeOpacity={0.85}
                >
                  {!this.state.isLoading ? (
                    <Text style={styles.bsConfirmT}>{this.state.popup_type == 'reject' ? 'Reject Order' : this.state.popup_type == 'cancel' ? 'Cancel Order' : 'Confirm Pickup'}</Text>
                  ) : (
                    <ActivityIndicator size="small" color="#FFF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </BottomSheet>
        ) : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F3F8' },

  headerWrap: { backgroundColor: '#5D3FD3' },
  headerSafe: { backgroundColor: '#5D3FD3' },
  headerRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  backImg: { width: 25, height: 25, resizeMode: 'contain', tintColor: '#FFF' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 15, fontWeight: '600' },

  container: { paddingHorizontal: 8, paddingTop: 10, paddingBottom: 20 },

  pageBox: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  pageBoxText: { marginLeft: 10, fontSize: 12, fontWeight: '600', color: '#1E293B' },
  pageErrorText: { fontSize: 12, fontWeight: '600', color: '#64748B' },

  // Detail card styles
  ddCard: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },

  ddHero: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, paddingBottom: 8 },
  ddOid: { fontSize: 14, fontWeight: '700', color: '#5D3FD3' },
  ddDate: { fontSize: 11, fontWeight: '400', color: '#94A3B8', marginTop: 2 },
  ddChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  ddChipT: { fontSize: 9, fontWeight: '700', color: '#FFF' },

  ddPerson: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  ddAvt: { width: 36, height: 36, borderRadius: 18, resizeMode: 'cover', marginRight: 10 },
  ddName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  ddPhone: { fontSize: 11, fontWeight: '400', color: '#94A3B8', marginTop: 1 },
  ddIco: { width: 30, height: 30, resizeMode: 'contain' },
  ddIcoOrange: { width: 30, height: 30, resizeMode: 'contain', tintColor: '#EA580C' },

  ddPayRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 12 },
  ddHeroAmt: { fontSize: 16, fontWeight: '700', color: '#16A34A' },

  ddPillGap: { marginRight: 6 },

  ddRoute: { padding: 12 },
  ddRouteRow: { flexDirection: 'row', alignItems: 'flex-start' },
  ddTl: { width: 14, alignItems: 'center', marginRight: 8, paddingTop: 3 },
  ddDot: { width: 8, height: 8, borderRadius: 4 },
  ddLine: { width: 1.5, flex: 1, minHeight: 10, backgroundColor: '#D1D5DB', marginVertical: 3 },
  ddRouteBody: { flex: 1, paddingBottom: 10 },
  ddRouteLbl: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3, marginBottom: 3 },
  ddRouteTitle: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  ddRoutePhone: { fontSize: 11, fontWeight: '500', color: '#94A3B8', marginTop: 1 },
  ddRouteAddr: { fontSize: 12, fontWeight: '400', color: '#64748B', lineHeight: 17, marginTop: 1 },

  ddInfoRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  ddInfoItem: { flex: 1 },
  ddInfoLabel: { fontSize: 11, fontWeight: '500', color: '#94A3B8', marginBottom: 4 },
  ddInfoVal: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  ddPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, alignSelf: 'flex-start', marginRight: 6 },
  ddPillT: { fontSize: 10, fontWeight: '600', color: '#FFF' },

  ddSlotRow: { paddingHorizontal: 12, paddingVertical: 8 },
  ddSlot: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, marginRight: 6, marginBottom: 4 },
  ddSlotT: { fontSize: 11, fontWeight: '500', color: '#475569' },

  ddSecTitle: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 6 },

  ddItemRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  ddItemImg: { marginRight: 12 },
  ddProductImg: { width: 46, height: 46, borderRadius: 8, resizeMode: 'cover', backgroundColor: '#F1F5F9' },
  ddItemName: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginBottom: 4 },
  ddItemMeta: { flexDirection: 'row', alignItems: 'center' },
  ddItemVarPill: { backgroundColor: '#FFF7ED', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  ddItemVar: { fontSize: 12, fontWeight: '600', color: '#EA580C' },
  ddItemQty: { fontSize: 12, fontWeight: '500', color: '#64748B' },
  ddItemPrice: { fontSize: 15, fontWeight: '700', color: '#16A34A' },
  ddItemUnit: { fontSize: 10, fontWeight: '400', color: '#94A3B8', marginTop: 2 },

  statusPill: { alignSelf: 'flex-start', borderRadius: 60, paddingHorizontal: 14, paddingVertical: 6 },
  statusPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  orderIdLine: { fontSize: 12, fontWeight: '800', color: '#111827' },
  orderIdBold: { fontSize: 13, fontWeight: '800', color: '#F68A20' },
  smallMeta: { fontSize: 12, color: '#6B7280', fontWeight: '500', marginTop: 4 },
  orderMetaRow: { flexDirection: 'row', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#EEF2F6' },
  orderMetaItem: { flex: 1, alignItems: 'center' },
  orderMetaLabel: { fontSize: 11, fontWeight: '500', color: '#9CA3AF', marginBottom: 4 },
  orderMetaValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  cardLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginBottom: 8, letterSpacing: 0.3 },

  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },

  farmerRow: { flexDirection: 'row', alignItems: 'center', padding: 5 },
  farmerName: { fontSize: 14, fontWeight: '700', color: '#000' },
  farmerMeta: { fontSize: 13, fontWeight: '400', lineHeight: 20, color: '#4B5563' },

  warehouseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  warehouseIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  warehouseAddress: { fontSize: 13, fontWeight: '400', lineHeight: 18, color: '#6B7280', marginTop: 2 },
  phoneMeta: { marginTop: 7, fontSize: 12, color: '#111827' },

  callIconImg: { width: 34, height: 34, resizeMode: 'contain' },
  waIconImg: { width: 34, height: 34, resizeMode: 'contain', marginLeft: 10 },

  itemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, marginTop: 20, paddingHorizontal: 4 },
  itemsTitle: { fontSize: 13, color: '#36454F', fontWeight: '500' },
  itemsTotal: { fontSize: 15, fontWeight: '700', color: '#0F7451' },

  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  itemSep: { borderTopWidth: 1, borderTopColor: '#EEF2F6' },
  itemImg: { alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  productImg: { width: 50, height: 50, borderRadius: 5, resizeMode: 'contain' },

  itemName: { flex:1,fontSize: 13, color: '#111827', fontWeight: '500', lineHeight: 20 },
  itemSub: { fontSize: 13, color: '#F37A20', fontWeight: '400', alignSelf: 'center' },
  itemPrice: { fontSize: 15, fontWeight: '600', color: '#0F7451' },
  itemQty: { fontSize: 12, color: '#000', fontWeight: '500', alignSelf: 'center' },

  bottomPanel: { paddingHorizontal: 14, paddingBottom: 30, paddingTop: 10, backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 8 },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 },
  totalLabel: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  codValue: { fontSize: 16, fontWeight: '700', color: '#F37A20' },

  pickupBtn: { height: 48, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#16A34A', marginTop: 4 },
  pickupBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  pickupArrow: { width: 12, height: 12, resizeMode: 'contain', tintColor: 'rgba(255,255,255,0.8)' },

  actionRow: { flexDirection: 'row', marginBottom: 0 },
  actionBtn: { flex: 1, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  primaryBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5D3FD3', marginBottom: 12 },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },

  dangerBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E35335' },
  dangerText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },

  emptyItemsText: { fontSize: 12, fontWeight: '700', color: '#6B7280', textAlign: 'center', paddingVertical: 10 },

  // Bottom sheet
  bsContent: { paddingHorizontal: 20, paddingBottom: 20 },
  bsHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 6, paddingBottom: 2 },
  bsTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  bsSub: { fontSize: 13, fontWeight: '400', color: '#94A3B8', lineHeight: 18 },
  bsCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginLeft: 12, marginTop: 2 },
  bsCloseX: { fontSize: 16, fontWeight: '700', color: '#94A3B8' },
  bsDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
  bsBtnWrap: { alignItems: 'center', paddingTop: 4 },
  bsConfirmBtn: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, minWidth: 160 },
  bsConfirmT: { color: '#FFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.2 },

  reasonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, marginBottom: 3 },
  reasonRowActive: { backgroundColor: '#FEF2F2' },
  radioOuter: { height: 22, width: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radioOuterActive: { borderColor: '#DC2626', borderWidth: 2 },
  radioInner: { height: 12, width: 12, borderRadius: 6, backgroundColor: '#DC2626' },
  reasonText: { flex: 1, color: '#334155', fontWeight: '500', fontSize: 14 },
  reasonTextActive: { color: '#DC2626', fontWeight: '600' },

  // ✅ Payment styles (added)
  receiveTitle: { fontSize: 13, fontWeight: '700', color: '#000', marginBottom: 15 },

  methodRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  methodIcon: { width: 50, height: 50, borderRadius: 5, backgroundColor: '#E7FAF3', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  methodTitle: { fontSize: 12, fontWeight: '600', color: '#F37A20' },
  methodSub: { marginTop: 4, fontSize: 18, fontWeight: '800', color: '#0F7451' },

  payTiles: { flexDirection: 'row', justifyContent: 'space-between' },
  payTile: {
    width: (Dimensions.get('window').width - 14 * 2 - 12 * 2 - 10) / 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  payImg: { flex: 1, minHeight: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7FAF3' },
  payFooterPrimary: { height: 40, backgroundColor: '#2F7D67', alignItems: 'center', justifyContent: 'center' },
  payTileText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  qrThumb: { height: '100%', width: '100%' },

  // ✅ QR Modal
  qrModalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  qrModalHeader: { height: 80, paddingTop: 36, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'flex-end' },
  qrCloseBtn: { height: 40, width: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  qrCloseText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  qrModalBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 40 },
  qrModalImage: { width: '92%', height: '65%' },
});
export default withV4Navigation(DeliveryDetails);
