import React, { Component } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, Image,
  TouchableOpacity, ActivityIndicator, StatusBar, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Animatable from 'react-native-animatable';
import Toast from 'react-native-simple-toast';
import constants from '../utils/constants';
import { withV4Navigation } from '../utils/v4Compat';
import { S, soilIcons as I } from '../utils/soilTheme';

const PER_PAGE = 20;
const SCREEN_BG = '#edf1f7';
const CARD_BORDER = '#E8ECF1';

const parseFarmers = (json) => {
  const d = json?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.farmers)) return d.farmers;
  if (Array.isArray(d?.list)) return d.list;
  if (Array.isArray(json?.farmers)) return json.farmers;
  return [];
};

const parsePagination = (json, page, listLen) => {
  const pg = json?.pagination || json?.meta || json?.data?.pagination || {};
  const currentPage = Math.max(1, Number(pg?.currentPage || pg?.current_page || pg?.page || page) || page);
  const totalPages = Math.max(1, Number(pg?.totalPages || pg?.total_pages || pg?.last_page || 1) || 1);
  const hasMore = typeof pg?.hasNextPage === 'boolean'
    ? pg.hasNextPage
    : typeof pg?.has_next_page === 'boolean'
      ? pg.has_next_page
      : currentPage < totalPages || listLen >= PER_PAGE;
  return { currentPage, totalPages, hasMore };
};

const farmerName = (f) => f?.name || f?.farmer_name || f?.fullName || f?.full_name || 'Farmer';
const farmerPhone = (f) => f?.mobile || f?.phone || f?.farmer_mobile || f?.contact || '';
const farmerVillage = (f) => f?.village || f?.city || f?.district || f?.address || '';
const farmerId = (f) => f?.id || f?.farmer_id || f?.user_id;

class SelectFarmer extends Component {
  constructor(props) {
    super(props);
    this.state = {
      search: '',
      loading: true,
      loadingMore: false,
      farmers: [],
      page: 1,
      hasMore: false,
    };
    this._timer = null;
    this._seq = 0;
    this._query = '';
  }

  componentDidMount() {
    this.fetchFarmers('', { page: 1, append: false });
  }

  componentWillUnmount() {
    if (this._timer) clearTimeout(this._timer);
  }

  goBack = () => this.props?.navigation?.goBack?.();

  buildUrl = (query, page) => {
    const q = String(query || '').trim();
    return `${constants.allFarmers}?page=${page}&per_page=${PER_PAGE}&search=${encodeURIComponent(q)}`;
  };

  fetchFarmers = (query, { page = 1, append = false } = {}) => {
    const q = String(query ?? this._query).trim();
    this._query = q;
    const seq = ++this._seq;
    this.setState({ loading: !append, loadingMore: append });

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
        this.setState({
          loading: false,
          loadingMore: false,
          farmers: append ? [...this.state.farmers, ...list] : list,
          page: currentPage,
          hasMore,
        });
        if (!json?.success && json?.message && !append) Toast.show(json.message, Toast.SHORT);
      })
      .catch(() => {
        if (seq !== this._seq) return;
        this.setState({ loading: false, loadingMore: false, farmers: append ? this.state.farmers : [], hasMore: false });
        if (!append) Toast.show('Farmers load nahi ho paye', Toast.SHORT);
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
    this.props.navigation.navigate('CreateSoilOrder', { selectedFarmer: farmer });
  };

  renderItem = ({ item, index }) => {
    const name = farmerName(item);
    const phone = farmerPhone(item);
    const village = farmerVillage(item);
    return (
      <Animatable.View animation="fadeInUp" duration={260} delay={Math.min(index * 35, 180)} useNativeDriver>
        <Pressable onPress={() => this.selectFarmer(item)} style={({ pressed }) => [st.card, pressed && { opacity: 0.9 }]}>
          <View style={st.icoWrap}>
            <Image source={I.farmerNew} style={st.ico} />
          </View>
          <View style={st.info}>
            <Text style={st.name} numberOfLines={1}>{name}</Text>
            {!!phone && (
              <View style={st.metaRow}>
                <Image source={I.call} style={st.metaIco} />
                <Text style={st.meta} numberOfLines={1}>{phone}</Text>
              </View>
            )}
            {!!village && <Text style={st.addr} numberOfLines={2}>{village}</Text>}
          </View>
          <View style={st.arrowWrap}>
            <Image source={I.arrow} style={st.arrowIco} />
          </View>
        </Pressable>
      </Animatable.View>
    );
  };

  renderEmpty = () => {
    if (this.state.loading) return null;
    return (
      <View style={st.empty}>
        <Image source={I.farmerNew} style={st.emptyImg} />
        <Text style={st.emptyT}>Koi farmer nahi mila</Text>
        <Text style={st.emptyS}>Naam ya mobile se search karein</Text>
      </View>
    );
  };

  renderFooter = () => {
    if (!this.state.loadingMore) return <View style={{ height: 12 }} />;
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
        <SafeAreaView edges={['top']} style={st.hdr}>
          <TouchableOpacity onPress={this.goBack} style={st.backBtn} activeOpacity={0.85}>
            <Image source={I.back} style={st.backIco} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={st.hdrTitle}>Farmer chunein</Text>
            <Text style={st.hdrSub}>Soil test kis kisan ke liye?</Text>
          </View>
        </SafeAreaView>

        <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
          <View style={st.searchWrap}>
            <Image source={require('./assets/search.png')} style={st.searchIco} />
            <TextInput
              style={st.searchIn}
              value={search}
              onChangeText={this.onSearchChange}
              placeholder="Naam ya mobile search karein..."
              placeholderTextColor={S.MUTED}
              returnKeyType="search"
              autoCorrect={false}
            />
            {!!search && (
              <TouchableOpacity onPress={this.clearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Image source={I.close} style={st.clearIco} />
              </TouchableOpacity>
            )}
          </View>

          {!loading && farmers.length > 0 && (
            <Text style={st.countLbl}>{farmers.length} farmers mile</Text>
          )}

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
        </SafeAreaView>
      </View>
    );
  }
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: SCREEN_BG },
  hdr: {
    backgroundColor: S.P, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  backIco: { width: 14, height: 14, resizeMode: 'contain', tintColor: '#FFF' },
  hdrTitle: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  hdrSub: { fontSize: 11.5, color: 'rgba(255,255,255,0.85)', marginTop: 1 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    marginHorizontal: 12, marginTop: 10, marginBottom: 4, borderRadius: 11,
    borderWidth: 1, borderColor: CARD_BORDER, paddingHorizontal: 11,
  },
  searchIco: { width: 15, height: 15, tintColor: S.MUTED, marginRight: 8, resizeMode: 'contain' },
  searchIn: { flex: 1, fontSize: 14, color: S.TXT, paddingVertical: 11 },
  clearIco: { width: 14, height: 14, tintColor: S.MUTED, resizeMode: 'contain' },

  countLbl: { fontSize: 11, color: S.SUB, marginHorizontal: 14, marginTop: 10, marginBottom: 8 },

  list: { paddingHorizontal: 12, paddingBottom: 16, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadTxt: { marginTop: 10, fontSize: 13, color: S.SUB },

  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    borderRadius: 14, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: CARD_BORDER,
  },
  icoWrap: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: S.P_TINT,
    alignItems: 'center', justifyContent: 'center', marginRight: 11,
    borderWidth: 1, borderColor: '#E9E4FC',
  },
  ico: { width: 40, height: 40, resizeMode: 'contain' },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '600', color: S.TXT },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  metaIco: { width: 11, height: 11, tintColor: S.SUB, marginRight: 5, resizeMode: 'contain' },
  meta: { fontSize: 12, color: S.SUB, flex: 1 },
  addr: { fontSize: 11.5, color: S.MUTED, marginTop: 3, lineHeight: 15 },
  arrowWrap: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: S.P_TINT,
    alignItems: 'center', justifyContent: 'center', marginLeft: 6,
  },
  arrowIco: { width: 10, height: 10, tintColor: S.P, resizeMode: 'contain' },

  listFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  listFooterT: { marginLeft: 8, fontSize: 12, color: S.SUB },

  empty: { alignItems: 'center', paddingTop: 50 },
  emptyImg: { width: 72, height: 72, resizeMode: 'contain', opacity: 0.45, marginBottom: 12 },
  emptyT: { fontSize: 14, fontWeight: '600', color: S.TXT },
  emptyS: { fontSize: 12, color: S.SUB, marginTop: 4 },
});

export default withV4Navigation(SelectFarmer);
