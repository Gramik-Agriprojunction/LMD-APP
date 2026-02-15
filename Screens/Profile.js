import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import constants from './constants';
import Toast from 'react-native-simple-toast';

import {NavigationEvents} from 'react-navigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackActions, NavigationActions } from 'react-navigation';

const resetAction = StackActions.reset({
  index: 0,                       
  actions: [NavigationActions.navigate({ routeName: 'Login'})],
});

const THEME = {
  green: '#1C8A62',
  greenPill: '#0F7451',
  bg: '#F3F5F7',
  border: '#E6EAF0',
  text: '#111827',
  subText: '#6B7280',
};

const TILE = {
  picked_up: { bg: '#E9EEF3', valueColor: '#484b4d', label: 'Picked Up' },

  // ✅ swapped colors (as you asked)
  pending: { bg: '#FCE9C9', valueColor: '#c27e08', label: 'Pending' },
  delivered: { bg: '#DDF3EA', valueColor: '#06bf72', label: 'Delivered' },

  in_transit: { bg: '#DCEEFF', valueColor: '#0B5394', label: 'In-Transit' },
  reschedule_order: { bg: '#E9E6FF', valueColor: '#3C2F8F', label: 'Re-schedule' },
  rto: { bg: '#FAD8D8', valueColor: '#B10000', label: 'RTO' },
};

export default class Profile extends Component {
  constructor(props) {
    super(props);
    this.state = {
      profileLoading: false,
      profile: null, // API only
      missingFields: [], 
      show_login : false
    };
  }

  componentDidMount() {
    this.profileApi();
  }

  goBack = () => {
    const nav = this.props?.navigation;
    if (nav?.goBack) nav.goBack();
  };

  goToSettlementHistory = () => {
    this.props?.navigation?.navigate('SettlementHistory');
  };

  goToCashSettlement = () => {
    // this.props?.navigation?.navigate('CashSettlement');
    this.props?.navigation?.navigate('SettleList');

  };

  // ✅ Navigate to TrackOrders with selected delivery status
  onPressStatus = (statusKey) => {
    this.props?.navigation?.navigate('TrackOrders', { status: statusKey });
  };

  // ✅ PROFILE API (GET) - your API returns object directly
  profileApi = () => {
    this.setState({ profileLoading: true, missingFields: [] }, () => {
      fetch(constants.profile, {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + global.token,
          Accept: 'application/json',
        },
      })
        .then((r) => r.json())
        .then((json) => {
          console.log('profile response== ', JSON.stringify(json));

          const p = json || null;

          // log missing fields only (no UI dummy text)
          const missing = [];
          if (!p?.id) missing.push('id');
          if (!p?.name) missing.push('name');
          if (!p?.user_type) missing.push('user_type');
          if (!p?.phone) missing.push('phone');
          if (!p?.avatar) missing.push('avatar');
          if (!p?.orders) missing.push('orders');

          const o = p?.orders || {};
          ['picked_up', 'pending', 'delivered', 'in_transit', 'reschedule_order', 'rto'].forEach((k) => {
            if (o?.[k] === undefined || o?.[k] === null) missing.push(`orders.${k}`);
          });

          if (missing.length) console.log('PROFILE MISSING FIELDS =>', missing);

          this.setState({
            profileLoading: false,
            profile: p,
            missingFields: missing,
          });
        })
        .catch((e) => {
          console.log('profile error== ', e);
          Toast.show('Profile load failed', Toast.SHORT);
          this.setState({ profileLoading: false, profile: null });
        });
    });
  };

  toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  renderTile = (key, rawValue) => {
    const t = TILE[key];
    const value = this.toNum(rawValue);

    return (
      <TouchableOpacity
        key={key}
        activeOpacity={0.9}
        onPress={() => this.onPressStatus(key)}
        style={[styles.tile, { backgroundColor: t.bg }]}
      >
        <Text style={styles.tileLabel} numberOfLines={1}>
          {t.label}
        </Text>
        <Text style={[styles.tileValue, { color: t.valueColor }]}>{String(value)}</Text>
      </TouchableOpacity>
    );
  };

    onLogout()
    {
      this.setState({show_logout : false})
      global.token = ''
      AsyncStorage.getAllKeys()
      .then(keys => AsyncStorage.multiRemove(keys))
      .then(() => this.props.navigation.dispatch(resetAction));
    }

  render() {
    const { profile, profileLoading } = this.state;

    const name = profile?.name ? String(profile.name).trim() : '';
    const avatar = profile?.avatar ? String(profile.avatar) : '';
    const phone = profile?.phone ? String(profile.phone) : '';

    const role =
      profile?.user_type === 'delivery_partner'
        ? 'Delivery Partner'
        : profile?.user_type
        ? String(profile.user_type).replace(/_/g, ' ')
        : '';

    const orders = profile?.orders || {};

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={THEME.green} />

        {/* ✅ Header (same as other screens) */}
        <View style={styles.headerWrap}>
          <SafeAreaView style={styles.headerSafe}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={this.goBack} style={styles.headerIconBtn} activeOpacity={0.8}>
                <Image style={styles.backImg} source={require('./assets/back.png')} />
              </TouchableOpacity>

              {(!!name || !!avatar || !!phone || !!role) && (
              <View style={styles.profileRow}>
                {!!avatar ? (
                  <View style={styles.avatar}>
                    <Image source={{ uri: avatar }} style={styles.avatarImg} />
                  </View>
                ) : (
                  <View style={styles.avatar}>
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>{name ? name.slice(0, 1).toUpperCase() : ''}</Text>
                    </View>
                  </View>
                )}

                <View style={{ flex: 1,alignSelf:'center' }}>
                  {!!name && (
                    <Text style={styles.name} numberOfLines={1}>
                      {name}
                    </Text>
                  )}

                  {/* {!!role && (
                    <Text style={styles.role} numberOfLines={1}>
                      {role}
                    </Text>
                  )} */}

                  {!!phone && (
                    <Text style={styles.phoneText} numberOfLines={1}>
                      {phone}
                    </Text>
                  )}
                </View>
              </View>
          )}
            </View>
          </SafeAreaView>
        </View>

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          
          

          {/* ✅ Live Orders (exact same structure as LMDDashboard) */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTop}>
              <Text style={styles.sectionTitle}>Live Orders</Text>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => this.props?.navigation?.navigate('TrackOrders')}
                style={styles.viewBtn}
              >
                <Text style={styles.viewBtnText}>View</Text>
                <Text style={styles.viewBtnArrow}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tilesGrid}>
              {this.renderTile('picked_up', orders?.picked_up)}
              {this.renderTile('pending', orders?.pending)}
              {this.renderTile('delivered', orders?.delivered)}
              {this.renderTile('in_transit', orders?.in_transit)}
              {this.renderTile('reschedule_order', orders?.reschedule_order)}
              {this.renderTile('rto', orders?.rto)}
            </View>
          </View>

          {/* ✅ Finance buttons */}
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.92} onPress={this.goToSettlementHistory}>
            <View style={styles.actionIcon}>
              <Text style={{ fontSize: 18 }}>📄</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Settlement History</Text>
              <Text style={styles.actionSub}>View all settlements & status</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} activeOpacity={0.92} onPress={this.goToCashSettlement}>
            <View style={styles.actionIcon}>
              <Text style={{ fontSize: 18 }}>💰</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Cash Settlement</Text>
              <Text style={styles.actionSub}>Upload proof & submit for verification</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

           <TouchableOpacity onPress={()=> this.setState({show_login : true})} style={styles.actionCard} activeOpacity={0.92}>
            <View style={styles.actionIcon}>
               <Image style={{height:20,width:20,marginLeft:5,tintColor:'#F88379',alignSelf:'center'}} source={require('./assets/logout.png')} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Logout</Text>
              <Text style={styles.actionSub}>Account Logout</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>


          <View style={{ height: 16 }} />
        </ScrollView>

        
        {profileLoading ? (
          <View style={styles.loaderOverlay}>
            <View style={styles.loaderBox}>
              <ActivityIndicator size="small" color={THEME.green} />
              <Text style={styles.loaderText}>Loading...</Text>
            </View>
          </View>
        ) : null}

        <Modal
                    animationType="fade"
                    transparent={true}
                    statusBarTranslucent={true}
                    visible={this.state.show_login}
                    onRequestClose={() => {
                      this.setState({ show_login: false });
                    }}
                  > 
                    <TouchableOpacity activeOpacity={1} onPress={()=> this.setState({show_login : false})} style={{flex:1,backgroundColor:'rgba(0, 0, 0, 0.6)',justifyContent:'center'}}>
                      <TouchableOpacity activeOpacity={1} onPress={()=> this.setState({show_login : true})} style={{width:'90%',padding:30,backgroundColor:'#FFF',alignSelf:'center',borderRadius:10}}>
                        <View style={{height:60,width:60,borderRadius:30,justifyContent:'center',alignSelf:'center',backgroundColor:'#FFF',marginTop:-60}}>  
                                                <Image animation="zoomIn" iterationCount={1} duration={1000} style={{width:60,height:60,alignSelf:'center',resizeMode:'cover'}} source={require('./assets/lgnew.png')}></Image>       
                                                </View>  
                        <Text style={{color:'#000',fontFamily:'Poppins-Bold',alignSelf:'center',fontSize:18,marginTop:20,textAlign:'center'}}>Logout</Text> 
                        <Text style={{color:'#000',fontFamily:'Poppins',alignSelf:'center',fontSize:13,textAlign:'center'}}>Are you sure to logout of this account?</Text>  
                        <TouchableOpacity onPress={()=> this.setState({show_login:false},()=> this.onLogout())} style={{height:40,width:150,marginTop:30,borderRadius:10,justifyContent:'center',alignSelf:'center',backgroundColor:'#F68A20'}}>
                        <Text style={{color:'#FFF',fontFamily:'Poppins-Bold',fontSize:13,alignSelf:'center'}}>Logout</Text> 
                        </TouchableOpacity> 
                      </TouchableOpacity> 
                    </TouchableOpacity>
                  </Modal>  

      </View>
    );
  }
}

const W = Dimensions.get('window').width;
const TILE_W = (W - 14 * 2 - 12 * 2 - 18) / 3; // 3 columns
const TILE_H = 70;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F5F7' },

  headerWrap: { backgroundColor: '#1C8A62' },
  headerSafe: { backgroundColor: '#1C8A62' },
  headerRow: {  paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center',paddingBottom:12 },
  headerIconBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  backImg: { width: 25, height: 25, resizeMode: 'contain', tintColor: '#FFF' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 14, fontWeight: '800' },

  container: { padding:8, paddingBottom: 20 },

  profileCard: {
    backgroundColor: '#A7C7E7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    padding: 12,
    marginBottom: 12,
    alignSelf:'center'
  },
  profileRow: { flexDirection: 'row', alignItems: 'center',paddingTop:10 },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    marginRight: 12,
    resizeMode:'cover'
  },
  avatarImg: { width: '100%', height: '100%', resizeMode: 'cover',marginTop:2 },
  avatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { fontSize: 18, fontWeight: '900', color: '#111827' },

  name: { fontSize: 16, fontWeight: '900', color: '#fff' },
  role: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#fff' },
  phoneText: { marginTop: 3, fontSize: 12, fontWeight: '700', color: '#fff' },

  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },
  sectionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#434445' },

  viewBtn: { flexDirection: 'row', alignItems: 'center' },
  viewBtnText: { color: '#1C5D9E', fontSize: 13, fontWeight: '700' },
  viewBtnArrow: { color: '#1C5D9E', fontSize: 18, marginLeft: 6, marginTop: -2,fontWeight:'bold' },

  tilesGrid: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileLabel: { fontSize: 11, fontWeight: '500', color: '#4B5563', marginBottom: 6 },
  tileValue: { fontSize: 22, fontWeight: '800',marginTop:2 },

  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E7FAF3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  actionTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  actionSub: { marginTop: 4, fontSize: 12, fontWeight: '400', color: '#6B7280' },
  actionArrow: { fontSize: 22, fontWeight: '400', color: '#000', paddingLeft: 8 },

  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    paddingHorizontal: 50,
    paddingVertical: 20, 
    flexDirection: 'row',
    alignItems: 'center',
  },
  loaderText: { marginLeft: 10, fontSize: 12, fontWeight: '900', color: '#111827' },
});