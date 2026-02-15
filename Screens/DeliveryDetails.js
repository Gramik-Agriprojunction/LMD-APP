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
} from 'react-native';
import constants from './constants';
import BottomSheet from '@gorhom/bottom-sheet';
import Toast from 'react-native-simple-toast';
import {NavigationEvents} from 'react-navigation';



export default class DeliveryDetails extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: false,
      details: null,
      hasError: false,
      show_pickup_confirm : false,
      popup_type : '',
      // cancel reasons
      reasonsLoading: false,
      cancelReasons: {}, // {key: label}
      selectedCancelReason: '',
    };
  }

  getOrder = () => this.props?.navigation?.getParam('order', null);

  componentDidMount() {
    const order = this.getOrder();
    const id = order?.id;

    if (id) this.deliverDetailsAPI(id);
    else console.log('DeliveryDetails: navigation order.id missing');
    this.cancelReasonsApi();
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
          this.setState({ details: json.order });
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

    // digits only (remove + and spaces)
    const phone = String(phoneRaw).replace(/[^\d]/g, '');
    if (!phone) return console.log('Invalid phone for WhatsApp:', phoneRaw);

    const url = `whatsapp://send?phone=${phone}`;

    try {
      const can = await Linking.canOpenURL(url);
      if (can) return Linking.openURL(url);

      // fallback
      const waWeb = `https://wa.me/${phone}`;
      const canWeb = await Linking.canOpenURL(waWeb);
      if (canWeb) return Linking.openURL(waWeb);

      console.log('WhatsApp not available');
    } catch (e) {
      console.log('WhatsApp error:', e);
    }
  };

  onPickUp(){
    this.setState({show_pickup_confirm : true})
  } 
  onAddAmount = () => console.log('Add amount pressed');

  toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  orderStatusApi(status, cancelReasonKey = '') {
    const formData = new FormData();
    formData.append('status', status=='deliver' ? 'delivered' : status);
    formData.append('order_id', this.state.details?.id);
    formData.append('type', '');
    formData.append('reason', cancelReasonKey || '');

    this.setState({ isLoading: true }, () => {
      console.log('order update formdata status== ', formData);

      fetch(constants.updateStatus, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + global.token,
          'Accept' : 'application/json'
        },
        body: formData,
      })
        .then((response) => response.json())
        .then((responseJson) => {
          console.log('update status response== ', JSON.stringify(responseJson));
          this.setState({isLoading : false})
          Toast.show(responseJson.message, Toast.SHORT); 
          if(responseJson.status)
          {
              this.deliverDetailsAPI(this.state.details?.id)
              this.setState({show_pickup_confirm : false})
          }
        })
        .catch((error) => {
          console.log('update status error== ', error);
          this.setState({ isLoading: false, order_list: [] });
        });
    });
  };

maskPhone = (phoneRaw) => {
  if (!phoneRaw) return '';

  const raw = String(phoneRaw).trim();
  const hasPlus = raw.startsWith('+');

  // keep only digits
  let digits = raw.replace(/[^\d]/g, '');

  // if it's like +91xxxxxxxxxx, try to mask only the local 10 digits
  // (keeps your country code intact)
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

  goBack = () => {
  const nav = this.props?.navigation;
  if (nav?.goBack) nav.goBack();
};

  render() {
    const { isLoading, details, hasError } = this.state;

    const orderIdText = details?.order_code || '';
    const orderDate = details?.order_date || '';
    const totalItems = this.toNum(details?.total_items);

    const farmerName = details?.farmer_data?.name || '';
    const farmerPhone = details?.farmer_data?.phone || '';
    const farmerAddress = details?.farmer_data?.address || '';

    const total = this.toNum(details?.grand_total);

    const items = Array.isArray(details?.order_items) ? details.order_items : [];

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#1C8A62" />

                 <NavigationEvents
                onWillFocus={() => {
                  
                }}
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
          {/* Loader / Error */}
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

          {/* Content only if details exists */}
          {details ? (
            <>
              {/* Top meta */}
              <View style={styles.topMeta}>
               

                <View style={{flex:1}}>
                  {orderIdText ? (
                    <Text style={styles.orderIdLine}>
                      ORDER : <Text style={styles.orderIdBold}>{orderIdText}</Text>
                    </Text>
                  ) : null}

                  {orderDate ? <Text style={styles.smallMeta}>{orderDate}</Text> : null}
                </View>
                 <View style={[styles.statusPill,{alignSelf:'center'}]}>
                  <Text style={styles.statusPillText}>{this.state.details?.order_status?.toUpperCase()}</Text>
                </View>
              </View>

              {/* Farmer Card */}
              <View style={styles.card}>
                <View style={styles.farmerRow}>
                  <View style={styles.avatar}>
                    <Image style={{height:45,width:45,borderRadius:22.5,resizeMode:'cover'}} source={{uri : this.state.details?.farmer_data?.image}} />
                  </View>

                  <View style={{ flex: 1, paddingRight: 8 }}>
                    {farmerName ? (
                      <Text style={styles.farmerName} numberOfLines={1}>
                        {farmerName}
                      </Text>
                    ) : null}

                    {farmerAddress ? (
                      <View style={{flexDirection:'row',marginTop:7}}>
                          <Image style={{height:20,width:20,resizeMode:'contain',alignSelf:'center'}} source={require('./assets/gps.png')} />
                          <Text style={styles.farmerMeta} numberOfLines={2}>
                            {farmerAddress} 
                          </Text>
                      </View>
                    ) : null}

                    {/* {farmerPhone ? (
                     <Text style={styles.phoneMeta} numberOfLines={1}>
                        {this.maskPhone(details?.farmer_data?.phone)}
                      </Text>
                    ) : null} */}
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
                <Text style={styles.itemsTitle}>
                  {`${(totalItems || items.length) || 0} Item(s) for delivery`}
                </Text>
                <Text style={styles.itemsTotal}>{`Total : ₹ ${total}`}</Text>
              </View>

              {/* Items card */}
              <View style={styles.card}>
                {items.length ? (
                  items.map((it, idx) => (
                    <View
                      key={`${it?.variant_id || it?.product_id || idx}`}
                      style={[styles.itemRow, idx !== 0 && styles.itemSep]}
                    >
                      <View style={styles.itemImg}>
                        {it?.image &&
                          <Image source={{ uri: it.image }} style={styles.productImg} />
                        }
                      </View>

                      <View style={{ flex: 1 }}>
                        {it?.product_name ? (
                          <View style={{flexDirection:'row',justifyContent:'center',justifyContent:'space-between'}}>
                              <Text style={styles.itemName}>
                                {String(it.product_name)}
                              </Text>
                          </View>  
                        ) : null}

                        {it?.variation ? (
                          <Text style={styles.itemSub}>
                            Variant : {String(it.variation)}
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.itemRight}>
                        <Text style={styles.itemPrice}>{`₹ ${this.toNum(it?.price)}`}</Text>
                        <Text style={styles.itemQty}>{`Qty : ${this.toNum(it?.quantity)}`}</Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyItemsText}>No items</Text>
                )}

               
              </View>

              {/* QR + UPI Row */}
              {/* <View style={styles.payRow}>
                <View style={styles.payLeft}>
                  <Text style={styles.payTitle}>QR + UPI</Text>
                </View>

                <TouchableOpacity style={styles.payAddBtn} onPress={this.onAddAmount} activeOpacity={0.85}>
                  <Text style={styles.payAddText}>+ ₹500</Text>
                </TouchableOpacity>
              </View> */}

              {/* Actions */}
            

              <View style={{ height: 14 }} />
            </>
          ) : null}
        </ScrollView>
       <View style={{padding:30,paddingBottom:10,paddingTop:12,backgroundColor:'#FFF',width:'100%',alignSelf:'center',borderRadius:20,borderRadius:20,elevation: 10,shadowColor: 'grey',shadowOffset: {width: 0, height: 2},shadowOpacity: 0.3,shadowRadius: 5}}>
           <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Grand Total</Text>
                  <Text style={styles.codValue}>{`₹ ${total}`}</Text>
                </View>
                {this.state.details?.order_status=='pending' && <TouchableOpacity onPress={()=> this.props.navigation.navigate('RescheduleDelivery',{order : this.state.details})} style={[styles.dangerBtn,{backgroundColor:'#6495ED',marginBottom : this.state.details?.order_status=='pickup' ? 30 : 0}]}  activeOpacity={0.9}>
                <Text style={styles.dangerText}>RE-SCHEDULE</Text>
              </TouchableOpacity> }
          {this.state.details?.order_status=='pickup' || (this.state.details?.order_status=='reschedule') && this.state.details?.order_status!='cancelled' && <View style={{flexDirection:'row',margin:10,marginLeft:0,marginRight:0,marginTop:5,borderRadius:20,borderRadius:20}}>
                 <TouchableOpacity style={[styles.primaryBtn,{flex:1,marginRight:5}]} onPress={()=> this.setState({popup_type : 'pickup'},()=>{this.onPickUp()})} activeOpacity={0.9}>
                <Text style={styles.primaryText}>PICKUP</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.dangerBtn,{flex:1,marginLeft:5}]} onPress={()=> this.setState({popup_type : 'reject'},()=>{this.onPickUp()})} activeOpacity={0.9}>
                <Text style={styles.dangerText}>REJECT</Text>
              </TouchableOpacity>
           </View> }

            {this.state.details?.order_status=='pickup' && <View style={{flexDirection:'row',margin:10,marginLeft:0,marginRight:0,marginTop:0}}>
                 <TouchableOpacity style={[styles.dangerBtn,{flex:1,marginRight:5}]} onPress={()=> this.setState({popup_type : 'cancel', selectedCancelReason: ''},()=>{this.onPickUp()})} activeOpacity={0.9}>
                <Text style={styles.dangerText}>CANCEL</Text>
              </TouchableOpacity>
                 <TouchableOpacity onPressIn={()=> this.props.navigation.navigate('DeliverToFarmer',{order : this.state.details})} style={[styles.primaryBtn,{flex:1,marginLeft:5}]} activeOpacity={0.9}>
                <Text style={styles.primaryText}>DELIVER ORDER</Text>
              </TouchableOpacity>
           </View> }
           {this.state.details?.order_status=='cancelled' || this.state.details?.order_status=='cancelled' && <Text style={{fontSize:14,color:'#D64545',alignSelf:'center',fontWeight:'800'}}>This order has been cancelled</Text> }
        </View> 
        {this.state.show_pickup_confirm && <BottomSheet
                            visible={this.state.show_pickup_confirm}
                            onSheetClose={() => this.setState({show_pickup_confirm: false})}
                            snapPoints={ this.state.popup_type=='cancel' ?  [680, 680] : [270, 270] }
                            style={{
                              backgroundColor: 'white', // <==== HERE
                              borderRadius: 24,
                              shadowColor: '#000000',
                              shadowOffset: {
                                width: 0,
                                height: 8,
                              },
                              shadowOpacity: 0.1,
                              shadowRadius: 24,
                              elevation: 30,   
                            }}
                            backgroundStyle={{backgroundColor: '#FFF', borderRadius: 24}}
                            enablePanDownToClose={true}
                            animateOnMount={true}
                            backdropComponent={({style}) => (
                              <View
                                style={[style, {backgroundColor: 'rgba(0, 0, 0, 0.5)'}]}
                              />
                            )}
                            onChange={status =>
                              status == -1 ? this.setState({show_pickup_confirm: false}) : ''
                            }
                            >
                              
                            <View style={{padding: 20, paddingTop: 10, flex: 1,backgroundColor:'#FFF'}}>
                              <View style={{flex: 1}}>
                                  <Text style={{color:'#36454F',fontSize:18,alignSelf:'center',fontFamily:'Poppins-Bold',textAlign:'center',fontWeight:900,color:this.state.popup_type=='reject' || this.state.popup_type=='cancel' ? '#E35335' : '#1C8A62' }}>{this.state.popup_type=='pickup' ? 'Pickup' : this.state.popup_type=='cancel' ? 'Cancel' : 'Reject'} Confirmation</Text>
                                  <Text style={{color:'##000',fontSize:14,alignSelf:'center',fontFamily:'Poppins',textAlign:'center',marginTop:6,marginBottom:10,marginLeft:20,marginRight:20,fontWeight:'450',lineHeight:25}}>
                                    {this.state.popup_type=='cancel'
                                      ? 'Please select a cancel reason and confirm.'
                                      : `Are you sure you want to mark this order as ${this.state.popup_type=='pickup' ? 'PICKED UP ?' : this.state.popup_type=='reject' ? 'REJECTED ?' : 'CANCELLED ?' }`}
                                  </Text>
                                  {this.state.popup_type=='cancel' ? this.renderCancelReasons() : null}
                              <TouchableOpacity
                                disabled={(this.state.popup_type=='cancel' && !this.state.selectedCancelReason) || this.state.isLoading}
                                onPress={()=> {
                                  if(this.state.popup_type=='cancel'){
                                    this.orderStatusApi(this.state.popup_type, this.state.selectedCancelReason)
                                  }else{
                                    this.orderStatusApi(this.state.popup_type)
                                  }
                                }}
                                style={{
                                  height:45,
                                  width:200,
                                  backgroundColor:this.state.popup_type=='reject' || this.state.popup_type=='cancel' ? '#E35335' : '#1C8A62',
                                  borderRadius:30,
                                  alignSelf:'center',
                                  marginTop:30,
                                  justifyContent:'center',
                                  opacity:(this.state.popup_type=='cancel' && !this.state.selectedCancelReason) || this.state.isLoading ? 0.6 : 1
                                }}
                              >
                                    {!this.state.isLoading && <Text style={{color:'#FFF',fontFamily:'Poppins',alignSelf:'center',fontSize:14,fontWeight:'600'}}>Confirm</Text> }
                                    {this.state.isLoading &&
                                          <ActivityIndicator style={{alignSelf:'center'}} size="small" color="#FFF" />
                                    }
                                  </TouchableOpacity>         

                              <TouchableOpacity onPress={()=> this.setState({show_pickup_confirm:false})} style={{alignSelf:'center',padding:20,justifyContent:'center'}}>
                                     <Text style={{color:'#000',fontFamily:'Poppins',alignSelf:'center',fontSize:14}}>Cancel</Text> 
                              </TouchableOpacity>         
                              </View>
                            </View>
                      </BottomSheet> }
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBoxText: { marginLeft: 10, fontSize: 12, fontWeight: '800', color: '#111827' },
  pageErrorText: { fontSize: 12, fontWeight: '800', color: '#6B7280' },

  topMeta: { marginBottom: 10,flexDirection:'row' },
  statusPill: { alignSelf: 'flex-start', backgroundColor: '#F37A20', borderRadius: 60, paddingHorizontal: 12, paddingVertical: 5,fontWeight:'700' },
  statusPillText: { fontSize: 9,fontWeight:'700', letterSpacing: 0.3, color: '#FFF' },
  orderIdLine: { marginTop: 8, fontSize: 10, fontWeight: '800', color: '#111827' },
  orderIdBold: { fontSize:11,fontWeight: '800',color:'#F68A20'},
  smallMeta: {fontSize: 12, color: '#111827',fontWeight:'600',marginTop:7},

  card: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E6EAF0', padding: 10},

  farmerRow: { flexDirection: 'row', alignItems: 'center',padding:5 },
  avatar: { width: 40, height: 40, borderRadius: 20,resizeMode:'cover', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  farmerName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  farmerMeta: { fontSize: 12,fontWeight:'500', color: '#4B5563',marginLeft:1,alignSelf:'center' },
  phoneMeta: { marginTop: 7, fontSize: 12,color: '#111827' },

  callIconImg: { width: 25, height: 25, resizeMode: 'contain'},
  waIconImg: { width: 25, height: 25, resizeMode: 'contain',marginLeft:15 },

  itemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,marginTop:25 },
  itemsTitle: { fontSize: 12, color: '#000',fontWeight:'500',letterSpacing:.3},
  itemsTotal: { fontSize: 12, fontWeight: '500', color: '#000' },

  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  itemSep: { borderTopWidth: 1, borderTopColor: '#EEF2F6' },
  itemImg: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  productImg: { width: 60, height: 60,borderRadius:5,resizeMode: 'cover' },

  itemName: { fontSize: 13, color: '#111827',fontWeight:'600' ,lineHeight:20},
  itemSub: { marginTop: 6, fontSize: 12, color: '#F37A20',fontWeight:'600',letterSpacing:.3 },
  itemRight: { width: 88, alignItems: 'flex-end' },
  itemPrice: { fontSize: 14, fontWeight: '800', color: '#0F7451' },
  itemQty: { marginTop: 15, fontSize: 13, color: 'grey',letterSpacing : 0.3,fontWeight:'600' },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 5,
    paddingBottom:12,
    paddingLeft:0,
    paddingRight:0
  },
  totalLabel: { fontSize: 15, fontWeight: '800', color: '#36454F'},
  codValue: { fontSize: 18, fontWeight: '800', color: '#F37A20' },

  payRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    height: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  payLeft: { flexDirection: 'column', justifyContent: 'center' },
  payTitle: { fontSize: 12, fontWeight: '900', color: '#111827' },
  payAddBtn: {
    height: 36,
    borderRadius: 10,
    backgroundColor: '#2F7D67',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payAddText: { color: '#fff', fontSize: 12, fontWeight: '900' },

  primaryBtn: {
    height: 45,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C8A62',
    marginBottom: 12,
  },
  primaryText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },

  dangerBtn: { height: 45, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E35335' },
  dangerText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.2  },

  emptyItemsText: { fontSize: 12, fontWeight: '700', color: '#6B7280', textAlign: 'center', paddingVertical: 10 },
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
  reasonText: { flex: 1, color: '#111827', fontWeight: '600', fontSize: 14 },
});