import { createAppContainer } from 'react-navigation';
import { createStackNavigator } from 'react-navigation-stack';

import Splash from './Screens/Splash.js';
import Login from './Screens/Login.js';

// ✅ NEW Retailer Screens
import RetailerDashboard from './Screens/RetailerDashboard';
import InventoryScreen from './Screens/InventoryScreen';
import CounterSaleScreen from './Screens/CounterSaleScreen';
import PaymentsScreen from './Screens/PaymentsScreen';
import LedgerScreen from './Screens/LedgerScreen';
import Profile from './Screens/Profile'
import OrderDetails from './Screens/OrderDetails.js';

const RootStack = createStackNavigator(
  {
    Splash: { screen: Splash, navigationOptions: { headerShown: false } },
    Login: { screen: Login, navigationOptions: { headerShown: false } },

    // Retailer Flow
    RetailerDashboard: { screen: RetailerDashboard, navigationOptions: { headerShown: false } },
    InventoryScreen: { screen: InventoryScreen, navigationOptions: { headerShown: false } },
    CounterSaleScreen: { screen: CounterSaleScreen, navigationOptions: { headerShown: false } },
    PaymentsScreen: { screen: PaymentsScreen, navigationOptions: { headerShown: false } },
    LedgerScreen: { screen: LedgerScreen, navigationOptions: { headerShown: false } },
    Profile: { screen: Profile, navigationOptions: { headerShown: false } },
    OrderDetails: { screen: OrderDetails, navigationOptions: { headerShown: false } },
  },
  {
    initialRouteName: 'Splash', 
  }
);

export default createAppContainer(RootStack);