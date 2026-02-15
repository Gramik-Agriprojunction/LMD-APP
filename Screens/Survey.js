// Survey.js
import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';

const THEME = {
  green: '#1C8A62',
  greenDark: '#0F7451',
  bg: '#F3F5F7',
  paper: '#F2EDE2',
  card: '#EFE7D9',
  border: 'rgba(17,24,39,0.10)',
  text: '#111827',
  subText: '#6B7280',
  white: '#FFFFFF',
  chip: '#E9E3D6',
  chipBorder: 'rgba(17,24,39,0.10)',
  accent: '#E5A84A',
};

const W = Dimensions.get('window').width;

export default class Survey extends Component {
  state = {
    farmer: { name: 'Ramesh Kumar', phone: '9923 569 XXX' }, // replace from API
    payment: 1800, // replace from API
    currentSeason: 'Rabi Season',
    currentCrops: [
      { id: 'dhan', label: 'Dhan', sub: '3 Acres', icon: '🌾' },
      { id: 'makka', label: 'Makka', sub: 'Silking', icon: '🌽' },
      { id: 'lehsun', label: 'Lehsun', sub: '1 Acre', icon: '🧄' },
    ],
    problems: [
      { id: 'pila', label: 'Pila pan', icon: '🌼' },
      { id: 'sukha', label: 'Sukha / Jalna', icon: '🔥' },
      { id: 'keeda', label: 'Keeda', icon: '🐛' },
    ],
    selectedProblem: { id: 'fungal', label: 'Fungal Daag', icon: '🍃' }, // replace from API
    rabi: [
      { id: 'gehu', label: 'Gehu', acres: '2 Acres', stage: 'Grain Filling', icon: '🌾' },
      { id: 'sarson', label: 'Sarson', acres: '1 Acre', stage: 'Flowering', icon: '🌼' },
    ],
    kharif: [
      { id: 'dhan2', label: 'Dhan', acres: '3 Acres', stage: 'Ready', icon: '🌾' },
      { id: 'makka2', label: 'Makka', acres: '4 Acre', stage: 'Flowering', icon: '🌽' },
    ],
    cattle: { cows: 3, buffalo: 2, milk: 12 },
    fodder: [
      { id: 'green', label: 'Green Fodder', icon: '🌿' },
      { id: 'bhusa', label: 'Bhusa', icon: '🪵' },
      { id: 'mix', label: 'Mix', icon: '🥣' },
    ],
    expense: [
      { id: 'spray', label: 'Spray', icon: '🧴' },
      { id: 'beej', label: 'Beej', icon: '🌱' },
      { id: 'khaad', label: 'Khaad', icon: '🧺' },
      { id: 'storage', label: 'Storage', icon: '📦' },
    ],
    notifCount: 12,
    activeTab: 'home',
  };

  onMenu = () => {};
  onChangeFarmer = () => {};
  onAddCrop = () => {};
  onTakePhoto = () => {};
  onAddAnotherCrop = () => {};
  onSaveFinish = () => {};
  onTab = (key) => this.setState({ activeTab: key });

  money = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '';
    return `₹ ${n.toLocaleString('en-IN')}`;
  };

  Chip = ({ icon, label, active, onPress, style }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        styles.chip,
        active ? styles.chipOn : null,
        style,
      ]}
    >
      {!!icon ? <Text style={styles.chipIcon}>{icon}</Text> : null}
      <Text style={[styles.chipText, active ? styles.chipTextOn : null]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  CropTile = ({ icon, label, sub, onPress }) => (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.cropTile}>
      <View style={styles.cropTopRow}>
        <Text style={styles.cropIcon}>{icon}</Text>
        <Text style={styles.cropLabel} numberOfLines={1}>{label}</Text>
      </View>
      {!!sub ? <Text style={styles.cropSub} numberOfLines={1}>{sub}</Text> : null}
    </TouchableOpacity>
  );

  SectionCard = ({ children, style }) => (
    <View style={[styles.sectionCard, style]}>{children}</View>
  );

  DividerLine = () => <View style={styles.divider} />;

  render() {
    const s = this.state;

    return (
      <View style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor={THEME.paper} />

        <SafeAreaView style={styles.safeTop} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={this.onMenu} activeOpacity={0.85}>
            <Text style={styles.iconTxt}>≡</Text>
          </TouchableOpacity>

          <View style={styles.brand}>
            {/* Replace with your logo if you have it */}
            {/* <Image source={require('./assets/logo.png')} style={styles.logo} /> */}
            <Text style={styles.brandName}>Gramik</Text>
          </View>

          <View style={{ width: 42 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Text style={styles.screenTitle}>Farmer Survey</Text>

          <View style={styles.cardWrap}>
            {/* Farmer row */}
            <View style={styles.farmerRow}>
              <Text style={styles.farmerText} numberOfLines={1}>
                {s.farmer?.name || ''}  <Text style={styles.farmerPhone}>{s.farmer?.phone || ''}</Text>
              </Text>

              <TouchableOpacity activeOpacity={0.9} onPress={this.onChangeFarmer} style={styles.changeBtn}>
                <Text style={styles.changeText}>Change</Text>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Payment collected */}
            <View style={styles.payRow}>
              <View style={styles.checkCircle}>
                <Text style={styles.checkTxt}>✓</Text>
              </View>
              <Text style={styles.payLabel}>Payment Collected:</Text>
              <Text style={styles.payValue}>{this.money(s.payment)}</Text>
            </View>

            <DividerLine />

            {/* Current crop */}
            <Text style={styles.blockTitle}>{`Current Crop (${s.currentSeason})`}</Text>
            <View style={styles.cropGrid}>
              {s.currentCrops.map((c) => (
                <this.CropTile
                  key={c.id}
                  icon={c.icon}
                  label={c.label}
                  sub={c.sub}
                  onPress={() => {}}
                />
              ))}
            </View>

            <TouchableOpacity activeOpacity={0.9} onPress={this.onAddCrop} style={styles.addRowBtn}>
              <Text style={styles.addPlus}>＋</Text>
              <Text style={styles.addText}>Add Crop</Text>
            </TouchableOpacity>

            <DividerLine />

            {/* Problems */}
            <Text style={styles.blockTitle}>Isme koi problem dikhi?</Text>
            <View style={styles.chipRow}>
              {s.problems.map((p) => (
                <this.Chip
                  key={p.id}
                  icon={p.icon}
                  label={p.label}
                  onPress={() => this.setState({ selectedProblem: { id: p.id, label: p.label, icon: p.icon } })}
                />
              ))}
            </View>

            {/* Selected problem + Take photo */}
            <View style={styles.problemRow}>
              <View style={styles.problemPill}>
                <Text style={styles.problemIcon}>{s.selectedProblem?.icon || '🍃'}</Text>
                <Text style={styles.problemText} numberOfLines={1}>
                  {s.selectedProblem?.label || ''}
                </Text>
              </View>

              <TouchableOpacity activeOpacity={0.9} onPress={this.onTakePhoto} style={styles.photoBtn}>
                <Text style={styles.photoIcon}>📷</Text>
                <Text style={styles.photoText}>Take photo</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity activeOpacity={0.9} onPress={this.onAddAnotherCrop} style={styles.addRowBtn}>
              <Text style={styles.addPlus}>＋</Text>
              <Text style={styles.addText}>Add Another Crop</Text>
            </TouchableOpacity>
          </View>

          {/* Rabi season */}
          <this.SectionCard>
            <Text style={styles.sectionTitle}>Rabi Season</Text>
            <View style={styles.twoCol}>
              {s.rabi.map((c) => (
                <View key={c.id} style={styles.seasonTile}>
                  <View style={styles.seasonTop}>
                    <Text style={styles.seasonIcon}>{c.icon}</Text>
                    <Text style={styles.seasonName} numberOfLines={1}>{c.label}</Text>
                    <Text style={styles.seasonAcres} numberOfLines={1}>{c.acres}</Text>
                  </View>
                  <View style={styles.stageRow}>
                    <Text style={styles.stageDot}>●</Text>
                    <Text style={styles.stageText} numberOfLines={1}>{c.stage}</Text>
                  </View>
                </View>
              ))}
            </View>
          </this.SectionCard>

          {/* Kharif season */}
          <this.SectionCard>
            <Text style={styles.sectionTitle}>Kharif Season</Text>
            <View style={styles.twoCol}>
              {s.kharif.map((c) => (
                <View key={c.id} style={styles.seasonTile}>
                  <View style={styles.seasonTop}>
                    <Text style={styles.seasonIcon}>{c.icon}</Text>
                    <Text style={styles.seasonName} numberOfLines={1}>{c.label}</Text>
                    <Text style={styles.seasonAcres} numberOfLines={1}>{c.acres}</Text>
                  </View>
                  <View style={styles.stageRow}>
                    <Text style={styles.stageDot}>●</Text>
                    <Text style={styles.stageText} numberOfLines={1}>{c.stage}</Text>
                  </View>
                </View>
              ))}
            </View>

            <TouchableOpacity activeOpacity={0.9} onPress={this.onAddCrop} style={[styles.addRowBtn, { marginTop: 10 }]}>
              <Text style={styles.addPlus}>＋</Text>
              <Text style={styles.addText}>Add Crop</Text>
            </TouchableOpacity>
          </this.SectionCard>

          {/* Cattle */}
          <this.SectionCard>
            <Text style={styles.sectionTitle}>Cattle</Text>

            <View style={styles.cattleRow}>
              <View style={styles.cattlePill}>
                <Text style={styles.cattleLabel}>Cows</Text>
                <Text style={styles.cattleValue}>{String(s.cattle.cows)}</Text>
              </View>
              <View style={styles.cattlePill}>
                <Text style={styles.cattleLabel}>Buffalo</Text>
                <Text style={styles.cattleValue}>{String(s.cattle.buffalo)}</Text>
              </View>
              <View style={styles.cattlePill}>
                <Text style={styles.cattleLabel}>Milk</Text>
                <Text style={styles.cattleValue}>{String(s.cattle.milk)}</Text>
                <Text style={styles.cattleUnit}>Litre</Text>
              </View>
            </View>

            <Text style={[styles.blockTitle, { marginTop: 12 }]}>Today’s Fodder Given</Text>
            <View style={styles.chipRow}>
              {s.fodder.map((f) => (
                <this.Chip key={f.id} icon={f.icon} label={f.label} onPress={() => {}} />
              ))}
            </View>

            <Text style={[styles.blockTitle, { marginTop: 12 }]}>Agla kharcha kis par hoga?</Text>
            <View style={styles.chipRow}>
              {s.expense.map((e) => (
                <this.Chip key={e.id} icon={e.icon} label={e.label} onPress={() => {}} />
              ))}
            </View>
          </this.SectionCard>

          <View style={{ height: 110 }} />
        </ScrollView>

        {/* Bottom Save */}
        <View style={styles.bottomWrap}>
          <TouchableOpacity activeOpacity={0.92} onPress={this.onSaveFinish} style={styles.saveBtn}>
            <Text style={styles.saveText}>SAVE & FINISH</Text>
          </TouchableOpacity>

          {/* Bottom Tabs (simple) */}
          <View style={styles.tabs}>
            <TouchableOpacity style={styles.tab} onPress={() => this.onTab('home')} activeOpacity={0.85}>
              <Text style={[styles.tabIcon, s.activeTab === 'home' ? styles.tabOn : null]}>⌂</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tab} onPress={() => this.onTab('bell')} activeOpacity={0.85}>
              <View style={{ position: 'relative' }}>
                <Text style={[styles.tabIcon, s.activeTab === 'bell' ? styles.tabOn : null]}>🔔</Text>
                {s.notifCount ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{String(s.notifCount)}</Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tab} onPress={() => this.onTab('stats')} activeOpacity={0.85}>
              <Text style={[styles.tabIcon, s.activeTab === 'stats' ? styles.tabOn : null]}>▮▮▮</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.tab} onPress={() => this.onTab('profile')} activeOpacity={0.85}>
              <Text style={[styles.tabIcon, s.activeTab === 'profile' ? styles.tabOn : null]}>👤</Text>
            </TouchableOpacity>
          </View>

          <SafeAreaView style={{ backgroundColor: THEME.paper }} />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.paper },
  safeTop: { backgroundColor: THEME.paper },

  header: {
    backgroundColor: THEME.paper,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { fontSize: 22, color: THEME.greenDark, fontWeight: '900' },

  brand: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brandName: { fontSize: 18, fontWeight: '900', color: THEME.greenDark },

  scroll: { paddingHorizontal: 14, paddingBottom: 16 },
  screenTitle: { marginTop: 6, fontSize: 18, fontWeight: '900', color: THEME.text, textAlign: 'center' },

  cardWrap: {
    marginTop: 10,
    backgroundColor: THEME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 12,
  },

  farmerRow: { flexDirection: 'row', alignItems: 'center' },
  farmerText: { flex: 1, fontSize: 13, fontWeight: '800', color: THEME.text },
  farmerPhone: { fontWeight: '700', color: THEME.subText },
  changeBtn: { flexDirection: 'row', alignItems: 'center' },
  changeText: { fontSize: 12, fontWeight: '800', color: THEME.greenDark },
  chev: { marginLeft: 6, fontSize: 18, fontWeight: '900', color: THEME.greenDark },

  payRow: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(28,138,98,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(28,138,98,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: THEME.greenDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkTxt: { color: '#fff', fontSize: 14, fontWeight: '900' },
  payLabel: { fontSize: 13, fontWeight: '800', color: THEME.text, marginRight: 8 },
  payValue: { fontSize: 16, fontWeight: '900', color: THEME.text },

  divider: { height: 1, backgroundColor: THEME.border, marginVertical: 12 },

  blockTitle: { fontSize: 13, fontWeight: '900', color: THEME.text },

  cropGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  cropTile: {
    width: (W - 14 * 2 - 12 * 2 - 10) / 3,
    backgroundColor: THEME.chip,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.chipBorder,
    padding: 8,
    marginBottom: 10,
    minHeight: 62,
  },
  cropTopRow: { flexDirection: 'row', alignItems: 'center' },
  cropIcon: { marginRight: 6, fontSize: 14 },
  cropLabel: { flex: 1, fontSize: 12, fontWeight: '900', color: THEME.text },
  cropSub: { marginTop: 6, fontSize: 11, fontWeight: '800', color: THEME.subText },

  addRowBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  addPlus: { fontSize: 18, fontWeight: '900', color: THEME.greenDark, marginRight: 8 },
  addText: { fontSize: 13, fontWeight: '900', color: THEME.greenDark },

  chipRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: THEME.chip,
    borderWidth: 1,
    borderColor: THEME.chipBorder,
    marginRight: 8,
    marginBottom: 8,
    maxWidth: '100%',
  },
  chipOn: { backgroundColor: 'rgba(28,138,98,0.12)', borderColor: 'rgba(28,138,98,0.22)' },
  chipIcon: { marginRight: 8, fontSize: 13 },
  chipText: { fontSize: 12, fontWeight: '900', color: THEME.text },
  chipTextOn: { color: THEME.greenDark },

  problemRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  problemPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(28,138,98,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(28,138,98,0.22)',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginRight: 10,
  },
  problemIcon: { marginRight: 8, fontSize: 13 },
  problemText: { flex: 1, fontSize: 14, fontWeight: '900', color: THEME.greenDark },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: THEME.greenDark,
  },
  photoIcon: { marginRight: 8, fontSize: 13, color: '#fff' },
  photoText: { fontSize: 12, fontWeight: '900', color: '#fff' },

  sectionCard: {
    marginTop: 12,
    backgroundColor: THEME.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: THEME.text, marginBottom: 8 },

  twoCol: { flexDirection: 'row', justifyContent: 'space-between' },
  seasonTile: {
    width: (W - 14 * 2 - 12 * 2 - 10) / 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.chipBorder,
    backgroundColor: THEME.chip,
    padding: 10,
  },
  seasonTop: { flexDirection: 'row', alignItems: 'center' },
  seasonIcon: { fontSize: 14, marginRight: 8 },
  seasonName: { flex: 1, fontSize: 13, fontWeight: '900', color: THEME.text },
  seasonAcres: { fontSize: 12, fontWeight: '900', color: THEME.subText },
  stageRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center' },
  stageDot: { color: THEME.greenDark, marginRight: 8, fontSize: 10 },
  stageText: { fontSize: 12, fontWeight: '900', color: THEME.greenDark },

  cattleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  cattlePill: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.chipBorder,
    backgroundColor: THEME.chip,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  cattleLabel: { fontSize: 12, fontWeight: '900', color: THEME.text, marginRight: 6 },
  cattleValue: { fontSize: 14, fontWeight: '900', color: THEME.text },
  cattleUnit: { marginLeft: 6, fontSize: 12, fontWeight: '900', color: THEME.subText },

  bottomWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: THEME.paper,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  saveBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: THEME.greenDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '900' },

  tabs: {
    marginTop: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(15,116,81,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(15,116,81,0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  tab: { width: 52, height: 40, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { fontSize: 18, opacity: 0.8 },
  tabOn: { opacity: 1 },

  badge: {
    position: 'absolute',
    right: -8,
    top: -6,
    minWidth: 22,
    height: 18,
    borderRadius: 9,
    backgroundColor: THEME.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '900', color: THEME.text },
});