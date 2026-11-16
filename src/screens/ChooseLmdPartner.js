import React, { Component } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, TextInput, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Toast from 'react-native-simple-toast';
import constants from '../utils/constants';
import { StackActions, NavigationActions, withV4Navigation } from '../utils/v4Compat';
import { setViewPartner, clearViewPartner, getViewPartnerId, VIEW_PARTNER_STORAGE_KEYS } from '../utils/lmdViewMode';
import { stopBackgroundLocationTracker } from '../utils/locationTracker';

const P = '#5D3FD3';
const LIMIT = 20;

const resetTo = (routeName) => StackActions.reset({
  index: 0,
  actions: [NavigationActions.navigate({ routeName })],
});

class ChooseLmdPartner extends Component {
  state = {
    rows: [],
    page: 1,
    total: 0,
    totalPages: 0,
    search: '',
    loading: true,
    loadingMore: false,
    error: '',
  };

  componentDidMount() {
    this.fetchPage(1);
  }

  componentWillUnmount() {
    if (this._searchTimer) clearTimeout(this._searchTimer);
  }

  fetchPage = (page) => {
    const { search } = this.state;
    const reqId = (this._reqId = (this._reqId || 0) + 1);
    this.setState(page === 1 ? { loading: true, error: '' } : { loadingMore: true });
    const qs = `page=${page}&limit=${LIMIT}` + (search.trim() ? `&search=${encodeURIComponent(search.trim())}` : '');
    fetch(`${constants.lmdViewPartners}?${qs}`, {
      method: 'GET',
      headers: { Authorization: 'Bearer ' + global.token, Accept: 'application/json', 'X-localization': 'en' },
    })
      .then((r) => r.json())
      .then((json) => {
        if (reqId !== this._reqId) return;
        if (!json?.status) {
          this.setState({ loading: false, loadingMore: false, error: json?.message || 'LMD list load nahi hui' });
          return;
        }
        const rows = Array.isArray(json?.data?.rows) ? json.data.rows : [];
        const meta = json?.data?.meta || {};
        this.setState((s) => ({
          rows: page === 1 ? rows : [...s.rows, ...rows],
          page,
          total: Number(meta.total) || 0,
          totalPages: Number(meta.totalPages) || 0,
          loading: false,
          loadingMore: false,
        }));
      })
      .catch(() => {
        if (reqId !== this._reqId) return;
        this.setState({ loading: false, loadingMore: false, error: 'Network error — dobara try karein' });
      });
  };

  onSearch = (text) => {
    this.setState({ search: text });
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.fetchPage(1), 350);
  };

  onEndReached = () => {
    const { loading, loadingMore, page, totalPages } = this.state;
    if (loading || loadingMore || page >= totalPages) return;
    this.fetchPage(page + 1);
  };

  onSelect = async (item) => {
    await setViewPartner(item.id, item.name || item.mobile || `LMD #${item.id}`);
    Toast.show(`${item.name || 'LMD'} ka data dikh raha hai`, Toast.SHORT);
    this.props.navigation.dispatch(resetTo('MainTabs'));
  };

  onLogout = async () => {
    try {
      stopBackgroundLocationTracker();
      global.token = '';
      global.userType = '';
      await clearViewPartner();
      await AsyncStorage.multiRemove(['accessToken', 'userType', 'language', 'referral_code', ...VIEW_PARTNER_STORAGE_KEYS]);
    } catch (e) {}
    this.props.navigation.dispatch(resetTo('Login'));
  };

  renderItem = ({ item }) => {
    const selected = String(item.id) === String(getViewPartnerId());
    return (
      <TouchableOpacity style={[s.card, selected && s.cardSelected]} activeOpacity={0.8} onPress={() => this.onSelect(item)}>
        <View style={s.avatar}>
          <MaterialCommunityIcons name="truck-delivery" size={22} color={P} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name} numberOfLines={1}>{item.name || '-'}</Text>
          <Text style={s.sub}>{item.mobile ? `+91 ${item.mobile}` : `ID ${item.id}`}</Text>
        </View>
        <MaterialCommunityIcons name={selected ? 'check-circle' : 'chevron-right'} size={22} color={selected ? '#10B981' : '#9CA3AF'} />
      </TouchableOpacity>
    );
  };

  render() {
    const { rows, total, search, loading, loadingMore, error } = this.state;
    const canGoBack = !!getViewPartnerId() && this.props.navigation.canGoBack?.();
    return (
      <View style={s.root}>
        <StatusBar backgroundColor={P} barStyle="light-content" />
        <View style={s.hdr}>
          <SafeAreaView edges={['top']}>
            <View style={s.hdrRow}>
              {canGoBack ? (
                <TouchableOpacity onPress={() => this.props.navigation.goBack()} style={s.hdrBtn} hitSlop={8}>
                  <MaterialCommunityIcons name="arrow-left" size={22} color="#FFF" />
                </TouchableOpacity>
              ) : <View style={s.hdrBtn} />}
              <View style={{ flex: 1 }}>
                <Text style={s.hdrTitle}>LMD Chunein</Text>
                <Text style={s.hdrSub}>Super Admin · View only</Text>
              </View>
              <TouchableOpacity onPress={this.onLogout} style={s.logoutBtn} hitSlop={8}>
                <MaterialCommunityIcons name="logout" size={18} color="#FFF" />
                <Text style={s.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
            <View style={s.searchBox}>
              <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" />
              <TextInput
                value={search}
                onChangeText={this.onSearch}
                placeholder="Naam ya mobile se search karein"
                placeholderTextColor="#9CA3AF"
                style={s.searchInput}
                autoCorrect={false}
              />
            </View>
          </SafeAreaView>
        </View>

        {loading ? (
          <View style={s.center}><ActivityIndicator color={P} size="large" /></View>
        ) : error ? (
          <View style={s.center}>
            <Text style={s.empty}>{error}</Text>
            <TouchableOpacity onPress={() => this.fetchPage(1)} style={s.retry}><Text style={s.retryText}>Retry</Text></TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(it) => String(it.id)}
            renderItem={this.renderItem}
            contentContainerStyle={s.list}
            onEndReached={this.onEndReached}
            onEndReachedThreshold={0.4}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={total ? <Text style={s.count}>Showing {rows.length} of {total} LMD</Text> : null}
            ListEmptyComponent={<Text style={s.empty}>Koi LMD nahi mila</Text>}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={P} style={{ marginVertical: 16 }} /> : null}
          />
        )}
      </View>
    );
  }
}

export default withV4Navigation(ChooseLmdPartner);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E8ECF4' },
  hdr: { backgroundColor: P, paddingBottom: 14, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  hdrRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 8 },
  hdrBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  hdrTitle: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  hdrSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  logoutText: { color: '#FFF', fontSize: 12, fontWeight: '700', marginLeft: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, marginHorizontal: 14, marginTop: 14, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: '#111827', paddingVertical: 0 },
  list: { padding: 14, paddingBottom: 40 },
  count: { color: '#6B7280', fontSize: 12, fontWeight: '600', marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1.5, borderColor: 'transparent' },
  cardSelected: { borderColor: '#10B981' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EEE9FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  name: { fontSize: 15, fontWeight: '800', color: '#111827' },
  sub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  empty: { textAlign: 'center', color: '#6B7280', fontSize: 14, marginTop: 30 },
  retry: { marginTop: 14, backgroundColor: P, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 12 },
  retryText: { color: '#FFF', fontWeight: '800' },
});
