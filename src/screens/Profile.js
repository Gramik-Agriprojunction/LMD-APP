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

import {NavigationEvents} from '../utils/v4Compat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StackActions, NavigationActions, withV4Navigation } from '../utils/v4Compat';
import { prefetchSoilOrderPincode } from '../utils/locationHelper';
import { stopBackgroundLocationTracker } from '../utils/locationTracker';
import ScreenHeader from '../components/ScreenHeader';
import { HEADER } from '../theme/headerColors';
import { clearViewPartner } from '../utils/lmdViewMode';

const resetAction = StackActions.reset({
  index: 0,
  actions: [NavigationActions.navigate({ routeName: 'Login'})],
});

const SAFE_BOTTOM = overlayBottomPadding();

const moneyIco = require('./assets/money.png');
const cashIco = require('./assets/cashb.png');
const boxIco = require('./assets/box.png');
const truckIco = require('./assets/truck.png');
const checkIco = require('./assets/tick.png');
const clockIco = require('./assets/clock.png');
const historyIco = require('./assets/history.png');
const soilIco = require('./assets/soil.png');
const plusIco = require('./assets/plus.png');
const farmerIco = require('./assets/addu.png');
const logoutIco = require('./assets/logout.png');
const arrowIco = require('./assets/arrow.png');

class Profile extends Component {
  constructor(props) {
    super(props);
    this.state = {
      profileLoading: false,
      refreshing: false,
      profile: null,
      summary: {
        delivered: 0,
        pending: 0,
        picked_up: 0,
        rto: 0,
        settled_count: 0,
        settled_amount: 0,
        pending_settlement_count: 0,
        pending_settlement_amount: 0,
        earnings: 0,
        penalties: 0,
      },
      missingFields: [],
      show_login: false,
    };
  }

  componentDidMount() {
    prefetchSoilOrderPincode();
    this.loadProfileData();
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
    this.props?.navigation?.navigate('MainTabs', { screen: 'Cash' });
  };

  goToPenaltyOrders = () => {
    this.props?.navigation?.navigate('PenaltyOrders');
  };

  goOrders = (selectedStatus) => {
    this.props?.navigation?.navigate('Orders', selectedStatus ? { selectedStatus } : undefined);
  };

  onRefresh = () => {
    this.setState({ refreshing: true }, () => {
      this.loadProfileData(() => this.setState({ refreshing: false }));
    });
  };

  authHeaders = () => ({
    Authorization: 'Bearer ' + global.token,
    Accept: 'application/json',
    'X-localization': 'en',
  });

  toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  fmtCount = (v) => this.toNum(v).toLocaleString('en-IN');
  fmtMoney = (v) => `₹ ${this.toNum(v).toLocaleString('en-IN')}`;

  loadProfileData = (callback) => {
    this.setState({
      profileLoading: !this.state.profile && !this.state.refreshing,
      missingFields: [],
    });

    Promise.all([
      fetch(constants.profile, { method: 'GET', headers: this.authHeaders() }).then((r) => r.json()).catch(() => null),
      fetch(constants.homescreen, { method: 'GET', headers: this.authHeaders() }).then((r) => r.json()).catch(() => null),
      fetch(constants.settleHistory, { method: 'GET', headers: this.authHeaders() }).then((r) => r.json()).catch(() => null),
    ])
      .then(([profileJson, homeJson, settleJson]) => {
        const p = profileJson?.data && typeof profileJson.data === 'object' && !Array.isArray(profileJson.data)
          ? profileJson.data
          : (profileJson?.id || profileJson?.name ? profileJson : null);

        const home = homeJson?.data && typeof homeJson.data === 'object' ? homeJson.data : {};
        const settleRoot = settleJson?.data && typeof settleJson.data === 'object' && !Array.isArray(settleJson.data)
          ? settleJson.data
          : settleJson;
        const lc = settleRoot?.list_count || settleJson?.list_count || {};
        const orders = p?.orders || {};

        const settleItems = Array.isArray(settleRoot?.items)
          ? settleRoot.items
          : Array.isArray(settleJson?.data)
            ? settleJson.data
            : [];

        const settledAmount = settleItems.reduce((sum, it) => {
          const st = String(it?.settlement_status || it?.status || '')
            .trim()
            .toLowerCase();
          if (st !== 'settled' && st !== 'success') return sum;
          const fromOrders = Array.isArray(it?.orders)
            ? it.orders.reduce(
                (s, o) =>
                  s +
                  this.toNum(o?.amount ?? o?.collected_amount ?? o?.order_amount),
                0,
              )
            : 0;
          const amt = this.toNum(it?.amount) || fromOrders;
          return sum + amt;
        }, 0);

        const summary = {
          delivered: this.toNum(orders.delivered),
          pending: this.toNum(orders.pending),
          picked_up: this.toNum(orders.picked_up),
          rto: this.toNum(orders.rto),
          settled_count: this.toNum(lc.settled_count),
          settled_amount: settledAmount,
          pending_settlement_count: this.toNum(
            home.pending_settlement_orders_count ?? lc.pending_count,
          ),
          pending_settlement_amount: this.toNum(home.pending_settlement_amount),
          earnings: this.toNum(home?.earnings?.this_month ?? p?.earnings?.this_month),
          penalties: this.toNum(home?.penalties?.this_month ?? p?.penalties?.this_month),
        };

        this.setState({
          profileLoading: false,
          profile: p,
          summary,
        }, () => { if (callback) callback(); });
      })
      .catch((e) => {
        console.log('Profile load error== ', e);
        Toast.show(e?.message || String(e), Toast.SHORT);
        this.setState({ profileLoading: false }, () => { if (callback) callback(); });
      });
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
    const { profile, profileLoading, summary } = this.state;

    const name = profile?.name ? String(profile.name).trim() : '';
    const phone = profile?.phone ? String(profile.phone) : '';

    const role =
      profile?.user_type === 'delivery_partner'
        ? 'LMD Partner'
        : profile?.user_type
        ? String(profile.user_type).replace(/_/g, ' ')
        : 'LMD Partner';

    const summaryRows = [
      {
        key: 'delivered',
        label: 'Delivered orders',
        value: this.fmtCount(summary.delivered),
        asset: checkIco,
        tint: '#DCFCE7',
        onPress: () => this.goOrders('DELIVERED'),
      },
      {
        key: 'pending',
        label: 'Pending orders',
        value: this.fmtCount(summary.pending),
        asset: clockIco,
        tint: '#FFEDD5',
        onPress: () => this.goOrders('PENDING'),
      },
      {
        key: 'picked',
        label: 'Picked up',
        value: this.fmtCount(summary.picked_up),
        asset: truckIco,
        tint: '#E0F2FE',
        onPress: () => this.goOrders('PICKUP'),
      },
      {
        key: 'rto',
        label: 'RTO orders',
        value: this.fmtCount(summary.rto),
        asset: boxIco,
        tint: '#EDE9FE',
        onPress: () => this.goOrders('RTO'),
      },
      {
        key: 'settled',
        label: 'Settlements done',
        value: `${this.fmtMoney(summary.settled_amount)} · ${this.fmtCount(summary.settled_count)}`,
        asset: moneyIco,
        tint: '#CCFBF1',
        onPress: this.goToSettlementHistory,
      },
      {
        key: 'pendingSettle',
        label: 'Pending settlement',
        value: `${this.fmtMoney(summary.pending_settlement_amount)} · ${this.fmtCount(summary.pending_settlement_count)}`,
        asset: cashIco,
        tint: '#FEF3C7',
        onPress: this.goToCashSettlement,
      },
    ];

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={HEADER.profile} />
        <NavigationEvents onWillFocus={() => {}} onDidFocus={() => this.loadProfileData()} />

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
                  {!!role && (
                    <Text style={styles.role} numberOfLines={1}>{role}</Text>
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

          <View style={styles.earnRow}>
            <View style={[styles.earnCard, { backgroundColor: '#16A34A' }]}>
              <Text style={styles.earnLbl}>My Earnings</Text>
              <Text style={styles.earnVal}>{this.fmtMoney(summary.earnings)}</Text>
            </View>
            <View style={{ width: 8 }} />
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={this.goToPenaltyOrders}
              style={[styles.earnCard, styles.penCard, { backgroundColor: '#EF4444' }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.earnLbl}>Penalties</Text>
                <Text style={styles.earnVal}>{this.fmtMoney(summary.penalties)}</Text>
              </View>
              <View style={styles.penArrow}>
                <Image source={require('./assets/arrow.png')} style={styles.penArrowIco} />
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.menuSectionLbl}>Mera summary</Text>
          <View style={styles.summaryCard}>
            {(() => {
              const COLS = 3;
              const rows = [];
              for (let i = 0; i < summaryRows.length; i += COLS) {
                rows.push(summaryRows.slice(i, i + COLS));
              }
              // Pad last row so layout stays a full 3×N grid
              const last = rows[rows.length - 1];
              while (last && last.length < COLS) {
                last.push({ key: `pad-${last.length}`, pad: true });
              }
              return rows.map((row, rowIdx) => (
                <View
                  key={`sum-row-${rowIdx}`}
                  style={[
                    styles.summaryRow,
                    rowIdx < rows.length - 1 && styles.summaryRowBorder,
                  ]}
                >
                  {row.map((cell, colIdx) =>
                    cell.pad ? (
                      <View
                        key={cell.key}
                        style={[
                          styles.summaryTile,
                          colIdx < COLS - 1 && styles.summaryTileBorderRight,
                        ]}
                      />
                    ) : (
                      <TouchableOpacity
                        key={cell.key}
                        style={[
                          styles.summaryTile,
                          colIdx < COLS - 1 && styles.summaryTileBorderRight,
                        ]}
                        activeOpacity={0.85}
                        onPress={cell.onPress}
                      >
                        <View style={[styles.summaryIcoWrap, { backgroundColor: cell.tint }]}>
                          <Image source={cell.asset} style={styles.summaryAsset} />
                        </View>
                        <Text style={styles.summaryValue} numberOfLines={2}>
                          {cell.value}
                        </Text>
                        <Text style={styles.summaryLabel} numberOfLines={2}>
                          {cell.label}
                        </Text>
                      </TouchableOpacity>
                    ),
                  )}
                </View>
              ));
            })()}
          </View>

          <Text style={styles.menuSectionLbl}>More options</Text>
          <View style={styles.menuCard}>
            {[
              {
                key: 'hist',
                title: 'Settlement History',
                sub: 'Saare settlements dekhein',
                asset: historyIco,
                tint: '#E0F2FE',
                onPress: this.goToSettlementHistory,
              },
              {
                key: 'cash',
                title: 'Cash Settlement',
                sub: 'Proof upload aur settle',
                asset: cashIco,
                tint: '#CCFBF1',
                onPress: this.goToCashSettlement,
              },
              {
                key: 'soil',
                title: 'Soil Testing',
                sub: 'Mitti jaanch orders',
                asset: soilIco,
                tint: '#DCFCE7',
                onPress: () => {
                  prefetchSoilOrderPincode();
                  this.props?.navigation?.navigate('SoilOrders');
                },
              },
              {
                key: 'createSoil',
                title: 'Create Soil Order',
                sub: 'Naya soil test book karein',
                asset: plusIco,
                tint: '#EDE9FE',
                onPress: () => {
                  prefetchSoilOrderPincode();
                  this.props?.navigation?.navigate('CreateSoilOrder');
                },
              },
              {
                key: 'farmer',
                title: 'Add Farmer',
                sub: 'Naya kisan jodein',
                asset: farmerIco,
                tint: '#DCFCE7',
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
                  <Image source={item.asset} style={styles.menuAsset} />
                </View>
                <View style={styles.menuText}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuSub}>{item.sub}</Text>
                </View>
                <View style={styles.menuChevron}>
                  <Image source={arrowIco} style={styles.menuChevronIco} />
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
              <Image source={logoutIco} style={styles.menuAsset} />
            </View>
            <View style={styles.menuText}>
              <Text style={styles.logoutTitle}>Logout</Text>
              <Text style={styles.logoutSub}>Account se bahar niklein</Text>
            </View>
            <Image source={arrowIco} style={[styles.menuChevronIco, { tintColor: '#F87171' }]} />
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

  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D6D3F0',
    overflow: 'hidden',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  summaryRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: '#E8ECF1',
  },
  summaryTile: {
    width: '33.333%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    minHeight: 102,
    backgroundColor: '#FFFFFF',
  },
  summaryTileBorderRight: {
    borderRightWidth: StyleSheet.hairlineWidth * 2,
    borderRightColor: '#E8ECF1',
  },
  summaryIcoWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  summaryAsset: { width: 22, height: 22, resizeMode: 'contain' },
  summaryValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  summaryLabel: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },



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
  menuAsset: { width: 24, height: 24, resizeMode: 'contain' },
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
  menuChevronIco: {
    width: 10,
    height: 10,
    resizeMode: 'contain',
    tintColor: '#94A3B8',
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
