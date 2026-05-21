/**
 * @format
 */

import './src/utils/metroLog';
import './src/utils/apiLogger';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
