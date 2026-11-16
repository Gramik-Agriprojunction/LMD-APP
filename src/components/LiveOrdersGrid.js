import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
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
];

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const allCount = (live) => SUM_KEYS.reduce((sum, k) => sum + toNum(live?.[k]), 0);

function StatTile({ st, value, isSel, onPress }) {
  return (
    <View style={s.cell}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={[
          s.tile,
          { backgroundColor: isSel ? st.tint : '#FFFFFF' },
          isSel && { borderColor: st.bg },
          !isSel && s.tileIdle,
        ]}
      >
        <View style={[s.iconWrap, { backgroundColor: isSel ? '#FFFFFF' : st.tint }]}>
          <MaterialCommunityIcons name={st.icon} size={15} color={st.bg} />
        </View>
        <View style={s.txtCol}>
          <Text style={[s.count, isSel && { color: st.accent }]} numberOfLines={1}>
            {Number(value).toLocaleString('en-IN')}
          </Text>
          <Text style={[s.label, isSel && { color: st.accent }]} numberOfLines={1}>
            {st.l}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function LiveOrdersGrid({ live, selected, onPress, showAll = true }) {
  const list = showAll ? STATS : STATS.filter((x) => x.k !== 'ALL');
  return (
    <View style={s.grid}>
      {list.map((st) => {
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
          />
        );
      })}
    </View>
  );
}

export { allCount };

const G = 7;

const s = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -G / 2,
  },
  cell: {
    width: '33.333%',
    paddingHorizontal: G / 2,
    marginBottom: G,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 7,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      android: { elevation: 1 },
    }),
  },
  tileIdle: {
    borderColor: 'rgba(15,23,42,0.06)',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txtCol: {
    flex: 1,
    minWidth: 0,
  },
  count: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    includeFontPadding: false,
    letterSpacing: -0.2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
    includeFontPadding: false,
  },
});
