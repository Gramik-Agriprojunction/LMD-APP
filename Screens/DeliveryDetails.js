// DeliveryDetails.js
import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
  ActivityIndicator,
  Linking,
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import constants from './constants';
import BottomSheet from '@gorhom/bottom-sheet';
import Toast from 'react-native-simple-toast';
import { NavigationEvents } from 'react-navigation';

export default class DeliveryDetails extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: false,
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
  }

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

  deliverDetailsAPI = (id) => {
    const formData = new FormData();
    formData.append('order_id', String(id));

    this.setState({ isLoading: true, hasError: false });
    console.log('orderDetails formData== ', id);

    fetch(constants.orderDetails, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + global.token,
      },
      body: formData,
    })
      .then((r) => r.json())
      .then((json) => {
        console.log('orderDetails response =', JSON.stringify(json));
        this.setState({ isLoading: false });

        if (json?.status && json?.order) {
          this.setState({ details: json.order }, () => {
            const oid = json?.order?.id;
            if (oid) this.getQR(oid);
          });
        } else {
          this.setState({ details: null, hasError: true });
          console.log('orderDetails error =>', json?.message || 'Invalid response');
        }
      })
      .catch((e) => {
        console.log('orderDetails api error =', e);
        this.setState({ isLoading: false, details: null, hasError: true });
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
          console.log('cancel reasons response== ', JSON.stringify(responseJson));
          this.setState({ reasonsLoading: false });
          if (responseJson?.status) {
            this.setState({ cancelReasons: responseJson?.data || {} });
          }
        })
        .catch((error) => {
          console.log('cancel reasons error== ', error);
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
          console.log('reject reasons response== ', JSON.stringify(responseJson));
          this.setState({ rejectReasonsLoading: false });
          if (responseJson?.status) {
            this.setState({ rejectReasons: responseJson?.data || {} });
          }
        })
        .catch((error) => {
          console.log('reject reasons error== ', error);
          this.setState({ rejectReasonsLoading: false });
        });
    });
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
      <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
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

  // ✅ Reject reason list UI
  renderRejectReasons = () => {
    const { rejectReasons, selectedRejectReason, rejectReasonsLoading } = this.state;

    if (rejectReasonsLoading) {
      return <ActivityIndicator style={{ marginTop: 12 }} size="small" color="#1C8A62" />;
    }

    const keys = Object.keys(rejectReasons || {});
    if (!keys.length) {
      return (
        <Text style={{ textAlign: 'center', marginTop: 12, color: '#6B7280', fontWeight: '700' }}>
          No reject reasons found
        </Text>
      );
    }

    return (
      <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
        {keys.map((k) => {
          const label = rejectReasons[k];
          const selected = selectedRejectReason === k;

          return (
            <TouchableOpacity
              key={k}
              activeOpacity={0.85}
              onPress={() => this.setState({ selectedRejectReason: k })}
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
    if (s === 'pending') return { bg: '#F37A20', text: '#FFF' };
    if (s === 'pickup' || s === 'pickedup' || s === 'picked_up') return { bg: '#1D4ED8', text: '#FFF' };
    if (s === 'delivered' || s === 'deliver') return { bg: '#0F7451', text: '#FFF' };
    if (s === 'cancelled' || s === 'canceled') return { bg: '#E35335', text: '#FFF' };
    if (s === 'rejected') return { bg: '#E35335', text: '#FFF' };
    return { bg: '#374151', text: '#FFF' };
  };

  openSurvey = () => {
    this.props?.navigation?.navigate('Survey', { order_data: this.state?.details });
  };

  orderStatusApi(status, cancelReasonKey = '') {
    const formData = new FormData();
    formData.append('status', status == 'deliver' ? 'delivered' : status);
    formData.append('order_id', this.state.details?.id);
    formData.append('type', '');
    formData.append('reason', cancelReasonKey || '');

    this.setState({ isLoading: true }, () => {
      console.log('order update formdata status== ', formData);

      fetch(constants.updateStatus, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + global.token,
          Accept: 'application/json',
        },
        body: formData,
      })
        .then((response) => response.json())
        .then((responseJson) => {
          console.log('update status response== ', JSON.stringify(responseJson));
          this.setState({ isLoading: false });
          Toast.show(responseJson.message, Toast.SHORT);
          if (responseJson.status) {
            this.deliverDetailsAPI(this.state.details?.id);
            this.setState({ show_pickup_confirm: false, selectedCancelReason: '', selectedRejectReason: '' });
          }
        })
        .catch((error) => {
          console.log('update status error== ', error);
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
    console.log('getQR URL =>', url);

    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + global.token,
        Accept: 'application/json',
      },
    })
      .then((r) => r.json())
      .then((json) => {
        console.log('get QR response =', JSON.stringify(json));
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
        console.log('get QR error== ', e);
        this.setState({ qrLoading: false, qr: '', qrFailed: true, qrErrorText: String(e) });
      });
  };

  getQrImageSource = () => {
    const { qr } = this.state;
    if (!qr) return null;

    const bust = qr.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`;
    return {
      uri: qr + bust,
      headers: { Authorization: 'Bearer ' + global.token },
    };
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

  render() {
    const { isLoading, details, hasError } = this.state;

    const orderIdText = details?.order_code || '';
    const orderDate = details?.order_date || '';
    const totalItems = this.toNum(details?.total_items);

    const farmerName = details?.farmer_data?.name || '';
    const farmerAddress = details?.farmer_data?.address || '';
    const total = this.toNum(details?.grand_total);
    const items = Array.isArray(details?.order_items) ? details.order_items : [];

    const isPaid = this.isAlreadyPaid(details);
    const paymentMode = details?.payment_mode || '';
    const paymentStatus = details?.payment_status || '';

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#1C8A62" />

        <NavigationEvents
          onWillFocus={() => {}}
          onDidFocus={() => {
            const order = this.getOrder();
            const id = order?.id;

            if (id) this.deliverDetailsAPI(id);
            else console.log('DeliveryDetails: navigation order.id missing');
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

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={styles.pageBox}>
              <ActivityIndicator size="small" color="#1C8A62" />
              <Text style={styles.pageBoxText}>Loading...</Text>
            </View>
          ) : null}

          {!isLoading && !details && hasError ? (
            <View style={styles.pageBox}>
              <Text style={styles.pageErrorText}>Unable to load details</Text>
            </View>
          ) : null}

          {details ? (
            <>
              <View style={styles.topMeta}>
                <View style={{ flex: 1 }}>
                  {orderIdText ? (
                    <Text style={styles.orderIdLine}>
                      ORDER : <Text style={styles.orderIdBold}>{orderIdText}</Text>
                    </Text>
                  ) : null}

                  {orderDate ? <Text style={styles.smallMeta}>{orderDate}</Text> : null}
                </View>

                {(() => {
                  const sc = this.getStatusColors(details?.order_status);
                  return (
                    <View style={[styles.statusPill, { alignSelf: 'center', backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusPillText, { color: sc.text }]}>
                        {details?.order_status?.toUpperCase()}
                      </Text>
                    </View>
                  );
                })()}
              </View>

              {/* Farmer Card */}
              <View style={styles.card}>
                <View style={styles.farmerRow}>
                  <View style={styles.avatar}>
                    <Image
                      style={{ height: 45, width: 45, borderRadius: 22.5, resizeMode: 'cover' }}
                      source={{ uri: details?.farmer_data?.image }}
                    />
                  </View>

                  <View style={{ flex: 1, paddingRight: 8 }}>
                    {farmerName ? (
                      <Text style={styles.farmerName} numberOfLines={1}>
                        {farmerName}
                      </Text>
                    ) : null}

                    {farmerAddress ? (
                      <View style={{ flexDirection: 'row', marginTop: 4, paddingRight: 20 }}>
                        <Text style={styles.farmerMeta} numberOfLines={2}>
                          {farmerAddress}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <TouchableOpacity onPress={this.onCall} activeOpacity={0.85}>
                    <Image source={require('./assets/viber.png')} style={styles.callIconImg} />
                  </TouchableOpacity>

                  <TouchableOpacity onPress={this.onWhatsApp} activeOpacity={0.85} style={{ marginLeft: 15 }}>
                    <Image source={require('./assets/wht.png')} style={styles.waIconImg} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Items header */}
              <View style={styles.itemsHeader}>
                <Text style={styles.itemsTitle}>{`${(totalItems || items.length) || 0} Item(s) for delivery`}</Text>
                <Text style={styles.itemsTotal}>{`Total : ₹ ${total}`}</Text>
              </View>

              {/* Items card */}
              <View style={styles.card}>
                {items.length ? (
                  items.map((it, idx) => (
                    <View key={`${it?.variant_id || it?.product_id || idx}`} style={[styles.itemRow, idx !== 0 && styles.itemSep]}>
                      <View style={styles.itemImg}>
                        {it?.image ? <Image source={{ uri: it.image }} style={styles.productImg} /> : null}
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={{ flex:1,flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          {it?.product_name ? (
                            <View style={{ flex:1,flexDirection: 'row', justifyContent: 'center',paddingRight:15 }}>
                              <Text style={styles.itemName}>{String(it.product_name)}</Text>
                            </View>
                          ) : null}
                          <Text style={styles.itemPrice}>{`₹ ${this.toNum(it?.price)}`}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 }}>
                          {it?.variation ? (
                            <Text style={styles.itemSub}>Variant : {String(it.variation)}</Text>
                          ) : null}
                          <Text style={styles.itemQty}>{`Qty : ${this.toNum(it?.quantity)}`}</Text>
                        </View>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyItemsText}>No items</Text>
                )}
              </View>

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
        <View
          style={{
            padding: 30,
            paddingBottom: 10,
            paddingTop: 12,
            backgroundColor: '#FFF',
            width: '100%',
            alignSelf: 'center',
            borderRadius: 20,
            elevation: 10,
            shadowColor: 'grey',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 5,
          }}
        >
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.codValue}>{`₹ ${this.toNum(details?.grand_total)}`}</Text>
          </View>

          {/* ✅ Survey button BELOW grand total (as you asked earlier) */}
          {details?.order_status == 'delivered' ? (
            <TouchableOpacity activeOpacity={0.9} onPress={this.openSurvey} style={[styles.primaryBtn, { marginBottom: 12 }]}>
              <Text style={styles.primaryText}>SURVEY</Text>
            </TouchableOpacity>
          ) : null}

          {details?.order_status == 'pending' ? (
            <TouchableOpacity
              onPress={() => this.props.navigation.navigate('RescheduleDelivery', { order: details })}
              style={[styles.dangerBtn, { backgroundColor: '#6495ED', marginBottom: details?.order_status == 'pickup' ? 30 : 0 }]}
              activeOpacity={0.9}
            >
              <Text style={styles.dangerText}>RE-SCHEDULE</Text>
            </TouchableOpacity>
          ) : null}

          {(details?.order_status == 'pending' || details?.order_status == 'reschedule') &&
          (details?.order_status != 'cancelled' &&
          details?.order_status != 'delivered') ? (
            <View style={{ flexDirection: 'row', margin: 10, marginLeft: 0, marginRight: 0, marginTop: 5, borderRadius: 20 }}>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, marginRight: 5 }]}
                onPress={() => this.setState({ popup_type: 'pickup' }, () => this.onPickUp())}
                activeOpacity={0.9}
              >
                <Text style={styles.primaryText}>PICKUP</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dangerBtn, { flex: 1, marginLeft: 5 }]}
                onPress={() => this.setState({ popup_type: 'reject', selectedRejectReason: '' }, () => this.onPickUp())}
                activeOpacity={0.9}
              >
                <Text style={styles.dangerText}>REJECT</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {details?.order_status == 'pickup' ? (
            <View style={{ flexDirection: 'row', margin: 10, marginLeft: 0, marginRight: 0, marginTop: 0 }}>
              <TouchableOpacity
                style={[styles.dangerBtn, { flex: 1, marginRight: 5 }]}
                onPress={() => this.setState({ popup_type: 'cancel', selectedCancelReason: '' }, () => this.onPickUp())}
                activeOpacity={0.9}
              >
                <Text style={styles.dangerText}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPressIn={() => this.props.navigation.navigate('DeliverToFarmer', { order: details })}
                style={[styles.primaryBtn, { flex: 1, marginLeft: 5 }]}
                activeOpacity={0.9}
              >
                <Text style={styles.primaryText}>DELIVER ORDER</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {details?.order_status == 'cancelled' ? (
            <Text style={{ fontSize: 14, color: '#D64545', alignSelf: 'center', fontWeight: '800' }}>
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
            visible={this.state.show_pickup_confirm}
            onSheetClose={() => this.setState({ show_pickup_confirm: false })}
            snapPoints={this.state.popup_type == 'cancel' || this.state.popup_type == 'reject' ? [680, 680] : [270, 270]}
            style={{
              backgroundColor: 'white',
              borderRadius: 24,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.1,
              shadowRadius: 24,
              elevation: 30,
            }}
            backgroundStyle={{ backgroundColor: '#FFF', borderRadius: 24 }}
            enablePanDownToClose={true}
            animateOnMount={true}
            backdropComponent={({ style }) => <View style={[style, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]} />}
            onChange={(status) => (status == -1 ? this.setState({ show_pickup_confirm: false }) : '')}
          >
            <View style={{ padding: 20, paddingTop: 10, flex: 1, backgroundColor: '#FFF' }}>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: '#36454F',
                    fontSize: 18,
                    alignSelf: 'center',
                    fontFamily: 'Poppins-Bold',
                    textAlign: 'center',
                    fontWeight: 900,
                    color: this.state.popup_type == 'reject' || this.state.popup_type == 'cancel' ? '#E35335' : '#1C8A62',
                  }}
                >
                  {this.state.popup_type == 'pickup' ? 'Pickup' : this.state.popup_type == 'cancel' ? 'Cancel' : 'Reject'} Confirmation
                </Text>

                <Text
                  style={{
                    color: '##000',
                    fontSize: 14,
                    alignSelf: 'center',
                    fontFamily: 'Poppins',
                    textAlign: 'center',
                    marginTop: 6,
                    marginBottom: 10,
                    marginLeft: 20,
                    marginRight: 20,
                    fontWeight: '450',
                    lineHeight: 25,
                  }}
                >
                  {this.state.popup_type == 'cancel'
                    ? 'Please select a cancel reason and confirm.'
                    : this.state.popup_type == 'reject'
                    ? 'Please select a reject reason and confirm.'
                    : `Are you sure you want to mark this order as ${
                        this.state.popup_type == 'pickup'
                          ? 'PICKED UP ?'
                          : this.state.popup_type == 'reject'
                          ? 'REJECTED ?'
                          : 'CANCELLED ?'
                      }`}
                </Text>

                {this.state.popup_type == 'cancel' ? this.renderCancelReasons() : null}
                {this.state.popup_type == 'reject' ? this.renderRejectReasons() : null}

                <TouchableOpacity
                  disabled={
                    ((this.state.popup_type == 'cancel' && !this.state.selectedCancelReason) ||
                      (this.state.popup_type == 'reject' && !this.state.selectedRejectReason)) ||
                    this.state.isLoading
                  }
                  onPress={() => {
                    if (this.state.popup_type == 'cancel') {
                      this.orderStatusApi(this.state.popup_type, this.state.selectedCancelReason);
                    } else if (this.state.popup_type == 'reject') {
                      this.orderStatusApi(this.state.popup_type, this.state.selectedRejectReason);
                    } else {
                      this.orderStatusApi(this.state.popup_type);
                    }
                  }}
                  style={{
                    height: 45,
                    width: 200,
                    backgroundColor: this.state.popup_type == 'reject' || this.state.popup_type == 'cancel' ? '#E35335' : '#1C8A62',
                    borderRadius: 30,
                    alignSelf: 'center',
                    marginTop: 30,
                    justifyContent: 'center',
                    opacity:
                      ((this.state.popup_type == 'cancel' && !this.state.selectedCancelReason) ||
                        (this.state.popup_type == 'reject' && !this.state.selectedRejectReason)) ||
                      this.state.isLoading
                        ? 0.6
                        : 1,
                  }}
                >
                  {!this.state.isLoading ? (
                    <Text style={{ color: '#FFF', fontFamily: 'Poppins', alignSelf: 'center', fontSize: 14, fontWeight: '600' }}>
                      Confirm
                    </Text>
                  ) : (
                    <ActivityIndicator style={{ alignSelf: 'center' }} size="small" color="#FFF" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => this.setState({ show_pickup_confirm: false })}
                  style={{ alignSelf: 'center', padding: 20, justifyContent: 'center' }}
                >
                  <Text style={{ color: '#000', fontFamily: 'Poppins', alignSelf: 'center', fontSize: 14 }}>Cancel</Text>
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
  root: { flex: 1, backgroundColor: '#F3F5F7' },

  headerWrap: { backgroundColor: '#1C8A62' },
  headerSafe: { backgroundColor: '#1C8A62' },
  headerRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  backImg: { width: 25, height: 25, resizeMode: 'contain', tintColor: '#FFF' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 14, fontWeight: '800' },

  container: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16 },

  pageBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBoxText: { marginLeft: 10, fontSize: 12, fontWeight: '800', color: '#111827' },
  pageErrorText: { fontSize: 12, fontWeight: '800', color: '#6B7280' },

  topMeta: { marginBottom: 10, flexDirection: 'row' },
  statusPill: { alignSelf: 'flex-start', borderRadius: 60, paddingHorizontal: 12, paddingVertical: 5, fontWeight: '700' },
  statusPillText: { fontSize: 9, fontWeight: '700' },
  orderIdLine: { marginTop: 7, fontSize: 10, fontWeight: '800', color: '#111827' },
  orderIdBold: { fontSize: 11, fontWeight: '800', color: '#F68A20' },
  smallMeta: { fontSize: 12, color: '#111827', fontWeight: '600', marginTop: 7 },

  card: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E6EAF0', padding: 10, marginTop: 10 },

  farmerRow: { flexDirection: 'row', alignItems: 'center', padding: 5 },
  avatar: { width: 35, height: 35, borderRadius: 17.5, resizeMode: 'cover', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  farmerName: { fontSize: 14, fontWeight: '700', color: '#000' },
  farmerMeta: { fontSize: 13, fontWeight: '400', lineHeight: 20, color: '#4B5563', alignSelf: 'center' },
  phoneMeta: { marginTop: 7, fontSize: 12, color: '#111827' },

  callIconImg: { width: 25, height: 25, resizeMode: 'contain' },
  waIconImg: { width: 25, height: 25, resizeMode: 'contain', marginLeft: 10 },

  itemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 20 },
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

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 5, paddingBottom: 17, paddingLeft: 0, paddingRight: 0 },
  totalLabel: { fontSize: 15, fontWeight: '800', color: '#36454F' },
  codValue: { fontSize: 18, fontWeight: '800', color: '#F37A20' },

  primaryBtn: { height: 45, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C8A62', marginBottom: 12 },
  primaryText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },

  dangerBtn: { height: 45, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E35335' },
  dangerText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },

  emptyItemsText: { fontSize: 12, fontWeight: '700', color: '#6B7280', textAlign: 'center', paddingVertical: 10 },

  // ✅ Cancel reasons
  reasonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6 },
  radioOuter: { height: 18, width: 18, borderRadius: 9, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  radioOuterActive: { borderColor: '#E35335' },
  radioInner: { height: 10, width: 10, borderRadius: 5, backgroundColor: '#E35335' },
  reasonText: { flex: 1, color: '#111827', fontWeight: '600', fontSize: 14 },

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