import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import constants from '../utils/constants';
import { withV4Navigation } from '../utils/v4Compat';

class Notifications extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: false,
      refreshing: false,
      notifications: [],
    };
  }

  componentDidMount() {
    this.fetchNotifications();
  }

  goBack = () => {
    const nav = this.props?.navigation;
    if (nav?.goBack) nav.goBack();
  };

  fetchNotifications = () => {
    this.setState({ isLoading: true });

    fetch(constants.notification, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + global.token,
        Accept: 'application/json',
      },
    })
      .then((r) => r.json())
      .then((json) => {
        console.log('Notifications API response== ', JSON.stringify(json));
        const list = Array.isArray(json?.data) ? json.data : Array.isArray(json?.notifications) ? json.notifications : [];
        this.setState({ isLoading: false, refreshing: false, notifications: list });
      })
      .catch((e) => {
        console.log('Notifications API error== ', e);
        this.setState({ isLoading: false, refreshing: false });
      });
  };

  onRefresh = () => {
    this.setState({ refreshing: true }, this.fetchNotifications);
  };

  timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  renderItem = ({ item, index }) => {
    const title = item?.title || item?.heading || '';
    const body = item?.message || item?.body || item?.description || '';
    const time = item?.created_at || item?.date || item?.time || '';
    const isRead = item?.read === true || item?.is_read === true || item?.status === 'read';

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => this.props.navigation.navigate('DeliveryDetails', { order: { id: item?.order_id || item?.orderId || item?.id } })}
      >
        <View style={[styles.notifCard, !isRead && styles.notifCardUnread]}>
          <View style={styles.notifIconWrap}>
            <Image source={require('./assets/bell.png')} style={styles.notifIcon} />
            {!isRead && <View style={styles.unreadDot} />}
          </View>
          <View style={{ flex: 1 }}>
            {!!title && <Text style={styles.notifTitle} numberOfLines={2}>{title}</Text>}
            {!!body && <Text style={styles.notifBody} numberOfLines={3}>{body}</Text>}
            {!!time && <Text style={styles.notifTime}>{this.timeAgo(time)}</Text>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  renderEmpty = () => {
    if (this.state.isLoading) return null;
    return (
      <View style={styles.emptyWrap}>
        <Image source={require('./assets/bell.png')} style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>Abhi Koi Notification Nahi!</Text>
        <Text style={styles.emptySub}>Kuch naya aayega toh aapko bata denge.</Text>
      </View>
    );
  };

  render() {
    const { isLoading, notifications, refreshing } = this.state;

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#5D3FD3" />

        <View style={styles.headerWrap}>
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={this.goBack} style={styles.headerIconBtn} activeOpacity={0.8}>
                <Image style={styles.backImg} source={require('./assets/back.png')} />
              </TouchableOpacity>
              <Text style={styles.headerTitle} numberOfLines={1}>Notifications</Text>{/* keep — widely understood */}
              <View style={{ width: 42, height: 42 }} />
            </View>
          </SafeAreaView>
        </View>

        {isLoading && !refreshing ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="small" color="#1C8A62" />
            <Text style={styles.loaderText}>Loading...</Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item, i) => String(item?.id || i)}
            renderItem={this.renderItem}
            ListEmptyComponent={this.renderEmpty}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={this.onRefresh} colors={['#1C8A62']} tintColor="#1C8A62" />
            }
          />
        )}
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

  listContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 20, flexGrow: 1 },

  notifCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },
  notifCardUnread: { backgroundColor: '#F0FAF6', borderColor: '#C6E9D9' },

  notifIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E7FAF3', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  notifIcon: { width: 20, height: 20, resizeMode: 'contain', tintColor: '#1C8A62' },
  unreadDot: { position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E53935' },

  notifTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  notifBody: { fontSize: 13, fontWeight: '400', color: '#6B7280', lineHeight: 19 },
  notifTime: { fontSize: 11, fontWeight: '500', color: '#9CA3AF', marginTop: 6 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 60 },
  emptyIcon: { width: 60, height: 60, resizeMode: 'contain', tintColor: '#D1D5DB', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#374151', marginBottom: 8 },
  emptySub: { fontSize: 13, fontWeight: '400', color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loaderText: { marginTop: 10, fontSize: 12, fontWeight: '700', color: '#6B7280' },
});

export default withV4Navigation(Notifications);
