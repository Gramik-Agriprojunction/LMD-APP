import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Splash from '../screens/Splash';
import Login from '../screens/Login';
import Language from '../screens/Language';
import LMDDashboard from '../screens/LMDDashboard';
import TrackOrders from '../screens/TrackOrders';
import DeliveryDetails from '../screens/DeliveryDetails';
import DeliverToFarmer from '../screens/DeliverToFarmer';
import RescheduleDelivery from '../screens/RescheduleDelivery';
import Survey from '../screens/Survey';
import Profile from '../screens/Profile';
import SettlementList from '../screens/SettlementList';
import CashSettlement from '../screens/CashSettlement';
import SettlementHistory from '../screens/SettlementHistory';
import Earnings from '../screens/Earnings';
import Notifications from '../screens/Notifications';
import OrderOtpVerify from '../screens/OrderOtpVerify';
import PenaltyOrders from '../screens/PenaltyOrders';
import BatchPickupOtp from '../screens/BatchPickupOtp';
import MarkDispute from '../screens/MarkDispute';
import RejectDelivery from '../screens/RejectDelivery';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          // 'fade' avoids the slide-transition elevation shadow that
          // native-stack renders on Android during screen mount.
          animation: 'fade',
          animationDuration: 200,
          contentStyle: { backgroundColor: '#5D3FD3' },
        }}
      >
        <Stack.Screen name="Splash" component={Splash} />
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="Language" component={Language} />
        <Stack.Screen name="LMDDashboard" component={LMDDashboard} />
        <Stack.Screen name="TrackOrders" component={TrackOrders} />
        <Stack.Screen name="DeliveryDetails" component={DeliveryDetails} />
        <Stack.Screen name="DeliverToFarmer" component={DeliverToFarmer} />
        <Stack.Screen name="RescheduleDelivery" component={RescheduleDelivery} />
        <Stack.Screen name="Survey" component={Survey} />
        <Stack.Screen name="Profile" component={Profile} />
        <Stack.Screen name="SettlementList" component={SettlementList} />
        <Stack.Screen name="CashSettlement" component={CashSettlement} />
        <Stack.Screen name="SettlementHistory" component={SettlementHistory} />
        <Stack.Screen name="Earnings" component={Earnings} />
        <Stack.Screen name="Notifications" component={Notifications} />
        <Stack.Screen name="OrderOtpVerify" component={OrderOtpVerify} />
        <Stack.Screen name="PenaltyOrders" component={PenaltyOrders} />
        <Stack.Screen name="BatchPickupOtp" component={BatchPickupOtp} />
        <Stack.Screen name="MarkDispute" component={MarkDispute} />
        <Stack.Screen name="RejectDelivery" component={RejectDelivery} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
