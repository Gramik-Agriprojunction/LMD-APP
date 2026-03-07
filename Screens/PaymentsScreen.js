import React, { Component } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default class PaymentsScreen extends Component {
  state = {
    period: 'month',
    tab: 'all',
      notifications: 3,

  };

//   onSearch = () => Alert.alert('Search clicked');
//   onWithdraw = () => Alert.alert('Withdraw initiated');

  renderStat(title, value, bg, icon) {
    return (
      <View style={[styles.statCard, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={25} color="#FFF" />
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    );
  }

  renderPending(title, sub, amount, time) {
    return (
      <View style={[styles.itemCard, styles.pendingBg]}>
        <View style={styles.itemLeft}>
          <Ionicons name="warning" size={20} color="#F59E0B" />
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.itemTitle}>{title}</Text>
            {sub ? <Text style={styles.itemSub}>{sub}</Text> : null}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.itemAmount, { color: '#F59E0B' }]}>{amount}</Text>
          <Text style={styles.itemTime}>{time}</Text>
        </View>
      </View>
    );
  }

  renderWithdraw(title, method, amount, time) {
    return (
      <View style={styles.itemCard}>
        <View style={styles.itemLeft}>
          <Ionicons name="business" size={20} color="#0F7451" />
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.itemTitle}>{title}</Text>
            <Text style={styles.itemSub}>{method}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.itemAmount, { color: '#0F7451' }]}>{amount}</Text>
          <Text style={styles.itemTime}>{time}</Text>
        </View>
      </View>
    );
  }

  render() {
    const { period, tab } = this.state;

    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar backgroundColor="#0F7451" barStyle="light-content" />

       {/* Header (same as InventoryScreen) */}
<View style={styles.headerWrap}>
  <SafeAreaView style={styles.headerSafe} />
  <StatusBar backgroundColor="#0F7451" barStyle="light-content" />

  <View style={styles.headerRow}>
    <TouchableOpacity
      onPress={() => this.props?.navigation?.goBack?.()}
      activeOpacity={0.85}
      style={styles.headerBtn}
    >
       <Ionicons name={'wallet'} size={25} color="#FFF" />
    </TouchableOpacity>

    <View style={{ flex: 1, paddingHorizontal: 8 }}>
      <Text style={styles.headerTitle} numberOfLines={1}>
        Payments
      </Text>

      <View style={styles.headerSubRow}>
        <Text style={styles.headerSubText} numberOfLines={1}>
          Total : ₹ 28,700
        </Text>
      </View>
    </View>

    <TouchableOpacity
      onPress={() => Alert.alert('Notifications')}
      activeOpacity={0.85}
      style={styles.headerBtn}
    >
      <Ionicons name="notifications-outline" size={22} color="#fff" />
      {this.state.notifications > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{this.state.notifications}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  </View>
</View>

        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>

          {/* Period Filters */}
          <View style={styles.periodRow}>
            {['This Month', 'Last 3 Months', 'Custom Date'].map((t, i) => {
              const key = i === 0 ? 'month' : i === 1 ? '3m' : 'custom';
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => this.setState({ period: key })}
                  style={[
                    styles.periodBtn,
                    period === key && styles.periodActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.periodText,
                      period === key && styles.periodTextActive,
                    ]}
                  >
                    {t}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {this.renderStat('Total Earned', '₹19,600', '#0F7451', 'wallet')}
            {this.renderStat('Total Paid', '₹14,600', '#2563EB', 'cash')}
            {this.renderStat('Payable', '₹5,000', '#F68A20', 'alert-circle')}
          </View>

          {/* Tabs + Search */}
          <View style={styles.tabsRow}>
            {['All', 'Pending', 'Paid', 'Withdrawals'].map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => this.setState({ tab: t.toLowerCase() })}
                style={[
                  styles.tabBtn,
                  tab === t.toLowerCase() && styles.tabActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === t.toLowerCase() && styles.tabTextActive,
                  ]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity onPress={this.onSearch} style={styles.searchBtn}>
              <Ionicons name="search" size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* List */}
          {this.renderPending('Pending Settlement', null, '₹ 1,300', 'Today, 11:25 AM')}
          {this.renderPending('Pending Settlement', '₹ 1,300 per Bag', '₹1,300', 'Apr 23, 2024, 3:45 PM')}
          {this.renderPending('Pending Settlement', '₹ 3,700 per Pack', '₹3,700', 'Apr 23, 2024, 3:45 PM')}

          {this.renderWithdraw('Withdrawn', 'Paid via Bank A/c', '₹ 7,800', 'Apr 19, 2024, 11:00 AM')}
          {this.renderWithdraw('Withdrawn', 'Paid via UPI', '₹ 6,800', 'Apr 14, 2024, 9:00 AM')}
          {this.renderWithdraw('Withdrawn', 'Paid via Bank A/c', '₹ 7,800', 'Apr 14, 2024, 9:00 AM')}

        </ScrollView>

      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7F6' },

 headerWrap: {
  backgroundColor: '#0F7451',
},
headerSafe: {
  backgroundColor: '#0F7451',
},
headerRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 14,
  paddingTop: 8,
  paddingBottom: 10,
},
headerBtn: {
  width: 36,
  height: 36,
  borderRadius: 12,
  alignItems: 'center',
  justifyContent: 'center',
},
headerTitle: {
  color: '#fff',
  fontSize: 17,
  fontWeight: '700',
},
headerSubRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 2,
},
headerSubText: {
  color: '#D1FAE5',
  fontSize: 12,
  fontWeight: '500',
},
badge: {
  position: 'absolute',
  top: 5,
  right: -3,
  width: 18,
  height: 18,
  borderRadius: 9,
  backgroundColor: '#EF4444',
  alignItems: 'center',
  justifyContent: 'center',
},
badgeText: {
  color: '#fff',
  fontSize: 11,
  fontWeight: '400',
},

  periodRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  periodBtn: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FFF',
  },
  periodActive: {
    backgroundColor: '#0F7451',
    borderColor: '#0F7451',
  },
  periodText: { fontSize: 11, color: '#111827' },
  periodTextActive: { color: '#FFF', fontWeight: '600' },

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
  },
  statTitle: { color: '#E5F4EF', fontSize: 11, marginTop: 6 },
  statValue: { color: '#FFF', fontSize: 16, fontWeight: '700', marginTop: 4 },

  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  tabBtn: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFF',
  },
  tabActive: {
    backgroundColor: '#0F7451',
    borderColor: '#0F7451',
  },
  tabText: { fontSize: 11, color: '#111827' },
  tabTextActive: { color: '#FFF', fontWeight: '600' },
  searchBtn: {
    marginLeft: 'auto',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFF',
  },

  itemCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pendingBg: {
    backgroundColor: '#FFF7ED',
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  itemTitle: { fontSize: 13, fontWeight: '600', color: '#111827' },
  itemSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  itemAmount: { fontSize: 15, fontWeight: '700' },
  itemTime: { fontSize: 10, color: '#6B7280', marginTop: 2 },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
    backgroundColor: '#F5F7F6',
  },
  withdrawBtn: {
    backgroundColor: '#0F7451',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  withdrawText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
});