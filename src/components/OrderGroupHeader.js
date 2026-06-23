import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getPriority } from '../utils/statusColors';

const P = '#5D3FD3';

export default function OrderGroupHeader({ title, count, groupBy, compact = false }) {
  const isPriority = groupBy === 'priority';
  const pri = isPriority ? getPriority(title) : null;

  return (
    <View style={[
      compact ? st.compact : st.hdr,
      isPriority && { backgroundColor: pri.tint, borderLeftColor: pri.bg },
    ]}>
      <View style={[st.dot, isPriority && { backgroundColor: pri.bg }]} />
      <Text style={[st.title, isPriority && { color: pri.accent }]} numberOfLines={2}>{title}</Text>
      <View style={[st.count, isPriority && { backgroundColor: pri.bg }]}>
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
