import React, {Component} from 'react';
import {View,StatusBar,Platform,LogBox,AppState,Text,TextInput,PermissionsAndroid} from 'react-native';
import AppNavigator from './AppNavigator';
import NavigationService from './NavigationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PushNotificationIOS from "@react-native-community/push-notification-ios";
import PushNotification from "react-native-push-notification";
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';


global.token = ''
global.userId = ''
global.fcmToken = ''
global.os = ''
global.language = 'English'

PushNotification.createChannel(
  {
    channelId: 'default-channel-id', // Unique channel ID
    channelName: 'Default Channel', // Channel name
    channelDescription: 'A default channel for notifications', // Optional
    soundName: 'default', // Optional
    importance: 4, // 'high' importance
    vibrate: true, // Enable vibration
  },
  (created) => console.log(`createChannel returned '${created}'`)
);

// Must be outside of any component LifeCycle (such as `componentDidMount`).
PushNotification.configure({
  // (optional) Called when Token is generated (iOS and Android)
  onRegister: function (token) {
    console.log("TOKEN:", token);
    global.fcmToken = token.token
    global.os = token.os
  },

  // (required) Called when a remote is received or opened, or local notification is opened
  onNotification: function (notification) {
    console.log("NOTIFICATION:", notification);

    console.log("==== ",notification?.data?.type)

    if(notification.userInteraction==true) {
      if(notification?.data?.type=='promo' || notification?.data?.type=='cart')
      {
        NavigationService.navigate('Cart')
      }
      if(notification?.data?.type=='order')
      {
        NavigationService.navigate('OrderDetails',{from : 'notification',order_id : notification?.data?.order_id})
      }
      if(notification?.data?.type=='wallet')
      {
          NavigationService.navigate('Wallet')
      }
    }
    

    // if(notification.userInteraction==false)
    // {
    //   PushNotification.localNotification({
    //     channelId: 'default-channel-id', // Match the channel ID created above
    //     title: notification.title,
    //     message: notification.message,
    //     playSound: true,
    //     soundName: 'default',
    //     importance: 'high', // Make sure the notification is given high importance
    //     vibrate: true,
    //   });
    // }else{
    //   if(notification.data.type=='promo')
    //   {
    //     this.props.navigation.navigate('Cart')
    //   }
    // }

    // process the notification

    // (required) Called when a remote is received or opened, or local notification is opened
    notification.finish(PushNotificationIOS.FetchResult.NoData);
  },

  // (optional) Called when Registered Action is pressed and invokeApp is false, if true onNotification will be called (Android)
  onAction: function (notification) {
    console.log("ACTION:", notification.action);
    console.log("NOTIFICATION:", notification);

    // process the action
  },

  // (optional) Called when the user fails to register for remote notifications. Typically occurs when APNS is having issues, or the device is a simulator. (iOS)
  onRegistrationError: function(err) {
    console.error(err.message, err);
  },

  // IOS ONLY (optional): default: all - Permissions to register.
  permissions: {
    alert: true,
    badge: true,
    sound: true,
  },

  // Should the initial notification be popped automatically
  // default: true
  popInitialNotification: true,

  /**
   * (optional) default: true
   * - Specified if permissions (ios) and token (android and ios) will requested or not,
   * - if not, you must call PushNotificationsHandler.requestPermissions() later
   * - if you are not using remote notification or do not have Firebase installed, use this:
   *     requestPermissions: Platform.OS === 'ios'
   */
  requestPermissions: true,
});



export default class App extends React.Component {
  constructor() {
    super();
    this.state={
      
    }

  }

   async componentDidMount() {
    if (Platform.OS === "android") {
      try {
          const result = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
          // Handling the result of the permit request
          if (result === RESULTS.GRANTED) {
              console.log('Permissions granted');
          } else {
              console.log('Permissions not granted');
          }
      } catch (error) {
          // Error handling during permission request
          console.error(error);
      }
  }
       var token = await AsyncStorage.getItem("accessToken")
       global.token = token
       console.log("app token== ",global.token)
      
      // var user_id = await AsyncStorage.getItem("userId")
      // global.userId = user_id

      if (Text.defaultProps) {
        Text.defaultProps.allowFontScaling = false;
      } else {
        Text.defaultProps = {};
        Text.defaultProps.allowFontScaling = false;
      }
      
      // Override Text scaling in input fields
      if (TextInput.defaultProps) {
        TextInput.defaultProps.allowFontScaling = false;
      } else {
        TextInput.defaultProps = {};
        TextInput.defaultProps.allowFontScaling = false;
      }
      LogBox.ignoreLogs(['Warning: ...']); // Ignore log notification by message
      LogBox.ignoreAllLogs();//Ignore all log notifications  

  }

    componentWillUnmount() {
      
  }


  render() {
    return (
      <AppNavigator
        ref={navigatorRef => {
          NavigationService.setTopLevelNavigator(navigatorRef);
        }}
      />
    );
  }
}

