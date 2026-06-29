import React, { Component } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Image,
  TouchableOpacity, ActivityIndicator, StatusBar, Pressable, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Animatable from 'react-native-animatable';
import Toast from 'react-native-simple-toast';
import constants from '../utils/constants';
import { withV4Navigation } from '../utils/v4Compat';
import { S, soilIcons as I } from '../utils/soilTheme';
import { prefetchSoilOrderPincode } from '../utils/locationHelper';
import { setPendingSelectedFarmer } from '../utils/pendingFarmer';
import {
  getCachedFarmers, parseFarmers, parseFarmerPagination, setCachedFarmers,
} from '../utils/farmerCache';

const PER_PAGE = 20;
const parsePagination = parseFarmerPagination;

const farmerName = (f) => f?.name || f?.farmer_name || f?.fullName || f?.full_name || 'Farmer';
const farmerPhone = (f) => f?.mobile || f?.phone || f?.farmer_mobile || f?.contact || '';
const farmerAddress = (f) => String(
  f?.address || f?.full_address || f?.fullAddress || f?.address_line
  || f?.village || f?.city || f?.district || '',
).trim();
const farmerId = (f) => f?.id || f?.farmer_id || f?.user_id;

class SelectFarmer extends Component {
  constructor(props) {
    super(props);
    const cached = getCachedFarmers();
    this.state = {
      search: '',
      loading: !(cached?.farmers?.length),
      loadingMore: false,
      farmers: cached?.farmers || [],
      page: cached?.page || 1,
      hasMore: cached?.hasMore ?? false,
    };
    this._timer = null;
    this._seq = 0;
    this._query = '';
  }

  componentDidMount() {
    prefetchSoilOrderPincode();
    const cached = getCachedFarmers();
    if (cached?.farmers?.length) {
      this.fetchFarmers('', { page: 1, append: false, background: true });
    } else {
      this.fetchFarmers('', { page: 1, append: false });
    }
  }

  componentWillUnmount() {
    if (this._timer) clearTimeout(this._timer);
  }

  goBack = () => this.props?.navigation?.goBack?.();

  buildUrl = (query, page) => {
    const q = String(query || '').trim();
    return `${constants.allFarmers}?page=${page}&per_page=${PER_PAGE}&search=${encodeURIComponent(q)}`;
  };

  fetchFarmers = (query, { page = 1, append = false, background = false } = {}) => {
    const q = String(query ?? this._query).trim();
    this._query = q;
    const seq = ++this._seq;
    if (!background) {
      this.setState({ loading: !append, loadingMore: append });
    }

    fetch(this.buildUrl(q, page), {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + global.token,
        Accept: 'application/json',
        'X-localization': 'en',
      },
    })
      .then((r) => r.json())
      .then((json) => {
        if (seq !== this._seq) return;
        const list = parseFarmers(json);
        const { currentPage, hasMore } = parsePagination(json, page, list.length);
        if (!q && page === 1 && !append) {
          setCachedFarmers({ farmers: list, page: currentPage, hasMore, query: q });
        }
        this.setState({
          loading: false,
          loadingMore: false,
          farmers: append ? [...this.state.farmers, ...list] : list,
          page: currentPage,
          hasMore,
        });
        if (!json?.success && json?.message && !append && !background) Toast.show(json.message, Toast.SHORT);
      })
      .catch(() => {
        if (seq !== this._seq) return;
        if (!background || !this.state.farmers.length) {
          this.setState({ loading: false, loadingMore: false, farmers: append ? this.state.farmers : [], hasMore: false });
          if (!append) Toast.show('Farmers load nahi ho paye', Toast.SHORT);
        } else {
          this.setState({ loading: false, loadingMore: false });
        }
      });
  };

  onSearchChange = (text) => {
    this.setState({ search: text });
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this.setState({ page: 1, hasMore: false }, () => this.fetchFarmers(text, { page: 1, append: false }));
    }, 400);
  };

  clearSearch = () => {
    if (this._timer) clearTimeout(this._timer);
    this.setState({ search: '', page: 1, hasMore: false }, () => this.fetchFarmers('', { page: 1, append: false }));
  };

  handleEndReached = () => {
    const { loadingMore, hasMore, loading, page } = this.state;
    if (loadingMore || !hasMore || loading) return;
    this.fetchFarmers(this._query, { page: page + 1, append: true });
  };

  selectFarmer = (farmer) => {
    prefetchSoilOrderPincode();
    setPendingSelectedFarmer(farmer);
    this.props.navigation.goBack();
  };

  renderItem = ({ item, index }) => {
    const name = farmerName(item);
    const phone = farmerPhone(item);
    const addr = farmerAddress(item);

    return (
      <Animatable.View
        animation="fadeInUp"
        duration={280}
        delay={Math.min(index * 35, 160)}
        useNativeDriver
      >
        <Pressable
          onPress={() => this.selectFarmer(item)}
          style={({ pressed }) => [st.card, pressed && st.cardPressed]}
        >
          <View style={st.cardTop}>
            <View style={st.avatar}>
              <Image source={I.farmerNew} style={st.avatarImg} />
            </View>

            <View style={st.cardContent}>
              <View style={st.topRow}>
                <Text style={st.name} numberOfLines={1}>{name}</Text>
                <View style={st.selectPill}>
                  <Text style={st.selectTxt}>Chunein</Text>
                </View>
              </View>

              {!!phone && (
                <View style={st.phoneRow}>
                  <MaterialCommunityIcons name="phone" size={11} color={S.P} />
                  <Text style={st.phoneTxt}>{phone}</Text>
                </View>
              )}
            </View>
          </View>

          {!!addr && (
            <View style={st.addrRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={11} color="#94A3B8" />
              <Text style={st.addr} numberOfLines={2}>{addr}</Text>
            </View>
          )}
        </Pressable>
      </Animatable.View>
    );
  };

  renderEmpty = () => {
    if (this.state.loading) return null;
    return (
      <Animatable.View animation="fadeIn" duration={400} style={st.empty}>
        <View style={st.emptyIco}>
          <MaterialCommunityIcons name="account-search-outline" size={36} color={S.P} />
        </View>
        <Text style={st.emptyT}>Koi farmer nahi mila</Text>
        <Text style={st.emptyS}>Naam ya mobile se search karein</Text>
      </Animatable.View>
    );
  };

  renderFooter = () => {
    if (!this.state.loadingMore) return <View style={{ height: 20 }} />;
    return (
      <View style={st.listFooter}>
        <ActivityIndicator color={S.P} size="small" />
        <Text style={st.listFooterT}>Aur load ho rahe hain...</Text>
      </View>
    );
  };

  render() {
    const { search, loading, farmers } = this.state;
    return (
      <View style={st.root}>
        <StatusBar barStyle="light-content" backgroundColor={S.P} />

        <View style={st.hdr}>
          <View style={st.hdrDecor} />
          <SafeAreaView edges={['top']} style={st.hdrInner}>
            <TouchableOpacity onPress={this.goBack} style={st.backBtn} activeOpacity={0.85}>
              <Image source={I.back} style={st.backIco} />
            </TouchableOpacity>
            <View style={st.hdrText}>
              <Text style={st.hdrTitle}>Farmer chunein</Text>
              <Text style={st.hdrSub}>Soil test kis kisan ke liye?</Text>
            </View>
          </SafeAreaView>
        </View>

        <View style={st.sheet}>
          <View style={st.searchWrap}>
            <View style={st.searchBox}>
              <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
              <TextInput
                style={st.searchIn}
                value={search}
                onChangeText={this.onSearchChange}
                placeholder="Naam ya mobile search karein..."
                placeholderTextColor="#94A3B8"
                returnKeyType="search"
                autoCorrect={false}
              />
              {!!search && (
                <TouchableOpacity onPress={this.clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialCommunityIcons name="close-circle" size={18} color="#CBD5E1" />
                </TouchableOpacity>
              )}
            </View>

            {!loading && farmers.length > 0 && (
              <View style={st.countPill}>
                <Text style={st.countTxt}>{farmers.length} farmers</Text>
              </View>
            )}
          </View>

          {loading ? (
            <View style={st.center}>
              <ActivityIndicator color={S.P} size="large" />
              <Text style={st.loadTxt}>Farmers dhoondh rahe hain...</Text>
            </View>
          ) : (
            <FlatList
              data={farmers}
              keyExtractor={(item, i) => `farmer-${farmerId(item) || i}`}
              renderItem={this.renderItem}
              ListEmptyComponent={this.renderEmpty}
              ListFooterComponent={this.renderFooter}
              contentContainerStyle={st.list}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onEndReached={this.handleEndReached}
              onEndReachedThreshold={0.35}
            />
          )}
        </View>
      </View>
    );
  }
}

const softShadow = Platform.select({
  ios: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: S.P },
  flex: { flex: 1 },

  hdr: {
    backgroundColor: S.P,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  hdrDecor: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -60,
    right: -40,
  },
  hdrInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backIco: { width: 13, height: 13, resizeMode: 'contain', tintColor: '#FFF' },
  hdrText: { flex: 1 },
  hdrTitle: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  hdrSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  sheet: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -4,
    overflow: 'hidden',
  },

  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 46,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...softShadow,
  },
  searchIn: { flex: 1, fontSize: 14, color: S.TXT, paddingVertical: 10 },
  countPill: {
    backgroundColor: S.P_TINT,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: S.P_GLOW,
  },
  countTxt: { fontSize: 11, fontWeight: '700', color: S.P_DARK },

  list: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 28, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  loadTxt: { marginTop: 12, fontSize: 13, color: S.SUB },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    ...softShadow,
  },
  cardPressed: {
    backgroundColor: '#FAFBFF',
    borderColor: S.P_GLOW,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#EDE9FE',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: { width: 34, height: 34, resizeMode: 'contain' },
  cardContent: { flex: 1, minWidth: 0, marginLeft: 10 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  name: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1E293B' },
  selectPill: {
    backgroundColor: S.P,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectTxt: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  phoneTxt: { fontSize: 11, fontWeight: '600', color: S.P_DARK },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F1F5F9',
  },
  addr: { flex: 1, fontSize: 10.5, fontWeight: '500', color: '#94A3B8', lineHeight: 14 },

  listFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  listFooterT: { marginLeft: 8, fontSize: 12, color: S.SUB },

  empty: { alignItems: 'center', paddingTop: 56, paddingHorizontal: 32 },
  emptyIco: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: S.P_TINT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyT: { fontSize: 16, fontWeight: '700', color: S.TXT },
  emptyS: { fontSize: 13, color: S.SUB, marginTop: 6, textAlign: 'center' },
});

export default withV4Navigation(SelectFarmer);
