import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/tokens';
import { goTab } from '../utils/tabNav';

const BRAND = COLORS.primary;
const MUTED = COLORS.tabInactive;
const BAR_BG = '#F3F0FA';

export const MAIN_TAB_BAR_CORE_HEIGHT = 58;

const TABS = [
  { key: 'Home', label: 'Home', icon: 'home-outline', iconOn: 'home' },
  { key: 'Orders', label: 'Orders', icon: 'package-variant-closed', iconOn: 'package-variant' },
  { key: 'Cash', label: 'Cash', icon: 'cash', iconOn: 'cash-multiple' },
  { key: 'Farmers', label: 'Farmer', icon: 'account-plus-outline', iconOn: 'account-plus' },
  { key: 'Profile', label: 'Profile', icon: 'account-circle-outline', iconOn: 'account-circle' },
];

function TabItem({ name, label, focused }) {
  return (
    <View style={styles.iconWrap}>
      <View style={[styles.iconPill, focused && styles.iconPillOn]}>
        <MaterialCommunityIcons name={name} size={22} color={focused ? BRAND : MUTED} />
      </View>
      <Text style={[styles.label, focused && styles.labelOn]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function useMainTabBarHeight() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 4);
  return MAIN_TAB_BAR_CORE_HEIGHT + bottomPad;
}

export default function MainTabBar({ navigation, activeTab = null }) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 4);
  const barHeight = MAIN_TAB_BAR_CORE_HEIGHT + bottomPad;

  return (
    <View style={[styles.bar, { height: barHeight, paddingBottom: bottomPad }]}>
      {TABS.map((tab) => {
        const focused = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabHit}
            activeOpacity={0.75}
            onPress={() => goTab(navigation, tab.key)}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
          >
            <TabItem
              name={focused ? tab.iconOn : tab.icon}
              label={tab.label}
              focused={focused}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    backgroundColor: BAR_BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E5F0',
    paddingTop: 8,
    elevation: 10,
    shadowColor: '#1A1F3A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
  },
  tabHit: {
    flex: 1,
    alignItems: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 58,
  },
  iconPill: {
    width: 44,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillOn: {
    backgroundColor: '#EDE9FE',
  },
  label: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.15,
  },
  labelOn: {
    color: BRAND,
    fontWeight: '700',
  },
});