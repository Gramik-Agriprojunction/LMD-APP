import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Easing } from 'react-native';
import { STATUS, STATUS_SEQUENCE } from '../utils/statusColors';

const { width } = Dimensions.get('window');
const G = 6;
// Available width inside the Live Orders white card:
//   - screen padding (8 each side)
//   - card padding (10 each side)
// Minus 2 gaps, divided by 3 columns.
const SW = Math.floor((width - 8 * 2 - 10 * 2 - G * 2) / 3);

// API live-counts keys per canonical status. `picked_up` + `in_transit` both
// roll into the PICKUP tile (In-Transit was dropped from the grid).
const LIVE_KEY = {
  PENDING:    'pending',
  RESCHEDULE: 'reschedule_order',
  PICKUP:     ['picked_up', 'in_transit'],
  DELIVERED:  'delivered',
  DISPUTED:   'disputed',
  CANCELLED:  'cancelled',
  REJECTED:   'rejected',
  RTO:        'rto',
};

const STATS = STATUS_SEQUENCE.map((k) => {
  const s = STATUS[k];
  return { k, l: s.label, liveKey: k === 'ALL' ? null : LIVE_KEY[k], bg: s.bg };
});

const SUM_KEYS = ['pending', 'picked_up', 'delivered', 'in_transit', 'reschedule_order', 'disputed', 'cancelled', 'rejected', 'rto'];

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const allCount = (live) => SUM_KEYS.reduce((sum, k) => sum + toNum(live?.[k]), 0);

function StatTile({ st, value, isSel, anySel, onPress }) {
  // Unselected tiles fade slightly so the selected one pops.
  const opacity = useRef(new Animated.Value(isSel || !anySel ? 1 : 0.82)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isSel || !anySel ? 1 : 0.82,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [isSel, anySel, opacity]);

  return (
    <Animated.View style={{ opacity, zIndex: isSel ? 2 : 1 }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={[s.sb, { backgroundColor: st.bg }, isSel && s.sbSel]}
      >
        <Text style={s.sbV} numberOfLines={1}>{String(value)}</Text>
        <Text style={s.sbL} numberOfLines={1}>{st.l}</Text>
        {isSel && <View style={s.sbCheck}><Text style={s.sbCheckT}>✓</Text></View>}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function LiveOrdersGrid({ live, selected, onPress, showAll = true }) {
  const list = showAll ? STATS : STATS.filter((x) => x.k !== 'ALL');
  const anySel = !!selected && list.some((st) => st.k === selected);
  return (
    <View style={s.sg}>
      {list.map((st) => {
        const v = st.k === 'ALL'
          ? allCount(live)
          : Array.isArray(st.liveKey)
          ? st.liveKey.reduce((sum, k) => sum + toNum(live?.[k]), 0)
          : toNum(live?.[st.liveKey]);
        const isSel = selected === st.k;
        return (
          <StatTile
            key={st.k}
            st={st}
            value={v}
            isSel={isSel}
            anySel={anySel}
            onPress={() => onPress?.(st.k)}
          />
        );
      })}
    </View>
  );
}

export { allCount };

const s = StyleSheet.create({
  sg: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // space-between distributes any leftover pixels evenly across the row
    // so left and right edges line up with the card padding identically.
    justifyContent: 'space-between',
    rowGap: G,
  },
  sb: {
    width: SW,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sbSel: {
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  sbV: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFF',
    includeFontPadding: false,
  },
  sbL: {
    fontSize: 10.5,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    marginTop: 2,
    includeFontPadding: false,
  },
  sbCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sbCheckT: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1E293B',
    includeFontPadding: false,
    lineHeight: 11,
  },
});
