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
  RefreshControl,
} from 'react-native';
import constants from '../utils/constants';
import Toast from 'react-native-simple-toast';
import BottomSheet from '../components/BottomSheet';
import ShimmerLoader from '../components/ShimmerLoader';

import {NavigationEvents} from '../utils/v4Compat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackActions, NavigationActions, withV4Navigation } from '../utils/v4Compat';

const resetAction = StackActions.reset({
  index: 0,                       
  actions: [NavigationActions.navigate({ routeName: 'Login'})],
});

const THEME = {
  green: '#5D3FD3',
  greenPill: '#0F7451',
  bg: '#E8ECF4',
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

class Profile extends Component {
  constructor(props) {
    super(props);
    this.state = {
      profileLoading: false,
      refreshing: false,
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
    this.props?.navigation?.navigate('SettlementList');

  };

  onRefresh = () => {
    this.setState({ refreshing: true }, () => {
      this.profileApi(() => {
        this.setState({ refreshing: false });
      });
    });
  };

  // ✅ Navigate to TrackOrders with selected delivery status
  onPressStatus = (statusKey) => {
    this.props?.navigation?.navigate('TrackOrders', { status: statusKey });
  };

  // ✅ PROFILE API (GET) - your API returns object directly
  profileApi = (callback) => {
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
          console.log('Profile API response== ', JSON.stringify(json));

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
          }, () => { if (callback) callback(); });
        })
        .catch((e) => {
          console.log('Profile API error== ', e);
          Toast.show(e?.message || String(e), Toast.SHORT);
          this.setState({ profileLoading: false, profile: null }, () => { if (callback) callback(); });
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

    async onLogout() {
      try {
        global.token = '';
        await AsyncStorage.multiRemove(['accessToken', 'userType', 'language', 'referral_code']);
      } catch (e) {
        console.log('Logout clear error:', e);
      }
      this.props.navigation.dispatch(resetAction);
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
                <View style={styles.avatar}>
                  {!!avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatarImg} />
                  ) : (
                    <Image source={require('./assets/profile.png')} style={styles.avatarFallbackImg} />
                  )}
                </View>

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

        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={this.state.refreshing}
              onRefresh={this.onRefresh}
              colors={['#5D3FD3']}
              tintColor={'#5D3FD3'}
            />
          }
        >

          {/* Earnings & Penalties */}
          <View style={styles.earningsRow}>
            <View style={[styles.earningCard, { backgroundColor: '#5D3FD3', marginRight: 5 }]}>
              <Text style={styles.earningLabel}>My Earnings</Text>
              <Text style={styles.earningValue}>{`₹ ${this.toNum(profile?.earnings?.this_month).toLocaleString('en-IN')}`}</Text>
            </View>
            <View style={[styles.earningCard, { backgroundColor: '#D64545', marginLeft: 5 }]}>
              <Text style={styles.earningLabel}>Penalties</Text>
              <Text style={styles.earningValue}>{`₹ ${this.toNum(profile?.penalties?.this_month).toLocaleString('en-IN')}`}</Text>
            </View>
          </View>

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
            <Image style={{height:30,width:30,marginRight:20,resizeMode:'contain'}} source={require('./assets/flow.png')} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Settlement History</Text>
              <Text style={styles.actionSub}>View all settlements & status</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} activeOpacity={0.92} onPress={this.goToCashSettlement}>
             <Image style={{height:30,width:30,marginRight:20,resizeMode:'contain'}} source={require('./assets/purse.png')} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Cash Settlement</Text>
              <Text style={styles.actionSub}>Upload proof & submit for verification</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

           <TouchableOpacity onPress={()=> this.setState({show_login : true})} style={styles.actionCard} activeOpacity={0.92}>
                <Image style={{height:35,width:38,marginRight:20,resizeMode:'contain'}} source={require('./assets/exit.png')} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Logout</Text>
              <Text style={styles.actionSub}>Account Logout</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>


          <View style={{ height: 16 }} />
        </ScrollView>

        
        {profileLoading ? <ShimmerLoader /> : null}

        {this.state.show_login ? (
          <BottomSheet
            visible={this.state.show_login}
            onSheetClose={() => this.setState({ show_login: false })}
            snapPoints={[280, 280]}
            enablePanDownToClose={true}
            onChange={(status) => status === -1 ? this.setState({ show_login: false }) : null}
          >
            <View style={{ padding: 24, paddingTop: 8, alignItems: 'center' }}>
              <Image style={{ width: 50, height: 50, resizeMode: 'contain', marginBottom: 16 }} source={require('./assets/exit.png')} />
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#E35335', marginBottom: 8 }}>Logout</Text>
              <Text style={{ fontSize: 14, fontWeight: '400', color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>Are you sure you want to logout of this account?</Text>
              <View style={{ flexDirection: 'row', width: '100%' }}>
                <TouchableOpacity
                  onPress={() => this.setState({ show_login: false })}
                  style={{ flex: 1, height: 46, borderRadius: 10, borderWidth: 1, borderColor: '#E6EAF0', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => this.setState({ show_login: false }, () => this.onLogout())}
                  style={{ flex: 1, height: 46, borderRadius: 10, backgroundColor: '#E35335', alignItems: 'center', justifyContent: 'center', marginLeft: 8 }}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>Logout</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BottomSheet>
        ) : null}  

      </View>
    );
  }
}

const W = Dimensions.get('window').width;
const TILE_W = (W - 14 * 2 - 12 * 2 - 18) / 3; // 3 columns
const TILE_H = 70;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E8ECF4' },

  headerWrap: { backgroundColor: '#5D3FD3' },
  headerSafe: { backgroundColor: '#5D3FD3' },
  headerRow: {  paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center',paddingBottom:12 },
  headerIconBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center',alignSelf:'center',paddingTop:10 },
  backImg: { width: 25, height: 25, resizeMode: 'contain', tintColor: '#FFF',alignSelf:'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 14, fontWeight: '800' },

  container: { padding:8, paddingBottom: 20 },

  earningsRow: { flexDirection: 'row', marginBottom: 12 },
  earningCard: { flex: 1, borderRadius: 10, paddingVertical: 15, paddingHorizontal: 12, alignItems: 'center' },
  earningLabel: { color: '#fff', fontSize: 11, fontWeight: '600', marginBottom: 6 },
  earningValue: { color: '#fff', fontSize: 18, fontWeight: '700' },

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
  avatarFallbackImg: { width: 30, height: 30, resizeMode: 'contain', tintColor: '#FFF' },
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
export default withV4Navigation(Profile);
