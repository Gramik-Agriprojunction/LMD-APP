import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Dimensions,
} from 'react-native';
import BottomSheet from './BottomSheet';
import { overlayBottomPadding, screenFooterPadding } from '../utils/safeAreaInsets';
import { GROUP_FILTERS, FILTER_ROW_H } from '../utils/orderGrouping';

const P = '#5D3FD3';
const HIT = { top: 10, bottom: 10, left: 10, right: 10 };

const SAFE_BOTTOM = overlayBottomPadding();
const SHEET_ACTIONS_BOTTOM = SAFE_BOTTOM + screenFooterPadding() + 12;

const filterSheetMaxHeight = (hasActive) => {
  const listH = GROUP_FILTERS.length * FILTER_ROW_H;
  const total = 108 + listH + (hasActive ? 42 : 0) + 88 + SHEET_ACTIONS_BOTTOM;
  return Math.min(total, Math.round(Dimensions.get('window').height * 0.82));
};

export default function GroupOrdersFilterSheet({
  visible,
  filterDraft,
  groupBy,
  sheetRef,
  onClose,
  onSheetClosed,
  onSelectDraft,
  onApply,
  onReset,
}) {
  if (!visible) return null;

  const activeOpt = GROUP_FILTERS.find((g) => g.id === groupBy);
  const sheetMax = filterSheetMaxHeight(!!groupBy);

  return (
    <BottomSheet
      ref={sheetRef}
      visible
      dynamicSize
      maxDynamicContentSize={sheetMax}
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

        {!!groupBy && activeOpt ? (
          <View style={st.activePill}>
            <View style={[st.activeDot, { backgroundColor: activeOpt.accent }]} />
            <Text style={st.activeTxt} numberOfLines={1}>
              Abhi active: <Text style={{ fontWeight: '800', color: activeOpt.accent }}>{activeOpt.label}</Text>
            </Text>
          </View>
        ) : null}

        <View style={[st.actions, { paddingBottom: SHEET_ACTIONS_BOTTOM }]}>
          <TouchableOpacity
            style={[st.resetBtn, (!filterDraft && !groupBy) && st.resetBtnOff]}
            activeOpacity={0.85}
            onPress={onReset}
            disabled={!filterDraft && !groupBy}
          >
            <Text style={[st.resetT, (!filterDraft && !groupBy) && { opacity: 0.45 }]}>Reset</Text>
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
    marginTop: 4,
    marginBottom: 14,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
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
    flexDirection: 'row', alignItems: 'center', minHeight: FILTER_ROW_H,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFF',
  },
  rowLast: { borderBottomWidth: 0 },
  rowOn: { backgroundColor: '#FAFAFF' },
  rowBar: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },
  rowIco: {
    width: 44, height: 44, borderRadius: 13, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  rowIcoImg: { width: 24, height: 24, resizeMode: 'contain' },
  rowT: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  rowS: { fontSize: 11, color: '#94A3B8', marginTop: 2, lineHeight: 14 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center', marginLeft: 10,
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  activePill: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12,
    backgroundColor: '#F8FAFC', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  activeDot: { width: 7, height: 7, borderRadius: 4, marginRight: 8 },
  activeTxt: { flex: 1, fontSize: 12, fontWeight: '600', color: '#64748B' },
  actions: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 14, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  resetBtn: {
    flex: 1, height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF',
  },
  resetBtnOff: { borderColor: '#E2E8F0' },
  resetT: { fontSize: 14, fontWeight: '700', color: '#475569' },
  doneBtn: {
    flex: 1.5, height: 50, borderRadius: 14, backgroundColor: P,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  doneT: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  doneArrow: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  doneArrowIco: { width: 10, height: 10, resizeMode: 'contain', tintColor: '#FFF' },
});
