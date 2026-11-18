import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Image,
  TouchableOpacity,
  Pressable,
  Platform,
  StatusBar,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Animatable from 'react-native-animatable';
import { HEADER } from '../theme/headerColors';
import ScreenHeader from '../components/ScreenHeader';
import { NavigationEvents, withV4Navigation } from '../utils/v4Compat';
import { isReadOnly } from '../utils/lmdViewMode';
import { S, soilIcons as I } from '../utils/soilTheme';
import {
  farmerDisplayAddress,
  farmerDisplayName,
  farmerDisplayPhone,
  farmerId,
  getAddedFarmers,
  subscribeAddedFarmers,
} from '../utils/addedFarmers';
import { fetchFreshSoilOrderPincode, getCachedCoordsForApi, lookupPincodeFromCoords, prefetchSoilOrderPincode } from '../utils/locationHelper';

const maskPhone = (p) => {
  if (!p) return '';
  const s = String(p).replace(/\D/g, '');
  if (s.length < 6) return String(p);
  return `${s.slice(0, 2)}****${s.slice(-2)}`;
};

const formatCropChip = (c) => {
  if (!c || typeof c !== 'object') return String(c || '').trim();
  const name = c?.cropName || c?.name || c?.crop || '';
  const variety = c?.variety || '';
  const area = c?.sowingArea != null && c.sowingArea !== '' ? `${c.sowingArea} ac` : '';
  return [name, variety, area].filter(Boolean).join(' · ');
};

const cropChips = (f) => {
  const fromCrops = (f?.crops || [])
    .filter((c) => c?.isCurrent !== false)
    .map(formatCropChip)
    .filter(Boolean);
  if (fromCrops.length) return fromCrops.slice(0, 3);
  const list = [...(f?.annualCrops || []), ...(f?.farmer_lands || f?.lands || [])];
  const fallback = list
    .map((c) => c?.name || c?.cropName || c?.crop || formatCropChip(c))
    .filter(Boolean);
  return fallback.slice(0, 3);
};

const isFarmerVerified = (f) =>
  f?.profileCompleted === true || f?.verified === true;

class FarmerList extends Component {
  constructor(props) {
    super(props);
    this.state = {
      search: '',
      farmers: [],
      tab: 'all',
      allFarmerCount: 0,
      verifiedFarmerCount: 0,
      loading: false,
    };
    this._unsub = null;
    this._searchTimer = null;
  }

  componentDidMount() {
    this.loadFarmers();
    this._unsub = subscribeAddedFarmers((farmers) => this.setState({ farmers }));
    prefetchSoilOrderPincode();
    const cached = getCachedCoordsForApi(900000);
    if (cached?.lat && cached?.lng) {
      lookupPincodeFromCoords(cached.lat, cached.lng).catch(() => {});
    }
    fetchFreshSoilOrderPincode({ maxWaitMs: 12000 }).catch(() => {});
  }

  componentWillUnmount() {
    this._unsub?.();
    if (this._searchTimer) clearTimeout(this._searchTimer);
  }

  loadFarmers = async () => {
    const { tab, search } = this.state;
    this.setState({ loading: true });
    try {
      const result = await getAddedFarmers({ tab, search, page: 1, limit: 100 });
      const farmers = Array.isArray(result) ? result : (result?.farmers || []);
      this.setState({
        farmers,
        allFarmerCount: result?.allFarmerCount ?? farmers.length,
        verifiedFarmerCount: result?.verifiedFarmerCount ?? farmers.filter(isFarmerVerified).length,
        loading: false,
      });
    } catch (e) {
      this.setState({ loading: false });
    }
  };

  setTab = (tab) => {
    if (tab === this.state.tab) return;
    this.setState({ tab }, () => this.loadFarmers());
  };

  onSearchChange = (text) => {
    this.setState({ search: text });
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => this.loadFarmers(), 320);
  };

  isTabRoot = () => {
    const state = this.props?.navigation?.getState?.();
    return state?.type === 'tab' || !!state?.routeNames?.includes?.('Home');
  };

  goBack = () => {
    const nav = this.props?.navigation;
    const state = nav?.getState?.();
    const isTabRoot = state?.type === 'tab' || state?.routeNames?.includes?.('Home');
    if (isTabRoot) nav?.navigate?.('Home');
    else if (nav?.canGoBack?.()) nav.goBack();
    else nav?.navigate?.('Home');
  };

  // AddFarmer lives on the root stack; from a tab we must climb to that parent.
  goStack = (name, params) => {
    const nav = this.props?.navigation;
    if (!nav?.navigate) return;
    if (nav.getState?.()?.routeNames?.includes(name)) {
      nav.navigate(name, params);
      return;
    }
    let parent = nav.getParent?.();
    while (parent) {
      if (parent.getState?.()?.routeNames?.includes(name)) {
        parent.navigate(name, params);
        return;
      }
      parent = parent.getParent?.();
    }
    nav.navigate(name, params);
  };

  goAdd = () => this.goStack('AddFarmer');

  goEdit = (farmer) => {
    this.goStack('AddFarmer', { farmer, mode: 'edit' });
  };

  goSales = (farmer) => {
    this.goStack('FarmerSales', { farmer });
  };

  renderItem = ({ item, index }) => {
    const name = farmerDisplayName(item);
    const phone = farmerDisplayPhone(item);
    const addr = farmerDisplayAddress(item);
    const crops = cropChips(item);
    const verified = isFarmerVerified(item);
    const locked = verified || isReadOnly();
    const totalArea =
      item?.totalArea ?? item?.land?.area ?? item?.land?.sowingArea ?? '';
    const cattle = item?.cattleCount || {};
    const cattleTotal = ['cow', 'buffalo', 'goat', 'other'].reduce(
      (sum, key) => sum + Math.max(0, Number(cattle[key]) || 0),
      0,
    );
    const hasMeta = crops.length > 0 || cattleTotal > 0 || !!totalArea;

    return (
      <Animatable.View
        animation="fadeInUp"
        duration={280}
        delay={Math.min(index * 35, 160)}
        useNativeDriver
      >
        <Pressable
          onPress={() => this.goSales(item)}
          style={({ pressed }) => [st.card, pressed && st.cardPressed]}
        >
          <View style={st.cardTop}>
            <View style={st.avatar}>
              <Image source={I.farmerNew} style={st.avatarImg} />
              {verified ? (
                <View style={st.avatarTick}>
                  <MaterialCommunityIcons name="check" size={10} color="#FFF" />
                </View>
              ) : null}
            </View>

            <View style={st.cardContent}>
              <View style={st.topRow}>
                <View style={st.nameCol}>
                  <Text style={st.name} numberOfLines={1}>{name || 'Kisan'}</Text>
                  {verified ? (
                    <View style={st.verifiedBadge}>
                      <MaterialCommunityIcons name="check-decagram" size={11} color="#16A34A" />
                      <Text style={st.verifiedTxt}>Verified</Text>
                    </View>
                  ) : (
                    <Text style={st.pendingTxt}>Pending verify</Text>
                  )}
                </View>
                {!locked ? (
                  <TouchableOpacity
                    style={st.editBtn}
                    activeOpacity={0.85}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      this.goEdit(item);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons name="pencil" size={15} color={HEADER.brand} />
                  </TouchableOpacity>
                ) : (
                  <View style={st.chevWrap}>
                    <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                  </View>
                )}
              </View>

              {!!phone && (
                <View style={st.phoneRow}>
                  <View style={st.phoneIco}>
                    <MaterialCommunityIcons name="phone" size={12} color={HEADER.brand} />
                  </View>
                  <Text style={st.phoneTxt}>{maskPhone(phone)}</Text>
                </View>
              )}
            </View>
          </View>

          {!!addr && (
            <View style={st.addrRow}>
              <MaterialCommunityIcons name="map-marker" size={14} color="#94A3B8" />
              <Text style={st.addr} numberOfLines={2}>{addr}</Text>
            </View>
          )}

          {hasMeta ? (
            <View style={st.metaRow}>
              {totalArea ? (
                <View style={[st.metaChip, st.metaLand]}>
                  <MaterialCommunityIcons name="vector-square" size={12} color="#087A4D" />
                  <Text style={[st.metaTxt, { color: '#087A4D' }]}>{totalArea} acres</Text>
                </View>
              ) : null}
              {cattleTotal > 0 ? (
                <View style={[st.metaChip, st.metaCattle]}>
                  <MaterialCommunityIcons name="cow" size={12} color="#9A3412" />
                  <Text style={[st.metaTxt, { color: '#9A3412' }]}>{cattleTotal} cattle</Text>
                </View>
              ) : null}
              {crops.slice(0, 3).map((c) => (
                <View key={c} style={[st.metaChip, st.metaCrop]}>
                  <MaterialCommunityIcons name="sprout" size={12} color={HEADER.brand} />
                  <Text style={[st.metaTxt, { color: HEADER.brand }]} numberOfLines={1}>{c}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Pressable>
      </Animatable.View>
    );
  };

  renderEmpty = () => (
    <Animatable.View animation="fadeIn" duration={400} style={st.empty}>
      <View style={st.emptyIco}>
        <MaterialCommunityIcons name="account-plus-outline" size={36} color={S.P} />
      </View>
      <Text style={st.emptyT}>Abhi koi kisan nahi hai</Text>
      {!isReadOnly() ? (
        <>
          <Text style={st.emptyS}>Naya kisan jodne ke liye neeche button dabayein</Text>
          <TouchableOpacity style={st.emptyBtn} activeOpacity={0.88} onPress={this.goAdd}>
            <MaterialCommunityIcons name="plus" size={18} color="#FFF" />
            <Text style={st.emptyBtnTxt}>Add Farmer</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </Animatable.View>
  );

  render() {
    const {
      search,
      farmers,
      tab,
      allFarmerCount,
      verifiedFarmerCount,
      loading,
    } = this.state;

    return (
      <View style={st.root}>
        <StatusBar barStyle="light-content" backgroundColor={HEADER.brand} />
        <NavigationEvents onDidFocus={this.loadFarmers} />
        <ScreenHeader
          bg={HEADER.brand}
          title="Kisan List"
          onBack={this.goBack}
          below={(
            <View>
              <View style={st.hdrHero}>
                <View style={{ flex: 1 }}>
                  <Text style={st.hdrHeroLbl}>ADDED FARMERS</Text>
                  <Text style={st.hdrHeroAmt}>{allFarmerCount}</Text>
                  <View style={st.hdrChipRow}>
                    <View style={st.hdrChip}>
                      <MaterialCommunityIcons name="account-group" size={12} color="#FFF" />
                      <Text style={st.hdrChipT}>Total {allFarmerCount}</Text>
                    </View>
                    <View style={st.hdrChip}>
                      <MaterialCommunityIcons name="check-decagram" size={12} color="#FFF" />
                      <Text style={st.hdrChipT}>Verified {verifiedFarmerCount}</Text>
                    </View>
                  </View>
                </View>
                <View style={st.hdrStatus}>
                  <Text style={st.hdrStatusT}>Farmer</Text>
                </View>
              </View>

              <View style={st.hdrSearch}>
                <MaterialCommunityIcons name="magnify" size={18} color="rgba(255,255,255,0.75)" />
                <TextInput
                  style={st.hdrSearchIn}
                  value={search}
                  onChangeText={this.onSearchChange}
                  placeholder="Naam ya mobile dhoondhein..."
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  returnKeyType="search"
                  autoCorrect={false}
                />
                {!!search && (
                  <TouchableOpacity
                    onPress={() => this.setState({ search: '' }, () => this.loadFarmers())}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons name="close-circle" size={18} color="rgba(255,255,255,0.55)" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />

        <View style={st.sheet}>
          <View style={st.tabRow}>
            <Pressable
              onPress={() => this.setTab('all')}
              style={[st.tabBtn, tab === 'all' ? st.tabBtnAllOn : st.tabBtnOff]}
            >
              <Text style={[st.tabLbl, tab === 'all' ? st.tabLblAllOn : st.tabLblOff]}>
                Sabhi ({allFarmerCount})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => this.setTab('verified')}
              style={[st.tabBtn, tab === 'verified' ? st.tabBtnVerifiedOn : st.tabBtnOff]}
            >
              <Text style={[st.tabLbl, tab === 'verified' ? st.tabLblVerifiedOn : st.tabLblOff]}>
                Verified ({verifiedFarmerCount})
              </Text>
            </Pressable>
          </View>

          <FlatList
            data={farmers}
            keyExtractor={(item, i) => `added-${farmerId(item) || i}`}
            renderItem={this.renderItem}
            ListEmptyComponent={this.renderEmpty}
            contentContainerStyle={st.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshing={loading}
            onRefresh={this.loadFarmers}
          />

          {this.state.farmers.length > 0 && !isReadOnly() ? (
            <View style={st.fabWrap}>
              <TouchableOpacity style={st.fab} activeOpacity={0.9} onPress={this.goAdd}>
                <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
                <Text style={st.fabTxt}>Add Farmer</Text>
              </TouchableOpacity>
            </View>
          ) : null}
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
  root: { flex: 1, backgroundColor: '#EBE7F5' },
  hdrSheet: {
    backgroundColor: HEADER.brand,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingBottom: 18,
    overflow: 'hidden',
    zIndex: 2,
    ...Platform.select({
      android: { elevation: 6 },
      ios: {
        shadowColor: '#5D3FD3',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      },
    }),
  },
  hdrBlobA: {
    position: 'absolute', width: 190, height: 190, borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.10)', right: -50, top: -60,
  },
  hdrBlobB: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.10)', left: -40, top: 80,
  },
  hdrTopRow: {
    height: 52, paddingHorizontal: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  hdrBack: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center', justifyContent: 'center',
  },
  hdrTitle: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  hdrHero: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 4, paddingTop: 2,
  },
  hdrHeroLbl: { color: 'rgba(255,255,255,0.80)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  hdrHeroAmt: { color: '#FFF', fontSize: 34, fontWeight: '800', letterSpacing: -0.6, marginTop: 2 },
  hdrChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  hdrChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.35)',
  },
  hdrChipT: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  hdrStatus: {
    backgroundColor: '#FFF', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 999, marginTop: 4,
  },
  hdrStatusT: { fontSize: 12, fontWeight: '800', color: HEADER.brand },
  hdrSearch: {
    marginTop: 14, marginHorizontal: 0, height: 44, borderRadius: 14,
    paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.28)',
  },
  hdrSearchIn: { flex: 1, fontSize: 14, color: '#FFF', paddingVertical: 0, fontWeight: '500' },
  sheet: {
    flex: 1,
    backgroundColor: '#EBE7F5',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  tabBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  tabBtnOff: {
    backgroundColor: '#FFF',
    borderColor: '#E2E8F0',
  },
  tabBtnAllOn: {
    backgroundColor: '#ECFDF5',
    borderColor: HEADER.brand,
    borderWidth: 1.5,
  },
  tabBtnVerifiedOn: {
    backgroundColor: HEADER.brand,
    borderColor: HEADER.brand,
  },
  tabLbl: { fontSize: 12, fontWeight: '700' },
  tabLblOff: { color: '#64748B' },
  tabLblAllOn: { color: HEADER.brand },
  tabLblVerifiedOn: { color: '#FFF' },
  list: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 110, flexGrow: 1 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(93,63,211,0.08)',
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
  cardPressed: { backgroundColor: '#FBF9FF', borderColor: 'rgba(93,63,211,0.22)' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: { width: 44, height: 44, resizeMode: 'contain' },
  avatarTick: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  cardContent: { flex: 1, minWidth: 0, marginLeft: 12 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  nameCol: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '800', color: '#0F172A', lineHeight: 20 },
  pendingTxt: { marginTop: 3, fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  editBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevWrap: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  verifiedTxt: { fontSize: 11, fontWeight: '700', color: '#15803D' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  phoneIco: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneTxt: { fontSize: 13, fontWeight: '700', color: HEADER.brand },
  addrRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EDE9FE',
  },
  addr: { flex: 1, fontSize: 12, fontWeight: '500', color: '#64748B', lineHeight: 17 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  metaLand: { backgroundColor: '#DCFCE7' },
  metaCattle: { backgroundColor: '#FFEDD5' },
  metaCrop: { backgroundColor: '#EDE9FE' },
  metaTxt: { fontSize: 11, fontWeight: '700', maxWidth: 140 },
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
  emptyBtn: {
    marginTop: 18,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: S.P,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyBtnTxt: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  fabWrap: {
    position: 'absolute',
    right: 18,
    bottom: 22,
  },
  fab: {
    height: 54,
    paddingHorizontal: 20,
    borderRadius: 27,
    backgroundColor: HEADER.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...Platform.select({
      ios: { shadowColor: S.P, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12 },
      android: { elevation: 10, shadowColor: S.P },
    }),
  },
  fabTxt: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});

export default withV4Navigation(FarmerList);
