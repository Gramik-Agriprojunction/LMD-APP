import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Easing } from 'react-native';

const { width } = Dimensions.get('window');
const G = 5;
// Available width inside the Live Orders white card:
//   - screen padding (8 each side)
//   - card padding (12 each side)
// Minus 2 gaps, divided by 3 columns.
const SW = Math.floor((width - 8 * 2 - 12 * 2 - G * 2) / 3);

const STATS = [
  { k: 'ALL',        l: 'All',        liveKey: null,               bg: '#5D3FD3' },
  { k: 'PENDING',    l: 'Pending',    liveKey: 'pending',          bg: '#EA580C' },
  { k: 'PICKUP',     l: 'Picked Up',  liveKey: 'picked_up',        bg: '#0891B2' },
  { k: 'DELIVERED',  l: 'Delivered',  liveKey: 'delivered',        bg: '#16A34A' },
  { k: 'IN_TRANSIT', l: 'In-Transit', liveKey: 'in_transit',       bg: '#2563EB' },
  { k: 'RESCHEDULE', l: 'Reschedule', liveKey: 'reschedule_order', bg: '#9333EA' },
  { k: 'DISPUTED',   l: 'Disputed',   liveKey: 'disputed',         bg: '#CA8A04' },
  { k: 'CANCELLED',  l: 'Cancelled',  liveKey: 'cancelled',        bg: '#F87171' },
  { k: 'RTO',        l: 'RTO',        liveKey: 'rto',              bg: '#DC2626' },
];

const SUM_KEYS = ['pending', 'picked_up', 'delivered', 'in_transit', 'reschedule_order', 'disputed', 'cancelled', 'rto'];

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const allCount = (live) => SUM_KEYS.reduce((sum, k) => sum + toNum(live?.[k]), 0);

function StatTile({ st, value, isSel, anySel, onPress }) {
  // Selected tile stays at full size (no bleed past card edges).
  // Unselected tiles shrink so the selected one visually pops.
  const target = isSel ? 1 : anySel ? 0.88 : 1;
  const scale = useRef(new Animated.Value(target)).current;
  const opacity = useRef(new Animated.Value(isSel || !anySel ? 1 : 0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: target,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: isSel || !anySel ? 1 : 0.85,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [target, isSel, anySel, scale, opacity]);

  return (
    <Animated.View style={{ transform: [{ scale }], opacity, zIndex: isSel ? 2 : 1 }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={[s.sb, { backgroundColor: st.bg }, isSel && s.sbSel]}
      >
        <Text style={s.sbV} numberOfLines={1}>{String(value)}</Text>
        <Text style={s.sbL} numberOfLines={1}>{st.l}</Text>
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
        const v = st.k === 'ALL' ? allCount(live) : toNum(live?.[st.liveKey]);
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
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 56,
    justifyContent: 'center',
  },
  sbSel: {
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  sbV: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
    includeFontPadding: false,
  },
  sbL: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 3,
    includeFontPadding: false,
  },
});
