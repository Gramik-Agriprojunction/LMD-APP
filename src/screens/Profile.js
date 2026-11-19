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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { overlayBottomPadding, sheetBottomInset } from '../utils/safeAreaInsets';
import constants from '../utils/constants';
import Toast from 'react-native-simple-toast';
import BottomSheet from '../components/BottomSheet';
import ShimmerLoader from '../components/ShimmerLoader';
import LiveOrdersGrid from '../components/LiveOrdersGrid';

import {NavigationEvents} from '../utils/v4Compat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackActions, NavigationActions, withV4Navigation } from '../utils/v4Compat';
import { prefetchSoilOrderPincode } from '../utils/locationHelper';
import { stopBackgroundLocationTracker } from '../utils/locationTracker';
import ScreenHeader from '../components/ScreenHeader';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { HEADER } from '../theme/headerColors';
import { clearViewPartner } from '../utils/lmdViewMode';

const resetAction = StackActions.reset({
  index: 0,                       
  actions: [NavigationActions.navigate({ routeName: 'Login'})],
});

const SAFE_BOTTOM = overlayBottomPadding();

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
      show_login : false,
    };
  }

  componentDidMount() {
    prefetchSoilOrderPincode();
    this.profileApi();
  }

  goBack = () => {
    const nav = this.props?.navigation;
    if (nav?.canGoBack?.()) {
      nav.goBack();
      return;
    }
    nav?.navigate?.('Home');
  };

  isTabRoot = () => {
    const state = this.props?.navigation?.getState?.();
    return state?.type === 'tab' || !!state?.routeNames?.includes?.('Home');
  };

  goToSettlementHistory = () => {
    this.props?.navigation?.navigate('SettlementHistory');
  };

  goToCashSettlement = () => {
    // this.props?.navigation?.navigate('CashSettlement');
    this.props?.navigation?.navigate('MainTabs', { screen: 'Cash' });

  };

  goToPenaltyOrders = () => {
    this.props?.navigation?.navigate('PenaltyOrders');
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
    this.props?.navigation?.navigate('Orders', { selectedStatus: statusKey });
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
          ['picked_up', 'pending', 'delivered', 'in_transit', 'reschedule_order', 'rto', 'rto_delivered'].forEach((k) => {
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
        stopBackgroundLocationTracker();
        global.token = '';
        global.userType = '';
        await clearViewPartner();
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
        <StatusBar barStyle="light-content" backgroundColor={HEADER.profile} />
        <NavigationEvents onWillFocus={() => {}} onDidFocus={() => this.profileApi()} />

        <ScreenHeader
          bg={HEADER.profile}
          title="Profile"
          onBack={this.isTabRoot() ? undefined : this.goBack}
          below={(
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Image source={require('./assets/logo.png')} style={styles.avatarFallbackImg} />
              </View>
              {(!!name || !!phone) ? (
                <View style={styles.nameCol}>
                  {!!name && (
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                  )}
                  {!!phone && (
                    <Text style={styles.phoneText} numberOfLines={1}>{phone}</Text>
                  )}
                </View>
              ) : null}
            </View>
          )}
        />

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

          {/* Earnings & Penalties — same layout as LMDDashboard */}
          <View style={styles.earnRow}>
            <View style={[styles.earnCard, { backgroundColor: '#16A34A' }]}>
              <Text style={styles.earnLbl}>My Earnings</Text>
              <Text style={styles.earnVal}>{`₹ ${this.toNum(profile?.earnings?.this_month).toLocaleString('en-IN')}`}</Text>
            </View>
            <View style={{ width: 8 }} />
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={this.goToPenaltyOrders}
              style={[styles.earnCard, styles.penCard, { backgroundColor: '#EF4444' }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.earnLbl}>Penalties</Text>
                <Text style={styles.earnVal}>{`₹ ${this.toNum(profile?.penalties?.this_month).toLocaleString('en-IN')}`}</Text>
              </View>
              <View style={styles.penArrow}>
                <Image source={require('./assets/arrow.png')} style={styles.penArrowIco} />
              </View>
            </TouchableOpacity>
          </View>

          {/* ✅ Live Orders (exact same structure as LMDDashboard) */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTop}>
              <Text style={styles.sectionTitle}>Live Orders</Text>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => this.props?.navigation?.navigate('Orders')}
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

          <Text style={styles.menuSectionLbl}>More options</Text>
          <View style={styles.menuCard}>
            {[
              {
                key: 'hist',
                title: 'Settlement History',
                sub: 'Saare settlements dekhein',
                icon: 'history',
                tint: '#E0F2FE',
                accent: '#0284C7',
                onPress: this.goToSettlementHistory,
              },
              {
                key: 'cash',
                title: 'Cash Settlement',
                sub: 'Proof upload aur settle',
                icon: 'cash-multiple',
                tint: '#CCFBF1',
                accent: '#0D9488',
                onPress: this.goToCashSettlement,
              },
              {
                key: 'soil',
                title: 'Soil Testing',
                sub: 'Mitti jaanch orders',
                icon: 'sprout',
                tint: '#DCFCE7',
                accent: '#16A34A',
                onPress: () => {
                  prefetchSoilOrderPincode();
                  this.props?.navigation?.navigate('SoilOrders');
                },
              },
              {
                key: 'createSoil',
                title: 'Create Soil Order',
                sub: 'Naya soil test book karein',
                icon: 'plus-box-outline',
                tint: '#EDE9FE',
                accent: '#5D3FD3',
                onPress: () => {
                  prefetchSoilOrderPincode();
                  this.props?.navigation?.navigate('CreateSoilOrder');
                },
              },
              {
                key: 'farmer',
                title: 'Add Farmer',
                sub: 'Naya kisan jodein',
                icon: 'account-plus',
                tint: '#DCFCE7',
                accent: '#15803D',
                onPress: () => this.props?.navigation?.navigate('MainTabs', { screen: 'Farmers' }),
              },
            ].map((item, idx, arr) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.menuRow, idx < arr.length - 1 && styles.menuRowBorder]}
                activeOpacity={0.85}
                onPress={item.onPress}
              >
                <View style={[styles.menuIco, { backgroundColor: item.tint }]}>
                  <MaterialCommunityIcons name={item.icon} size={20} color={item.accent} />
                </View>
                <View style={styles.menuText}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSub}>{item.sub}</Text>
                </View>
                <View style={styles.menuChevron}>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.logoutCard}
            activeOpacity={0.88}
            onPress={() => this.setState({ show_login: true })}
          >
            <View style={styles.logoutIco}>
              <MaterialCommunityIcons name="logout" size={20} color="#DC2626" />
            </View>
            <View style={styles.menuText}>
              <Text style={styles.logoutTitle}>Logout</Text>
              <Text style={styles.logoutSub}>Account se bahar niklein</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#F87171" />
          </TouchableOpacity>


          <View style={{ height: 16 }} />
        </ScrollView>

        
        {profileLoading ? <ShimmerLoader /> : null}

        {this.state.show_login ? (
          <BottomSheet
            visible={this.state.show_login}
            dynamicSize
            onSheetClose={() => this.setState({ show_login: false })}
            enablePanDownToClose={true}
            onChange={(status) => status === -1 ? this.setState({ show_login: false }) : null}
          >
            <View style={{
              padding: 24,
              paddingTop: 8,
              paddingBottom: Platform.OS === 'ios'
                ? 16 + sheetBottomInset(global.__SAFE_BOTTOM_INSET__ ?? 0)
                : 16 + SAFE_BOTTOM,
              alignItems: 'center',
            }}>
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
  root: { flex: 1, backgroundColor: '#EBE7F5' },

  headerWrap: {
    backgroundColor: '#5D3FD3',
    paddingBottom: 10,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerSafe: { backgroundColor: '#5D3FD3' },
  headerRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', width: '100%' },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  backImg: { width: 17, height: 17, resizeMode: 'contain', tintColor: '#FFF' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 14, fontWeight: '800' },

  container: { padding: 10, paddingBottom: 28 },

  earnRow: { flexDirection: 'row', marginBottom: 12, gap: 10 },
  earnCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  earnLbl: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  earnVal: { color: '#FFF', fontSize: 22, fontWeight: '800', marginTop: 4, letterSpacing: -0.3 },
  penCard: { flexDirection: 'row', alignItems: 'center' },
  penArrow: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  penArrowIco: { width: 9, height: 9, resizeMode: 'contain', tintColor: '#EF4444' },

  profileCard: {
    backgroundColor: '#A7C7E7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    padding: 12,
    marginBottom: 12,
    alignSelf:'center'
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', minWidth: 0, paddingBottom: 4 },
  nameCol: { flex: 1, marginLeft: 12, justifyContent: 'center' },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    backgroundColor: '#F7F5FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarFallbackImg: { width: 38, height: 38, borderRadius: 19, resizeMode: 'contain' },
  avatarFallbackText: { fontSize: 18, fontWeight: '900', color: '#111827' },

  name: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  role: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#fff' },
  phoneText: { marginTop: 2, fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.85)' },

  sectionCard: {
    backgroundColor: '#F7F5FC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E5F0',
    elevation: 0,
  },
  sectionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 15.5, fontWeight: '700', color: '#171A2A' },

  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingLeft: 8,
  },
  viewBtnText: { color: '#5D3FD3', fontSize: 12.5, fontWeight: '600' },
  viewBtnArrow: { color: '#5D3FD3', fontSize: 18, marginLeft: 2, marginTop: -1, fontWeight: '600' },

  tilesGrid: { marginTop: 12 },

  menuSectionLbl: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.3,
    marginBottom: 8,
    marginLeft: 4,
    marginTop: 4,
  },
  menuCard: {
    backgroundColor: '#F7F5FC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E5F0',
    paddingVertical: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E0F2',
  },
  menuIco: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1, marginLeft: 12, marginRight: 8 },
  menuTitle: { fontSize: 14.5, fontWeight: '700', color: '#0F172A' },
  menuSub: { marginTop: 2, fontSize: 12, fontWeight: '500', color: '#64748B' },
  menuChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  logoutIco: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutTitle: { fontSize: 14.5, fontWeight: '700', color: '#B91C1C' },
  logoutSub: { marginTop: 2, fontSize: 12, fontWeight: '500', color: '#F87171' },

  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderBox: {
    backgroundColor: '#F7F5FC',
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
