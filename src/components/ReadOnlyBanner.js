import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { isReadOnly, getViewPartnerName } from '../utils/lmdViewMode';

export default function ReadOnlyBanner({ navigation }) {
  if (!isReadOnly()) return null;
  return (
    <View style={s.wrap}>
      <MaterialCommunityIcons name="eye-outline" size={18} color="#92400E" />
      <Text style={s.text} numberOfLines={1}>
        View only — <Text style={s.bold}>{getViewPartnerName() || 'LMD'}</Text>
      </Text>
      <TouchableOpacity onPress={() => navigation.navigate('ChooseLmdPartner')} style={s.btn} activeOpacity={0.8}>
        <Text style={s.btnText}>Change LMD</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderColor: '#FCD34D', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 14, marginTop: 10 },
  text: { flex: 1, marginLeft: 8, color: '#92400E', fontSize: 13, fontWeight: '600' },
  bold: { fontWeight: '900' },
  btn: { backgroundColor: '#92400E', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginLeft: 8 },
  btnText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
});
