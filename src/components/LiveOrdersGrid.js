import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { STATUS, STATUS_SEQUENCE } from '../utils/statusColors';

const LIVE_KEY = {
  PENDING: 'pending',
  RESCHEDULE: 'reschedule_order',
  PICKUP: ['picked_up', 'in_transit'],
  DELIVERED: 'delivered',
  DISPUTED: 'disputed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  RTO: 'rto',
  RTO_IN: 'rto_delivered',
};

const ICONS = {
  ALL: 'view-grid-outline',
  PENDING: 'clock-outline',
  REJECTED: 'close-circle-outline',
  RESCHEDULE: 'calendar-clock',
  PICKUP: 'truck-delivery-outline',
  DELIVERED: 'check-decagram',
  DISPUTED: 'alert-circle-outline',
  CANCELLED: 'cancel',
  RTO: 'backup-restore',
  RTO_IN: 'archive-arrow-down-outline',
};

const LABELS = {
  ALL: 'All',
  PENDING: 'Pending',
  REJECTED: 'Rejected',
  RESCHEDULE: 'Reschedule',
  PICKUP: 'Picked Up',
  DELIVERED: 'Delivered',
  DISPUTED: 'Disputed',
  CANCELLED: 'Cancelled',
  RTO: 'RTO',
  RTO_IN: 'RTO IN',
};

const STATS = STATUS_SEQUENCE.map((k) => {
  const st = STATUS[k];
  return {
    k,
    l: LABELS[k] || st.label,
    liveKey: k === 'ALL' ? null : LIVE_KEY[k],
    bg: st.bg,
    tint: st.tint,
    accent: st.accent,
    icon: ICONS[k] || 'package-variant',
  };
});

const SUM_KEYS = [
  'pending',
  'picked_up',
  'delivered',
  'in_transit',
  'reschedule_order',
  'disputed',
  'cancelled',
  'rejected',
  'rto',
  'rto_delivered',
];

const COLS = 4;
const LINE = '#E8ECF1';

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const allCount = (live) => SUM_KEYS.reduce((sum, k) => sum + toNum(live?.[k]), 0);

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

function StatTile({ st, value, isSel, onPress, showRightBorder }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        s.cell,
        showRightBorder && s.cellBorderRight,
        isSel && { backgroundColor: st.tint },
      ]}
    >
      <View style={[s.iconWrap, { backgroundColor: isSel ? '#FFFFFF' : st.tint }]}>
        <MaterialCommunityIcons name={st.icon} size={18} color={st.bg} />
      </View>
      <Text style={[s.count, isSel && { color: st.accent }]} numberOfLines={1}>
        {Number(value).toLocaleString('en-IN')}
      </Text>
      <Text style={[s.label, isSel && { color: st.accent }]} numberOfLines={2}>
        {st.l}
      </Text>
    </TouchableOpacity>
  );
}

/** Decorative fill for incomplete last row (2 empty columns). */
function ArtPanel() {
  return (
    <View style={s.artPanel}>
      <View style={s.artBlob} />
      <View style={s.artBlobSm} />
      <View style={s.artRow}>
        <Image
          source={require('../screens/assets/box.png')}
          style={s.artBox}
        />
        <Image
          source={require('../screens/assets/truck.png')}
          style={s.artTruck}
        />
        <View style={s.artPath}>
          <View style={s.artDot} />
          <View style={s.artDot} />
          <View style={s.artDot} />
          <View style={s.artDot} />
        </View>
        <MaterialCommunityIcons name="map-marker" size={22} color="#7C3AED" />
      </View>
      <MaterialCommunityIcons
        name="leaf"
        size={14}
        color="#A78BFA"
        style={s.artLeaf1}
      />
      <MaterialCommunityIcons
        name="leaf"
        size={12}
        color="#C4B5FD"
        style={s.artLeaf2}
      />
    </View>
  );
}

export default function LiveOrdersGrid({ live, selected, onPress, showAll = true }) {
  const list = showAll ? STATS : STATS.filter((x) => x.k !== 'ALL');
  const rows = chunk(list, COLS);

  return (
    <View style={s.card}>
      {rows.map((row, rowIndex) => {
        const isLastRow = rowIndex === rows.length - 1;
        const emptyCols = isLastRow ? COLS - row.length : 0;

        return (
          <View
            key={`row-${rowIndex}`}
            style={[s.row, !isLastRow && s.rowBorderBottom]}
          >
            {row.map((st, colIndex) => {
              const showRightBorder =
                colIndex < row.length - 1 || emptyCols > 0;
              const v =
                st.k === 'ALL'
                  ? allCount(live)
                  : Array.isArray(st.liveKey)
                    ? st.liveKey.reduce((sum, k) => sum + toNum(live?.[k]), 0)
                    : toNum(live?.[st.liveKey]);
              return (
                <StatTile
                  key={st.k}
                  st={st}
                  value={v}
                  isSel={selected === st.k}
                  onPress={() => onPress?.(st.k)}
                  showRightBorder={showRightBorder}
                />
              );
            })}
            {emptyCols > 0 ? (
              <View style={[s.artWrap, { width: `${(100 / COLS) * emptyCols}%` }]}>
                <ArtPanel />
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export { allCount };

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D6D3F0',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  rowBorderBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: LINE,
  },
  cell: {
    width: `${100 / COLS}%`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    minHeight: 96,
    backgroundColor: '#FFFFFF',
  },
  cellBorderRight: {
    borderRightWidth: StyleSheet.hairlineWidth * 2,
    borderRightColor: LINE,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  count: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    includeFontPadding: false,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  label: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    includeFontPadding: false,
    textAlign: 'center',
    lineHeight: 13,
  },
  artWrap: {
    minHeight: 96,
    overflow: 'hidden',
  },
  artPanel: {
    flex: 1,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  artBlob: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#EDE9FE',
    right: 8,
    top: 4,
  },
  artBlobSm: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E9E5FF',
    left: 10,
    bottom: 6,
  },
  artRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 1,
  },
  artBox: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
    marginRight: 2,
  },
  artTruck: {
    width: 48,
    height: 36,
    resizeMode: 'contain',
  },
  artPath: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginHorizontal: 2,
  },
  artDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C4B5FD',
  },
  artLeaf1: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    transform: [{ rotate: '25deg' }],
  },
  artLeaf2: {
    position: 'absolute',
    left: 14,
    top: 10,
    transform: [{ rotate: '-30deg' }],
  },
});
