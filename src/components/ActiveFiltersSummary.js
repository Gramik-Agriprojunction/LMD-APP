import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { buildActiveFilterSummary } from '../utils/orderGrouping';

const P = '#5D3FD3';

function Chip({ chip, onClear }) {
  const accent = chip.accent || P;
  const clearable = typeof onClear === 'function';
  return (
    <View style={[st.chip, { backgroundColor: chip.tint || '#EDE9FE', borderColor: `${accent}33` }]}>
      {chip.imageIcon ? (
        <Image
          source={chip.imageIcon}
          style={[st.chipImg, chip.iconTint ? { tintColor: chip.iconTint } : null]}
        />
      ) : chip.icon ? (
        <MaterialCommunityIcons name={chip.icon} size={11} color={accent} />
      ) : null}
      <Text style={[st.chipT, { color: accent }]} numberOfLines={1}>{chip.label}</Text>
      {clearable ? (
        <TouchableOpacity
          onPress={() => onClear(chip)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${chip.label} filter hataao`}
        >
          <MaterialCommunityIcons name="close-circle" size={15} color={accent} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function ActiveFiltersSummary({
  groupBy,
  pickReadyFilter,
  rescheduleDateFilter,
  subGroupBy,
  groupStack,
  priorityFilter,
  entityFilters,
  compact,
  onClearChip,
  onClearGroup,
}) {
  const { groupPath, chips } = useMemo(
    () => buildActiveFilterSummary(
      groupBy,
      pickReadyFilter,
      rescheduleDateFilter,
      subGroupBy,
      groupStack,
      priorityFilter,
      entityFilters,
    ),
    [groupBy, pickReadyFilter, rescheduleDateFilter, subGroupBy, groupStack, priorityFilter, entityFilters],
  );

  if (!groupPath && !chips.length) return null;

  return (
    <View style={[st.box, compact && st.boxCompact]}>
      <View style={st.wrap}>
        {groupPath ? (
          <View style={[st.chip, st.groupChip]}>
            <MaterialCommunityIcons name="layers-triple-outline" size={12} color={P} />
            <Text style={st.groupT} numberOfLines={1}>{groupPath}</Text>
            {typeof onClearGroup === 'function' ? (
              <TouchableOpacity
                onPress={onClearGroup}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Group filter hataao"
              >
                <MaterialCommunityIcons name="close-circle" size={15} color={P} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        {chips.map((chip) => (
          <Chip key={chip.id} chip={chip} onClear={onClearChip} />
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  box: {
    backgroundColor: '#FAFAFF',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E9E5FF',
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  boxCompact: { marginTop: 6 },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  groupChip: {
    backgroundColor: '#EDE9FE',
    borderColor: '#DDD6FE',
  },
  groupT: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4C1D95',
    flexShrink: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
  },
  chipImg: { width: 11, height: 11, resizeMode: 'contain' },
  chipT: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
});
