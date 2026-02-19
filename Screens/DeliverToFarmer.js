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


export default class DeliverToFarmer extends Component {
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

      // bottomsheet
      show_sheet: false,
      popup_type: 'complete', // complete | cancel

      // cancel reasons
      cancelReasons: {}, // {key: label}
      selectedCancelReason: '', // key
    };
  }

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
    });

    this.cancelReasonsApi();
  }

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
            console.log("check status== ",this.state.details?.order_status)
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
    this.setState({ payment_type: 'cash' });
  };

  onScanQR = () => {
    this.setState({ payment_type: 'qr' });
    // open modal only if qr exists
    if (this.state.qr) this.setState({ qrModalVisible: true });
  };

  onComplete = () => {
    this.setState({ popup_type: 'complete', show_sheet: true });
  };

  onCancel = () => {
    this.setState({ popup_type: 'cancel', show_sheet: true, selectedCancelReason: '' });
  };

  toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // ✅ Fetch QR
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
        console.log('get QR error== ', e);
        this.setState({ qrLoading: false, qr: '', qrFailed: true, qrErrorText: String(e) });
      });
  };

  // ✅ Update Status API
  orderStatusApi = (status, cancelReasonKey = '') => {
    const formData = new FormData();
    formData.append('status', status=='deliver' ? 'delivered' : status); // "complete" / "cancel" OR whatever backend expects
    formData.append('order_id', this.state.details?.id);

    // IMPORTANT: For cancel, send reason key in type
    formData.append('type', this.state.payment_type);
     formData.append('reason', cancelReasonKey || '');

    console.log('update formData status=',formData);

    this.setState({ statusLoading: true }, () => {
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
          this.setState({ statusLoading: false });
          Toast.show(responseJson.message, Toast.SHORT);

          if (responseJson.status) {
            this.setState({ show_sheet: false }, () => {
              const nav = this.props?.navigation;
              // if (nav?.goBack) nav.goBack();
              if (nav?.goBack) nav.navigate('Survey',{order_data : this.state.details});

            });
          }
        })
        .catch((error) => {
          console.log('update status error== ', error);
          this.setState({ statusLoading: false });
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
          console.log('cancel reasons response== ', JSON.stringify(responseJson));
          this.setState({ reasonsLoading: false });
          if (responseJson.status) {
            const reasons = responseJson?.data || {};
            this.setState({ cancelReasons: reasons });
          }
        })
        .catch((error) => {
          console.log('cancel reasons error== ', error);
          this.setState({ reasonsLoading: false });
        });
    });
  };

  // ✅ QR Image source (with auth headers)
  getQrImageSource = () => {
    const { qr } = this.state;
    if (!qr) return null;

    // Cache bust to avoid stale blank image on iOS sometimes
    const bust = qr.includes('?') ? `&t=${Date.now()}` : `?t=${Date.now()}`;

    return {
      uri: qr + bust,
      headers: {
        Authorization: 'Bearer ' + global.token,
      },
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

  render() {
    const o = this.state.details || this.getOrder();
    const { statusLoading } = this.state;

    const orderCode = o?.order_code || '';
    const orderDate = o?.order_date || '';
    const statusText = o?.order_status || '';
    const totalItems = this.toNum(o?.total_items);

    const farmerName = o?.farmer_data?.name || '';
    const farmerPhone = o?.farmer_data?.phone || '';
    const farmerAddress = o?.farmer_data?.address || '';
    const farmerImage = o?.farmer_data?.image || '';

    const total = this.toNum(o?.grand_total);
    const items = Array.isArray(o?.order_items) ? o.order_items : [];

    const isCancel = this.state.popup_type === 'cancel';
    const confirmDisabled = isCancel && !this.state.selectedCancelReason;

    const isPaid = this.isAlreadyPaid(o);
    const paymentMode = o?.payment_mode || '';
    const paymentStatus = o?.payment_status || '';

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#1C8A62" />

        {/* Header */}
        <View style={styles.headerWrap}>
          <SafeAreaView style={styles.headerSafe}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={this.goBack} style={styles.headerIconBtn} activeOpacity={0.8}>
                <Image style={styles.backImg} source={require('./assets/back.png')} />
              </TouchableOpacity>

              <Text style={styles.headerTitle} numberOfLines={1}>
                Deliver To Farmer
              </Text>

              <View style={{ width: 42, height: 42 }} />
            </View>
          </SafeAreaView>
        </View>

            <NavigationEvents
                  onWillFocus={() => {}}
                  onDidFocus={() => {
                       this.deliverDetailsAPI(this.state.details?.id);
                  }}
                />

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {!o ? (
            <View style={styles.pageBox}>
              <Text style={styles.pageErrorText}>Missing navigation param: order</Text>
            </View>
          ) : (
            <>
              {/* Top meta */}
              <View style={styles.topMeta}>
                <View style={{ flex: 1 }}>
                  {!!orderCode ? (
                    <Text style={styles.orderIdLine}>
                      ORDER : <Text style={styles.orderIdBold}>{orderCode}</Text>
                    </Text>
                  ) : null}
                  {!!orderDate ? <Text style={styles.smallMeta}>{orderDate}</Text> : null}
                </View>

                {!!statusText ? (
                  <View style={[styles.statusPill, { alignSelf: 'center' }]}>
                    <Text style={styles.statusPillText}>{String(statusText).toUpperCase()}</Text>
                  </View>
                ) : null}
              </View>

              {/* Farmer card */}
              <View style={styles.card}>
                <View style={styles.farmerRow}>
                  <View style={styles.avatar}>
                    {!!farmerImage ? (
                      <Image style={styles.avatarImg} source={{ uri: farmerImage }} />
                    ) : (
                      <View style={styles.avatarFallback} />
                    )}
                  </View>

                  <View style={{ flex: 1, paddingRight: 8 }}>
                    {!!farmerName ? <Text style={styles.farmerName}>{farmerName}</Text> : null}

                    {!!farmerAddress ? (
                      <View style={styles.addrRow}>
                        {/* <Image style={styles.gpsImg} source={require('./assets/gps.png')} /> */}
                        <Text style={styles.farmerMeta} numberOfLines={2}>
                          {farmerAddress}
                        </Text>
                      </View>
                    ) : null}

                    {/* {!!farmerPhone ? <Text style={styles.phoneMeta}>{farmerPhone}</Text> : null} */}
                  </View>

                  <TouchableOpacity onPress={this.onCall} activeOpacity={0.85}>
                    <Image source={require('./assets/viber.png')} style={styles.callIconImg} />
                  </TouchableOpacity>

                  <TouchableOpacity onPress={this.onWhatsApp} activeOpacity={0.85} style={{ marginLeft: 25 }}>
                    <Image source={require('./assets/wht.png')} style={styles.waIconImg} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Items header */}
              <View style={styles.itemsHeader}>
                             <Text style={styles.itemsTitle}>
                               {`${(totalItems || items.length) || 0} Item(s) for delivery`}
                             </Text>
                             <Text style={styles.itemsTotal}>{`Total : ₹ ${total}`}</Text>
                           </View>

                           {/* ✅ Order Items */}
<View style={styles.card}>

  {(items || []).length ? (
    (items || []).map((it, idx) => (
      <View
        key={String(it?.product_id ?? it?.variant_id ?? idx)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 10,
          borderTopWidth: idx === 0 ? 0 : 1,
          borderTopColor: '#E6EAF0',
        }}
      >
        {it?.image ? (
          <Image
            source={{ uri: String(it.image) }}
            style={{ width: 44, height: 44, borderRadius: 10, marginRight: 10, backgroundColor: '#F3F5F6' }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ width: 40, height: 40, borderRadius: 10, marginRight: 10, backgroundColor: '#F3F5F6' }} />
        )}

        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: '500', color: '#000' }} numberOfLines={1}>
            {it?.product_name || it?.name || '-'}
          </Text>

          {!!it?.variation ? (
            <Text style={{ marginTop: 8, fontSize: 13, color: '#6B7280' }} numberOfLines={1}>
              {it.variation}
            </Text>
          ) : null}
        </View>

        <View style={{ alignItems: 'flex-end' }}>
           <Text style={{ fontSize: 15, fontWeight: '600', color: '#0F7451' }}>
            ₹ {String(it?.price ?? 0)}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#111827' ,marginTop: 8, }}>
            Qty: {String(it?.quantity ?? 0)}
          </Text>
         
        </View>
      </View>
    ))
  ) : (
    <Text style={{ color: '#6B7280', fontWeight: '700' }}>No items found</Text>
  )}
</View>

              
<View style={styles.card}>
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
</View>

              {/* Footer */}
             
              <View style={{ height: 14 }} />
            </>
          )}
        </ScrollView>

         <View style={styles.footerBox}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Grand Total</Text>
                  <Text style={styles.codValue}>{`₹ ${total}`}</Text>
                </View>

               {this.state.details?.order_status!='delivered' && <View style={{}}>
                 <TouchableOpacity style={styles.primaryBtn} onPress={this.onComplete} activeOpacity={0.9}>
                  <Text style={styles.primaryText}>COMPLETE DELIVERY</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.dangerBtn, { marginTop: 10 }]} onPress={this.onCancel} activeOpacity={0.9}>
                  <Text style={styles.dangerText}>CANCEL DELIVERY</Text>
                </TouchableOpacity>
               </View> }
              {this.state.details?.order_status=='delivered' && <TouchableOpacity activeOpacity={0.9} onPress={this.openSurvey} style={[styles.primaryBtn, { marginBottom: 12 }]}>
                             <Text style={styles.primaryText}>SURVEY</Text>
                           </TouchableOpacity> }
              </View>


        {/* ✅ QR Fullscreen Modal */}
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
                  <Text style={{ color: '#fff', fontWeight: '800', textAlign: 'center' }}>
                    QR failed to load
                  </Text>
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

        {/* ✅ BottomSheet Confirm + Cancel Reasons */}
        {this.state.show_sheet ? (
          <BottomSheet
            visible={this.state.show_sheet}
            onSheetClose={() => this.setState({ show_sheet: false })}
            snapPoints={isCancel ? [680, 680] : [290, 290]}
            backgroundStyle={{ backgroundColor: '#FFF', borderRadius: 24 }}
            enablePanDownToClose={true}
            animateOnMount={true}
            backdropComponent={({ style }) => <View style={[style, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]} />}
            onChange={(status) => (status === -1 ? this.setState({ show_sheet: false }) : '')}
          >
            <View style={{ padding: 20, paddingTop: 10, flex: 1, backgroundColor: '#FFF' }}>
              <Text
                style={{
                  fontSize: 20,
                  alignSelf: 'center',
                  fontFamily: 'Poppins-Bold',
                  textAlign: 'center',
                  fontWeight: '900',
                  lineHeight: 25,
                  color: isCancel ? '#E35335' : '#1C8A62',
                }}
              >
                {isCancel ? 'Cancel' : 'Complete'} Delivery
              </Text>

              <Text
                style={{
                  color: '#000',
                  fontSize: 14,
                  alignSelf: 'center',
                  fontFamily: 'Poppins',
                  textAlign: 'center',
                  lineHeight: 22,
                  marginLeft: 24,
                  marginRight: 24,
                  fontWeight: '450',
                  marginBottom: isCancel ? 0 : 20,
                  marginTop:10
                }}
              >
                {isCancel
                  ? 'Please select a cancel reason and confirm.'
                  : 'Are you sure you want to mark this order as complete?'}
              </Text>

              {/* ✅ Cancel reasons list */}
              {isCancel ? this.renderCancelReasons() : null}

              <TouchableOpacity
                disabled={confirmDisabled || statusLoading}
                onPress={() => {
                  if (isCancel) {
                    this.orderStatusApi('cancel', this.state.selectedCancelReason);
                  } else {
                    this.orderStatusApi('deliver', '');
                  }
                }}
                style={[
                  styles.confirmBtn,
                  {
                    backgroundColor: isCancel ? '#E35335' : '#1C8A62',
                    opacity: confirmDisabled || statusLoading ? 0.6 : 1,
                  },
                ]}
              >
                {statusLoading ? (
                  <ActivityIndicator style={{ alignSelf: 'center' }} size="small" color="#FFF" />
                ) : (
                  <Text style={styles.confirmText}>Confirm</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => this.setState({ show_sheet: false })} style={{ alignSelf: 'center', padding: 16 }}>
                <Text style={{ color: '#000', fontFamily: 'Poppins', alignSelf: 'center', fontSize: 14 }}>Close</Text>
              </TouchableOpacity>
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
  backImg: { width: 25, height: 25, resizeMode: 'contain',tintColor:'#FFF'},
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 14, fontWeight: '800' },

  container: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16 },

  pageBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageErrorText: { fontSize: 12, fontWeight: '800', color: '#6B7280' },

  topMeta: { marginBottom: 10, flexDirection: 'row' },
  statusPill: { backgroundColor: '#F37A20', borderRadius: 60, paddingHorizontal: 18, paddingVertical: 5 },
  statusPillText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3, color: '#FFF' },
  orderIdLine: { marginTop: 8, fontSize: 11, fontWeight: '800', color: '#111827' },
  orderIdBold: { fontSize: 12, fontWeight: '800', color: '#F68A20'},
  smallMeta: { fontSize: 14, color: '#111827', marginTop: 7, fontWeight: '600' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    padding: 12,
    marginBottom: 12,
    marginTop: 10,
  },

  farmerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 10, overflow: 'hidden', backgroundColor: '#F3F5F6' },
  avatarImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarFallback: { flex: 1, backgroundColor: '#F3F5F6' },

  farmerName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  addrRow: { flexDirection: 'row', marginTop: 7 },
  gpsImg: { height: 20, width: 20, resizeMode: 'contain', alignSelf: 'center' },
  farmerMeta: { fontSize: 13, color: '#4B5563',  alignSelf: 'center', flex: 1,marginRight:15 },
  phoneMeta: { marginTop: 7, fontSize: 12, color: '#111827' },

  callIconImg: { width: 28, height: 28, resizeMode: 'contain' },
  waIconImg: { width: 28, height: 28, resizeMode: 'contain' },

  itemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 10 },
  itemsTitle: { fontSize: 12, fontWeight: '700', color: '#111827' },
  itemsTotal: { fontSize: 13, fontWeight: '800', color: '#0F7451' },

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
  payImg: { flex:1,minHeight: 120,alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7FAF3' },
  payFooterPrimary: { height: 40, backgroundColor: '#2F7D67', alignItems: 'center', justifyContent: 'center' },
  payTileText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  footerBox: {
    padding: 20,
    paddingBottom:30,
    paddingTop:15,
    backgroundColor: '#FFF',
    width: '100%',
    alignSelf: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    elevation: 3,
  shadowColor: 'grey',
  shadowOffset: { width: 0, height: -2 },
  shadowOpacity: 0.2,
  shadowRadius: 5,

  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 18 },
  totalLabel: { fontSize: 15, fontWeight: '900', color: '#36454F' },
  codValue: { fontSize: 20, fontWeight: '800', color: '#F37A20' },

  primaryBtn: { height: 42, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C8A62',marginLeft:5,marginRight:5 },
  primaryText: { color: '#fff', fontSize: 12, fontWeight: '800',},

  dangerBtn: { height: 42, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E35335',marginLeft:5,marginRight:5 },
  dangerText: { color: '#fff', fontSize: 12, fontWeight: '800',},

  qrThumb: { height: '100%', width: '100%' },

  // ✅ QR Modal
  qrModalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  qrModalHeader: {
    height: 80,
    paddingTop: 36,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  qrCloseBtn: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop:40,
  },
  qrCloseText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  qrModalBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 40 },
  qrModalImage: { width: '92%', height: '65%' },

  // ✅ Cancel reasons
  reasonRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6 },
  radioOuter: {
    height: 18,
    width: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioOuterActive: { borderColor: '#E35335' },
  radioInner: { height: 10, width: 10, borderRadius: 5, backgroundColor: '#E35335' },
  reasonText: { flex: 1, color: '#111827', fontWeight: '700', fontSize: 14 },

  confirmBtn: {
    height: 45,
    width: 220,
    borderRadius: 30,
    alignSelf: 'center',
    marginTop: 14,
    justifyContent: 'center',
  },
  confirmText: { color: '#FFF', fontFamily: 'Poppins', alignSelf: 'center', fontSize: 14, fontWeight: '800' },
});