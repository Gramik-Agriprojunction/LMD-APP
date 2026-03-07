import React from 'react';
import { View, Text, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'react-native-animatable';

export default class Splash extends React.Component {
  async componentDidMount() {
    const token = await AsyncStorage.getItem('accessToken');

    setTimeout(() => {
      console.log("==",token)
      if (token) {
        this.props.navigation.replace('RetailerDashboard');
      } else {
        this.props.navigation.replace('Login');
      }
    }, 800);
  }

  render() {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F7451', alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar barStyle="light-content" backgroundColor="#0F7451" />
        <Image style={{height:150,width:150,resizeMode:'contain'}} source={require('./assets/logo.png')} />
        <Text style={{ fontSize: 34, fontWeight: '900', color: '#FFFFFF' }}>Gramik</Text>
        <Text style={{ marginTop: 10, fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)' }}>
          Retailer App
        </Text>
      </View>
    );
  }
}