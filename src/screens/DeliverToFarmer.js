import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Image,
  ActivityIndicator,
  Linking,
  Dimensions,
  Modal,
  Platform,
  Animated,
  RefreshControl,
  LayoutAnimation,
  UIManager,
  PanResponder,
  InteractionManager,
} from 'react-native';
import { SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import constants from '../utils/constants';
import BottomSheet from '../components/BottomSheet';
import ShimmerLoader from '../components/ShimmerLoader';
import Toast from 'react-native-simple-toast';
import { NavigationEvents, withV4Navigation } from '../utils/v4Compat';
import { invalidateOrderRelated } from '../utils/dataCache';
import * as STATUS_COLORS from '../utils/statusColors';
import CachedImage from '../components/CachedImage';

const BG = '#5D3FD3';
const QR_SAFE_TOP = initialWindowMetrics?.insets?.top ?? (Platform.OS === 'ios' ? 47 : StatusBar.currentHeight || 0);
const QR_SAFE_BOTTOM = initialWindowMetrics?.insets?.bottom ?? 0;


class DeliverToFarmer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // loaders
      qrLoading: false,
      statusLoading: false,
      reasonsLoading: false,

      details: null,

      payment_type: 'cash',
      qr: '',
      qrFailed: false,
      qrErrorText: '',

      // QR modal
      qrModalVisible: false,

      // more options
      show_more_options: false,

      // bottomsheet
      show_sheet: false,
      popup_type: 'complete', // complete | cancel

      // cancel reasons
      cancelReasons: {}, // {key: label}
      selectedCancelReason: '', // key
      refreshing: false,
      showSuccessModal: false,
    };
    this.fadeAnim = new Animated.Value(0);
    this.slideAnim = new Animated.Value(24);
    this.qrModalY = new Animated.Value(0);
    this.qrBackdropOp = new Animated.Value(1);
    this.successScale = new Animated.Value(0);
    this.successOpacity = new Animated.Value(0);
    this.successRing = new Animated.Value(0.5);
    this.successRingOp = new Animated.Value(0);
    this.successModalY = new Animated.Value(0);
    this._qrClosing = false;

    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    const SH = Dimensions.get('window').height;

    this.successPan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderMove: (_, g) => { if (g.dy > 0) this.successModalY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.4) {
          Animated.timing(this.successModalY, { toValue: SH, duration: 250, useNativeDriver: true }).start(() => {
            this.setState({ showSuccessModal: false });
            this.successModalY.setValue(0);
            const nav = this.props?.navigation;
            nav?.navigate('TrackOrders');
          });
        } else {
          Animated.spring(this.successModalY, { toValue: 0, friction: 8, useNativeDriver: true }).start();
        }
      },
    });

    this.qrPan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) {
          this.qrModalY.setValue(g.dy);
          this.qrBackdropOp.setValue(Math.max(0, 1 - g.dy / (SH * 0.5)));
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.4) {
          this.closeQrModal();
        } else {
          Animated.parallel([
            Animated.spring(this.qrModalY, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
            Animated.timing(this.qrBackdropOp, { toValue: 1, duration: 200, useNativeDriver: true }),
          ]).start();
        }
      },
    });
  }

  mask = (p) => { if (!p) return ''; const s = String(p); if (s.length < 6) return s; return s.slice(0,2) + '****' + s.slice(-2); };

  runEntryAnim = () => {
    this.fadeAnim.setValue(0);
    this.slideAnim.setValue(24);
    Animated.parallel([
      Animated.timing(this.fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(this.slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  };

  onRefresh = () => {
    const id = this.state.details?.id;
    if (id) { this.setState({ refreshing: true }); this.deliverDetailsAPI(id); }
  };

  getOrder = () => this.props?.navigation?.getParam('order', null);

  isAlreadyPaid = (order) => {
  const ps = String(order?.payment_status || '').toLowerCase(); // "paid"
  const pm = String(order?.payment_mode || '').toLowerCase();   // "razor pay"
  return ps === 'paid' && pm && pm !== 'cod' && pm !== 'cash';
};

  componentDidMount() {
    const order = this.getOrder();
    this.setState({ details: order }, () => {
      const id = order?.id;
      if (id) this.getQR(id);
      else console.log('DeliverToFarmer: navigation order.id missing');
      this.runEntryAnim();
    });

    this.cancelReasonsApi();
  }

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
        this.setState({ isLoading: false });

        if (json?.status && json?.order) {
          this.setState({ details: json.order, refreshing: false }, () => {
            const oid = json?.order?.id;
            if (oid) this.getQR(oid);
            this.runEntryAnim();
          });
        } else {
          this.setState({ details: null, hasError: true, refreshing: false });
          console.log('Order Details API error== ', json?.message || 'Invalid response');
        }
      })
      .catch((e) => {
        console.log('Order Details API error== ', e);
        this.setState({ isLoading: false, refreshing: false, details: null, hasError: true });
      });
  };

  goBack = () => {
    const nav = this.props?.navigation;
    if (nav?.goBack) nav.goBack();
  };

  // ✅ Call Farmer
  onCall = async () => {
    const o = this.state.details || this.getOrder();
    const phoneRaw = o?.farmer_data?.phone;
    if (!phoneRaw) return console.log('DeliverToFarmer: farmer_data.phone missing');

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

  // ✅ WhatsApp Farmer
  onWhatsApp = async () => {
    const o = this.state.details || this.getOrder();
    const phoneRaw = o?.farmer_data?.phone;
    if (!phoneRaw) return console.log('DeliverToFarmer: farmer_data.phone missing');

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

  onCollectCash = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'));
    this.setState({ payment_type: 'cash' });
  };

  onScanQR = () => {
    this.setState({ payment_type: 'qr' });
    this.openQrModal();
  };

  openQrModal = () => {
    if (this.state.qrModalVisible || this._qrClosing) return;
    const SH = Dimensions.get('window').height;
    this.qrModalY.setValue(SH);
    this.qrBackdropOp.setValue(0);
    this.setState({ qrModalVisible: true }, () => {
      Animated.parallel([
        Animated.spring(this.qrModalY, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
        Animated.timing(this.qrBackdropOp, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  };

  closeQrModal = () => {
    if (this._qrClosing || !this.state.qrModalVisible) return;
    this._qrClosing = true;
    const SH = Dimensions.get('window').height;
    Animated.parallel([
      Animated.timing(this.qrModalY, { toValue: SH, duration: 280, useNativeDriver: true }),
      Animated.timing(this.qrBackdropOp, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) {
        this._qrClosing = false;
        return;
      }
      InteractionManager.runAfterInteractions(() => {
        this.setState({ qrModalVisible: false }, () => {
          this._qrClosing = false;
        });
      });
    });
  };

  onCancel = () => {
    this.setState({ popup_type: 'cancel', show_sheet: true, show_more_options: false, selectedCancelReason: '' });
  };

  closeMoreAnd = (fn) => {
    this.moreSheetRef?.close();
    setTimeout(() => fn?.(), 220);
  };

  toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // ✅ Fetch QR
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

        // iOS ATS common issue if http
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

  // ✅ Update Status API
  orderStatusApi = (status, cancelReasonKey = '') => {
    const body = {
      status: status == 'deliver' ? 'delivered' : status,
      order_id: this.state.details?.id,
      type: this.state.payment_type,
      reason: cancelReasonKey || '',
    };

    console.log('Update Status API payload== ', body);

    this.setState({ statusLoading: true }, () => {
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
          this.setState({ statusLoading: false });
          Toast.show(responseJson.message, Toast.SHORT);

          if (responseJson.status || responseJson.success) {
            invalidateOrderRelated();
            this.setState({ show_sheet: false }, () => {
              if (this.props?.navigation?.goBack) this.props.navigation.goBack();
            });
          }
        })
        .catch((error) => {
          console.log('Update Status API error== ', error);
          this.setState({ statusLoading: false });
          Toast.show('Something went wrong', Toast.SHORT);
        });
    });
  };

  // ✅ Cancel reasons API
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
          if (responseJson.status) {
            const reasons = responseJson?.data || {};
            this.setState({ cancelReasons: reasons });
          }
        })
        .catch((error) => {
          console.log('Cancel Reasons API error== ', error);
          this.setState({ reasonsLoading: false });
        });
    });
  };

  // ✅ QR Image source (with auth headers)
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
          {qrLoading ? <ActivityIndicator size="small" color="#1C8A62" /> : null}

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

  // ✅ Cancel reason list UI
  renderCancelReasons = () => {
    const { cancelReasons, selectedCancelReason, reasonsLoading } = this.state;

    if (reasonsLoading) {
      return <ActivityIndicator style={{ marginTop: 12 }} size="small" color="#1C8A62" />;
    }

    const keys = Object.keys(cancelReasons || {});
    if (!keys.length) {
      return (
        <Text style={{ textAlign: 'center', marginTop: 12, color: '#6B7280', fontWeight: '700' }}>
          No cancel reasons found
        </Text>
      );
    }

    return (
      <ScrollView style={{  marginTop: 12 }} showsVerticalScrollIndicator={false}>
        {keys.map((k) => {
          const label = cancelReasons[k];
          const selected = selectedCancelReason === k;

          return (
            <TouchableOpacity
              key={k}
              activeOpacity={0.85}
              onPress={() => this.setState({ selectedCancelReason: k })}
              style={styles.reasonRow}
            >
              <View style={[styles.radioOuter, selected ? styles.radioOuterActive : null]}>
                {selected ? <View style={styles.radioInner} /> : null}
              </View>
              <Text style={styles.reasonText}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  showDeliverySuccess = () => {
    this.successScale.setValue(0);
    this.successOpacity.setValue(0);
    this.successRing.setValue(0.5);
    this.successRingOp.setValue(0);
    this.successModalY.setValue(0);
    this.setState({ showSuccessModal: true }, () => {
      Animated.sequence([
        Animated.parallel([
          Animated.spring(this.successScale, { toValue: 1.15, friction: 3, tension: 80, useNativeDriver: true }),
          Animated.timing(this.successOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]),
        Animated.spring(this.successScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
      ]).start();

      setTimeout(() => {
        Animated.parallel([
          Animated.timing(this.successRing, { toValue: 2, duration: 800, useNativeDriver: true }),
          Animated.timing(this.successRingOp, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]).start();
      }, 200);

      this._successTimer = setTimeout(() => {
        this.setState({ showSuccessModal: false });
        this.props?.navigation?.navigate('TrackOrders');
      }, 2500);
    });
  };

  closeSuccessModal = () => {
    if (this._successTimer) clearTimeout(this._successTimer);
    const SH = Dimensions.get('window').height;
    Animated.timing(this.successModalY, { toValue: SH, duration: 250, useNativeDriver: true }).start(() => {
      this.setState({ showSuccessModal: false });
      this.successModalY.setValue(0);
      this.props?.navigation?.navigate('TrackOrders');
    });
  };

  getStatusColors = (s) => ({ bg: STATUS_COLORS.getStatus(s).bg });

  openSurvey = () => {
    this.props?.navigation?.navigate('Survey', { order_data: this.state.details });
  };

  render() {
    const o = this.state.details || this.getOrder();
    const { statusLoading } = this.state;

    const rawCode = o?.order_code || '';
    const orderIdText = rawCode.includes(' ') ? rawCode.split(' ')[0] : rawCode;
    const orderDate = o?.order_date || '';
    const statusText = o?.order_status || '';
    const sc = this.getStatusColors(statusText);
    const totalItems = this.toNum(o?.total_items);

    const farmerName = o?.farmer_data?.name || '';
    const farmerPhone = o?.farmer_data?.phone || '';
    const farmerAddress = o?.farmer_data?.address || '';
    const farmerFullAddress = o?.farmer_address || {};
    const darkStore = o?.dark_store || {};

    const total = this.toNum(o?.grand_total);
    const codAmount = this.toNum(o?.cod_amount);
    const items = Array.isArray(o?.order_items) ? o.order_items : [];

    const isCancel = this.state.popup_type === 'cancel';
    const confirmDisabled = isCancel && !this.state.selectedCancelReason;

    const isPaid = this.isAlreadyPaid(o);
    const paymentMode = o?.payment_mode || '';
    const paymentStatus = o?.payment_status || '';
    const qrSize = Math.min(Dimensions.get('window').width - 56, 308);
    const st = String(statusText || '').toLowerCase();
    const isDelivered = st === 'delivered' || st === 'deliver';
    const isCancelled = st === 'cancelled' || st === 'canceled';
    const isDisputed = st === 'disputed';

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />

        <View style={styles.headerWrap}>
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={this.goBack} style={styles.headerIconBtn} activeOpacity={0.8}>
                <Image style={styles.backImg} source={require('./assets/back.png')} />
              </TouchableOpacity>
              <Text style={styles.headerTitle} numberOfLines={1}>Deliver To Farmer</Text>
              <View style={{ width: 42, height: 42 }} />
            </View>
          </SafeAreaView>
        </View>

        <NavigationEvents onWillFocus={() => {}} onDidFocus={() => { if (this.state.details?.id) this.deliverDetailsAPI(this.state.details.id); }} />

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={!!this.state.refreshing} onRefresh={this.onRefresh} />}>
          {this.state.isLoading && !this.state.refreshing ? <ShimmerLoader /> : null}

          {!this.state.isLoading && !o ? (
            <View style={styles.pageBox}><Text style={styles.pageErrorText}>Unable to load details</Text></View>
          ) : null}

          {o ? (
            <Animated.View style={{ opacity: this.fadeAnim, transform: [{ translateY: this.slideAnim }] }}>
              {/* Hero Card — Order + Farmer + Payment */}
              <View style={styles.ddCard}>
                <View style={styles.ddHero}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ddOid}>#{orderIdText}</Text>
                    <Text style={styles.ddDate}>{orderDate || '-'}</Text>
                  </View>
                  <View style={[styles.ddChip, { backgroundColor: sc.bg }]}>
                    <Text style={styles.ddChipT}>{String(statusText).toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.ddPerson}>
                  <Image source={require('./assets/farmer.png')} style={styles.ddAvt} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ddName}>{farmerName || '-'}</Text>
                    <Text style={styles.ddPhone}>{this.mask(farmerPhone)}</Text>
                  </View>
                  <TouchableOpacity onPress={this.onCall} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                    <Image source={require('./assets/call.png')} style={styles.ddIco} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={this.onWhatsApp} activeOpacity={0.7} hitSlop={{top:8,bottom:8,left:8,right:8}} style={{ marginLeft: 10 }}>
                    <Image source={require('./assets/whatsapp.png')} style={styles.ddIco} />
                  </TouchableOpacity>
                </View>

                <View style={styles.ddPayRow}>
                  <View style={[styles.ddPill, { backgroundColor: '#475569' }]}><Text style={styles.ddPillT}>{paymentMode.toUpperCase() || '-'}</Text></View>
                  <View style={[styles.ddPill, { backgroundColor: paymentStatus === 'paid' ? '#16A34A' : '#B45309' }]}><Text style={styles.ddPillT}>{paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}</Text></View>
                  <View style={{ flex: 1 }} />
                  <Text style={styles.ddHeroAmt}>{'₹'}{codAmount || total}</Text>
                </View>
              </View>

              {/* Route: Pickup -> Drop */}
              <View style={styles.ddCard}>
                <View style={{ padding: 12 }}>
                  <View style={styles.ddRouteRow}>
                    <View style={styles.ddTl}><View style={[styles.ddDot, { backgroundColor: '#0DA60D' }]} /><View style={styles.ddLine} /></View>
                    <View style={styles.ddRouteBody}>
                      <Text style={[styles.ddRouteLbl, { color: '#0DA60D' }]}>Pickup</Text>
                      <Text style={styles.ddRouteTitle}>{darkStore?.name || '-'}</Text>
                      {darkStore?.mobile ? <Text style={styles.ddRouteSub}>{darkStore.mobile}</Text> : null}
                      <Text style={styles.ddRouteSub}>{darkStore?.location || `${darkStore?.city || ''}${darkStore?.pincode ? `, ${darkStore.pincode}` : ''}`}</Text>
                    </View>
                  </View>
                  <View style={styles.ddRouteRow}>
                    <View style={styles.ddTl}><View style={[styles.ddDot, { backgroundColor: '#EF4444' }]} /></View>
                    <View style={[styles.ddRouteBody, { paddingBottom: 0 }]}>
                      <Text style={[styles.ddRouteLbl, { color: '#EF4444' }]}>Drop</Text>
                      <Text style={styles.ddRouteSub}>
                        {farmerFullAddress?.address || farmerAddress || '-'}
                        {farmerFullAddress?.block ? `, ${farmerFullAddress.block}` : ''}
                        {farmerFullAddress?.city ? `, ${farmerFullAddress.city}` : ''}
                        {farmerFullAddress?.state ? `, ${farmerFullAddress.state}` : ''}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Items */}
              <Text style={styles.ddSecTitle}>{`${totalItems || items.length || 0} Item(s)`}  <Text style={{ color: '#16A34A' }}>{'₹'} {total}</Text></Text>
              {items.length ? items.map((it, idx) => (
                <View key={`${it?.variant_id || it?.product_id || idx}`} style={styles.ddCard}>
                  <View style={styles.ddItemRow}>
                    <View style={styles.ddItemImg}>
                      {it?.image ? <CachedImage source={{ uri: it.image }} style={styles.ddProductImg} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ddItemName}>{String(it?.product_name || '-')}</Text>
                      <View style={styles.ddItemMeta}>
                        {it?.variation ? <View style={styles.ddItemVarPill}><Text style={styles.ddItemVar}>{it.variation}</Text></View> : null}
                        <Text style={styles.ddItemQty}>Qty: {this.toNum(it?.quantity)}</Text>
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.ddItemPrice}>{'₹'}{this.toNum(it?.total_price || it?.price)}</Text>
                      {it?.price && it?.quantity > 1 ? <Text style={styles.ddItemUnit}>{'₹'}{this.toNum(it?.price)} each</Text> : null}
                    </View>
                  </View>
                </View>
              )) : <View style={styles.ddCard}><Text style={styles.emptyTxt}>No items</Text></View>}

              {/* Payment */}
              {!isPaid ? (
                <View style={styles.ddCard}>
                  <View style={{ padding: 12 }}>
                    <Text style={styles.payTitle}>Collect Payment  <Text style={{ color: '#16A34A', fontSize: 16, fontWeight: '800' }}>{'₹'}{total}</Text></Text>

                    <TouchableOpacity onPress={this.onCollectCash} activeOpacity={0.8} style={[styles.payCard, this.state.payment_type === 'cash' && styles.payCardActive]}>
                      <View style={[styles.payRadio, this.state.payment_type === 'cash' && styles.payRadioOn]}>
                        {this.state.payment_type === 'cash' ? <View style={styles.payRadioDot} /> : null}
                      </View>
                      <Image style={{ height: 30, width: 30, resizeMode: 'contain' }} source={require('./assets/crn.png')} />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.payCardTitle, this.state.payment_type === 'cash' && { color: '#16A34A' }]}>Collect Cash</Text>
                        <Text style={styles.payCardSub}>Collect amount from farmer</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={this.onScanQR} activeOpacity={0.8} style={[styles.payCard, { marginBottom: 0 }, this.state.payment_type === 'qr' && styles.payCardActive]}>
                      <View style={[styles.payRadio, this.state.payment_type === 'qr' && styles.payRadioOn]}>
                        {this.state.payment_type === 'qr' ? <View style={styles.payRadioDot} /> : null}
                      </View>
                      <View style={{ width: 30, height: 30, borderRadius: 6, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: BG }}>QR</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.payCardTitle, this.state.payment_type === 'qr' && { color: BG }]}>Scan QR Code</Text>
                        <Text style={styles.payCardSub}>Pay via UPI / QR scan</Text>
                      </View>
                      {this.state.payment_type === 'qr' && this.state.qr ? (
                        <TouchableOpacity onPress={this.openQrModal} activeOpacity={0.85} style={styles.payQrThumbWrap}>
                          <Image source={this.getQrImageSource()} style={styles.payQrThumb} resizeMode="contain" onError={() => this.setState({ qrFailed: true })} />
                        </TouchableOpacity>
                      ) : this.state.payment_type === 'qr' ? (
                        <View style={styles.payQrThumbWrap}>
                          {this.state.qrLoading ? <ActivityIndicator size="small" color={BG} /> : <Text style={{ fontSize: 9, fontWeight: '600', color: '#94A3B8' }}>N/A</Text>}
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              <View style={{ height: 14 }} />
            </Animated.View>
          ) : null}
        </ScrollView>

        {/* Bottom Panel */}
        <SafeAreaView edges={['bottom']} style={styles.bottomPanel}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.codValue}>{'₹'} {total}</Text>
          </View>

          {isDelivered ? (
            <View style={styles.deliveredBadge}>
              <View style={styles.deliveredBadgeIco}>
                <Text style={styles.deliveredBadgeCheck}>{'✓'}</Text>
              </View>
              <Text style={styles.deliveredBadgeT}>Delivered</Text>
            </View>
          ) : isCancelled ? (
            <Text style={styles.cancelledNote}>This order has been cancelled</Text>
          ) : null}

          {!isCancelled && !isDisputed ? (
            <TouchableOpacity
              style={styles.moreOptsBtn}
              onPress={() => this.setState({ show_more_options: true })}
              activeOpacity={0.85}
            >
              <Text style={styles.moreOptsDots}>⋯</Text>
              <Text style={styles.moreOptsT}>Aur Options</Text>
            </TouchableOpacity>
          ) : null}
        </SafeAreaView>

        {/* Success Modal */}
        <Modal visible={this.state.showSuccessModal} transparent animationType="none" onRequestClose={this.closeSuccessModal}>
          <Animated.View style={[styles.successWrap, { transform: [{ translateY: this.successModalY }] }]} {...this.successPan.panHandlers}>
            <View style={styles.successContent}>
              <View style={styles.successCheckArea}>
                <Animated.View style={[styles.successRing, { opacity: this.successRingOp.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }), transform: [{ scale: this.successRing }] }]} />
                <Animated.View style={[styles.successCircle, { opacity: this.successOpacity, transform: [{ scale: this.successScale }] }]}>
                  <Text style={styles.successCheck}>{'✓'}</Text>
                </Animated.View>
              </View>
              <Animated.View style={{ opacity: this.successOpacity, alignItems: 'center' }}>
                <Text style={styles.successTitle}>Delivery Complete!</Text>
                <Text style={styles.successSub}>Order delivered successfully</Text>
                <View style={styles.successInfo}>
                  <Text style={styles.successOid}>#{(o?.order_code || '').split(' ')[0]}</Text>
                  <Text style={styles.successDot}>{'·'}</Text>
                  <Text style={styles.successName}>{o?.farmer_data?.name || '-'}</Text>
                  <Text style={styles.successDot}>{'·'}</Text>
                  <Text style={styles.successAmt}>{'₹'}{this.toNum(o?.grand_total)}</Text>
                </View>
                <Text style={styles.successHint}>Swipe down or wait...</Text>
              </Animated.View>
            </View>
          </Animated.View>
        </Modal>

        {/* QR Modal */}
        <Modal
          visible={this.state.qrModalVisible}
          transparent
          animationType="none"
          presentationStyle="overFullScreen"
          statusBarTranslucent
          onRequestClose={this.closeQrModal}
        >
          <View style={{ flex: 1 }}>
            <Animated.View style={[styles.qrBackdrop, { opacity: this.qrBackdropOp }]} pointerEvents="none" />

            <Animated.View style={[styles.qrSheet, { transform: [{ translateY: this.qrModalY }] }]} {...this.qrPan.panHandlers}>
              <View style={[styles.qrSafe, { paddingBottom: QR_SAFE_BOTTOM }]}>
                <View style={{ paddingTop: QR_SAFE_TOP }}>
                  <View style={styles.qrSheetHandle}><View style={styles.qrDragHandle} /></View>
                  <View style={styles.qrTopBar}>
                    <TouchableOpacity onPress={this.closeQrModal} activeOpacity={0.7} style={styles.qrCloseBtn}>
                      <Text style={styles.qrCloseText}>✕</Text>
                    </TouchableOpacity>
                    <Text style={styles.qrTitle} numberOfLines={1}>Scan & Pay</Text>
                    <View style={styles.qrTopSpacer} />
                  </View>
                </View>
                <Text style={styles.qrSubtitle}>Ask farmer to scan this QR code</Text>

                <ScrollView
                  contentContainerStyle={styles.qrScroll}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={[styles.qrCard, { width: qrSize + 32 }]}>
                    {this.state.qr ? (
                      <Image
                        source={this.getQrImageSource()}
                        resizeMode="contain"
                        style={{ width: qrSize, height: qrSize, borderRadius: 8 }}
                        onError={() => this.setState({ qrFailed: true })}
                      />
                    ) : (
                      <View style={[styles.qrModalPlaceholder, { width: qrSize, height: qrSize }]}>
                        {this.state.qrLoading ? (
                          <ActivityIndicator size="large" color={BG} />
                        ) : (
                          <Text style={styles.qrPlaceholderT}>QR not available</Text>
                        )}
                      </View>
                    )}
                  </View>

                  <Text style={styles.qrCardAmt}>{'₹'} {total}</Text>

                  <View style={styles.qrOrderCard}>
                    <View style={styles.qrOrderTop}>
                      <Text style={styles.qrOrderOid} numberOfLines={1}>#{orderIdText}</Text>
                      <View style={styles.qrPayPill}>
                        <Text style={styles.qrPayPillT}>{(paymentMode || 'COD').toUpperCase()}</Text>
                      </View>
                    </View>
                    <View style={styles.qrOrderDivider} />
                    <View style={styles.qrOrderRow}>
                      <View style={styles.qrFarmerAv}>
                        <Text style={styles.qrFarmerAvT}>{(farmerName || 'F').trim().charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.qrFarmerInfo}>
                        <Text style={styles.qrOrderName} numberOfLines={1}>{farmerName || '-'}</Text>
                        {farmerPhone ? (
                          <Text style={styles.qrOrderPhone}>{this.mask(farmerPhone)}</Text>
                        ) : null}
                      </View>
                      <View style={styles.qrItemsChip}>
                        <Text style={styles.qrItemsChipT}>{totalItems || items.length || 0} item(s)</Text>
                      </View>
                    </View>
                  </View>
                </ScrollView>

                <Text style={styles.qrInfoHint}>Swipe down to close</Text>
              </View>
            </Animated.View>
          </View>
        </Modal>

        {/* More Options — Mark Dispute */}
        {this.state.show_more_options ? (
          <BottomSheet
            ref={r => { this.moreSheetRef = r; }}
            visible
            dynamicSize
            maxDynamicContentSize={280 + (initialWindowMetrics?.insets?.bottom ?? 0)}
            onSheetClose={() => this.setState({ show_more_options: false })}
            enablePanDownToClose
            onChange={(status) => (status === -1 ? this.setState({ show_more_options: false }) : null)}
          >
            <View style={[styles.moreSheetWrap, { paddingBottom: 12 + (initialWindowMetrics?.insets?.bottom ?? 0) }]}>
              <View style={styles.moreSheetHeadRow}>
                <View style={styles.moreSheetHeadIco}>
                  <Text style={styles.moreSheetHeadIcoT}>⋯</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.moreSheetTitle}>Aur Options</Text>
                  <Text style={styles.moreSheetSub}>Is order ke liye action chunein</Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.moreSheetTile, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
                onPress={() => this.closeMoreAnd(() =>
                  this.props.navigation.navigate('MarkDispute', { order: o })
                )}
              >
                <View style={[styles.moreSheetIcoWrap, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.moreSheetIco, { color: '#B45309' }]}>⚑</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.moreSheetRowT, { color: '#B45309' }]}>Dispute Lagayein</Text>
                  <Text style={styles.moreSheetRowS}>Is order par shikayat darj karein</Text>
                </View>
                <Text style={[styles.moreSheetChev, { color: '#B45309' }]}>›</Text>
              </TouchableOpacity>
            </View>
          </BottomSheet>
        ) : null}

        {/* Bottom Sheet */}
        {this.state.show_sheet ? (
          <BottomSheet
            ref={r => this.bsRef = r}
            visible={this.state.show_sheet}
            onSheetClose={() => this.setState({ show_sheet: false })}
            enablePanDownToClose={true}
            onChange={(status) => (status === -1 ? this.setState({ show_sheet: false }) : '')}
          >
            <View style={styles.bsContent}>
              <View style={styles.bsHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bsTitle, { color: '#DC2626' }]}>Cancel Delivery</Text>
                  <Text style={styles.bsSub}>Select a cancel reason to proceed</Text>
                </View>
                <TouchableOpacity onPress={() => this.bsRef?.close()} style={styles.bsCloseBtn} activeOpacity={0.7}>
                  <Text style={styles.bsCloseX}>{'✕'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.bsDivider} />
              <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.35 }} bounces={false} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {this.renderCancelReasons()}
              </ScrollView>

              <View style={styles.bsDivider} />
              <View style={styles.bsBtnWrap}>
                <TouchableOpacity
                  disabled={!this.state.selectedCancelReason || statusLoading}
                  onPress={() => this.orderStatusApi('cancel', this.state.selectedCancelReason)}
                  style={[styles.bsConfirmBtn, {
                    backgroundColor: '#DC2626',
                    opacity: !this.state.selectedCancelReason || statusLoading ? 0.35 : 1,
                  }]}
                  activeOpacity={0.85}
                >
                  {statusLoading ? <ActivityIndicator size="small" color="#FFF" /> : (
                    <Text style={styles.bsConfirmT}>Cancel Order</Text>
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

  headerWrap: { backgroundColor: BG },
  headerSafe: { backgroundColor: BG },
  headerRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  backImg: { width: 17, height: 17, resizeMode: 'contain', tintColor: '#FFF' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 15, fontWeight: '600' },

  container: { paddingHorizontal: 8, paddingTop: 10, paddingBottom: 20 },

  pageBox: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, alignItems: 'center', justifyContent: 'center' },
  pageErrorText: { fontSize: 12, fontWeight: '600', color: '#64748B' },

  // Hero card (same as DeliveryDetails)
  ddCard: { backgroundColor: '#FFF', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  ddHero: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, paddingBottom: 8 },
  ddOid: { fontSize: 14, fontWeight: '700', color: BG },
  ddDate: { fontSize: 11, fontWeight: '400', color: '#94A3B8', marginTop: 2 },
  ddChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
  ddChipT: { fontSize: 9, fontWeight: '700', color: '#FFF' },

  ddPerson: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 },
  ddAvt: { width: 36, height: 36, borderRadius: 18, resizeMode: 'cover', marginRight: 10 },
  ddName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  ddPhone: { fontSize: 11, fontWeight: '400', color: '#94A3B8', marginTop: 1 },
  ddIco: { width: 30, height: 30, resizeMode: 'contain' },

  ddPayRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 12 },
  ddHeroAmt: { fontSize: 16, fontWeight: '700', color: '#16A34A' },
  ddPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, alignSelf: 'flex-start', marginRight: 6 },
  ddPillT: { fontSize: 10, fontWeight: '600', color: '#FFF' },

  // Route
  ddRouteRow: { flexDirection: 'row', alignItems: 'flex-start' },
  ddTl: { width: 14, alignItems: 'center', marginRight: 8, paddingTop: 3 },
  ddDot: { width: 8, height: 8, borderRadius: 4 },
  ddLine: { width: 1.5, flex: 1, minHeight: 10, backgroundColor: '#D1D5DB', marginVertical: 3 },
  ddRouteBody: { flex: 1, paddingBottom: 10 },
  ddRouteLbl: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3, marginBottom: 3 },
  ddRouteTitle: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  ddRouteSub: { fontSize: 12, fontWeight: '400', color: '#64748B', lineHeight: 17, marginTop: 1 },
  ddInfoLabel: { fontSize: 11, fontWeight: '500', color: '#94A3B8', marginBottom: 4 },
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

  emptyTxt: { fontSize: 12, fontWeight: '600', color: '#64748B', textAlign: 'center', paddingVertical: 10 },

  // Payment section
  payTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 10 },
  payCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 8 },
  payCardActive: { backgroundColor: '#FAFBFF', borderColor: BG },
  payRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  payRadioOn: { borderColor: BG },
  payRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BG },
  payCardTitle: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  payCardSub: { fontSize: 11, fontWeight: '400', color: '#94A3B8', marginTop: 2 },
  payQrThumbWrap: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  payQrThumb: { width: 38, height: 38 },

  paidRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  paidCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  paidCheck: { fontSize: 18, fontWeight: '900', color: '#16A34A' },
  paidLabel: { fontSize: 14, fontWeight: '600', color: '#16A34A' },
  paidMode: { fontSize: 12, fontWeight: '400', color: '#94A3B8', marginTop: 2 },
  paidAmt: { fontSize: 16, fontWeight: '700', color: '#16A34A' },

  // Bottom Panel
  bottomPanel: { paddingHorizontal: 14, paddingTop: 10, backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8 },
  totalLabel: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  codValue: { fontSize: 16, fontWeight: '700', color: '#F37A20' },
  deliveredBadge: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  deliveredBadgeIco: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  deliveredBadgeCheck: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  deliveredBadgeT: { fontSize: 14, fontWeight: '700', color: '#16A34A' },
  cancelledNote: { fontSize: 13, color: '#DC2626', alignSelf: 'center', fontWeight: '600', marginBottom: 4 },
  moreOptsBtn: { height: 44, marginTop: 8, borderRadius: 12, borderWidth: 1.2, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  moreOptsDots: { fontSize: 20, fontWeight: '700', color: '#475569', marginRight: 8, lineHeight: 22 },
  moreOptsT: { color: '#334155', fontSize: 13.5, fontWeight: '600', letterSpacing: 0.2, lineHeight: 22 },

  moreSheetWrap: { paddingHorizontal: 18, paddingTop: 4 },
  moreSheetHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  moreSheetHeadIco: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  moreSheetHeadIcoT: { fontSize: 22, fontWeight: '700', color: '#475569', lineHeight: 38, textAlign: 'center' },
  moreSheetTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  moreSheetSub: { fontSize: 12, fontWeight: '400', color: '#64748B', marginTop: 2 },
  moreSheetTile: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  moreSheetIcoWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  moreSheetIco: { fontSize: 16, fontWeight: '700', lineHeight: 18 },
  moreSheetRowT: { fontSize: 13.5, fontWeight: '600' },
  moreSheetRowS: { fontSize: 11.5, fontWeight: '500', color: '#64748B', marginTop: 2 },
  moreSheetChev: { fontSize: 22, fontWeight: '500', marginLeft: 6, opacity: 0.6 },

  qrThumb: { height: '100%', width: '100%' },
  // Success modal
  successWrap: { flex: 1, backgroundColor: BG },
  successContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  successCheckArea: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successRing: { position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 2.5, borderColor: '#16A34A' },
  successCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#16A34A', alignItems: 'center', justifyContent: 'center', shadowColor: '#16A34A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 3 },
  successCheck: { fontSize: 38, fontWeight: '900', color: '#FFF' },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#FFF', marginBottom: 6 },
  successSub: { fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.6)', marginBottom: 16 },
  successInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  successOid: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  successDot: { fontSize: 14, color: 'rgba(255,255,255,0.3)', marginHorizontal: 6 },
  successName: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  successAmt: { fontSize: 14, fontWeight: '800', color: '#FCD34D' },
  successHint: { fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.25)', marginTop: 20 },

  qrBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  qrSheet: { flex: 1, backgroundColor: BG, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', marginTop: 6 },
  qrSafe: { flex: 1, backgroundColor: BG },
  qrSheetHandle: { alignItems: 'center', paddingTop: 8, paddingBottom: 2 },
  qrDragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  qrTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: 12,
  },
  qrCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCloseText: { color: '#FFF', fontSize: 16, fontWeight: '700', lineHeight: 18 },
  qrTopSpacer: { width: 40, height: 40 },
  qrTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: '#FFF', marginHorizontal: 8 },
  qrSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  qrScroll: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12, justifyContent: 'center' },
  qrCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  qrModalPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qrPlaceholderT: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
  qrCardAmt: { fontSize: 26, fontWeight: '800', color: '#FCD34D', textAlign: 'center', marginTop: 14, marginBottom: 12 },
  qrOrderCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  qrOrderTop: { flexDirection: 'row', alignItems: 'center' },
  qrOrderOid: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1E293B', marginRight: 8 },
  qrPayPill: { backgroundColor: '#EDE9FE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  qrPayPillT: { fontSize: 10, fontWeight: '700', color: BG, letterSpacing: 0.3 },
  qrOrderDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
  qrOrderRow: { flexDirection: 'row', alignItems: 'center' },
  qrFarmerAv: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  qrFarmerAvT: { fontSize: 15, fontWeight: '700', color: BG },
  qrFarmerInfo: { flex: 1, minWidth: 0 },
  qrOrderName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  qrOrderPhone: { fontSize: 11, fontWeight: '500', color: '#94A3B8', marginTop: 2 },
  qrItemsChip: { backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginLeft: 8 },
  qrItemsChipT: { fontSize: 11, fontWeight: '700', color: '#D97706' },
  qrInfoHint: { fontSize: 11, fontWeight: '400', color: 'rgba(255,255,255,0.35)', textAlign: 'center', paddingBottom: 8, paddingTop: 4 },

  // Bottom sheet
  bsContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  bsHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 6, paddingBottom: 2 },
  bsTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  bsSub: { fontSize: 13, fontWeight: '400', color: '#94A3B8', lineHeight: 18 },
  bsCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginLeft: 12, marginTop: 2 },
  bsCloseX: { fontSize: 16, fontWeight: '700', color: '#94A3B8' },
  bsDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 },
  bsBtnWrap: { alignItems: 'center', paddingTop: 4 },
  bsConfirmBtn: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, minWidth: 160 },
  bsConfirmT: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  reasonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, marginBottom: 3 },
  radioOuter: { height: 22, width: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radioOuterActive: { borderColor: '#DC2626', borderWidth: 2 },
  radioInner: { height: 12, width: 12, borderRadius: 6, backgroundColor: '#DC2626' },
  reasonText: { flex: 1, color: '#334155', fontWeight: '500', fontSize: 14 },
});
export default withV4Navigation(DeliverToFarmer);
