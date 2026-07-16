import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getPriority } from '../utils/statusColors';

const P = '#5D3FD3';

const PICK_READY_HEADER = {
  'Ready to Pick': { tint: '#DCFCE7', accent: '#166534', dot: '#16A34A' },
  'Not Ready to Pick': { tint: '#FFEDD5', accent: '#9A3412', dot: '#EA580C' },
  Unknown: { tint: '#F1F5F9', accent: '#475569', dot: '#94A3B8' },
};

export default function OrderGroupHeader({ title, count, groupBy, compact = false }) {
  const isPriority = groupBy === 'priority';
  const isPickReady = groupBy === 'pick_ready';
  const pri = isPriority ? getPriority(title) : null;
  const pickReady = isPickReady ? (PICK_READY_HEADER[title] || PICK_READY_HEADER.Unknown) : null;
  const accentStyle = isPriority
    ? { backgroundColor: pri.tint, borderLeftColor: pri.bg }
    : isPickReady
      ? { backgroundColor: pickReady.tint, borderLeftColor: pickReady.dot }
      : null;

  return (
    <View style={[
      compact ? st.compact : st.hdr,
      accentStyle,
    ]}>
      <View style={[
        st.dot,
        isPriority && { backgroundColor: pri.bg },
        isPickReady && { backgroundColor: pickReady.dot },
      ]} />
      <Text style={[
        st.title,
        isPriority && { color: pri.accent },
        isPickReady && { color: pickReady.accent },
      ]} numberOfLines={2}>{title}</Text>
      <View style={[
        st.count,
        isPriority && { backgroundColor: pri.bg },
        isPickReady && { backgroundColor: pickReady.dot },
      ]}>
        <Text style={st.countT}>{count}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  hdr: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
    marginTop: 2,
    borderLeftWidth: 3,
    borderLeftColor: P,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 6,
    marginTop: 2,
    borderLeftWidth: 3,
    borderLeftColor: P,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: P, marginRight: 8 },
  title: { flex: 1, fontSize: 12, fontWeight: '700', color: '#312E81', lineHeight: 16 },
  count: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: P,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
  },
  countT: { fontSize: 10, fontWeight: '700', color: '#FFF' },
});
