import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  StatusBar,
  Image,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { HEADER } from '../theme/headerColors';
import { withV4Navigation } from '../utils/v4Compat';
import {
  farmerDisplayAddress,
  farmerDisplayName,
  farmerDisplayPhone,
} from '../utils/addedFarmers';
import { soilIcons as I } from '../utils/soilTheme';

const BRAND = HEADER.brand;

const maskPhone = (p) => {
  if (!p) return '';
  const s = String(p).replace(/\D/g, '');
  if (s.length < 6) return String(p);
  return `${s.slice(0, 2)}****${s.slice(-2)}`;
};

/** Static demo sales — replace with API later. */
const STATIC_SALES = [
  {
    id: '1',
    orderCode: 'AGRI4480380077358',
    amount: 1250,
    status: 'delivered',
    statusLabel: 'Delivered',
    isFirstSale: true,
    date: '12 Jul 2026',
    items: 'Urea 45kg · 2 bags',
    payment: 'COD',
  },
];

const STATUS_STYLE = {
  delivered: { bg: '#DCFCE7', text: '#166534', dot: '#16A34A' },
  pickup: { bg: '#EDE9FE', text: '#5B21B6', dot: BRAND },
  pending: { bg: '#FFEDD5', text: '#9A3412', dot: '#EA580C' },
  cancelled: { bg: '#FEE2E2', text: '#B91C1C', dot: '#DC2626' },
  disputed: { bg: '#FEF3C7', text: '#854D0E', dot: '#CA8A04' },
};

class FarmerSales extends Component {
  getFarmer = () => this.props?.navigation?.getParam?.('farmer', null) || {};

  goBack = () => this.props.navigation?.goBack?.();

  renderSale = ({ item }) => {
    const st = STATUS_STYLE[item.status] || STATUS_STYLE.pending;
    return (
      <View style={s.saleCard}>
        <View style={[s.saleAccent, { backgroundColor: st.dot }]} />

        {item.isFirstSale ? (
          <View style={s.firstSaleBanner}>
            <View style={s.firstSaleIco}>
              <MaterialCommunityIcons name="trophy-outline" size={14} color="#0369A1" />
            </View>
            <Text style={s.firstSaleT}>1st Sale</Text>
            <Text style={s.firstSaleSub}>Onboarding reward eligible</Text>
          </View>
        ) : null}

        <View style={s.saleTop}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
            <Text style={s.orderCode} numberOfLines={1}>#{item.orderCode}</Text>
            <View style={s.metaRow}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={13} color="#94A3B8" />
              <Text style={s.saleDate}>{item.date}</Text>
            </View>
          </View>
          <View style={[s.statusPill, { backgroundColor: st.bg }]}>
            <View style={[s.statusDot, { backgroundColor: st.dot }]} />
            <Text style={[s.statusPillT, { color: st.text }]}>{item.statusLabel}</Text>
          </View>
        </View>

        <View style={s.itemRow}>
          <View style={s.itemIco}>
            <MaterialCommunityIcons name="package-variant-closed" size={16} color={BRAND} />
          </View>
          <Text style={s.items} numberOfLines={2}>{item.items}</Text>
        </View>

        <View style={s.saleDivider} />

        <View style={s.saleBottom}>
          <View style={s.payChip}>
            <MaterialCommunityIcons name="cash" size={14} color="#64748B" />
            <Text style={s.payChipT}>{item.payment}</Text>
          </View>
          <View style={s.amountWrap}>
            <Text style={s.amountLbl}>Order total</Text>
            <Text style={s.amount}>₹{Number(item.amount).toLocaleString('en-IN')}</Text>
          </View>
        </View>
      </View>
    );
  };

  renderHeader = () => {
    const farmer = this.getFarmer();
    const name = farmerDisplayName(farmer) || 'Kisan';
    const phone = farmerDisplayPhone(farmer);
    const addr = farmerDisplayAddress(farmer);
    const sales = STATIC_SALES;
    const delivered = sales.filter((x) => x.status === 'delivered').length;
    const totalAmt = sales
      .filter((x) => x.status === 'delivered')
      .reduce((sum, x) => sum + (Number(x.amount) || 0), 0);

    return (
      <View>
        <View style={s.farmerCard}>
          <View style={s.farmerAccent} />
          <View style={s.farmerBody}>
            <View style={s.farmerTop}>
              <View style={s.avatar}>
                <Image source={I.farmerNew} style={s.avatarImg} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.farmerName} numberOfLines={1}>{name}</Text>
                {!!phone && (
                  <View style={s.phoneRow}>
                    <View style={s.phoneIco}>
                      <MaterialCommunityIcons name="phone" size={12} color={BRAND} />
                    </View>
                    <Text style={s.phoneTxt}>{maskPhone(phone)}</Text>
                  </View>
                )}
              </View>
              <View style={s.onboardBadge}>
                <MaterialCommunityIcons name="account-check" size={14} color={BRAND} />
                <Text style={s.onboardBadgeT}>Onboarded</Text>
              </View>
            </View>

            {!!addr && (
              <View style={s.addrRow}>
                <MaterialCommunityIcons name="map-marker-outline" size={14} color="#94A3B8" />
                <Text style={s.addr} numberOfLines={2}>{addr}</Text>
              </View>
            )}

            <View style={s.statRow}>
              <View style={s.statBox}>
                <Text style={s.statVal}>{sales.length}</Text>
                <Text style={s.statLbl}>Orders</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statBox}>
                <Text style={[s.statVal, { color: '#16A34A' }]}>{delivered}</Text>
                <Text style={s.statLbl}>Delivered</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statBox}>
                <Text style={[s.statVal, { color: BRAND }]}>
                  ₹{totalAmt.toLocaleString('en-IN')}
                </Text>
                <Text style={s.statLbl}>Total sale</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>Order Details</Text>
          <Text style={s.sectionCount}>{sales.length} order</Text>
        </View>
      </View>
    );
  };

  renderEmpty = () => (
    <View style={s.empty}>
      <View style={s.emptyIco}>
        <MaterialCommunityIcons name="shopping-outline" size={32} color={BRAND} />
      </View>
      <Text style={s.emptyT}>Abhi koi sale nahi</Text>
      <Text style={s.emptyS}>Jab is farmer ki order aayegi, yahan dikhegi</Text>
    </View>
  );

  render() {
    const farmer = this.getFarmer();
    const name = farmerDisplayName(farmer) || 'Kisan';

    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={BRAND} />
        <ScreenHeader
          bg={BRAND}
          title="Farmer Sales"
          onBack={this.goBack}
          below={
            <View style={s.hdrBelow}>
              <Text style={s.hdrSub} numberOfLines={1}>{name} ki sales</Text>
            </View>
          }
        />

        <FlatList
          data={STATIC_SALES}
          keyExtractor={(it) => it.id}
          renderItem={this.renderSale}
          ListHeaderComponent={this.renderHeader}
          ListEmptyComponent={this.renderEmpty}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EDE9FE' },
  hdrBelow: { paddingHorizontal: 16, paddingBottom: 12 },
  hdrSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 32 },

  farmerCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    marginBottom: 16,
    overflow: 'hidden',
    ...softShadow,
  },
  farmerAccent: {
    height: 4,
    backgroundColor: BRAND,
  },
  farmerBody: { padding: 14 },
  farmerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EDE9FE',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(93,63,211,0.2)',
  },
  avatarImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  farmerName: { fontSize: 17, fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  phoneIco: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(93,63,211,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneTxt: { fontSize: 13, fontWeight: '600', color: '#475569' },
  onboardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(93,63,211,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
  },
  onboardBadgeT: { fontSize: 10, fontWeight: '700', color: BRAND },

  addrRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15,23,42,0.08)',
  },
  addr: { flex: 1, fontSize: 12, color: '#64748B', lineHeight: 17 },

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    backgroundColor: '#F8F7FC',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(93,63,211,0.08)',
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(93,63,211,0.12)' },
  statLbl: { fontSize: 10, fontWeight: '600', color: '#94A3B8', marginTop: 2 },
  statVal: { fontSize: 15, fontWeight: '800', color: '#0F172A' },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  sectionCount: { fontSize: 12, fontWeight: '600', color: '#64748B' },

  saleCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    paddingLeft: 16,
    marginBottom: 10,
    overflow: 'hidden',
    ...softShadow,
  },
  saleAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  firstSaleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  firstSaleIco: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  firstSaleT: { fontSize: 12, fontWeight: '800', color: '#0369A1' },
  firstSaleSub: { flex: 1, fontSize: 11, fontWeight: '500', color: '#0284C7' },
  saleTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  orderCode: { fontSize: 14, fontWeight: '800', color: BRAND, letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  saleDate: { fontSize: 12, fontWeight: '500', color: '#94A3B8' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillT: { fontSize: 11, fontWeight: '700' },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    backgroundColor: '#F8F7FC',
    borderRadius: 12,
    padding: 10,
  },
  itemIco: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(93,63,211,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  items: { flex: 1, fontSize: 13, fontWeight: '600', color: '#334155' },

  saleDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(15,23,42,0.08)',
    marginVertical: 12,
  },
  saleBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  payChipT: { fontSize: 12, fontWeight: '700', color: '#475569' },
  amountWrap: { alignItems: 'flex-end' },
  amountLbl: { fontSize: 10, fontWeight: '600', color: '#94A3B8', marginBottom: 1 },
  amount: { fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },

  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyIco: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(93,63,211,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyT: { fontSize: 15, fontWeight: '700', color: '#475569' },
  emptyS: { marginTop: 4, fontSize: 12, color: '#94A3B8', textAlign: 'center' },
});

export default withV4Navigation(FarmerSales);
