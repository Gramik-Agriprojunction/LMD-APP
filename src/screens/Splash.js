import React from 'react';
import { View, SafeAreaView, StatusBar, Animated, Dimensions, StyleSheet, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withV4Navigation } from '../utils/v4Compat';

const BG = '#5D3FD3';
const { width, height } = Dimensions.get('window');

class Splash extends React.Component {
  constructor() {
    super();
    this.state = {};
    this.sceneOp = new Animated.Value(0);
    this.roadDash = new Animated.Value(0);
    this.truckX = new Animated.Value(-160);
    this.truckBounce = new Animated.Value(0);
    this.wheelRotate = new Animated.Value(0);
    this.dust = Array(5).fill(0).map(() => ({
      x: new Animated.Value(0), y: new Animated.Value(0),
      opacity: new Animated.Value(0), scale: new Animated.Value(0.5),
    }));
    this.clouds = [new Animated.Value(width + 20), new Animated.Value(width * 0.6), new Animated.Value(width + 80)];
    this.treesX = new Animated.Value(0);
    this.titleOp = new Animated.Value(0);
    this.titleY = new Animated.Value(25);
    this.subOp = new Animated.Value(0);
    this.dots = Array(3).fill(0).map(() => new Animated.Value(0));
    this.headlightOp = new Animated.Value(0);
    this.fadeOut = new Animated.Value(1);
  }

  async componentDidMount() {
    Animated.timing(this.sceneOp, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    setTimeout(() => this.scrollRoadDashes(), 200);
    setTimeout(() => this.driftClouds(), 100);
    setTimeout(() => this.scrollTrees(), 200);
    setTimeout(() => {
      Animated.spring(this.truckX, { toValue: width * 0.22, friction: 8, tension: 18, useNativeDriver: true }).start();
      this.spinWheels();
      this.startTruckBounce();
      setTimeout(() => this.emitDust(), 600);
      Animated.timing(this.headlightOp, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    }, 400);
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(this.titleOp, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(this.titleY, { toValue: 0, friction: 6, useNativeDriver: true }),
      ]).start();
    }, 1100);
    setTimeout(() => {
      Animated.timing(this.subOp, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 1500);
    setTimeout(() => this.startDots(), 1700);
    setTimeout(() => {
      Animated.timing(this.truckX, { toValue: width + 60, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true }).start();
    }, 2600);
    setTimeout(() => {
      Animated.timing(this.fadeOut, { toValue: 0, duration: 350, useNativeDriver: true }).start();
    }, 3000);

    var token = await AsyncStorage.getItem('accessToken');
    var userType = await AsyncStorage.getItem('userType');
    var language = await AsyncStorage.getItem('language');
    global.token = token;
    global.userType = userType;
    global.language = language;
    setTimeout(() => {
      if (token != null && token != '' && token != undefined) {
        this.props.navigation.replace('LMDDashboard');
      } else {
        this.props.navigation.replace('Login');
      }
    }, 3400);
  }

  scrollRoadDashes = () => {
    const loop = () => {
      this.roadDash.setValue(0);
      Animated.timing(this.roadDash, { toValue: 1, duration: 500, easing: Easing.linear, useNativeDriver: true }).start(() => loop());
    };
    loop();
  };

  driftClouds = () => {
    const speeds = [12000, 16000, 10000];
    this.clouds.forEach((c, i) => {
      const loop = () => {
        c.setValue(width + 60 + i * 30);
        Animated.timing(c, { toValue: -140, duration: speeds[i], easing: Easing.linear, useNativeDriver: true }).start(() => loop());
      };
      loop();
    });
  };

  scrollTrees = () => {
    const loop = () => {
      this.treesX.setValue(0);
      Animated.timing(this.treesX, { toValue: -240, duration: 2400, easing: Easing.linear, useNativeDriver: true }).start(() => loop());
    };
    loop();
  };

  spinWheels = () => {
    const loop = () => {
      this.wheelRotate.setValue(0);
      Animated.timing(this.wheelRotate, { toValue: 1, duration: 350, easing: Easing.linear, useNativeDriver: true }).start(() => loop());
    };
    loop();
  };

  startTruckBounce = () => {
    const loop = () => {
      Animated.sequence([
        Animated.timing(this.truckBounce, { toValue: -3, duration: 140, useNativeDriver: true }),
        Animated.timing(this.truckBounce, { toValue: 0, duration: 140, useNativeDriver: true }),
        Animated.timing(this.truckBounce, { toValue: -2, duration: 110, useNativeDriver: true }),
        Animated.timing(this.truckBounce, { toValue: 0, duration: 110, useNativeDriver: true }),
        Animated.delay(350),
      ]).start(() => loop());
    };
    loop();
  };

  emitDust = () => {
    this.dust.forEach((d, i) => {
      const loop = () => {
        d.x.setValue(0); d.y.setValue(0); d.opacity.setValue(0); d.scale.setValue(0.4);
        Animated.parallel([
          Animated.timing(d.x, { toValue: -(25 + Math.random() * 35), duration: 500, useNativeDriver: true }),
          Animated.timing(d.y, { toValue: -(3 + Math.random() * 12), duration: 500, useNativeDriver: true }),
          Animated.timing(d.scale, { toValue: 0.8 + Math.random() * 0.6, duration: 500, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(d.opacity, { toValue: 0.45, duration: 120, useNativeDriver: true }),
            Animated.timing(d.opacity, { toValue: 0, duration: 380, useNativeDriver: true }),
          ]),
        ]).start(() => loop());
      };
      setTimeout(loop, i * 100);
    });
  };

  startDots = () => {
    this.dots.forEach((d, i) => {
      const loop = () => {
        d.setValue(0);
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(d, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 280, useNativeDriver: true }),
        ]).start(() => loop());
      };
      loop();
    });
  };

  render() {
    const spin = this.wheelRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    const dashX = this.roadDash.interpolate({ inputRange: [0, 1], outputRange: [0, -60] });

    return (
      <Animated.View style={[$.root, { opacity: this.fadeOut }]}>
        <StatusBar backgroundColor={BG} translucent={false} barStyle="light-content" />
        <Animated.View style={[$.scene, { opacity: this.sceneOp }]}>

          {/* Stars */}
          {[[0.10, 0.18], [0.07, 0.55], [0.16, 0.78], [0.13, 0.40], [0.20, 0.12], [0.24, 0.65], [0.09, 0.88]].map((p, i) => (
            <View key={i} style={[i < 5 ? $.star : $.starBig, { top: height * p[0], left: width * p[1] }]} />
          ))}

          {/* Clouds */}
          {this.clouds.map((cx, i) => (
            <Animated.View key={i} style={[$.cloudWrap, { top: height * 0.12 + i * 45, transform: [{ translateX: cx }] }]}>
              <View style={[$.cloudBase, { width: 55 + i * 12, height: 16 + i * 2, borderRadius: 8 + i }]} />
              <View style={[$.cloudBump, { width: 26 + i * 4, height: 14 + i * 2, top: -(8 + i), left: 10 }]} />
              <View style={[$.cloudBump, { width: 18, height: 10, top: -4, right: 8 }]} />
            </Animated.View>
          ))}

          {/* Brand */}
          <View style={$.brand}>
            <Animated.View style={{ opacity: this.titleOp, transform: [{ translateY: this.titleY }], alignItems: 'center' }}>
              <View style={$.logoWrap}>
                <View style={$.lBoxTop} />
                <View style={$.lBoxBody}><View style={$.lBoxStripe} /></View>
                <View style={$.lPin}><View style={$.lPinDot} /></View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 16 }}>
                <Animated.Text style={$.tLight}>Gramik</Animated.Text>
                <Animated.Text style={$.tBold}> LMD</Animated.Text>
              </View>
            </Animated.View>
            <Animated.Text style={[$.sub, { opacity: this.subOp }]}>Last Mile Delivery</Animated.Text>
            <View style={$.dotsRow}>
              {this.dots.map((d, i) => (
                <Animated.View key={i} style={[$.dot, {
                  opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
                  transform: [{ scale: d.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.3] }) }],
                }]} />
              ))}
            </View>
          </View>

          {/* Road scene */}
          <View style={$.roadScene}>

            {/* Trees */}
            <Animated.View style={[$.treesStrip, { transform: [{ translateX: this.treesX }] }]}>
              {[0, 120, 240, 360, 480, 600].map((x, i) => (
                <View key={i} style={[$.treeGroup, { left: x }]}>
                  <View style={[$.treeCrown, i % 2 === 0 ? { height: 22 } : { height: 16 }]} />
                  <View style={$.treeTrunk} />
                </View>
              ))}
            </Animated.View>

            {/* Road */}
            <View style={$.road}>
              <View style={$.roadEdgeTop} />
              <View style={$.dashClip}>
                <Animated.View style={[$.dashTrack, { transform: [{ translateX: dashX }] }]}>
                  {Array(14).fill(0).map((_, i) => (
                    <View key={i} style={$.dash} />
                  ))}
                </Animated.View>
              </View>
              <View style={$.roadEdgeBot} />
            </View>

            {/* Truck */}
            <Animated.View style={[$.truck, { transform: [{ translateX: this.truckX }, { translateY: this.truckBounce }] }]}>

              {/* Dust */}
              <View style={$.dustAnchor}>
                {this.dust.map((d, i) => (
                  <Animated.View key={i} style={[$.dustDot, {
                    opacity: d.opacity,
                    transform: [{ translateX: d.x }, { translateY: d.y }, { scale: d.scale }],
                  }]} />
                ))}
              </View>

              {/* Headlight glow */}
              <Animated.View style={[$.headGlow, { opacity: this.headlightOp }]} />

              {/* Cargo */}
              <View style={$.cargo}>
                <View style={$.cargoS1} />
                <View style={$.cargoS2} />
                <View style={$.cargoIcon}><View style={$.cargoIconDot} /></View>
              </View>

              {/* Cabin */}
              <View style={$.cabin}>
                <View style={$.cabinRoof} />
                <View style={$.windshield} />
                <View style={$.door}><View style={$.handle} /></View>
              </View>

              {/* Bumper */}
              <View style={$.bumper}>
                <View style={$.headlamp} />
              </View>

              {/* Rear wheel */}
              <Animated.View style={[$.whl, { left: 8 }, { transform: [{ rotate: spin }] }]}>
                <View style={$.hub} />
                <View style={$.spk} />
                <View style={[$.spk, { transform: [{ rotate: '90deg' }] }]} />
              </Animated.View>

              {/* Front wheel */}
              <Animated.View style={[$.whl, { right: 6 }, { transform: [{ rotate: spin }] }]}>
                <View style={$.hub} />
                <View style={$.spk} />
                <View style={[$.spk, { transform: [{ rotate: '90deg' }] }]} />
              </Animated.View>

              {/* Exhaust */}
              <View style={$.exhaust} />
            </Animated.View>
          </View>

        </Animated.View>
        <SafeAreaView style={{ flex: 0, backgroundColor: BG }} />
      </Animated.View>
    );
  }
}

const ROAD_BOTTOM = height * 0.16;
const ROAD_H = 52;
const TRUCK_W = 120;
const TRUCK_H = 55;

const $ = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scene: { flex: 1, backgroundColor: BG },

  star: { position: 'absolute', width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.3)' },
  starBig: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.2)' },

  cloudWrap: { position: 'absolute' },
  cloudBase: { backgroundColor: 'rgba(255,255,255,0.12)' },
  cloudBump: { position: 'absolute', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' },

  brand: { position: 'absolute', top: height * 0.28, left: 0, right: 0, alignItems: 'center' },
  logoWrap: { alignItems: 'center', width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)' },
  lBoxTop: { width: 28, height: 6, backgroundColor: '#FBBF24', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  lBoxBody: { width: 26, height: 18, backgroundColor: '#F59E0B', borderBottomLeftRadius: 3, borderBottomRightRadius: 3, alignItems: 'center', justifyContent: 'center' },
  lBoxStripe: { width: 3, height: 18, backgroundColor: '#D97706', borderRadius: 1 },
  lPin: { width: 11, height: 11, borderRadius: 5.5, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginTop: -4 },
  lPinDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: BG },
  tLight: { fontSize: 30, fontWeight: '300', color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5 },
  tBold: { fontSize: 30, fontWeight: '900', color: '#FFF', letterSpacing: 3 },
  sub: { fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.45)', letterSpacing: 1, marginTop: 8 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 28 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(255,255,255,0.7)', marginHorizontal: 4 },

  roadScene: { position: 'absolute', bottom: ROAD_BOTTOM, left: 0, right: 0, height: 110 },

  treesStrip: { position: 'absolute', bottom: ROAD_H - 2, left: 0, flexDirection: 'row', width: width + 600 },
  treeGroup: { position: 'absolute', alignItems: 'center', bottom: 0 },
  treeCrown: { width: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.08)' },
  treeTrunk: { width: 4, height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 1 },

  road: { position: 'absolute', bottom: 0, left: 0, right: 0, height: ROAD_H, backgroundColor: '#2D2655', justifyContent: 'center' },
  roadEdgeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.12)' },
  roadEdgeBot: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.08)' },
  dashClip: { overflow: 'hidden', height: 3, marginHorizontal: 0 },
  dashTrack: { flexDirection: 'row', width: width + 200 },
  dash: { width: 28, height: 3, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 1.5, marginRight: 32 },

  truck: { position: 'absolute', bottom: ROAD_H - 8, flexDirection: 'row', alignItems: 'flex-end', height: TRUCK_H, width: TRUCK_W },

  dustAnchor: { position: 'absolute', left: -5, bottom: 8 },
  dustDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },

  headGlow: { position: 'absolute', right: -18, bottom: 14, width: 30, height: 18, borderRadius: 10, backgroundColor: 'rgba(251,191,36,0.15)' },

  cargo: { width: 62, height: 38, backgroundColor: '#FBBF24', borderRadius: 4, borderTopRightRadius: 2, overflow: 'hidden', justifyContent: 'center' },
  cargoS1: { position: 'absolute', left: 18, top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(217,119,6,0.3)' },
  cargoS2: { position: 'absolute', left: 38, top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(217,119,6,0.3)' },
  cargoIcon: { width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  cargoIconDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },

  cabin: { width: 32, height: 34, backgroundColor: '#E8E0FF', borderTopLeftRadius: 3, borderTopRightRadius: 10, borderBottomRightRadius: 3, marginLeft: -2, overflow: 'hidden' },
  cabinRoof: { height: 4, backgroundColor: '#5D3FD3' },
  windshield: { width: 20, height: 12, backgroundColor: '#A5B4FC', borderRadius: 2, marginTop: 2, marginLeft: 8, borderWidth: 1, borderColor: 'rgba(93,63,211,0.3)' },
  door: { flex: 1, marginTop: 2, marginHorizontal: 4, backgroundColor: '#D4CCFF', borderRadius: 2, justifyContent: 'center' },
  handle: { width: 6, height: 2, backgroundColor: '#5D3FD3', borderRadius: 1, alignSelf: 'flex-end', marginRight: 4 },

  bumper: { width: 6, height: 10, backgroundColor: '#9CA3AF', borderTopRightRadius: 2, borderBottomRightRadius: 2, marginBottom: 6, marginLeft: -1, justifyContent: 'center', alignItems: 'center' },
  headlamp: { width: 3, height: 4, borderRadius: 1, backgroundColor: '#FDE68A' },

  whl: { position: 'absolute', bottom: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#1E1B4B', borderWidth: 2, borderColor: '#374151', alignItems: 'center', justifyContent: 'center' },
  hub: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6B7280' },
  spk: { position: 'absolute', width: 1, height: 14, backgroundColor: 'rgba(107,114,128,0.4)' },

  exhaust: { position: 'absolute', left: -4, bottom: 4, width: 5, height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 1.5 },
});

export default withV4Navigation(Splash);
