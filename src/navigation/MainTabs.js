import React from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LMDDashboard from '../screens/LMDDashboard';
import TrackOrders from '../screens/TrackOrders';
import SettlementList from '../screens/SettlementList';
import FarmerList from '../screens/FarmerList';
import Profile from '../screens/Profile';
import { COLORS } from '../theme/tokens';

const Tab = createBottomTabNavigator();

const BRAND = COLORS.primary;
const MUTED = COLORS.tabInactive;
const BAR_BG = '#F3F0FA';

function TabIcon({ name, focused, label }) {
  return (
    <View style={styles.iconWrap}>
      <View style={styles.iconPill}>
        <MaterialCommunityIcons
          name={name}
          size={22}
          color={focused ? BRAND : MUTED}
        />
      </View>
      <Text style={[styles.label, focused && styles.labelOn]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** No Android ripple / iOS highlight — avoids rounded press “shadow”. */
function TabBarButton(props) {
  return (
    <Pressable
      {...props}
      android_ripple={null}
      style={[props.style, { backgroundColor: 'transparent' }]}
    />
  );
}

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 4);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveBackgroundColor: 'transparent',
        tabBarInactiveBackgroundColor: 'transparent',
        tabBarButton: (props) => <TabBarButton {...props} />,
        tabBarStyle: [
          styles.bar,
          {
            height: 58 + bottomPad,
            paddingBottom: bottomPad,
          },
        ],
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="Home"
        component={LMDDashboard}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} label="Home" />
          ),
        }}
      />
      <Tab.Screen
        name="Orders"
        component={TrackOrders}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'package-variant' : 'package-variant-closed'}
              focused={focused}
              label="Orders"
            />
          ),
        }}
      />
      <Tab.Screen
        name="Cash"
        component={SettlementList}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'cash-multiple' : 'cash'}
              focused={focused}
              label="Cash"
            />
          ),
        }}
      />
      <Tab.Screen
        name="Farmers"
        component={FarmerList}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'account-plus' : 'account-plus-outline'}
              focused={focused}
              label="Farmer"
            />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={Profile}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'account-circle' : 'account-circle-outline'}
              focused={focused}
              label="Profile"
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
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
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 58,
  },
  iconPill: {
    width: 44,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
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
