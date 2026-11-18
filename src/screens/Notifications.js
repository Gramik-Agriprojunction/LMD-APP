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
import { HEADER } from '../theme/headerColors';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
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
      filterTab: 'all', // all | unread
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

  isRead = (item) =>
    item?.isRead === true || item?.read === true || item?.is_read === true || item?.status === 'read';

  unreadCount = () => (this.state.notifications || []).filter((n) => !this.isRead(n)).length;

  markItemRead = (item) => {
    const id = item?.id;
    if (id == null) return;
    this.setState((prev) => ({
      notifications: (prev.notifications || []).map((n) =>
        String(n?.id) === String(id)
          ? { ...n, isRead: true, read: true, is_read: true, status: 'read' }
          : n,
      ),
    }));
  };

  markAllRead = () => {
    const unread = this.unreadCount();
    if (!unread) return;
    this.setState((prev) => ({
      notifications: (prev.notifications || []).map((n) => ({
        ...n,
        isRead: true,
        read: true,
        is_read: true,
        status: 'read',
      })),
    }));
  };

  filteredList = () => {
    const { notifications, filterTab } = this.state;
    if (filterTab === 'unread') return (notifications || []).filter((n) => !this.isRead(n));
    return notifications || [];
  };

  renderNotifIcon = (evt) => {
    const src = evt?.icon || evt?.typeMeta?.icon || I.bell;
    const tint = evt?.tint !== false;
    return (
      <Image
        source={src}
        style={[styles.iconImg, tint && { tintColor: evt?.color || P }]}
        resizeMode="contain"
      />
    );
  };

  onNotificationPress = (item) => {
    this.markItemRead(item);
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
    // Status chip: Cancelled / Order Placed — not always "Delivery" from type
    const statusText = evt?.label || this.typeLabel(item?.type);

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => this.onNotificationPress(item)}
        style={styles.cardWrap}
      >
        <View style={[styles.card, !read && styles.cardUnread]}>
          <View style={[styles.iconRing, { backgroundColor: evt.bg || '#EDE9FE' }]}>
            {this.renderNotifIcon(evt)}
            {!read ? <View style={[styles.iconBadge, { backgroundColor: evt.color || P }]} /> : null}
          </View>

          <View style={styles.inner}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, !read && styles.titleUnread]} numberOfLines={1}>
                {title}
              </Text>
              {!!time ? <Text style={styles.time}>{this.timeAgo(time)}</Text> : null}
            </View>

            {!!body ? (
              <Text style={[styles.body, read && styles.bodyRead]} numberOfLines={2}>
                {body}
              </Text>
            ) : null}

            <View style={styles.footerRow}>
              {!!statusText ? (
                <View style={[styles.typeChip, { backgroundColor: evt.bg || '#F1F5F9' }]}>
                  <View style={[styles.typeDot, { backgroundColor: evt.color || P }]} />
                  <Text style={[styles.typeText, { color: evt.color || P }]}>{statusText}</Text>
                </View>
              ) : <View />}
              {!read ? (
                <Text style={styles.unreadLbl}>Unread</Text>
              ) : (
                <MaterialCommunityIcons name="check" size={14} color="#CBD5E1" />
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  renderEmpty = () => {
    if (this.state.isLoading) return null;
    const unreadOnly = this.state.filterTab === 'unread';
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyIconWrap}>
          <Image source={I.bell} style={[styles.emptyIcon, { tintColor: P }]} />
        </View>
        <Text style={styles.emptyTitle}>
          {unreadOnly ? 'Sab padh liya' : 'Abhi koi notification nahi'}
        </Text>
        <Text style={styles.emptySub}>
          {unreadOnly
            ? 'Naye alerts aate hi Unread me dikhenge'
            : 'Naya update aate hi yahan dikhega'}
        </Text>
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
    if (hasMore && this.state.filterTab === 'all') return <View style={styles.footerSpacer} />;
    return null;
  };

  renderListHeader = () => {
    const unread = this.unreadCount();
    const { filterTab } = this.state;
    return (
      <View style={styles.toolbar}>
        <View style={styles.tabRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => this.setState({ filterTab: 'all' })}
            style={[styles.tabChip, filterTab === 'all' && styles.tabChipOn]}
          >
            <Text style={[styles.tabChipT, filterTab === 'all' && styles.tabChipTOn]}>Sabhi</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => this.setState({ filterTab: 'unread' })}
            style={[styles.tabChip, filterTab === 'unread' && styles.tabChipOn]}
          >
            <Text style={[styles.tabChipT, filterTab === 'unread' && styles.tabChipTOn]}>
              Unread{unread > 0 ? ` (${unread})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {unread > 0 ? (
          <TouchableOpacity style={styles.markAllBtn} activeOpacity={0.85} onPress={this.markAllRead}>
            <MaterialCommunityIcons name="check-all" size={16} color={P} />
            <Text style={styles.markAllT}>Sabhi padhein</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.markAllBtnGhost}>
            <MaterialCommunityIcons name="check-all" size={16} color="#94A3B8" />
            <Text style={styles.markAllGhostT}>Sab clear</Text>
          </View>
        )}
      </View>
    );
  };

  render() {
    const { isLoading, refreshing } = this.state;
    const unread = this.unreadCount();
    const list = this.filteredList();

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor={HEADER.brand} />

        <ScreenHeader
          bg={HEADER.brand}
          title="Notifications"
          onBack={() => this.props.navigation?.goBack?.()}
          showNotification={false}
          below={(
            <View style={styles.hdrBelow}>
              <View>
                <Text style={styles.hdrBelowLbl}>UNREAD</Text>
                <Text style={styles.hdrBelowAmt}>{unread}</Text>
              </View>
              {unread > 0 ? (
                <TouchableOpacity style={styles.hdrMarkBtn} activeOpacity={0.85} onPress={this.markAllRead}>
                  <MaterialCommunityIcons name="check-all" size={16} color={HEADER.brand} />
                  <Text style={styles.hdrMarkT}>Mark all read</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.hdrClearPill}>
                  <Text style={styles.hdrClearT}>All caught up</Text>
                </View>
              )}
            </View>
          )}
        />

        <SafeAreaView edges={Platform.OS === 'ios' ? [] : safeBottomEdges()} style={styles.body}>
          {isLoading && !refreshing ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="small" color={P} />
            </View>
          ) : (
            <FlatList
              data={list}
              keyExtractor={(item, i) => String(item?.id || i)}
              renderItem={this.renderItem}
              ListHeaderComponent={this.renderListHeader}
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
  root: { flex: 1, backgroundColor: '#EBE7F5' },
  body: { flex: 1 },

  hdrBelow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 2,
  },
  hdrBelowLbl: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  hdrBelowAmt: { color: '#FFF', fontSize: 28, fontWeight: '800', marginTop: 2, letterSpacing: -0.5 },
  hdrMarkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  hdrMarkT: { color: HEADER.brand, fontSize: 12, fontWeight: '800' },
  hdrClearPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  hdrClearT: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  tabRow: { flexDirection: 'row', gap: 8, flex: 1 },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabChipOn: { backgroundColor: '#EDE9FE', borderColor: P },
  tabChipT: { fontSize: 12.5, fontWeight: '700', color: '#64748B' },
  tabChipTOn: { color: P },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EDE9FE',
  },
  markAllT: { fontSize: 11.5, fontWeight: '800', color: P },
  markAllBtnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  markAllGhostT: { fontSize: 11.5, fontWeight: '700', color: '#94A3B8' },

  listContent: { flexGrow: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 28 },

  cardWrap: { marginBottom: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(93,63,211,0.08)',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  cardUnread: {
    backgroundColor: '#FBF9FF',
    borderColor: 'rgba(93,63,211,0.22)',
  },

  iconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconImg: { width: 22, height: 22 },
  iconBadge: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FFF',
  },

  inner: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 14.5, fontWeight: '700', color: '#1E293B', lineHeight: 20 },
  titleUnread: { color: '#0F172A', fontWeight: '800' },
  time: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  body: { fontSize: 13, fontWeight: '500', color: '#64748B', lineHeight: 18, marginTop: 4 },
  bodyRead: { color: '#94A3B8' },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typeDot: { width: 6, height: 6, borderRadius: 3 },
  typeText: { fontSize: 11, fontWeight: '700' },
  unreadLbl: { fontSize: 11, fontWeight: '800', color: P },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 48 },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyIcon: { width: 28, height: 28, resizeMode: 'contain' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footerLoader: { paddingVertical: 14, alignItems: 'center' },
  footerSpacer: { height: 8 },
});

export default withV4Navigation(Notifications);
