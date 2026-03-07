// Screens/Profile.js
import React, { Component } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import FastImage from 'react-native-fast-image';
import { StackActions, NavigationActions } from 'react-navigation';
import constants from './constants';

Ionicons.loadFont?.();

const C = {
  green: '#0F7451',
  greenDark: '#0B6B47',
  bg: '#F5F7F6',
  text: '#111827',
  sub: '#6B7280',
  line: '#E5E7EB',
  red: '#EF4444',

  infoBg: '#EEF2FF',
  infoIcon: '#2563EB',

  // filled stats
  statTotalBg: '#E8F5E9',
  statTotalIcon: '#0F7451',

  statDeliveredBg: '#E0F2FE',
  statDeliveredIcon: '#0369A1',

  statPendingBg: '#FFF7ED',
  statPendingIcon: '#B45309',

  statCancelBg: '#FEE2E2',
  statCancelIcon: '#B91C1C',

  // payable
  warnBg: '#FFFBEB',
  warnBorder: '#FDE68A',
  warnIcon: '#D97706',
};

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default class Profile extends Component {
  logoutSheetRef = React.createRef();

  state = {
    name: '',
    retailerId: '',
    phone: '',
    location: '',
    notifications: 0,

    totalOrders: 0,
    delivered: 0,
    pending: 0,
    cancelled: 0,

    payableBalance: 0,

    growerOrderCommission: 0,
    growerOrderTotalOrders: 0,

    directFarmerSaleCommission: 0,
    directFarmerSaleTotalWalkIn: 0,

    revenueEarnedByPlatform: 0,

    loggingOut: false,

    apiLoading: false,
    apiError: '',
    apiResponse: null,
  };

  snapPoints = [280];

  componentDidMount() {
    this.fetchProfile();
  }

  fetchProfile = () => {
    let url = String(constants?.profile || '').trim();
    if (!url) {
      this.setState({ apiError: 'constants.profile missing' });
      return;
    }

    this.setState({ apiLoading: true, apiError: '' });

    console.log('url== ', url);

    fetch(url, {
      method: 'GET',
      headers: {
        'X-localization': 'en',
        Authorization: 'Bearer ' + (global.token || ''),
      },
    })
      .then((r) => r.json())
      .then((res) => {
        console.log('res== ', JSON.stringify(res));

        const data = res?.data || {};

        const name = String(data?.name || '').trim();
        const phone = String(data?.phone || '').trim();

        const notifications = Number(
          data?.notification_count ?? res?.notification_count ?? 0
        );

        const retailerId = String(
          data?.retailer_id ||
            data?.retailerId ||
            data?.user_id ||
            data?.id ||
            ''
        ).trim();

        const location = String(
          data?.location ||
            data?.city ||
            data?.district ||
            data?.state ||
            data?.address ||
            ''
        ).trim();

        const totalOrders = Number(
          data?.total_orders ?? data?.orders_total ?? data?.totalOrders ?? 0
        );
        const delivered = Number(
          data?.delivered_orders ?? data?.orders_delivered ?? data?.delivered ?? 0
        );
        const pending = Number(
          data?.pending_orders ?? data?.orders_pending ?? data?.pending ?? 0
        );
        const cancelled = Number(
          data?.cancelled_orders ?? data?.canceled_orders ?? data?.cancelled ?? data?.canceled ?? 0
        );

        const payableBalance = Number(
          data?.payable_balance ?? data?.payableBalance ?? data?.payable ?? data?.balance ?? 0
        );

        const growerOrderCommission = Number(
          data?.grower_order_commission ?? data?.growerOrderCommission ?? 0
        );
        const growerOrderTotalOrders = Number(
          data?.grower_order_total_orders ?? data?.growerOrderTotalOrders ?? 0
        );

        const directFarmerSaleCommission = Number(
          data?.direct_farmer_sale_commission ?? data?.directFarmerSaleCommission ?? 0
        );
        const directFarmerSaleTotalWalkIn = Number(
          data?.direct_farmer_sale_total_walkin ??
            data?.directFarmerSaleTotalWalkIn ??
            0
        );

        const revenueEarnedByPlatform = Number(
          data?.revenue_earned_by_platform ?? data?.revenueEarnedByPlatform ?? 0
        );

        this.setState({
          apiLoading: false,
          apiError: '',
          apiResponse: res,

          name,
          retailerId,
          phone,
          location,
          notifications: Number.isFinite(notifications) ? notifications : 0,

          totalOrders: Number.isFinite(totalOrders) ? totalOrders : 0,
          delivered: Number.isFinite(delivered) ? delivered : 0,
          pending: Number.isFinite(pending) ? pending : 0,
          cancelled: Number.isFinite(cancelled) ? cancelled : 0,

          payableBalance: Number.isFinite(payableBalance) ? payableBalance : 0,

          growerOrderCommission: Number.isFinite(growerOrderCommission) ? growerOrderCommission : 0,
          growerOrderTotalOrders: Number.isFinite(growerOrderTotalOrders) ? growerOrderTotalOrders : 0,

          directFarmerSaleCommission: Number.isFinite(directFarmerSaleCommission) ? directFarmerSaleCommission : 0,
          directFarmerSaleTotalWalkIn: Number.isFinite(directFarmerSaleTotalWalkIn) ? directFarmerSaleTotalWalkIn : 0,

          revenueEarnedByPlatform: Number.isFinite(revenueEarnedByPlatform) ? revenueEarnedByPlatform : 0,
        });
      })
      .catch((e) => {
        console.log('e== ', e);
        this.setState({ apiLoading: false, apiError: 'API failed' });
      });
  };

  onBack = () => this.props?.navigation?.goBack?.();
  onBell = () => {};

  openLogoutSheet = () => {
    this.logoutSheetRef?.current?.snapToIndex?.(0);
  };

  closeLogoutSheet = () => {
    this.logoutSheetRef?.current?.close?.();
  };

  logout = () => {
    this.openLogoutSheet();
  };

  confirmLogout = async () => {
    if (this.state.loggingOut) return;

    this.setState({ loggingOut: true });

    try {
      await AsyncStorage.clear();
    } catch (e) {}

    this.closeLogoutSheet?.();

    const resetAction = StackActions.reset({
      index: 0,
      actions: [NavigationActions.navigate({ routeName: 'Login' })],
    });

    this.props.navigation.dispatch(resetAction);

    this.setState({ loggingOut: false });
  };

  renderHeader() {
    return (
      <View style={styles.headerWrap}>
        <SafeAreaView style={styles.headerSafe} />
        <StatusBar backgroundColor={C.green} barStyle="light-content" />

        <View style={styles.headerRow}>
          <TouchableOpacity onPress={this.onBack} activeOpacity={0.85} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1, paddingHorizontal: 8 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Profile
            </Text>
            <Text style={styles.headerSubText} numberOfLines={1}>
              Retailer ID: {this.state.retailerId || '--'}
            </Text>
          </View>

          <TouchableOpacity onPress={this.onBell} activeOpacity={0.85} style={styles.headerBtn}>
            <Ionicons name="notifications" size={18} color="#fff" />
            {this.state.notifications > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{this.state.notifications}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  renderProfileCard() {
    const { name, phone, location, retailerId } = this.state;

    return (
      <View style={styles.card}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={25} color={C.green} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {name || '--'}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {phone || '--'}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {location || '--'}
            </Text>
          </View>

          <View style={styles.idPill}>
            <Text style={styles.idPillText}>{retailerId || '--'}</Text>
          </View>
        </View>
      </View>
    );
  }

  StatBox = ({ bg, iconColor, icon, value, label }) => {
    return (
      <View style={[styles.statBox, { backgroundColor: bg }]}>
        <View style={[styles.statIcon]}>
          <Ionicons name={icon} size={16} color={iconColor} />
        </View>
        <Text style={styles.statValue}>{Number(value || 0)}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    );
  };

  renderStats() {
    const { totalOrders, delivered, pending, cancelled } = this.state;

    return (
      <View style={styles.statsWrap}>
        <this.StatBox
          bg={C.statTotalBg}
          iconColor={C.statTotalIcon}
          icon="file-tray-full"
          value={totalOrders}
          label="Total Orders"
        />
        <this.StatBox
          bg={C.statDeliveredBg}
          iconColor={C.statDeliveredIcon}
          icon="checkmark-done"
          value={delivered}
          label="Delivered"
        />
        <this.StatBox
          bg={C.statPendingBg}
          iconColor={C.statPendingIcon}
          icon="time"
          value={pending}
          label="Pending"
        />
        <this.StatBox
          bg={C.statCancelBg}
          iconColor={C.statCancelIcon}
          icon="close-circle"
          value={cancelled}
          label="Cancelled"
        />
      </View>
    );
  }

  renderInfoNote() {
    return (
      <View style={styles.infoCard}>
        <View style={styles.infoIconWrap}>
          <Ionicons name="information" size={18} color={C.infoIcon} />
        </View>
        <Text style={styles.infoText}>
          This profile shows your earnings & commissions summary (as visible in Ledger screen).
        </Text>
      </View>
    );
  }

  renderPayableBalance() {
    const { payableBalance } = this.state;

    return (
      <View style={[styles.card, styles.payableCard]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.payableIcon}>
            <Ionicons name="hourglass" size={25} color={C.warnIcon} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.payableTitle}>Payable Balance</Text>
            <Text style={styles.payableSub}>Available for Withdrawal</Text>
          </View>

          <Text style={styles.payableAmt}>{money(payableBalance)}</Text>
        </View>
      </View>
    );
  }

  renderMiniLedgerCards() {
    const {
      growerOrderCommission,
      growerOrderTotalOrders,
      directFarmerSaleCommission,
      directFarmerSaleTotalWalkIn,
      revenueEarnedByPlatform,
    } = this.state;

    return (
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Earnings Summary</Text>

        <View style={styles.rowCard}>
          <View style={styles.rowIcon}>
            <Ionicons name="car" size={25} color={C.greenDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              Grower&apos;s Order Commission
            </Text>
            <Text style={styles.rowSub} numberOfLines={1}>
              {money(growerOrderTotalOrders)} Total Orders
            </Text>
          </View>
          <Text style={styles.rowAmt}>{money(growerOrderCommission)}</Text>
        </View>

        <View style={styles.rowCard}>
          <View style={styles.rowIcon}>
            <Ionicons name="cash" size={25} color={C.greenDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              Direct Farmer Sales Commission (15%)
            </Text>
            <Text style={styles.rowSub} numberOfLines={1}>
              {money(directFarmerSaleTotalWalkIn)} Total Walk-In Sales
            </Text>
          </View>
          <Text style={styles.rowAmt}>{money(directFarmerSaleCommission)}</Text>
        </View>

        <View style={[styles.rowCard, { backgroundColor: '#FFFBEB', borderColor: C.warnBorder }]}>
          <View style={[styles.rowIcon, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
            <Ionicons name="leaf" size={25} color="#B45309" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: '#92400E' }]} numberOfLines={1}>
              Revenue Earned by Gramik Platform
            </Text>
            <Text style={[styles.rowSub, { color: '#9A3412' }]} numberOfLines={1}>
              Store Orders Commission (15%)
            </Text>
          </View>
          <Text style={[styles.rowAmt, { color: '#92400E' }]}>{money(revenueEarnedByPlatform)}</Text>
        </View>
      </View>
    );
  }

  renderLogout() {
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={this.logout} style={styles.logoutBtn}>
        <Ionicons name="log-out-outline" size={18} color="#fff" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    );
  }

  renderLogoutSheet() {
    return (
      <BottomSheet
        ref={this.logoutSheetRef}
        index={-1}
        snapPoints={this.snapPoints}
        enablePanDownToClose
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
        )}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <View style={styles.sheetContent}>
          <FastImage
            source={require('./assets/logout.gif')}
            style={{ width: 80, height: 80, alignSelf: 'center' }}
            resizeMode={FastImage.resizeMode.contain}
          />

          <View style={{ flex: 1 }}>
            <Text style={[styles.sheetTitle, { color: '#FA5F55' }]}>Logout</Text>
            <Text style={styles.sheetSub}>Are you sure you want to logout?</Text>
          </View>

          <View style={styles.sheetBtnRow}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={this.closeLogoutSheet}
              style={[styles.sheetBtn, styles.sheetBtnGhost]}
              disabled={this.state.loggingOut}
            >
              <Text style={[styles.sheetBtnText, styles.sheetBtnTextGhost]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={this.confirmLogout}
              style={[styles.sheetBtn, styles.sheetBtnDanger]}
              disabled={this.state.loggingOut}
            >
              <Text style={styles.sheetBtnText}>{this.state.loggingOut ? 'Logging out...' : 'Logout'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>
    );
  }

  renderApiState() {
    if (!this.state.apiLoading && !this.state.apiError) return null;

    return (
      <View style={{ paddingHorizontal: 14, paddingTop: 10 }}>
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: C.line,
            paddingHorizontal: 12,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {this.state.apiLoading ? <ActivityIndicator /> : null}
          <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '600' }}>
            {this.state.apiLoading ? 'Loading profile...' : this.state.apiError}
          </Text>
        </View>
      </View>
    );
  }

  render() {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {this.renderHeader()}

        {this.renderApiState()}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {this.renderProfileCard()}
          {this.renderStats()}
          {this.renderInfoNote()}
          {this.renderPayableBalance()}
          {this.renderMiniLedgerCards()}
        </ScrollView>

        <View style={{ padding: 10, paddingBottom: 20, paddingTop: 5 }}>{this.renderLogout()}</View>

        {this.renderLogoutSheet()}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  // ===== Header =====
  headerWrap: { backgroundColor: C.green },
  headerSafe: { backgroundColor: C.green },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
  },
  headerBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerSubText: { color: '#D1FAE5', fontSize: 12, fontWeight: '500', marginTop: 2 },
  badge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // ===== common card =====
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.1,
    borderColor: C.line,
    padding: 12,
  },

  // ===== profile =====
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  name: { color: C.text, fontSize: 14, fontWeight: '700' },
  meta: { marginTop: 2, color: C.sub, fontSize: 12, fontWeight: '500' },
  idPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: C.line,
    marginLeft: 10,
    paddingLeft: 15,
    paddingRight: 15,
  },
  idPillText: { color: C.text, fontSize: 10, fontWeight: '500' },

  // ===== stats =====
  statsWrap: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statBox: {
    width: '48%',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: { color: C.text, fontSize: 16, fontWeight: '700' },
  statLabel: { marginTop: 2, color: C.sub, fontSize: 12, fontWeight: '400' },

  // ===== info =====
  infoCard: {
    marginTop: 2,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: C.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    marginRight: 10,
  },
  infoText: { flex: 1, color: C.sub, fontSize: 12, fontWeight: '500', lineHeight: 18 },

  // ===== payable =====
  payableCard: {
    marginTop: 10,
    backgroundColor: C.warnBg,
    borderColor: C.warnBorder,
  },
  payableIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  payableTitle: { color: '#92400E', fontSize: 13, fontWeight: '700' },
  payableSub: { marginTop: 5, color: '#9A3412', fontSize: 12, fontWeight: '400' },
  payableAmt: { color: '#92400E', fontSize: 16, fontWeight: '800' },

  // ===== section =====
  sectionCard: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.1,
    borderColor: C.line,
    padding: 12,
  },
  sectionTitle: { color: C.text, fontSize: 14, fontWeight: '600', marginBottom: 10 },

  // ===== rows =====
  rowCard: {
    borderRadius: 16,
    borderWidth: 1.1,
    borderColor: C.line,
    backgroundColor: '#fff',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rowTitle: { color: C.text, fontSize: 12, fontWeight: '500' },
  rowSub: { marginTop: 4, color: C.sub, fontSize: 12, fontWeight: '500' },
  rowAmt: { marginLeft: 10, color: C.greenDark, fontSize: 14, fontWeight: '800' },

  // ===== logout =====
  logoutBtn: {
    marginTop: 6,
    height: 45,
    borderRadius: 10,
    backgroundColor: '#FA5F55',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    width: '85%',
    alignSelf: 'center',
  },
  logoutText: { color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 8 },

  // ===== bottom sheet =====
  sheetBg: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  sheetHandle: {
    backgroundColor: '#D1FAE5',
    width: 46,
  },
  sheetContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 14,
    flex: 1,
  },
  sheetTitleRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: { color: C.text, fontSize: 20, fontWeight: '800', alignSelf: 'center' },
  sheetSub: {
    marginTop: 2,
    color: C.sub,
    fontSize: 15,
    fontWeight: '400',
    alignSelf: 'center',
    textAlign: 'center',
    marginTop: 10,
  },

  sheetBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 'auto',
    padding: 15,
    paddingBottom:20
  },
  sheetBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBtnGhost: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sheetBtnDanger: {
    backgroundColor: '#F68A20',
  },
  sheetBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  sheetBtnTextGhost: { color: '#111827' },
});