import React, { Component, Fragment } from 'react';
import { View, Image,SafeAreaView, Text,Dimensions,StatusBar,TouchableOpacity,StyleSheet,FlatList} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Animatable from 'react-native-animatable';
import LinearGradient from 'react-native-linear-gradient';
import FastImage from 'react-native-fast-image';


export default class Splash extends React.Component {
  constructor() {
    super();
    this.state={
        
    }

  }

   async componentDidMount() {
    var token = await AsyncStorage.getItem("accessToken")
    var userType = await AsyncStorage.getItem("userType")
    var language = await AsyncStorage.getItem("language")
    global.token = token
    global.userType = userType
    global.language = language
    console.log("splash userType== ",global.userType)
    console.log("splash language== ",global.language)
    setTimeout(() => {
          if(token!=null && token!='' && token!=undefined)
          {
           
              this.props.navigation.replace('LMDDashboard')

          }else{
            this.props.navigation.replace('Login')
          }
     }, 3200);
        
    }

   

  render() {

    return (
        <View style={{flex:1}}>
            <SafeAreaView style={{flex:1,backgroundColor:'#FFF'}}>
              <StatusBar backgroundColor="transparent" translucent barStyle="dark-content" />
                    <View style={{flex:1,backgroundColor:'#FFF',justifyContent:'center'}}>
                       <FastImage
                        style={{height:400,width:400,alignSelf:'center',resizeMode:'contain'}}
                        source={require('./assets/splash.gif')}
                        resizeMode={FastImage.resizeMode.contain}
                      />
                    </View>
             </SafeAreaView>
             <SafeAreaView style={{flex:0, backgroundColor: '#FFF'}}/>
        </View>
    );
  }''
}
