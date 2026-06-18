import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import constants from '../utils/constants';
import Toast from 'react-native-simple-toast';
import BottomSheet from '../components/BottomSheet';
import ShimmerLoader from '../components/ShimmerLoader';
import LiveOrdersGrid from '../components/LiveOrdersGrid';

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
    this.props?.navigation?.navigate('TrackOrders', { selectedStatus: statusKey });
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
        <NavigationEvents onWillFocus={() => {}} onDidFocus={() => this.profileApi()} />

        {/* ✅ Header (same as other screens) */}
        <View style={styles.headerWrap}>
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={this.goBack} style={styles.headerIconBtn} activeOpacity={0.8}>
                <Image style={styles.backImg} source={require('./assets/back.png')} />
              </TouchableOpacity>

              {(!!name || !!avatar || !!phone || !!role) && (
                <View style={styles.profileRow}>
                  <View style={styles.avatar}>
                    <Image source={require('./assets/profile.png')} style={styles.avatarFallbackImg} />
                  </View>
                  <View style={styles.nameCol}>
                    {!!name && (
                      <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    )}
                    {!!phone && (
                      <Text style={styles.phoneText} numberOfLines={1}>{phone}</Text>
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
              <LiveOrdersGrid live={orders} onPress={this.onPressStatus} />
            </View>
          </View>

          {/* ✅ Finance buttons */}
          <TouchableOpacity style={styles.actionCard} activeOpacity={0.92} onPress={this.goToSettlementHistory}>
            <Image style={{height:30,width:30,marginRight:20,resizeMode:'contain'}} source={require('./assets/flow.png')} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Settlement History</Text>
              <Text style={styles.actionSub}>Saare settlements aur status dekhein</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} activeOpacity={0.92} onPress={this.goToCashSettlement}>
             <Image style={{height:30,width:30,marginRight:20,resizeMode:'contain'}} source={require('./assets/purse.png')} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Cash Settlement</Text>
              <Text style={styles.actionSub}>Proof upload karein aur verify ke liye bhejein</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.92}
            onPress={() => this.props?.navigation?.navigate('SoilOrders')}
          >
            <Image style={{ height: 30, width: 30, marginRight: 20, resizeMode: 'contain' }} source={require('./assets/planting.png')} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Soil Testing</Text>
              <Text style={styles.actionSub}>Mitti jaanch orders dekhein aur track karein</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.92}
            onPress={() => this.props?.navigation?.navigate('CreateSoilOrder')}
          >
            <Image style={{ height: 30, width: 30, marginRight: 20, resizeMode: 'contain' }} source={require('./assets/fertilizer.png')} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Create Soil Order</Text>
              <Text style={styles.actionSub}>Naya soil test package book karein</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

           <TouchableOpacity onPress={()=> this.setState({show_login : true})} style={styles.actionCard} activeOpacity={0.92}>
                <Image style={{height:35,width:38,marginRight:20,resizeMode:'contain'}} source={require('./assets/exit.png')} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Logout</Text>
              <Text style={styles.actionSub}>Account se logout karein</Text>
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
            enablePanDownToClose={true}
            onChange={(status) => status === -1 ? this.setState({ show_login: false }) : null}
          >
            <View style={{ padding: 24, paddingTop: 8, alignItems: 'center' }}>
              <Image style={{ width: 50, height: 50, resizeMode: 'contain', marginBottom: 16 }} source={require('./assets/exit.png')} />
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#E35335', marginBottom: 8 }}>Logout</Text>
              <Text style={{ fontSize: 14, fontWeight: '400', color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>Kya aap waqai logout karna chahte hain?</Text>
              <View style={{ flexDirection: 'row', width: '100%' }}>
                <TouchableOpacity
                  onPress={() => this.setState({ show_login: false })}
                  style={{ flex: 1, height: 46, borderRadius: 10, borderWidth: 1, borderColor: '#E6EAF0', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}
                  activeOpacity={0.85}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151' }}>Nahi</Text>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E8ECF4' },

  headerWrap: { backgroundColor: '#5D3FD3' },
  headerSafe: { backgroundColor: '#5D3FD3' },
  headerRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  backImg: { width: 17, height: 17, resizeMode: 'contain', tintColor: '#FFF' },
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
  profileRow: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  nameCol: { flex: 1, marginLeft: 12, justifyContent: 'center' },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarFallbackImg: { width: 38, height: 38, borderRadius: 19, resizeMode: 'contain' },
  avatarFallbackText: { fontSize: 18, fontWeight: '900', color: '#111827' },

  name: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  role: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#fff' },
  phoneText: { marginTop: 1, fontSize: 11.5, fontWeight: '500', color: 'rgba(255,255,255,0.85)' },

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

  tilesGrid: { marginTop: 12 },

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
