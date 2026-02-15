import React, { Component } from 'react';
import {
  View,
  SafeAreaView,
  Text,
  StatusBar,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import constants from './constants';
import {NavigationEvents} from 'react-navigation';


const { width } = Dimensions.get('window');

export default class LMDDashboard extends Component {
  constructor() {
    super();
    this.state = {
      isLoading: false,
      dashboard_data: null,
      notifCount: 2,
    };
  }

  componentDidMount() {
    this.dashboardApi();
  }

  dashboardApi() {
    this.setState({ isLoading: true });

    fetch(constants.homescreen, {
      headers: {
        'X-localization': 'en',
        Authorization: 'Bearer ' + global.token,
      },
      method: 'GET',
    })
      .then((response) => response.json())
      .then((responseJson) => {
        this.setState({ isLoading: false });
        console.log('dashboard response== ', JSON.stringify(responseJson));

        if (responseJson.status) {
          this.setState({ dashboard_data: responseJson.data });
        } else {
          console.log('Error', responseJson.message || 'Failed to load dashboard');
        }
      })
      .catch((error) => {
        this.setState({ isLoading: false });
        console.log('dashboard error== ', error);
      });
  }

  onMenuPress = () => {
    console.log(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: this.logout },
      ],
      { cancelable: true }
    );
  };

  logout = async () => {
    try {
      await AsyncStorage.multiRemove(['accessToken', 'userId', 'PENDING_FEED_ID']);
    } catch (e) {}

    this.props.navigation.navigate('Login');
  };

  // ---- NAV HELPERS ----
  goOrders = (selectedStatus) => {
    // Send backend status exactly (PENDING/DELIVERED/INTRANSIT/etc)
    this.props.navigation.navigate('TrackOrders', {
      selectedStatus: selectedStatus || 'ALL',
    });
  };

  goProfile = () => this.props.navigation.navigate('Profile');
  goEarnings = () => this.props.navigation.navigate('Earnings');

  
  callSupport = async () => {
    const phone = String(this.state.dashboard_data?.Support || '7388821222').replace(/\s+/g, '');
    const url = `tel:${phone}`;

    try {
      const can = await Linking.canOpenURL(url);
      if (can) Linking.openURL(url);
      else console.log('Support', `Call ${phone}`);
    } catch (e) {
      console.log('Support', `Call ${phone}`);
    }
  };

  toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // ✅ BACKEND STATUS COLORS
  badgeFor = (status) => {
    switch (status) {
      case 'PENDING':
        return { bg: '#FCEED7', text: '#111827' };
      case 'DELIVERED':
        return { bg: '#DDF4EA', text: '#1C8A62' };
      case 'PICKUP':
        return { bg: '#E6F4FF', text: '#0B5CAD' };
      case 'INTRANSIT':
        return { bg: '#E6F4FF', text: '#0B5CAD' };
      case 'RESCHEDULE':
        return { bg: '#E9E7FF', text: '#4F46E5' };
      case 'RTO':
        return { bg: '#FFE6E6', text: '#B91C1C' };
      case 'CANCELLED':
      case 'PICKUPCANCELLED':
        return { bg: '#FFE6E6', text: '#B91C1C' };
      default:
        return { bg: '#EEF2F6', text: '#111827' };
    }
  };

  renderDeliveryItem = ({ item }) => {
    const status = item?.status || 'UNKNOWN';
    const b = this.badgeFor(status);

    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => this.props.navigation.navigate('DeliveryDetails', { order: item })}>
        <View style={styles.deliveryRow}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.deliveryName} numberOfLines={1}>
              {item?.customer_name || 'Customer'}
            </Text>
            <Text style={styles.deliveryMeta} numberOfLines={2}>
              {`Village : ${item?.village || '-'}`}
            </Text>
            <Text style={styles.deliveryCod}>{`₹ ${this.toNum(item?.amount)}`}</Text>
          </View>

          <View style={[styles.deliveryBadge, { backgroundColor: b.bg }]}>
            <Text style={[styles.deliveryBadgeText, { color: b.text }]}>{status}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  render() {
    const d = this.state.dashboard_data;

    const userName = d?.partner?.name || '';
    const rule = d?.partner?.rule;

    const live = d?.live_orders || {};
    const todayDeliveries = d?.today_deliveries || [];

    // ✅ API earnings/penalties
    const earnings = this.toNum(d?.earnings?.this_month);
    const penalties = this.toNum(d?.penalties?.this_month);

    const notifCount = this.state.notifCount;

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#1C8A62" />

         <NavigationEvents
                        onWillFocus={() => {
                          
                        }}
                        onDidFocus={() => {
                           this.dashboardApi();
                        }}
                      />

        {/* Header */}
        <View style={styles.headerWrap}>
          <SafeAreaView style={styles.headerSafe}>
            <View style={styles.headerRow}>
             <TouchableOpacity style={styles.headerRight} onPress={this.goProfile} activeOpacity={0.85}>
                <View style={styles.avatar}>
                  <Text style={{ fontSize: 16 }}>👤</Text>
                </View>
                {notifCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{notifCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>

              <Text style={styles.headerTitle} numberOfLines={1}>
                Gramik LMD 
              </Text>
              <View style={{ width: 42, height: 42 }} />
            </View>
          </SafeAreaView>
        </View>

        <SafeAreaView style={styles.bodySafe}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.welcome}>{`Welcome, ${userName || '-'}`}</Text>

            {rule ? (
              <View style={styles.ruleBanner}>
                <Text style={styles.ruleText}>
                  <Text style={{ fontWeight: '800' }}>Rule :</Text> {rule}
                </Text>
              </View>
            ) : null}

             <View style={styles.twoColRow}>
              <TouchableOpacity disabled activeOpacity={0.9} onPress={this.goEarnings} style={[styles.bigCard, { backgroundColor: '#1C8A62' }]}>
                <Text style={styles.bigCardTitle}>My Earnings</Text>
                <Text style={styles.bigCardValue}>₹ {formatINR(earnings)}</Text>
                {/* <Text style={styles.bigCardSub}>This Month</Text> */}
              </TouchableOpacity>

              <TouchableOpacity disabled activeOpacity={0.9} onPress={this.goEarnings} style={[styles.bigCard, { backgroundColor: '#D64545' }]}>
                <Text style={styles.bigCardTitle}>Penalties</Text>
                <Text style={styles.bigCardValue}> ₹ {formatINR(penalties)}</Text>
                {/* <Text style={styles.bigCardSub}>This Month</Text> */}
              </TouchableOpacity>
            </View>

            {/* Live Orders */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.sectionTitle}>Live Orders</Text>
                <TouchableOpacity onPress={() => this.goOrders('ALL')} style={styles.linkBtn}>
                  <Text style={styles.linkText}>View</Text>
                  <Text style={styles.linkArrow}>›</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.liveRow}>
                {/* Picked up === PICKUP in backend */}
                <StatBox
                  title="Picked Up"
                  value={this.toNum(live?.picked_up)}
                  bg="#EEF2F6" 
                  valueColor="#111827"
                  onPress={() => this.goOrders('PICKUP')}
                />
                <StatBox
                  title="Pending"
                  value={this.toNum(live?.pending)}
                  bg="#DDF4EA"
                  valueColor="#1C8A62"
                  onPress={() => this.goOrders('PENDING')}
                />
                <StatBox
                  title="Delivered"
                  value={this.toNum(live?.delivered)}
                  bg="#FCEED7"
                  valueColor="#111827"
                  onPress={() => this.goOrders('DELIVERED')}
                />
                {/* ✅ INTRANSIT exact */}
                <StatBox
                  title="In-Transit"
                  value={this.toNum(live?.in_transit)}
                  bg="#E6F4FF"
                  valueColor="#0B5CAD"
                  onPress={() => this.goOrders('IN_TRANSIT')}
                />
                {/* ✅ RESCHEDULE exact */}
                <StatBox
                  title="Re-schedule"
                  value={this.toNum(live?.reschedule_order)}
                  bg="#E9E7FF"
                  valueColor="#4F46E5"
                  onPress={() => this.goOrders('RESCHEDULE')}
                />
                <StatBox
                  title="RTO"
                  value={this.toNum(live?.rto)}
                  bg="#FFE6E6"
                  valueColor="#B91C1C"
                  onPress={() => this.goOrders('RTO')}
                />
              </View>
            </View>

            {/* Today's Deliveries */}
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.sectionTitle}>Today's Deliveries</Text>
                <TouchableOpacity onPress={() => this.goOrders('TODAY')} style={styles.linkBtn}>
                  <Text style={styles.linkText}>View All</Text>
                  <Text style={styles.linkArrow}>›</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={todayDeliveries}
                keyExtractor={(item, index) => `${item?.customer_name || 'cust'}-${item?.status || 'st'}-${index}`}
                renderItem={this.renderDeliveryItem}
                ItemSeparatorComponent={() => <View style={styles.sep} />}
                scrollEnabled={false}
              />
            </View>

            {/* Earnings + Penalties */}
           

            {/* Quick Actions */}
            <View style={styles.actionsRow}>
              {/* <ActionTile label="Scan POD" icon="📷" bg="#E8F1FF" textColor="#164E8A" onPress={() => console.log('Scan POD', 'Demo action')} /> */}
              <ActionTile label="Deposit Cash" icon="💸" bg="#E7FAF3" textColor="#0F7A5A" onPress={() =>  this.goOrders('ALL')} />
              <ActionTile label="Delivery History" icon="📋" bg="#FFF4DA" textColor="#A16207" onPress={() => this.goOrders('ALL')} />
              <ActionTile label="Support" icon="🎧" bg="#FFE7E7" textColor="#B91C1C" onPress={this.callSupport} />
            </View>

            <View style={{ height: 10 }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }
}

class StatBox extends Component {
  render() {
    const { title, value, bg, valueColor, onPress } = this.props;
    return (
      <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={[styles.statBox, { backgroundColor: bg }]}>
        <Text style={styles.statTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.statValue, { color: valueColor }]}>{String(value)}</Text>
      </TouchableOpacity>
    );
  }
}


class ActionTile extends Component {
  render() {
    const { label, icon, bg, textColor, onPress } = this.props;
    return (
      <TouchableOpacity style={[styles.actionTile, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.85}>
        <View style={styles.actionIconWrap}>
          <Text style={styles.actionIcon} numberOfLines={1}>
            {icon}
          </Text>
        </View>
        <Text style={[styles.actionLabel, { color: textColor }]} numberOfLines={2}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }
}

function formatINR(n) {
  try {
    return Number(n).toLocaleString('en-IN');
  } catch (e) {
    return String(n);
  }
}

const CARD_RADIUS = 14;
const GAP = 10;
const STAT_COLS = 3;
const STAT_BOX_WIDTH = (width - 14 * 2 - 12 * 2 - GAP * (STAT_COLS - 1)) / STAT_COLS;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F5F7' },

  headerWrap: { backgroundColor: '#1C8A62' },
  headerSafe: { backgroundColor: '#1C8A62' },
  headerRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { width: 42, height: 42, justifyContent: 'center' },
  headerIcon: { fontSize: 26, color: '#fff' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 16, fontWeight: '800' },
  headerRight: { width: 42, height: 42, alignItems: 'flex-end', justifyContent: 'center' },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 2,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '500' },

  bodySafe: { flex: 1, backgroundColor: '#F3F5F7' },
  scrollContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16 },

  welcome: { fontSize: 14, fontWeight: '800', color: '#111827', marginBottom: 10 },

  ruleBanner: { backgroundColor: '#2D3A44', borderRadius: 8, paddingVertical: 14, paddingHorizontal: 12, marginBottom: 12 },
  ruleText: { color: '#F2B01E', fontSize: 12, fontWeight: '700' },

  card: { backgroundColor: '#fff', borderRadius: CARD_RADIUS, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E6EAF0' },

  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '500', color: '#111827' },

  linkBtn: { flexDirection: 'row', alignItems: 'center' },
  linkText: { color: '#1C5D9E', fontSize: 12, fontWeight: '800' },
  linkArrow: { color: '#1C5D9E', fontSize: 18, marginLeft: 6, marginTop: -2 },

  liveRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: GAP },
  statBox: { width: STAT_BOX_WIDTH, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  statTitle: { fontSize: 10, fontWeight: '500', color: '#4B5563', marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: '900' },

  deliveryRow: { flexDirection: 'row', alignItems: 'center' },
  deliveryName: { fontSize: 13, fontWeight: '500', color: '#111827' },
  deliveryMeta: { fontSize: 12, fontWeight: '400',color: '#4B5563', marginTop: 4 },
  deliveryCod: { fontSize: 13, fontWeight: '800', color: '#0F7451', marginTop: 6 },
  deliveryBadge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  deliveryBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.1 },
  sep: { height: 1, backgroundColor: '#EEF2F6', marginVertical: 12 },

  twoColRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  bigCard: { width: (width - 14 * 2 - 10) / 2, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 10, justifyContent: 'center' },
  bigCardTitle: { color: '#fff', fontSize: 11, fontWeight: '700', marginBottom: 6,alignSelf:'center' },
  bigCardValue: { color: '#fff', fontSize: 18, fontWeight: '800', alignSelf:'center' },
  bigCardSub: { color: '#EAF7F1', fontSize: 10, fontWeight: '600',alignSelf:'center' },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionTile: { width: (width - 14 * 2 - 12 * 3) / 4, height: 88, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  actionIconWrap: { height: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  actionIcon: { fontSize: 24, lineHeight: 26, textAlign: 'center', includeFontPadding: false },
  actionLabel: { textAlign: 'center', fontSize: 10, fontWeight: '800', lineHeight: 12 },
});