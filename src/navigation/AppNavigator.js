import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { navigationRef, flushPendingNotificationNavigation } from '../utils/notificationNavigation';

import Splash from '../screens/Splash';
import Login from '../screens/Login';
import Language from '../screens/Language';
import MainTabs from './MainTabs';
import OrderFilters from '../screens/OrderFilters';
import DeliveryDetails from '../screens/DeliveryDetails';
import RescheduleDelivery from '../screens/RescheduleDelivery';
import Survey from '../screens/Survey';
import CashSettlement from '../screens/CashSettlement';
import SettlementHistory from '../screens/SettlementHistory';
import SettlementDetail from '../screens/SettlementDetail';
import Earnings from '../screens/Earnings';
import Notifications from '../screens/Notifications';
import OrderOtpVerify from '../screens/OrderOtpVerify';
import PenaltyOrders from '../screens/PenaltyOrders';
import BatchPickupOtp from '../screens/BatchPickupOtp';
import MarkDispute from '../screens/MarkDispute';
import RejectDelivery from '../screens/RejectDelivery';
import SoilOrders from '../screens/SoilOrders';
import SoilOrderDetail from '../screens/SoilOrderDetail';
import CreateSoilOrder from '../screens/CreateSoilOrder';
import SelectFarmer from '../screens/SelectFarmer';
import FarmerList from '../screens/FarmerList';
import FarmerSales from '../screens/FarmerSales';
import AddFarmer from '../screens/AddFarmer';
import AddLand from '../screens/AddLand';
import ChooseLmdPartner from '../screens/ChooseLmdPartner';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={flushPendingNotificationNavigation}
    >
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          animationDuration: 200,
          contentStyle: { backgroundColor: '#F4F6FB' },
        }}
      >
        <Stack.Screen name="Splash" component={Splash} />
        <Stack.Screen name="Login" component={Login} />
        <Stack.Screen name="Language" component={Language} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
        {/* Legacy aliases → same tab roots (deep links / old navigate calls) */}
        <Stack.Screen name="LMDDashboard" component={MainTabs} />
        <Stack.Screen
          name="ChooseLmdPartner"
          component={ChooseLmdPartner}
          options={{ contentStyle: { backgroundColor: '#EBE7F5' } }}
        />
        <Stack.Screen name="OrderFilters" component={OrderFilters} options={{ contentStyle: { backgroundColor: '#EBE7F5' } }} />
        <Stack.Screen name="DeliveryDetails" component={DeliveryDetails} />
        <Stack.Screen name="RescheduleDelivery" component={RescheduleDelivery} />
        <Stack.Screen name="Survey" component={Survey} />
        <Stack.Screen name="CashSettlement" component={CashSettlement} />
        <Stack.Screen name="SettlementHistory" component={SettlementHistory} />
        <Stack.Screen name="SettlementDetail" component={SettlementDetail} options={{ contentStyle: { backgroundColor: '#F4F6FB' } }} />
        <Stack.Screen name="Earnings" component={Earnings} />
        <Stack.Screen name="Notifications" component={Notifications} />
        <Stack.Screen name="OrderOtpVerify" component={OrderOtpVerify} />
        <Stack.Screen name="PenaltyOrders" component={PenaltyOrders} />
        <Stack.Screen name="BatchPickupOtp" component={BatchPickupOtp} />
        <Stack.Screen name="MarkDispute" component={MarkDispute} />
        <Stack.Screen name="RejectDelivery" component={RejectDelivery} />
        <Stack.Screen name="SoilOrders" component={SoilOrders} />
        <Stack.Screen name="SoilOrderDetail" component={SoilOrderDetail} />
        <Stack.Screen name="CreateSoilOrder" component={CreateSoilOrder} options={{ contentStyle: { backgroundColor: '#F4F6FB' } }} />
        <Stack.Screen name="SelectFarmer" component={SelectFarmer} options={{ contentStyle: { backgroundColor: '#F4F6FB' } }} />
        <Stack.Screen name="FarmerList" component={FarmerList} options={{ contentStyle: { backgroundColor: '#5D3FD3' } }} />
        <Stack.Screen name="FarmerSales" component={FarmerSales} options={{ contentStyle: { backgroundColor: '#F4F6FB' } }} />
        <Stack.Screen name="AddFarmer" component={AddFarmer} options={{ contentStyle: { backgroundColor: '#F4F6FB' } }} />
        <Stack.Screen name="AddLand" component={AddLand} options={{ contentStyle: { backgroundColor: '#5D3FD3' } }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
