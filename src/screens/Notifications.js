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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeBottomEdges } from '../utils/safeAreaInsets';
import constants from '../utils/constants';
import { applyNotificationNavigation } from '../utils/notificationNavigation';
import { withV4Navigation } from '../utils/v4Compat';
import ScreenHeader from '../components/ScreenHeader';
import { NotificationCountBadge } from '../components/NotificationBellButton';
import { S, soilIcons as I } from '../utils/soilTheme';

const P = S.P;
const PAGE_LIMIT = 20;

const TYPE_META = {
  SOIL_ORDER: { label: 'Soil Order', color: S.AMBER, bg: S.AMBER_BG, icon: require('./assets/soil.png'), tint: false },
  ORDER: { label: 'Delivery', color: S.P, bg: S.P_TINT, icon: I.truck, tint: true },
  SETTLEMENT: { label: 'Settlement', color: S.TEAL, bg: S.TEAL_BG, icon: I.rupee, tint: true },
  DEFAULT: { label: 'Alert', color: S.P, bg: S.P_SOFT, icon: I.bell, tint: true },
};

const EVENT = {
  cancel: { label: 'Cancelled', color: S.RED, bg: S.RED_BG, icon: I.close, tint: true },
  placed: { label: 'Order Placed', color: S.GREEN_DARK, bg: S.GREEN_BG, icon: I.check, tint: true },
  success: { label: 'Completed', color: S.GREEN_DARK, bg: S.GREEN_BG, icon: I.check, tint: true },
  pending: { label: 'Pending', color: S.ORANGE, bg: S.ORANGE_BG, icon: I.clock, tint: true },
  default: null,
};

class Notifications extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: true,
      refreshing: false,
      loadingMore: false,
      notifications: [],
      page: 1,
      totalPages: 1,
      total: 0,
      hasMore: false,
    };
    this._seq = 0;
  }

  componentDidMount() {
    this.fetchNotifications({ page: 1, append: false });
  }

  parsePayload = (json) => {
    const payload = json?.data;
    const list = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.list)
        ? payload.list
        : Array.isArray(payload)
          ? payload
          : Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.notifications)
              ? json.notifications
              : [];
    const meta = payload?.meta || json?.meta || json?.pagination || {};
    return { list, meta };
  };

  fetchNotifications = ({ page = 1, append = false } = {}) => {
    const seq = ++this._seq;
    const url = `${constants.notification}?page=${page}&limit=${PAGE_LIMIT}`;

    fetch(url, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + global.token, Accept: 'application/json' },
    })
      .then((r) => r.json())
      .then((json) => {
        if (seq !== this._seq) return;

        const { list, meta } = this.parsePayload(json);
        const currentPage = Math.max(1, Number(meta?.page || page) || page);
        const totalPages = Math.max(1, Number(meta?.totalPages || meta?.total_pages || 1) || 1);
        const total = Number(meta?.total ?? list.length) || list.length;
        const hasMore = currentPage < totalPages;

        this.setState({
          isLoading: false,
          refreshing: false,
          loadingMore: false,
          notifications: append ? [...this.state.notifications, ...list] : list,
          page: currentPage,
          totalPages,
          total,
          hasMore,
        });
      })
      .catch((e) => {
        if (seq !== this._seq) return;
        console.log('Notifications API error== ', e);
        this.setState({
          isLoading: false,
          refreshing: false,
          loadingMore: false,
          notifications: append ? this.state.notifications : [],
          hasMore: false,
        });
      });
  };

  onRefresh = () => {
    this.setState({ refreshing: true, page: 1, hasMore: false }, () =>
      this.fetchNotifications({ page: 1, append: false }),
    );
  };

  handleEndReached = () => {
    const { loadingMore, hasMore, isLoading, refreshing, page } = this.state;
    if (loadingMore || !hasMore || isLoading || refreshing) return;
    this.setState({ loadingMore: true }, () =>
      this.fetchNotifications({ page: page + 1, append: true }),
    );
  };

  timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'Abhi';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  typeMeta = (type) => {
    const key = String(type || '').toUpperCase();
    if (TYPE_META[key]) return TYPE_META[key];
    if (key.includes('SOIL')) return TYPE_META.SOIL_ORDER;
    if (key.includes('SETTLE')) return TYPE_META.SETTLEMENT;
    if (key.includes('ORDER')) return TYPE_META.ORDER;
    return TYPE_META.DEFAULT;
  };

  typeLabel = (type) => {
    const key = String(type || '').trim().toUpperCase();
    if (!key) return '';
    return this.typeMeta(type).label;
  };

  eventStyle = (item) => {
    const blob = `${item?.title || ''} ${item?.message || ''}`.toLowerCase();
    const typeMeta = this.typeMeta(item?.type);

    if (/cancel|reject|fail|dispute/.test(blob)) {
      return { ...EVENT.cancel, typeMeta };
    }
    if (/place|creat/.test(blob)) {
      return { ...EVENT.placed, typeMeta };
    }
    if (/success|confirm|complete|deliver|ready/.test(blob)) {
      return { ...EVENT.success, typeMeta };
    }
    if (/pending|wait|pickup/.test(blob)) {
      return { ...EVENT.pending, typeMeta };
    }

    return {
      label: typeMeta.label,
      color: typeMeta.color,
      bg: typeMeta.bg,
      icon: typeMeta.icon,
      tint: typeMeta.tint !== false,
      typeMeta,
    };
  };

  renderNotifIcon = (evt) => {
    const style = [styles.iconImg, evt.tint !== false && { tintColor: evt.color }];
    return <Image source={evt.icon} style={style} resizeMode="contain" />;
  };

  isRead = (item) =>
    item?.isRead === true || item?.read === true || item?.is_read === true || item?.status === 'read';

  onNotificationPress = (item) => {
    applyNotificationNavigation(this.props.navigation, {
      nav: item?.nav || '',
      navId: item?.navId != null ? String(item.navId) : '',
      type: item?.type || '',
      orderId: item?.order_id != null
        ? String(item.order_id)
        : item?.orderId != null
          ? String(item.orderId)
          : '',
    });
  };

  renderItem = ({ item }) => {
    const title = item?.title || item?.heading || '';
    const body = item?.message || item?.body || item?.description || '';
    const time = item?.createdAt || item?.created_at || item?.date || '';
    const read = this.isRead(item);
    const evt = this.eventStyle(item);
    const typeText = this.typeLabel(item?.type);

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => this.onNotificationPress(item)}
        style={styles.cardWrap}
      >
        <View style={[styles.card, !read && styles.cardUnread]}>
          <View style={[styles.accent, { backgroundColor: evt.color }]} />

          <View style={[styles.iconBox, { backgroundColor: evt.bg }]}>
            {this.renderNotifIcon(evt)}
          </View>

          <View style={styles.inner}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, !read && styles.titleUnread]}>{title}</Text>
              {!!time ? <Text style={styles.time}>{this.timeAgo(time)}</Text> : null}
            </View>
            {!!body ? (
              <Text style={[styles.body, read && styles.bodyRead]}>{body}</Text>
            ) : null}
            {!!typeText ? (
              <View style={[styles.typeChip, { backgroundColor: evt.typeMeta?.bg || S.BG }]}>
                <Text style={[styles.typeText, { color: evt.typeMeta?.color || S.SUB }]}>
                  {typeText}
                </Text>
              </View>
            ) : null}
          </View>

          {!read ? <View style={[styles.unreadDot, { backgroundColor: evt.color }]} /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  renderEmpty = () => {
    if (this.state.isLoading) return null;
    return (
      <View style={styles.emptyWrap}>
        <View style={[styles.emptyIconWrap, { backgroundColor: S.P_SOFT }]}>
          <Image source={I.bell} style={[styles.emptyIcon, { tintColor: P }]} />
        </View>
        <Text style={styles.emptyTitle}>Abhi koi notification nahi</Text>
        <Text style={styles.emptySub}>Naya update aate hi yahan dikhega</Text>
      </View>
    );
  };

  renderFooter = () => {
    const { loadingMore, hasMore } = this.state;
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={P} />
        </View>
      );
    }
    if (hasMore) return <View style={styles.footerSpacer} />;
    return null;
  };

  renderHeaderBadge = () => <NotificationCountBadge large />;

  render() {
    const { isLoading, notifications, refreshing } = this.state;

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={P} />

        <ScreenHeader
          bg={P}
          title="Notifications"
          onBack={() => this.props.navigation?.goBack?.()}
          right={this.renderHeaderBadge()}
        />

        <SafeAreaView edges={Platform.OS === 'ios' ? [] : safeBottomEdges()} style={styles.body}>
          {isLoading && !refreshing ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="small" color={P} />
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item, i) => String(item?.id || i)}
              renderItem={this.renderItem}
              ListEmptyComponent={this.renderEmpty}
              ListFooterComponent={this.renderFooter}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onEndReached={this.handleEndReached}
              onEndReachedThreshold={0.35}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={this.onRefresh} colors={[P]} tintColor={P} />
              }
            />
          )}
        </SafeAreaView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: S.BG },
  body: { flex: 1 },

  listContent: { flexGrow: 1, paddingHorizontal: 6, paddingTop: 6, paddingBottom: 16 },

  cardWrap: { marginBottom: 5 },
  card: {
    flexDirection: 'row',
    alignItems: 'stretch',
    position: 'relative',
    backgroundColor: S.CARD,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: S.BORDER,
    ...Platform.select({
      ios: {
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
      android: { elevation: 1 },
    }),
  },
  cardUnread: { borderColor: S.P_GLOW, backgroundColor: '#FDFBFF' },
  accent: { width: 4 },

  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginLeft: 8,
    marginTop: 8,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  iconImg: { width: 18, height: 18 },

  inner: { flex: 1, minWidth: 0, paddingTop: 8, paddingBottom: 8, paddingRight: 8 },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { flex: 1, fontSize: 13, fontWeight: '600', color: S.TXT, lineHeight: 17 },
  titleUnread: { fontWeight: '600', color: S.TXT },
  time: { fontSize: 10, fontWeight: '500', color: S.MUTED, marginTop: 2, flexShrink: 0 },
  body: { fontSize: 12, fontWeight: '400', color: S.SUB, lineHeight: 16, marginTop: 3 },
  bodyRead: { color: S.MUTED },
  typeChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: { fontSize: 10, fontWeight: '500', letterSpacing: 0.2 },

  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    position: 'absolute',
    top: 8,
    right: 8,
  },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 60 },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyIcon: { width: 28, height: 28, resizeMode: 'contain' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: S.TXT, marginBottom: 6 },
  emptySub: { fontSize: 13, color: S.MUTED, textAlign: 'center', lineHeight: 18 },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footerLoader: { paddingVertical: 12, alignItems: 'center' },
  footerSpacer: { height: 4 },
});

export default withV4Navigation(Notifications);
