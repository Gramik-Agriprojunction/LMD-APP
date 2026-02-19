import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Image,
  ActivityIndicator,
} from 'react-native';
import constants from './constants';
import Toast from 'react-native-simple-toast';
import {NavigationEvents} from 'react-navigation';

const { width } = Dimensions.get('window');

const STATUS = {
  ALL: 'ALL',
  PICKUP: 'PICKUP',
  PENDING: 'PENDING',
  DELIVERED: 'DELIVERED',
  INTRANSIT: 'IN_TRANSIT',
  RESCHEDULE: 'RESCHEDULE',
  RTO: 'RTO',
};

// layout constants (same idea as LMDDashboard)
const CARD_RADIUS = 14;
const GAP = 10;
const STAT_COLS = 3;
const STAT_BOX_WIDTH = (width - 14 * 2 - 12 * 2 - GAP * (STAT_COLS - 1)) / STAT_COLS;

export default class TrackOrders extends Component {
  constructor(props) {
    super(props);

    const initialStatus = this.getInitialStatus();

    this.state = {
      isLoading: false,
      query: '',
      selectedStatus: initialStatus,

      // API response
      order_list: [],
      live: {
        picked_up: 0,
        pending: 0,
        delivered: 0,
        in_transit: 0,
        reschedule_order: 0,
        rto: 0,
      },
    };
  }

  componentDidMount() {
    this.ordersListApi(this.state.selectedStatus);
  }

  getInitialStatus = () => {
    const selected = this.props?.navigation?.getParam('selectedStatus', STATUS.ALL);

    // normalize variants if coming from older code
    if (selected === 'IN_TRANSIT') return STATUS.INTRANSIT;

    return Object.values(STATUS).includes(selected) ? selected : STATUS.ALL;
  };

  toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  ordersListApi = (statusKey) => {
    const statusToSend = statusKey === STATUS.ALL ? '' : statusKey;

    const formData = new FormData();
    formData.append('status', statusToSend?.toLowerCase());

    this.setState({ isLoading: true }, () => {
      console.log('orders list formdata status== ', statusToSend);

      fetch(constants.orderList, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + global.token,
        },
        body: formData,
      })
        .then((response) => response.json())
        .then((responseJson) => {
          console.log('orders list response== ', JSON.stringify(responseJson));
          const ok = !!responseJson?.status;

          this.setState({
            isLoading: false,
            order_list: ok && Array.isArray(responseJson?.data) ? responseJson.data : [],
            live: ok && responseJson?.live ? responseJson.live : this.state.live,
          });

          if (!ok) console.log('orders list api message== ', responseJson?.message);
        })
        .catch((error) => {
          console.log('order list error== ', error);
          this.setState({ isLoading: false, order_list: [] });
        });
    });
  };

  setSelectedStatus = (statusKey) => {
    this.setState({ selectedStatus: statusKey }, () => this.ordersListApi(statusKey));
  };

  goBack = () => {
    const nav = this.props?.navigation;
    if (nav?.goBack) nav.goBack();
    else console.log('goBack not available');
  };

  getFilteredOrders = () => {
    const { order_list, query } = this.state;
    const q = (query || '').trim().toLowerCase();
    if (!q.length) return order_list;

    return order_list.filter((o) => {
      const id = String(o?.order_id || '');
      const farmer = String(o?.customer_name || '');
      const village = String(o?.village || '');
      const hay = `${id} ${farmer} ${village}`.toLowerCase();
      return hay.includes(q);
    });
  };

onPressOrder = (item) => {
  // item contains { id: 10, order_id: "...", ... }
  this.props.navigation.navigate('DeliveryDetails', { order: item });
};
 
  renderOrder = ({ item }) => {
    const statusText = String(item?.status || 'UNKNOWN');

    return (
      <TouchableOpacity style={styles.orderCard} activeOpacity={0.9} onPress={() => this.onPressOrder(item)}>
        <View style={styles.orderTopRow}>
          <Text style={styles.orderIdLabel}>
            ORDER : <Text style={styles.orderId}>{String(item?.order_id || '-')}</Text>
          </Text>

          <View style={[styles.badge, badgeFor(statusText)]}>
            <Text style={[styles.badgeText, { color: badgeFor(statusText).color }]} numberOfLines={1}>
              {statusText}
            </Text>
          </View>
        </View>

        <Text style={styles.farmerName} numberOfLines={1}>
          {String(item?.customer_name || 'Customer')}
        </Text>

        <Text style={styles.metaText} numberOfLines={2}>
          {`Village : ${String(item?.village || '-')}`}
        </Text>

        <View style={styles.moneyRow}>
          <Text style={styles.moneyLabel}>Amount :</Text>
          <Text style={styles.moneyValue}>{`₹ ${this.toNum(item?.amount)}`}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  render() {
    const { query, selectedStatus, isLoading, live } = this.state;
    const data = this.getFilteredOrders();

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#1C8A62" />

         <NavigationEvents
                        onWillFocus={() => {
                          
                        }}
                        onDidFocus={() => {
                             this.ordersListApi(this.state.selectedStatus);
                        }}
                      />

        {/* ✅ SAFE HEADER */}
        <View style={styles.headerWrap}>
          <SafeAreaView style={styles.headerSafe}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={this.goBack} style={styles.headerIconBtn} activeOpacity={0.8}>
                <Image style={styles.backImg} source={require('./assets/back.png')} />
              </TouchableOpacity>

              <Text style={styles.headerTitle} numberOfLines={1}>
                Delivery Orders
              </Text>

              <View style={{ width: 42, height: 42 }} />
            </View>
          </SafeAreaView>
        </View>

        {/* BODY */}
        <View style={styles.body}>
          {/* Search */}
          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              value={query}
              onChangeText={(t) => this.setState({ query: t })}
              placeholder="Search here.."
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
            />
          </View>

          {/* ✅ SAME 6 STATUS BOXES AS LMDDashboard */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.sectionTitle}>Live Orders</Text>
            </View>

            <View style={styles.liveRow}>
              <StatBox
                title="Picked Up"
                value={this.toNum(live?.picked_up)}
                bg="#EEF2F6"
                valueColor="#111827"
                active={selectedStatus === STATUS.PICKUP}
                onPress={() => this.setSelectedStatus(STATUS.PICKUP)}
              />
              <StatBox
                title="Pending"
                value={this.toNum(live?.pending)}
                bg="#FCEED7"
                valueColor="#997c12"
                active={selectedStatus === STATUS.PENDING}
                onPress={() => this.setSelectedStatus(STATUS.PENDING)}
              />
              <StatBox
                title="Delivered"
                value={this.toNum(live?.delivered)}
                bg="#beebdb"
                valueColor="#457d69"
                active={selectedStatus === STATUS.DELIVERED}
                onPress={() => this.setSelectedStatus(STATUS.DELIVERED)}
              />
              <StatBox
                title="In-Transit"
                value={this.toNum(live?.in_transit)}
                bg="#E6F4FF"
                valueColor="#0B5CAD" 
                active={selectedStatus === STATUS.INTRANSIT}
                onPress={() => this.setSelectedStatus(STATUS.INTRANSIT)}
              />
              <StatBox
                title="Re-schedule"
                value={this.toNum(live?.reschedule_order)}
                bg="#E9E7FF"
                valueColor="#4F46E5"
                active={selectedStatus === STATUS.RESCHEDULE}
                onPress={() => this.setSelectedStatus(STATUS.RESCHEDULE)}
              />
              <StatBox
                title="RTO"
                value={this.toNum(live?.rto)}
                bg="#FFE6E6"
                valueColor="#B91C1C"
                active={selectedStatus === STATUS.RTO}
                onPress={() => this.setSelectedStatus(STATUS.RTO)}
              />
            </View>
          </View>

          <FlatList
            data={data}
            keyExtractor={(i, idx) => String(i?.id || i?.order_id || idx)}
            renderItem={this.renderOrder}
            contentContainerStyle={{ paddingBottom: 14 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ paddingVertical: 28, alignItems: 'center', justifyContent: 'center' }}>
                {isLoading ? (
                  <ActivityIndicator size="small" color="#1C8A62" />
                ) : (
                  <Text style={{ fontSize: 15, color: '#6B7280', fontWeight: '500',marginTop:20 }}>
                    No order(s) found
                  </Text>
                )}
              </View>
            }
          /> 
        </View>

      </View>
    ); 
  }
}

/** ✅ StatBox with border for selected */
class StatBox extends Component {
  render() {
    const { title, value, bg, valueColor, onPress, active } = this.props;

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onPress}
        style={[
          styles.statBox,
          { backgroundColor: bg },
          active ? [styles.statBoxActive,{borderColor : valueColor}] : styles.statBoxInactive,
        ]}
      >
        <Text style={styles.statTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.statValue, { color: valueColor }]}>{String(value)}</Text>
      </TouchableOpacity>
    );
  }
}

/** Badge color helper */
function badgeFor(status) {
  const st = String(status || '').toUpperCase();

  if (st === 'PICKUP' || st === 'PICKED UP') {
    return { backgroundColor: '#EEF2F6', color: '#111827' };
  }

  if (st === 'PENDING') {
    return { backgroundColor: '#FCEED7', color: '#997c12' };
  }

  if (st === 'DELIVERED') {
    return { backgroundColor: '#beebdb', color: '#457d69' };
  }

  if (st === 'IN-TRANSIT' || st === 'INTRANSIT' || st === 'IN TRANSIT') {
    return { backgroundColor: '#E6F4FF', color: '#0B5CAD' };
  }

  if (st === 'RE-SCHEDULE' || st === 'RESCHEDULE' || st === 'RE SCHEDULE') {
    return { backgroundColor: '#E9E7FF', color: '#4F46E5' };
  }

  if (st === 'RTO') {
    return { backgroundColor: '#FFE6E6', color: '#B91C1C' };
  }

  if (st === 'CANCELLED' || st === 'CANCELED') {
    return { backgroundColor: '#FFE6E6', color: '#B91C1C' };
  }

  return { backgroundColor: '#EEF2F6', color: '#111827' };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F5F7' },

  /** Header */
  headerWrap: { backgroundColor: '#1C8A62', zIndex: 10, elevation: 10 },
  headerSafe: { backgroundColor: '#1C8A62' },
  headerRow: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  headerIconBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  backImg: { width: 25, height: 25, resizeMode: 'contain', tintColor: '#FFF' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#fff', fontSize: 14, fontWeight: '800' },

  body: { flex: 1, paddingHorizontal: 14, paddingTop: 12 },

  /** Search */
  searchWrap: {
    height: 46,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },

  /** Card */
  card: {
    backgroundColor: '#fff',
    borderRadius: CARD_RADIUS,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },

  /** Stat grid */
  liveRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: GAP },
  statBox: {
    width: STAT_BOX_WIDTH,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    height: 70,
  },
  statBoxActive: {
    borderColor: '#111827',
    borderWidth: 1.5,
  },
  statBoxInactive: {
    borderColor: 'transparent',
    borderWidth: 1,
  },
  statTitle: { fontSize: 9, fontWeight: '600', color: '#4B5563', marginBottom: 3 },
  statValue: { fontSize: 20,marginTop:3, fontWeight: '800' },

  /** Order card */
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    padding: 12,
    marginBottom: 12,
  },
  orderTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderIdLabel: { fontSize: 9, fontWeight: '700', color: '#000' },
  orderId: { fontSize: 10, color: '#F68A20', fontWeight: '700' },

  badge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, maxWidth: 150 },
  badgeText: { fontSize: 8, fontWeight: '800' },

  farmerName: { marginTop: 8, fontSize: 13, fontWeight: '500', color: '#111827' },
  metaText: { marginTop: 8, fontSize: 11, color: '#4B5563',fontWeight:'500' },

  moneyRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  moneyLabel: { fontSize: 11, fontWeight: '500', color: '#4B5563', marginRight: 6 },
  moneyValue: { fontSize: 15, fontWeight: '800', color: '#02724E' },

  loaderOverlay: {
    position: 'absolute',
    left: 0,
    right: 0, 
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },
  loaderText: { marginLeft: 10, fontSize: 12, color: '#111827', fontWeight: '800' },
});