import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, Switch, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from './BottomSheet';
import { GROUP_FILTERS, PICK_READY_FILTER, formatActiveFilterLabel, hasActiveFilters } from '../utils/orderGrouping';
import { sheetBottomInset } from '../utils/safeAreaInsets';

const P = '#5D3FD3';
const HIT = { top: 10, bottom: 10, left: 10, right: 10 };
const ROW_H = 58;
const PICK_READY_ROW_H = 62;
const ACTIONS_BTN_H = 46;
const FOOTER_INNER_PAD = 12;

const filterSheetMaxHeight = (hasActive, footerPad) => {
  const bannerH = 82;
  const listH = GROUP_FILTERS.length * ROW_H;
  const pickReadyBlock = 28 + PICK_READY_ROW_H;
  const activeH = hasActive ? 40 : 0;
  const actionsH = ACTIONS_BTN_H + 10;
  const handleH = 20;
  return bannerH + listH + pickReadyBlock + activeH + actionsH + footerPad + handleH + 4;
};

export default function GroupOrdersFilterSheet({
  visible,
  filterDraft,
  pickReadyFilterDraft,
  groupBy,
  pickReadyFilter,
  sheetRef,
  onClose,
  onSheetClosed,
  onSelectDraft,
  onTogglePickReadyDraft,
  onApply,
  onReset,
}) {
  const insets = useSafeAreaInsets();
  const footerPad = sheetBottomInset(insets.bottom) + FOOTER_INNER_PAD;

  const hasActive = hasActiveFilters(groupBy, pickReadyFilter);
  const sheetMax = useMemo(
    () => filterSheetMaxHeight(hasActive, footerPad),
    [hasActive, footerPad],
  );
  const activeLabel = formatActiveFilterLabel(groupBy, pickReadyFilter);
  const pickReadyOn = !!pickReadyFilterDraft;

  if (!visible) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      visible
      dynamicSize
      maxDynamicContentSize={sheetMax + 8}
      bottomInset={0}
      onSheetClose={onSheetClosed}
    >
      <View style={st.root}>
        <View style={st.banner}>
          <View style={st.bannerGlow} />
          <View style={st.bannerRow}>
            <View style={st.bannerIco}>
              <Image source={require('../screens/assets/sort.png')} style={st.bannerIcoImg} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.bannerTitle}>Group Orders</Text>
              <Text style={st.bannerSub}>List ko organize karne ka tareeka chunein</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={st.bannerClose} hitSlop={HIT}>
              <Image source={require('../screens/assets/cross.png')} style={st.bannerCloseIco} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={st.list}>
          {GROUP_FILTERS.map((opt, idx) => {
            const on = filterDraft === opt.id;
            const last = idx === GROUP_FILTERS.length - 1;
            return (
              <TouchableOpacity
                key={opt.id}
                activeOpacity={0.82}
                style={[st.row, on && st.rowOn, last && st.rowLast]}
                onPress={() => onSelectDraft(opt.id)}
              >
                {on ? <View style={[st.rowBar, { backgroundColor: opt.accent }]} /> : null}
                <View style={[
                  st.rowIco,
                  { borderColor: on ? opt.accent : `${opt.accent}40`, backgroundColor: on ? opt.tint : '#FFF' },
                ]}>
                  <Image
                    source={opt.icon}
                    style={[st.rowIcoImg, opt.iconTint ? { tintColor: opt.iconTint } : null]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.rowT, on && { color: opt.accent }]}>{opt.label}</Text>
                  <Text style={st.rowS}>{opt.sub}</Text>
                </View>
                <View style={[st.radio, on && { borderColor: opt.accent, backgroundColor: opt.tint }]}>
                  {on ? <View style={[st.radioDot, { backgroundColor: opt.accent }]} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={st.pickReadySection}>
          <Text style={st.pickReadyLbl}>Additional Filter</Text>
          <TouchableOpacity
            activeOpacity={0.82}
            style={[st.pickReadyRow, pickReadyOn && st.pickReadyRowOn]}
            onPress={onTogglePickReadyDraft}
          >
            {pickReadyOn ? <View style={[st.rowBar, { backgroundColor: PICK_READY_FILTER.accent }]} /> : null}
            <View style={[
              st.rowIco,
              {
                borderColor: pickReadyOn ? PICK_READY_FILTER.accent : `${PICK_READY_FILTER.accent}40`,
                backgroundColor: pickReadyOn ? PICK_READY_FILTER.tint : '#FFF',
              },
            ]}>
              <Image
                source={PICK_READY_FILTER.icon}
                style={[st.rowIcoImg, { tintColor: PICK_READY_FILTER.iconTint }]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[st.rowT, pickReadyOn && { color: PICK_READY_FILTER.accent }]}>{PICK_READY_FILTER.label}</Text>
              <Text style={st.rowS}>{PICK_READY_FILTER.sub}</Text>
            </View>
            <Switch
              value={pickReadyOn}
              onValueChange={onTogglePickReadyDraft}
              trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
              thumbColor={pickReadyOn ? '#16A34A' : '#F8FAFC'}
              ios_backgroundColor="#CBD5E1"
            />
          </TouchableOpacity>
        </View>

        {hasActive ? (
          <View style={st.activePill}>
            <View style={[st.activeDot, { backgroundColor: P }]} />
            <Text style={st.activeTxt} numberOfLines={2}>
              Abhi active: <Text style={{ fontWeight: '800', color: P }}>{activeLabel}</Text>
            </Text>
          </View>
        ) : null}

        <View style={[st.actions, { paddingBottom: footerPad }]}>
          <TouchableOpacity
            style={[st.resetBtn, !hasActive && st.resetBtnOff]}
            activeOpacity={0.85}
            onPress={onReset}
            disabled={!hasActive}
          >
            <Text style={[st.resetT, !hasActive && { opacity: 0.45 }]}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.doneBtn} activeOpacity={0.88} onPress={onApply}>
            <Text style={st.doneT}>Apply</Text>
            <View style={st.doneArrow}>
              <Image source={require('../screens/assets/arrow.png')} style={st.doneArrowIco} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
}

const st = StyleSheet.create({
  root: { overflow: 'hidden' },
  banner: {
    backgroundColor: P,
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 10,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  bannerGlow: {
    position: 'absolute', top: -30, right: -20, width: 100, height: 100,
    borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.12)',
  },
  bannerRow: { flexDirection: 'row', alignItems: 'center' },
  bannerIco: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  bannerIcoImg: { width: 18, height: 18, resizeMode: 'contain', tintColor: '#FFF' },
  bannerTitle: { fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: -0.2 },
  bannerSub: { fontSize: 11.5, color: 'rgba(255,255,255,0.78)', marginTop: 2, lineHeight: 15 },
  bannerClose: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  bannerCloseIco: { width: 9, height: 9, resizeMode: 'contain', tintColor: '#FFF' },
  list: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', minHeight: ROW_H,
    paddingHorizontal: 10, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFF',
  },
  rowLast: { borderBottomWidth: 0 },
  rowOn: { backgroundColor: '#FAFAFF' },
  rowBar: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },
  rowIco: {
    width: 38, height: 38, borderRadius: 11, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  rowIcoImg: { width: 20, height: 20, resizeMode: 'contain' },
  rowT: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  rowS: { fontSize: 10.5, color: '#94A3B8', marginTop: 1, lineHeight: 13 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center', marginLeft: 10,
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  pickReadySection: { marginHorizontal: 16, marginTop: 8 },
  pickReadyLbl: {
    fontSize: 10.5, fontWeight: '700', color: '#64748B', letterSpacing: 0.4,
    textTransform: 'uppercase', marginBottom: 6, marginLeft: 2,
  },
  pickReadyRow: {
    flexDirection: 'row', alignItems: 'center', minHeight: PICK_READY_ROW_H,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0',
    backgroundColor: '#FFF', overflow: 'hidden',
  },
  pickReadyRowOn: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  activePill: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8,
    backgroundColor: '#F8FAFC', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  activeDot: { width: 7, height: 7, borderRadius: 4, marginRight: 8 },
  activeTxt: { flex: 1, fontSize: 12, fontWeight: '600', color: '#64748B' },
  actions: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 10, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  resetBtn: {
    flex: 1, height: ACTIONS_BTN_H, borderRadius: 12, borderWidth: 1.5, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF',
  },
  resetBtnOff: { borderColor: '#E2E8F0' },
  resetT: { fontSize: 14, fontWeight: '700', color: '#475569' },
  doneBtn: {
    flex: 1.5, height: ACTIONS_BTN_H, borderRadius: 12, backgroundColor: P,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  doneT: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  doneArrow: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  doneArrowIco: { width: 10, height: 10, resizeMode: 'contain', tintColor: '#FFF' },
});
