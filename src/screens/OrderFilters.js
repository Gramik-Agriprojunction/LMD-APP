import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Switch, ScrollView, StatusBar, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ScreenHeader from '../components/ScreenHeader';
import { HEADER } from '../theme/headerColors';
import { withV4Navigation } from '../utils/v4Compat';
import { screenFooterPadding } from '../utils/safeAreaInsets';
import {
  DEFAULT_GROUP_BY,
  PICK_READY_FILTER,
  RESCHEDULE_DATE_PRESETS,
  dedupeGroupStack,
  hasActiveFilters,
  groupFilterById,
  stackFromLegacy,
} from '../utils/orderGrouping';

const P = '#5D3FD3';
const P_SOFT = '#EDE9FE';
const TXT = '#0F172A';
const SUB = '#64748B';
const MUTED = '#94A3B8';
const BORDER = '#E8ECF1';
const BG = '#E8ECF4';
const PAD = 12;

/** LMD ke liye sirf yeh group options — Address confusing hai */
const SIMPLE_GROUP_OPTS = [
  { id: 'priority', label: 'Priority', hint: 'Jaldi wale pehle' },
  { id: 'darkstore', label: 'Dark Store', hint: 'Store ke hisaab se' },
  { id: 'pincode', label: 'Pin Code', hint: 'Area / PIN se' },
  { id: 'farmer', label: 'Kisan', hint: 'Naam ke hisaab se' },
];

const DATE_OPTS = RESCHEDULE_DATE_PRESETS.filter((p) => p.id !== 'range');

function OrderFilters({ navigation }) {
  const initialStack = navigation?.getParam?.('groupStack')
    || stackFromLegacy(
      navigation?.getParam?.('groupBy', DEFAULT_GROUP_BY),
      navigation?.getParam?.('subGroupBy', null),
    );
  const initialPickReady = navigation?.getParam?.('pickReadyFilter', null);
  const initialReschedule = navigation?.getParam?.('rescheduleDateFilter', null);
  const onApply = navigation?.getParam?.('onApply');

  const initialPrimary = dedupeGroupStack(initialStack)[0] || DEFAULT_GROUP_BY;
  const safePrimary = SIMPLE_GROUP_OPTS.some((o) => o.id === initialPrimary)
    ? initialPrimary
    : DEFAULT_GROUP_BY;

  const [groupBy, setGroupBy] = useState(safePrimary);
  const [pickReadyDraft, setPickReadyDraft] = useState(initialPickReady === true);
  const [rescheduleDraft, setRescheduleDraft] = useState(
    initialReschedule?.preset && initialReschedule.preset !== 'range'
      ? initialReschedule
      : null,
  );

  const previewActive = hasActiveFilters(
    groupBy,
    pickReadyDraft ? true : null,
    rescheduleDraft,
    null,
    [groupBy],
    null,
    null,
  );

  const handleDatePress = (presetId) => {
    if (rescheduleDraft?.preset === presetId) {
      setRescheduleDraft(null);
      return;
    }
    setRescheduleDraft({ preset: presetId });
  };

  const apply = () => {
    onApply?.({
      groupStack: [groupBy],
      groupBy,
      subGroupBy: null,
      pickReadyFilter: pickReadyDraft ? true : null,
      rescheduleDateFilter: rescheduleDraft || null,
      priorityFilter: null,
      entityFilters: null,
    });
    navigation.goBack();
  };

  const reset = () => {
    setGroupBy(DEFAULT_GROUP_BY);
    setPickReadyDraft(false);
    setRescheduleDraft(null);
  };

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={P} />
      <ScreenHeader bg={HEADER.filters} title="Order Filter" onBack={() => navigation.goBack()} />

      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        <View style={st.helpCard}>
          <MaterialCommunityIcons name="hand-pointing-right" size={18} color={P} />
          <Text style={st.helpT}>
            3 cheezein chunein — Delivery kab, Pickup ready, List kaise dikhe.
          </Text>
        </View>

        {/* 1. Date */}
        <View style={st.card}>
          <Text style={st.cardTitle}>1. Delivery kab?</Text>
          <Text style={st.cardSub}>Aaj / Kal / Is hafte — dobara dabane se hatega</Text>
          <View style={st.dateRow}>
            {DATE_OPTS.map((preset) => {
              const on = rescheduleDraft?.preset === preset.id;
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => handleDatePress(preset.id)}
                  style={({ pressed }) => [
                    st.dateChip,
                    on && st.dateChipOn,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={[st.dateChipT, on && st.dateChipTOn]}>{preset.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 2. Pickup ready */}
        <View style={st.card}>
          <Text style={st.cardTitle}>2. Pickup ready?</Text>
          <Text style={st.cardSub}>Dark Store se uthane ke liye taiyar</Text>
          <View style={st.switchRow}>
            <View style={[st.switchIco, pickReadyDraft && { backgroundColor: '#DCFCE7' }]}>
              <Image
                source={PICK_READY_FILTER.icon}
                style={[st.switchIcoImg, { tintColor: PICK_READY_FILTER.iconTint }]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.switchTitle}>Sirf ready orders</Text>
              <Text style={st.switchSub}>Band = sab orders</Text>
            </View>
            <Switch
              value={pickReadyDraft}
              onValueChange={setPickReadyDraft}
              trackColor={{ false: '#E2E8F0', true: '#C4B5FD' }}
              thumbColor="#FFF"
              ios_backgroundColor="#E2E8F0"
            />
          </View>
        </View>

        {/* 3. Group / list view */}
        <View style={st.card}>
          <Text style={st.cardTitle}>3. List kaise dikhe?</Text>
          <Text style={st.cardSub}>Ek option chunein</Text>
          <View style={st.groupList}>
            {SIMPLE_GROUP_OPTS.map((opt, idx) => {
              const meta = groupFilterById(opt.id);
              const selected = groupBy === opt.id;
              const accent = meta?.accent || P;
              const tint = meta?.tint || P_SOFT;
              const isLast = idx === SIMPLE_GROUP_OPTS.length - 1;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setGroupBy(opt.id)}
                  style={({ pressed }) => [
                    st.groupRow,
                    !isLast && st.groupRowBorder,
                    selected && { backgroundColor: tint },
                    pressed && { opacity: 0.92 },
                  ]}
                >
                  <View style={[st.groupIco, { backgroundColor: selected ? '#FFF' : tint }]}>
                    <Image
                      source={meta?.icon}
                      style={[
                        st.groupImg,
                        { tintColor: selected ? accent : (meta?.iconTint || SUB) },
                      ]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.groupT, selected && { color: accent, fontWeight: '800' }]}>
                      {opt.label}
                    </Text>
                    <Text style={st.groupHint}>{opt.hint}</Text>
                  </View>
                  {selected ? (
                    <MaterialCommunityIcons name="check-circle" size={22} color={accent} />
                  ) : (
                    <View style={st.radio} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ height: 88 + screenFooterPadding() }} />
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={st.footerSafe}>
        <View style={st.footer}>
          <TouchableOpacity
            style={[st.resetBtn, !previewActive && st.resetBtnOff]}
            onPress={reset}
            disabled={!previewActive}
          >
            <Text style={[st.resetT, !previewActive && { color: MUTED }]}>Saaf karo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.applyBtn} activeOpacity={0.9} onPress={apply}>
            <Text style={st.applyT}>Lagaao</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollInner: { paddingHorizontal: PAD, paddingTop: 10, paddingBottom: PAD, gap: 10 },
  helpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: P_SOFT,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  helpT: { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#4C1D95', lineHeight: 19 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: TXT },
  cardSub: { fontSize: 12.5, color: SUB, marginTop: 3, marginBottom: 12 },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: '#FFF',
  },
  dateChipOn: { backgroundColor: P_SOFT, borderColor: P },
  dateChipT: { fontSize: 15, fontWeight: '700', color: SUB },
  dateChipTOn: { color: P, fontWeight: '800' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FAFBFC',
  },
  switchIco: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchIcoImg: { width: 20, height: 20, resizeMode: 'contain' },
  switchTitle: { fontSize: 15, fontWeight: '700', color: TXT },
  switchSub: { fontSize: 12, color: SUB, marginTop: 2 },
  groupList: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    overflow: 'hidden',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFF',
  },
  groupRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  groupIco: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupImg: { width: 18, height: 18, resizeMode: 'contain' },
  groupT: { fontSize: 15, fontWeight: '700', color: TXT },
  groupHint: { fontSize: 12, color: MUTED, marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  footerSafe: { backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: BORDER },
  footer: { flexDirection: 'row', gap: 8, paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 8 },
  resetBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFBFC',
  },
  resetBtnOff: { opacity: 0.55 },
  resetT: { fontSize: 15, fontWeight: '700', color: SUB },
  applyBtn: {
    flex: 1.7,
    height: 52,
    borderRadius: 14,
    backgroundColor: P,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyT: { fontSize: 16, fontWeight: '800', color: '#FFF' },
});

export default withV4Navigation(OrderFilters);
