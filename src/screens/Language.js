import React from 'react';
import { View, Image, Text, StatusBar, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { safeBottomEdges } from '../utils/safeAreaInsets';
import AsyncStorage from '@react-native-async-storage/async-storage';
import constants from '../utils/constants';
import Toast from 'react-native-simple-toast';
import languages from '../utils/languages';
import { withV4Navigation } from '../utils/v4Compat';


class Language extends React.Component {
  constructor() {
    super();
    this.state={

    }

  }

   async componentDidMount() {
        
    }

   

    languageApi(lang){
      const body = { language: lang };
      console.log("Language API payload== ", body)

      fetch(constants.language,{
        headers: {
          'X-localization': 'en',
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer ' + global.token,
        },
        method:"POST",
        body: JSON.stringify(body)
      })
      .then((response)=>response.json())
      .then((responseJson)=>{
        console.log("Language API response== ",responseJson)
        Toast.show(responseJson.message, Toast.SHORT); 
        if(responseJson.status)
        {
          global.language = lang;
        }
      })
      .catch((error)=>{
        console.log("Language API error== ",error)
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
                            <TouchableOpacity onPress={()=> this.props.navigation.goBack()} style={{width:40,height:40,borderRadius:20,backgroundColor:'rgba(0,0,0,0.06)',alignItems:'center',justifyContent:'center',marginLeft:4,marginRight:6}}>
                                <Image style={{width:17,height:17,resizeMode:'contain',tintColor:'#0F172A'}} source={require('./assets/back.png')}></Image>
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

             <SafeAreaView edges={safeBottomEdges()} style={{flex:0, backgroundColor: '#FFF'}}/>

        </View>
    );
  }
}

export default withV4Navigation(Language);


