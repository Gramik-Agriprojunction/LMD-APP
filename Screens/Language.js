import React, { Component, Fragment } from 'react';
import { View, Image,SafeAreaView, Text,Dimensions,StatusBar,TouchableOpacity,TextInput,StyleSheet,FlatList, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Animatable from 'react-native-animatable';
import { SliderBox } from "react-native-image-slider-box";
import { Rating, AirbnbRating } from 'react-native-ratings';
import { ScrollView } from 'react-native-gesture-handler';
import * as Progress from 'react-native-progress';
import constants from './constants'
import Toast from 'react-native-simple-toast';
import languages from './languages';


export default class Language extends React.Component {
  constructor() {
    super();
    this.state={

    }

  }

   async componentDidMount() {
        
    }

   

    languageApi(lang){
      var formData = new FormData()
      formData.append("language",lang);
      console.log("wishlist formdata== ",formData)

      fetch(constants.language,{
        headers: {
          'X-localization': 'en',
          Authorization: 'Bearer ' + global.token,
        },
        method:"POST",
        body:formData
      })
      .then((response)=>response.json())
      .then((responseJson)=>{
        console.log("language response== ",responseJson)
        Toast.show(responseJson.message, Toast.SHORT); 
        if(responseJson.status)
        {
          global.language = lang;
        }
      })
      .catch((error)=>{
        console.log("launguage error== ",error)
      })
} 
   async storeLang(lang) {
     try {
       await AsyncStorage.setItem('language', lang);
     } catch (error) {}
     global.language = lang;
     this.setState({});
     this.props.navigation.goBack();
   };

  render() {
    return (
        <View style={{flex:1}}>
              <StatusBar backgroundColor="#FFF" translucent barStyle="dark-content" />
              <View style={{flex:1,backgroundColor:'#FFF'}}>
              <View style={{width:'100%',paddingTop:Platform.OS=='android' ? 30:45,backgroundColor:'#FFF'}}>
                    <View style={{flexDirection:'row',justifyContent:'space-between',backgroundColor:'#FFF'}}>
                       <View style={{flexDirection:'row'}}>
                            <TouchableOpacity onPress={()=> this.props.navigation.goBack()} style={{padding:15,paddingRight:10,justifyContent:'center'}}>
                                <Image style={{width:25,height:25,alignSelf:'center',resizeMode:'contain',tintColor:'#000'}} source={require('./assets/back.png')}></Image>
                            </TouchableOpacity>
                            <Text style={{color:'#000',fontFamily:'Poppins-Bold',fontSize:14,alignSelf:'center'}}>{global.language == 'English' ? languages.english.lang : languages.hindi.lang}</Text>
                       </View>
                    </View>
                </View>  

               <View style={{flex:1}}>
               <Image style={{width:70,height:70,alignSelf:'center',resizeMode:'contain',marginTop:80}} source={require('./assets/lang.png')}></Image>
               <Text style={{color:'#36454F',fontFamily:'Poppins-Bold',fontWeight:'bold',fontSize:20,alignSelf:'center',marginTop:40}}>{global.language == 'English' ? languages.english.lang2 : languages.hindi.lang2}</Text>
                    <TouchableOpacity onPress={()=> {this.languageApi('English'),this.storeLang('English')}} style={{height:45,width:200,borderRadius:10,justifyContent:'center',backgroundColor:'#F68A20',alignSelf:'center',marginTop:30}}>
                         <Text style={{color:'#FFF',fontFamily:'Poppins',fontSize:13,alignSelf:'center'}}>English</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={()=> {this.languageApi('Hindi'),this.storeLang('Hindi')}} style={{height:45,width:200,borderRadius:10,justifyContent:'center',backgroundColor:'#0F7451',alignSelf:'center',marginTop:20}}>
                         <Text style={{color:'#FFF',fontFamily:'Poppins',fontSize:13,alignSelf:'center',marginTop:5}}>हिंदी</Text>
                    </TouchableOpacity>
               </View> 
                
            </View>

             <SafeAreaView style={{flex:0, backgroundColor: '#FFF'}}/>

        </View>
    );
  }
}

