import { createAppContainer } from 'react-navigation';
import { createStackNavigator } from 'react-navigation-stack';

import Splash from './Screens/Splash.js';
import Login from './Screens/Login.js';

import LMDDashboard from './Screens/LMDDashboard.js';
import TrackOrders from './Screens/TrackOrders.js';
import DeliveryDetails from './Screens/DeliveryDetails.js';
import DeliverToFarmer from './Screens/DeliverToFarmer.js';
import RescheduleDelivery from './Screens/RescheduleDelivery.js';
import Earnings from './Screens/Earnings.js';
import Profile from './Screens/Profile.js';
import SettlementHistory from './Screens/SettlementHistory.js';
import CashSettlement from './Screens/CashSettlement.js';
import SettlementList from './Screens/SettlementList.js';
import Survey from './Screens/Survey.js';

const RootStack = createStackNavigator(
  {
    Splash: { screen: Splash, navigationOptions: { headerShown: false } },
    Login: { screen: Login, navigationOptions: { headerShown: false } },

    // LMD Investor Demo Screens
    LMDDashboard: { screen: LMDDashboard, navigationOptions: { headerShown: false } },
    TrackOrders: { screen: TrackOrders, navigationOptions: { headerShown: false } },
    DeliveryDetails: { screen: DeliveryDetails, navigationOptions: { headerShown: false } },
    DeliverToFarmer: { screen: DeliverToFarmer, navigationOptions: { headerShown: false } },
    RescheduleDelivery: { screen: RescheduleDelivery, navigationOptions: { headerShown: false } },

    Earnings: { screen: Earnings, navigationOptions: { headerShown: false } },
    Profile: { screen: Profile, navigationOptions: { headerShown: false } },
    SettlementHistory: { screen: SettlementHistory, navigationOptions: { headerShown: false } },
    CashSettlement: { screen: CashSettlement, navigationOptions: { headerShown: false } },
    SettlementList: { screen: SettlementList, navigationOptions: { headerShown: false } },
    Survey: { screen: Survey, navigationOptions: { headerShown: false }},
  },
  {
    initialRouteName: 'Splash', 
  }
);

const AppNavigator = createAppContainer(RootStack);
export default AppNavigator;