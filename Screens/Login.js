import React, { Component, Fragment } from 'react';
import { View, Image,SafeAreaView, Text,Dimensions,KeyboardAvoidingView,PermissionsAndroid,StatusBar,StyleSheet,TouchableOpacity,TextInput,Keyboard,ScrollView,ActivityIndicator, Platform} from 'react-native';
import { StackActions, NavigationActions } from 'react-navigation';
import constants from './constants'
import Toast from 'react-native-simple-toast';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Animatable from 'react-native-animatable';
import BottomSheet from '@gorhom/bottom-sheet';
import OTPInputView from '@twotalltotems/react-native-otp-input'
import FastImage from 'react-native-fast-image';
import languages from './languages';
// import RNSmsRetriever from "react-native-sms-retriever";

import PushNotificationIOS from "@react-native-community/push-notification-ios";
import PushNotification from "react-native-push-notification";
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

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

PushNotification.configure({
  onRegister: function (token) {
    console.log("TOKEN:", token);
    global.fcmToken = token.token
    global.os = token.os
  },

});

const DashboardResetAction = StackActions.reset({
  index: 0,                       
  actions: [NavigationActions.navigate({ routeName: 'RetailerDashboard'})],
});


export default class Login extends React.Component {
  constructor() {
    super();
    this.state={
      mobile : '',
      peer : '',
      show_peer:'',
      isLoading : false,
      show_otp : false,
      otp : '',
      show_name : false,
      name : '',
      isLoadingOtp : false,
      is_registered : false,
      referral_code : '',
      shop_added : false
    }

  }

   async componentDidMount() {
    this.setState({referral_code : this.props.navigation.getParam('referral_code')},()=>{
     console.log("code== ",this.state.referral_code)
    })
    }

    componentWillUnmount() {
    
  }

    loginApi(type){
              var formData = new FormData()
              formData.append("mobile",this.state.mobile);
              formData.append("type",type);
              formData.append("referral_code",this.state.referral_code==undefined ? '' : this.state.referral_code);

              console.log("login formdata== ",formData)
              this.setState({isLoading:true})
              fetch(constants.login,{
                headers: {
                  'X-localization': 'en',
                },
                method:"POST",
                body:formData
              })
              .then((response)=>response.json())
              .then((responseJson)=>{
                this.setState({isLoading:false})
                console.log("login response== ",responseJson)
                Toast.show(responseJson.message, Toast.SHORT);
                if(responseJson.status)
                {
                  this.setState({is_registered : responseJson.is_registered})
                  if(type)
                  {
                    this.setState({show_otp : true})
                  }else{
                    // Keyboard.dismiss()

                   setTimeout(()=>{
                          this.props.navigation.dispatch(DashboardResetAction)
                        },150)
                    

         
                  }
                }
              })
              .catch((error)=>{
                this.setState({isLoading:false})
                console.log("login error== ",error)
              })
    } 

    verifyOtp(){
        // if(this.state.otp.length<5)
        // {
        //   Toast.show("Enter OTP", Toast.SHORT);
        // }else{
          var formData = new FormData()
          formData.append("mobile",this.state.mobile);
          formData.append("otp",this.state.otp);
          formData.append("fcm",global.fcmToken);
          formData.append("os",global.os);

          console.log("verify formdata== ",formData)
          this.setState({isLoadingOtp:true})
          fetch(constants.verifyOtp,{
            headers: {
              'X-localization': 'en',
            },
            method:"POST",
            body:formData
          })
          .then((response)=>response.json())
          .then((responseJson)=>{
            this.setState({isLoadingOtp:false})
            console.log("verify response== ",responseJson)
            Toast.show(responseJson.message, Toast.SHORT);
            if(responseJson.status)
            {
              this.setState({show_otp : false,shop_added : responseJson.shop_added},()=>{
                global.token = responseJson.token
                global.userType = responseJson.user_type
                this._storeData(responseJson);
                if(this.state.is_registered)
                {
                  Keyboard.dismiss()
                   this.props.navigation.dispatch(DashboardResetAction)
                }else{
                  this.setState({show_name : true})
                }
              }) 
              
            }
          })
          .catch((error)=>{
            this.setState({isLoadingOtp:false})
            console.log("verify error== ",error)
          })
        // }
    } 

    _storeData = async (response) => { 
      try {        
          await AsyncStorage.setItem("accessToken", response?.token)
          await AsyncStorage.setItem("userType", response?.user_type)
          await AsyncStorage.setItem("referral_code", response?.referral_code?.toString())
      } catch (error) {
        console.warn("otp store data error== " + error);
      }
    };

  onLogin()
  {
   
    // if(this.state.mobile=='')
    // {
    //   Toast.show("Enter Mobile Number", Toast.SHORT);
    // }
    // else{
    //   this.loginApi(true)
    //   // Keyboard.dismiss()
    // }
    this.loginApi(true)
  }

  onContinue()
  {
    Keyboard.dismiss()
    this.loginApi(false)
  }


  render() {

    return (
      <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{flex: 1,backgroundColor:'#FFF'}}>
        <View style={{flex:1,backgroundColor:'#FFF'}}>
              <StatusBar backgroundColor="transparent" translucent={true} barStyle="dark-content" />
                <TouchableOpacity activeOpacity={1} onPress={()=> Keyboard.dismiss()} style={{flex:1,backgroundColor:'#FFF',padding:20,justifyContent:'center'}}> 
                {!this.state.show_name && <View style={{flex:1}}>
                  <Image style={{height:110,width:110,alignSelf:'center',resizeMode:'contain',marginTop:80,borderRadius:10}} source={require('./assets/logo.png')}></Image>
                    <Text style={{color:'#36454F',fontFamily:'Poppins-Bold',fontWeight:'bold',fontSize:20,marginTop:30,textAlign:'left'}}>{global.language == 'English' ? languages.english.wht : languages.hindi.wht}</Text>
                      <View style={{height:50,flexDirection:'row',width:'100%',alignSelf:'center',marginTop:20,borderRadius:5,backgroundColor:'#E8E4E4'}}>
                      <TextInput
                                        autoCapitalize="none"
                                        placeholder={global.language == 'English' ? languages.english.mob : languages.hindi.mob} 
                                        keyboardType='numeric'
                                        placeholderTextColor="#8B8688" 
                                        style={{paddingLeft:15,paddingRight:15,flex:1,textAlign:'left',color:'#000',fontFamily:'Poppins'}}
                                        multiline={false}
                                        maxLength={10}
                                        textSize={16}
                                        onChangeText={(text) => this.setState({mobile : text})}
                                        value={this.state.mobile}
                                        />   
                                   
                                      
                      </View> 
                      {/* <View style={{flexDirection:'row',justifyContent:'flex-end',marginTop:20}}>
                       {this.state.show_peer && <TextInput
                                        autoCapitalize="none"
                                        placeholder={'Enter Peer Code'}
                                        placeholderTextColor="#8B8688" 
                                        style={{paddingLeft:10,paddingRight:10,height:40,flex:1,borderRadius:5,borderWidth:1,fontSize:12,borderColor:'#E5E4E2',textAlign:'left',color:'#000',fontFamily:'Poppins'}}
                                        multiline={false}
                                        textSize={16}
                                        onChangeText={(text) => this.setState({peer : text})}
                                        value={this.state.peer}
                                        />  }
                                        
                            <TouchableOpacity onPress={()=> this.setState({show_peer : !this.state.show_peer})} style={{padding:10,justifyContent:'center',alignSelf:'flex-end',marginTop: !this.state.show_peer ? -20 : 0,alignSelf:'center'}}>
                               <Text style={{color:'#36454F',fontFamily:'Poppins-Bold',fontSize:12,alignSelf:'center'}}>Have a peer code?</Text>
                            </TouchableOpacity>            
                        </View>  */}
                        <Text style={{color:'#8B8688',fontFamily:'Poppins',fontSize:12,marginTop:10}}>{global.language == 'English' ? languages.english.mt : languages.hindi.mt}</Text>   
                 
                  <TouchableOpacity onPress={()=> this.onLogin()} style={{height:45,width:'100%',backgroundColor:'#0B6B47',borderRadius:10,alignSelf:'center',marginTop:30,justifyContent:'center'}}>
                           {!this.state.isLoading && <Text style={{color:'#FFF',fontFamily:'Poppins',alignSelf:'center',fontSize:14}}>{global.language == 'English' ? languages.english.sn : languages.hindi.sn}</Text> }
                           {this.state.isLoading &&
                                <ActivityIndicator style={{alignSelf:'center'}} size="small" color="#FFF" />
                            }
                        </TouchableOpacity>  
                        {/* <TouchableOpacity onPress={()=> this.props.navigation.dispatch(RetailerResetAction)} style={{alignSelf:'center'}}>
                          <Text style={{color:'#36454F',fontFamily:'Poppins-Bold',fontSize:13,marginTop:30,textAlign:'left'}}>{global.language == 'English' ? languages.english.guest : languages.hindi.guest}</Text>
                      </TouchableOpacity>        */}
                  </View>  } 

                
 

                  {this.state.show_name && <View style={{flex:1}}>
                  <Image  style={{height:80,width:80,alignSelf:'center',resizeMode:'contain',marginTop:100}} source={require('./assets/lgnew.png')}></Image>
                    <Text style={{color:'#36454F',fontFamily:'Poppins-Bold',fontWeight:'bold',fontSize:20,marginTop:30,textAlign:'left'}}>{global.language == 'English' ? languages.english.wyn : languages.hindi.wyn}</Text>
                      <View style={{height:50,flexDirection:'row',width:'100%',alignSelf:'center',marginTop:20,borderRadius:5,backgroundColor:'#E8E4E4'}}>
                      <TextInput
                                        autoCapitalize='sentences'
                                        placeholder={global.language == 'English' ? languages.english.ename : languages.hindi.ename}
                                        placeholderTextColor="#8B8688" 
                                        style={{paddingLeft:15,paddingRight:15,flex:1,textAlign:'left',color:'#000',fontFamily:'Poppins'}}
                                        multiline={false}
                                        textSize={16}
                                        onChangeText={(text) => this.setState({name : text})}
                                        value={this.state.name}
                                        />  
                                   
                                      
                      </View> 

                      {/* <Text style={{color:'#36454F',fontFamily:'Poppins-Bold',fontWeight:'bold',fontSize:20,marginTop:20,textAlign:'left'}}>{global.language == 'English' ? languages.english.refc : languages.hindi.refc}</Text>
                      <View style={{height:50,flexDirection:'row',width:'100%',alignSelf:'center',marginTop:20,borderRadius:5,backgroundColor:'#E8E4E4'}}>
                      <TextInput
                                        
                                        autoCapitalize='none'
                                        placeholder={global.language == 'English' ? languages.english.refc : languages.hindi.refc}
                                        placeholderTextColor="#8B8688" 
                                        style={{paddingLeft:15,paddingRight:15,flex:1,textAlign:'left',color:'#000',fontFamily:'Poppins'}}
                                        multiline={false}
                                        textSize={16}
                                        onChangeText={(text) => this.setState({referral_code : text})}
                                        value={this.state.referral_code}
                                        />  
                                   
                                      
                      </View>  */}
                 
                 <Animatable.View animation="slideInLeft" iterationCount={1} duration={1000} >
                  <TouchableOpacity onPress={()=> this.onContinue()} style={{height:45,width:200,backgroundColor:'#F37A20',borderRadius:10,alignSelf:'center',marginTop:20,justifyContent:'center'}}>
                           {!this.state.isLoading && <Text style={{color:'#FFF',fontFamily:'Poppins',alignSelf:'center',fontSize:14}}>{global.language == 'English' ? languages.english.cnt : languages.hindi.cnt}</Text> }
                           {this.state.isLoading &&
                                <ActivityIndicator style={{alignSelf:'center'}} size="small" color="#FFF" />
                            }
                        </TouchableOpacity>         
                        </Animatable.View> 
                  </View>  } 

                {this.state.show_otp && <BottomSheet
                  visible={this.state.show_otp}
                  onSheetClose={() => this.setState({show_otp: false})}
                  snapPoints={[330, 330]}
                  style={{
                    backgroundColor: 'white', // <==== HERE
                    borderRadius: 24,
                    shadowColor: '#000000',
                    shadowOffset: {
                      width: 0,
                      height: 8,
                    },
                    shadowOpacity: 0.1,
                    shadowRadius: 24,
                    elevation: 30,
                  }}
                  backgroundStyle={{backgroundColor: '#FFF', borderRadius: 24}}
                  enablePanDownToClose={true}
                  animateOnMount={true}
                  backdropComponent={({style}) => (
                    <View
                      style={[style, {backgroundColor: 'rgba(0, 0, 0, 0.5)'}]}
                    />
                  )}
                  onChange={status =>
                    status == -1 ? this.setState({show_otp: false}) : ''
                  }>
                    
                  <View style={{padding: 20, paddingTop: 20, flex: 1}}>
                    <View style={{flex: 1}}>
                        <Text style={{color:'#36454F',fontSize:18,alignSelf:'center',fontFamily:'Poppins-Bold',textAlign:'center',lineHeight:25}}>{global.language == 'English' ? languages.english.sn2 : languages.hindi.sn2}{'\n'}+91 - {this.state.mobile}</Text>
                        <OTPInputView
                      style={{width: '90%', height: 100,alignSelf:'center',color:'#000',marginTop:10}}
                      pinCount={5}
                      // code={this.state.code} //You can supply this prop or not. The component will be used as a controlled / uncontrolled component respectively.
                      // onCodeChanged = {code => { this.setState({code})}}
                      autoFocusOnLoad={false} 
                      codeInputFieldStyle={styles.underlineStyleBase}
                      codeInputHighlightStyle={styles.underlineStyleHighLighted}
                      onCodeFilled = {(code => {
                          console.log(`Code is ${code}, you are good to go!`)
                          this.setState({otp : code})
                      })}
                  />
                    <View style={{flexDirection:'row',alignSelf:'center'}}>
                      <Text style={{color:'#8B8688',fontFamily:'Poppins',fontSize:12}}>{global.language == 'English' ? languages.english.rc : languages.hindi.rc}  </Text>   
                      <TouchableOpacity onPress={()=> this.loginApi(true)} style={{justifyContent:'center',marginTop:Platform.OS=='android' ? -4 : 0}}>
                          <Text style={{color:'#F37A20',fontFamily:'Poppins-Bold',fontWeight:'bold',fontSize:12,alignSelf:'center'}}>{global.language == 'English' ? languages.english.ro : languages.hindi.ro}</Text>       
                      </TouchableOpacity>
                    </View>

                  <TouchableOpacity onPress={()=> this.verifyOtp()} style={{height:45,width:200,backgroundColor:'#0B6B47',borderRadius:30,alignSelf:'center',marginTop:30,justifyContent:'center'}}>
                           {!this.state.isLoadingOtp && <Text style={{color:'#FFF',fontFamily:'Poppins',alignSelf:'center',fontSize:14}}>{global.language == 'English' ? languages.english.vo : languages.hindi.vo}</Text> }
                           {this.state.isLoadingOtp &&
                                <ActivityIndicator style={{alignSelf:'center'}} size="small" color="#FFF" />
                           }
                        </TouchableOpacity>         

                    </View>
                  </View>
            </BottomSheet> }

            {/* {this.state.show_name && <BottomSheet
                  visible={this.state.show_name}
                  onSheetClose={() => this.setState({show_name: false})}
                  snapPoints={[250, 250]}
                  style={{
                    backgroundColor: 'white', // <==== HERE
                    borderRadius: 24,
                    shadowColor: '#000000',
                    shadowOffset: {
                      width: 0,
                      height: 8,
                    },
                    shadowOpacity: 0.1,
                    shadowRadius: 24,
                    elevation: 30,
                  }}
                  backgroundStyle={{backgroundColor: '#FFF', borderRadius: 24}}
                  enablePanDownToClose={true}
                  animateOnMount={true}
                  backdropComponent={({style}) => (
                    <View
                      style={[style, {backgroundColor: 'rgba(0, 0, 0, 0.5)'}]}
                    />
                  )}
                  // onChange={status =>
                  //   status == -1 ? this.setState({show_name: false}) : ''
                  // }
                  >
                    
                  <View style={{padding: 20, paddingTop: 10, flex: 1}}>
                    <View style={{flex: 1}}>
                        <Text style={{color:'#6E260E',fontSize:18,alignSelf:'center',fontFamily:'Poppins-Bold',textAlign:'center',lineHeight:25}}>What's your name?</Text>
                        <View style={{height:50,flexDirection:'row',width:'100%',alignSelf:'center',marginTop:40,borderRadius:5,backgroundColor:'#E8E4E4'}}>
                      <TextInput
                                        autoCapitalize="none"
                                        placeholder={'Enter Name'}
                                        placeholderTextColor="#8B8688" 
                                        style={{paddingLeft:15,paddingRight:15,flex:1,textAlign:'left',color:'#000'}}
                                        multiline={false}
                                        textSize={16}
                                        onChangeText={(text) => this.setState({name : text})}
                                        value={this.state.name}
                                        />  
                      </View> 
                    <Animatable.View animation="slideInLeft" iterationCount={1} duration={1000} >
                    <TouchableOpacity onPress={()=> this.onContinue()} style={{height:45,width:200,backgroundColor:'#6E260E',borderRadius:30,alignSelf:'center',marginTop:30,justifyContent:'center'}}>
                           {!this.state.isLoading && <Text style={{color:'#FFF',fontFamily:'Poppins',alignSelf:'center',fontSize:14}}>Continue</Text> }
                           {this.state.isLoading &&
                                <ActivityIndicator style={{alignSelf:'center'}} size="small" color="#FFF" />
                           }
                        </TouchableOpacity>         
                        </Animatable.View> 

                    </View>
                  </View>
            </BottomSheet> } */}
                  
                </TouchableOpacity>
                <SafeAreaView style={{flex:0, backgroundColor: '#FFF'}}/>
        </View>
        </KeyboardAvoidingView>
    );
  }
}

const styles = StyleSheet.create({
  borderStyleBase: {
    width: 30,
    height: 45,
  },

  borderStyleHighLighted: {
    borderColor: "#6E260E",
  },

  underlineStyleBase: {
    width: 50,
    height: 50,
    backgroundColor:'#E8E4E4',
    borderRadius:5,
    color:'#000',
    fontSize:20
  },

  underlineStyleHighLighted: {
    borderColor: "#F37A20",
  },
});