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
import * as Animatable from 'react-native-animatable';
import ScreenHeader from '../components/ScreenHeader';
import { NavigationEvents, withV4Navigation } from '../utils/v4Compat';
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

const cropNames = (f) => {
  const list = [...(f?.crops || []), ...(f?.annualCrops || [])];
  const fromCrops = list.map((c) => c?.name || c?.cropName).filter(Boolean);
  if (fromCrops.length) return fromCrops.slice(0, 3);
  return [...(f?.farmer_lands || f?.lands || [])]
    .map((land) => land?.cropName)
    .filter(Boolean)
    .slice(0, 3);
};

class FarmerList extends Component {
  constructor(props) {
    super(props);
    this.state = {
      search: '',
      farmers: [],
    };
    this._unsub = null;
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
  }

  loadFarmers = async () => {
    const farmers = await getAddedFarmers();
    this.setState({ farmers });
  };

  goBack = () => this.props?.navigation?.goBack?.();

  goAdd = () => this.props?.navigation?.navigate('AddFarmer');

  goEdit = (farmer) => {
    this.props?.navigation?.navigate('AddFarmer', { farmer, mode: 'edit' });
  };

  filtered = () => {
    const q = String(this.state.search || '').trim().toLowerCase();
    const list = this.state.farmers || [];
    if (!q) return list;
    return list.filter((f) => {
      const name = farmerDisplayName(f).toLowerCase();
      const phone = farmerDisplayPhone(f);
      const addr = farmerDisplayAddress(f).toLowerCase();
      return name.includes(q) || phone.includes(q) || addr.includes(q);
    });
  };

  renderItem = ({ item, index }) => {
    const name = farmerDisplayName(item);
    const phone = farmerDisplayPhone(item);
    const addr = farmerDisplayAddress(item);
    const crops = cropNames(item);
    const cattle = item?.cattleCount || {};
    const cattleTotal = ['cow', 'buffalo', 'goat', 'other'].reduce(
      (sum, key) => sum + Math.max(0, Number(cattle[key]) || 0),
      0,
    );

    return (
      <Animatable.View
        animation="fadeInUp"
        duration={280}
        delay={Math.min(index * 35, 160)}
        useNativeDriver
      >
        <Pressable
          onPress={() => this.goEdit(item)}
          style={({ pressed }) => [st.card, pressed && st.cardPressed]}
        >
          <View style={st.cardTop}>
            <View style={st.avatar}>
              <Image source={I.farmerNew} style={st.avatarImg} />
            </View>
            <View style={st.cardContent}>
              <View style={st.topRow}>
                <Text style={st.name} numberOfLines={1}>{name}</Text>
                <View style={st.editPill}>
                  <MaterialCommunityIcons name="pencil-outline" size={11} color={S.P} />
                  <Text style={st.editTxt}>Edit</Text>
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

          {(crops.length > 0 || cattleTotal > 0 || item?.totalArea) ? (
            <View style={st.metaRow}>
              {item?.totalArea ? (
                <View style={st.metaChip}>
                  <MaterialCommunityIcons name="arrow-expand-all" size={11} color="#087A4D" />
                  <Text style={st.metaTxt}>{item.totalArea} acres</Text>
                </View>
              ) : null}
              {cattleTotal > 0 ? (
                <View style={st.metaChip}>
                  <MaterialCommunityIcons name="cow" size={11} color="#835B4B" />
                  <Text style={st.metaTxt}>{cattleTotal} cattle</Text>
                </View>
              ) : null}
              {crops.map((c) => (
                <View key={c} style={st.metaChip}>
                  <Text style={st.metaTxt}>{c}</Text>
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
      <Text style={st.emptyS}>Naya kisan jodne ke liye neeche button dabayein</Text>
      <TouchableOpacity style={st.emptyBtn} activeOpacity={0.88} onPress={this.goAdd}>
        <MaterialCommunityIcons name="plus" size={18} color="#FFF" />
        <Text style={st.emptyBtnTxt}>Add Farmer</Text>
      </TouchableOpacity>
    </Animatable.View>
  );

  render() {
    const { search } = this.state;
    const farmers = this.filtered();

    return (
      <View style={st.root}>
        <StatusBar barStyle="light-content" backgroundColor={S.P} />
        <NavigationEvents onDidFocus={this.loadFarmers} />
        <ScreenHeader
          bg={S.P}
          title="Added Farmers"
          onBack={this.goBack}
          right={
            <TouchableOpacity onPress={this.goAdd} style={st.hdrAdd} activeOpacity={0.85}>
              <MaterialCommunityIcons name="plus" size={20} color="#FFF" />
            </TouchableOpacity>
          }
        />

        <View style={st.sheet}>
          <View style={st.searchWrap}>
            <View style={st.searchBox}>
              <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
              <TextInput
                style={st.searchIn}
                value={search}
                onChangeText={(text) => this.setState({ search: text })}
                placeholder="Naam ya mobile search karein..."
                placeholderTextColor="#94A3B8"
                returnKeyType="search"
                autoCorrect={false}
              />
              {!!search && (
                <TouchableOpacity onPress={() => this.setState({ search: '' })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialCommunityIcons name="close-circle" size={18} color="#CBD5E1" />
                </TouchableOpacity>
              )}
            </View>
            {farmers.length > 0 && (
              <View style={st.countPill}>
                <Text style={st.countTxt}>{farmers.length} farmers</Text>
              </View>
            )}
          </View>

          <FlatList
            data={farmers}
            keyExtractor={(item, i) => `added-${farmerId(item) || i}`}
            renderItem={this.renderItem}
            ListEmptyComponent={this.renderEmpty}
            contentContainerStyle={st.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />

          {this.state.farmers.length > 0 ? (
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
  root: { flex: 1, backgroundColor: S.P },
  hdrAdd: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
  list: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 100, flexGrow: 1 },
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
  cardPressed: { backgroundColor: '#FAFBFF', borderColor: S.P_GLOW },
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
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  name: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1E293B' },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: S.P_TINT,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  editTxt: { fontSize: 10, fontWeight: '700', color: S.P },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
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
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaTxt: { fontSize: 10.5, fontWeight: '600', color: '#475569' },
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
    left: 16,
    right: 16,
    bottom: 20,
  },
  fab: {
    height: 48,
    borderRadius: 12,
    backgroundColor: S.P,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...Platform.select({
      ios: { shadowColor: S.P, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 10 },
      android: { elevation: 6 },
    }),
  },
  fabTxt: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});

export default withV4Navigation(FarmerList);
