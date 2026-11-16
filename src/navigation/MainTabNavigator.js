import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LMDDashboard from '../screens/LMDDashboard';
import TrackOrders from '../screens/TrackOrders';
import SettlementList from '../screens/SettlementList';
import Profile from '../screens/Profile';

const Tab = createBottomTabNavigator();
const P = '#5D3FD3';

const TABS = [
  {
    name: 'LMDDashboard',
    label: 'Home',
    component: LMDDashboard,
    icon: 'home-outline',
    iconOn: 'home',
  },
  {
    name: 'TrackOrders',
    label: 'Orders',
    component: TrackOrders,
    icon: 'package-variant-closed',
    iconOn: 'package-variant',
  },
  {
    name: 'SettlementList',
    label: 'Cash',
    component: SettlementList,
    icon: 'cash',
    iconOn: 'cash-multiple',
  },
  {
    name: 'Profile',
    label: 'Profile',
    component: Profile,
    icon: 'account-circle-outline',
    iconOn: 'account-circle',
  },
];

function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <View style={[styles.bar, { paddingBottom: bottomPad }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const tab = TABS.find((t) => t.name === route.name) || TABS[index];
        const { options } = descriptors[route.key];
        const label = tab?.label || options.tabBarLabel || route.name;
        const color = focused ? P : '#94A3B8';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel || label}
            onPress={onPress}
            activeOpacity={0.85}
            style={styles.item}
          >
            <View style={[styles.iconWrap, focused && styles.iconWrapOn]}>
              <MaterialCommunityIcons
                name={focused ? tab.iconOn : tab.icon}
                size={22}
                color={color}
              />
            </View>
            <Text style={[styles.label, focused && styles.labelOn]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
      }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{ tabBarLabel: tab.label }}
        />
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 10 },
    }),
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  iconWrap: {
    width: 40,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapOn: {
    backgroundColor: '#EDE9FE',
  },
  label: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  labelOn: {
    color: P,
    fontWeight: '700',
  },
});
