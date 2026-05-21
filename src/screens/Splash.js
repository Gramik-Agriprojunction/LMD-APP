import React from 'react';
import { View, Text, StatusBar, Animated, Dimensions, StyleSheet, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { withV4Navigation } from '../utils/v4Compat';

const P = '#5D3FD3';
const { width, height } = Dimensions.get('window');
const ROUTE_W = width * 0.78;
const NUM_DOTS = 28;

class Splash extends React.Component {
  constructor() {
    super();
    this.state = {};
    this.sceneOp = new Animated.Value(0);
    this.gridOp = new Animated.Value(0);
    this.routeDots = Array(NUM_DOTS).fill(0).map(() => new Animated.Value(0));
    this.vanProgress = new Animated.Value(0);
    this.vanOp = new Animated.Value(0);
    this.vanBounce = new Animated.Value(0);
    this.startPinScale = new Animated.Value(0);
    this.startPinOp = new Animated.Value(0);
    this.endPinScale = new Animated.Value(0);
    this.endPinOp = new Animated.Value(0);
    this.checkScale = new Animated.Value(0);
    this.checkOp = new Animated.Value(0);
    this.pulseRing = new Animated.Value(0.8);
    this.pulseOp = new Animated.Value(0);
    this.titleOp = new Animated.Value(0);
    this.titleY = new Animated.Value(20);
    this.subOp = new Animated.Value(0);
    this.dots = Array(3).fill(0).map(() => new Animated.Value(0));
    this.fadeOut = new Animated.Value(1);
  }

  getRoutePoint(t) {
    const x = -ROUTE_W / 2 + t * ROUTE_W;
    const y = Math.sin(t * Math.PI * 2) * 22;
    return { x, y };
  }

  async componentDidMount() {
    Animated.parallel([
      Animated.timing(this.sceneOp, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(this.gridOp, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.spring(this.startPinScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
        Animated.timing(this.startPinOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }, 350);

    setTimeout(() => {
      this.routeDots.forEach((dot, i) => {
        setTimeout(() => {
          Animated.spring(dot, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
        }, i * 35);
      });
    }, 550);

    setTimeout(() => {
      Animated.timing(this.vanOp, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      Animated.timing(this.vanProgress, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
      this.startVanBounce();
    }, 650);

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(this.titleOp, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(this.titleY, { toValue: 0, friction: 6, useNativeDriver: true }),
      ]).start();
    }, 1200);

    setTimeout(() => {
      Animated.timing(this.subOp, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, 1600);

    setTimeout(() => {
      Animated.parallel([
        Animated.spring(this.endPinScale, { toValue: 1, friction: 4, tension: 50, useNativeDriver: true }),
        Animated.timing(this.endPinOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }, 2000);

    setTimeout(() => {
      Animated.parallel([
        Animated.spring(this.checkScale, { toValue: 1, friction: 4, tension: 50, useNativeDriver: true }),
        Animated.timing(this.checkOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      this.startPulse();
    }, 2200);

    setTimeout(() => this.startDots(), 1900);

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
    }, 3000);
  }

  startVanBounce = () => {
    const loop = () => {
      Animated.sequence([
        Animated.timing(this.vanBounce, { toValue: -2, duration: 120, useNativeDriver: true }),
        Animated.timing(this.vanBounce, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.delay(200),
      ]).start(() => loop());
    };
    loop();
  };

  startPulse = () => {
    const loop = () => {
      this.pulseRing.setValue(0.8);
      this.pulseOp.setValue(0);
      Animated.parallel([
        Animated.timing(this.pulseRing, { toValue: 2.2, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(this.pulseOp, { toValue: 0.4, duration: 200, useNativeDriver: true }),
          Animated.timing(this.pulseOp, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ]),
      ]).start(() => loop());
    };
    loop();
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
    const routePoints = [];
    for (let i = 0; i < NUM_DOTS; i++) {
      routePoints.push(this.getRoutePoint(i / (NUM_DOTS - 1)));
    }

    const vanX = this.vanProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [-ROUTE_W / 2, ROUTE_W / 2 - 24],
    });
    const vanY = this.vanProgress.interpolate({
      inputRange: [0, 0.25, 0.5, 0.75, 1],
      outputRange: [0, -22, 0, 22, 0],
    });

    const startPt = routePoints[0];
    const endPt = routePoints[NUM_DOTS - 1];

    return (
      <Animated.View style={[$.root, { opacity: this.fadeOut }]}>
        <StatusBar backgroundColor={P} translucent={false} barStyle="light-content" />
        <Animated.View style={[$.scene, { opacity: this.sceneOp }]}>
          <SafeAreaView edges={['top']} style={$.safe}>
            <View style={$.center}>

              <Animated.View style={[$.gridWrap, { opacity: this.gridOp }]}>
                {Array(10).fill(0).map((_, i) => (
                  <View key={`h${i}`} style={[$.gridH, { top: i * 36 }]} />
                ))}
                {Array(12).fill(0).map((_, i) => (
                  <View key={`v${i}`} style={[$.gridV, { left: i * 36 }]} />
                ))}
              </Animated.View>

              {/* Brand */}
              <View style={$.brandArea}>
                <Animated.View style={{ opacity: this.titleOp, transform: [{ translateY: this.titleY }], alignItems: 'center' }}>
                  <View style={$.logoCircle}>
                    <View style={$.lTop} />
                    <View style={$.lBody}><View style={$.lStripe} /></View>
                    <View style={$.lPin}><View style={$.lDot} /></View>
                  </View>
                  <View style={$.titleRow}>
                    <Text style={$.tLight}>Gramik</Text>
                    <Text style={$.tBold}> LMD</Text>
                  </View>
                </Animated.View>
                <Animated.Text style={[$.sub, { opacity: this.subOp }]}>Last Mile Delivery</Animated.Text>
              </View>

              {/* Route map */}
              <View style={$.routeArea}>

                {routePoints.map((pt, i) => (
                  <Animated.View key={i} style={[$.rDot, {
                    left: ROUTE_W / 2 + pt.x - 3,
                    top: 50 + pt.y - 3,
                    opacity: this.routeDots[i],
                    transform: [{ scale: this.routeDots[i] }],
                  }]} />
                ))}

                {/* Start pin A */}
                <Animated.View style={[$.pin, {
                  left: ROUTE_W / 2 + startPt.x - 16,
                  top: 50 + startPt.y - 46,
                  opacity: this.startPinOp,
                  transform: [{ scale: this.startPinScale }],
                }]}>
                  <View style={[$.pinHead, { backgroundColor: '#FBBF24' }]}>
                    <Text style={$.pinLetter}>A</Text>
                  </View>
                  <View style={[$.pinTail, { borderTopColor: '#FBBF24' }]} />
                </Animated.View>

                {/* End pin B + pulse */}
                <Animated.View style={[$.pulseCircle, {
                  left: ROUTE_W / 2 + endPt.x - 18,
                  top: 50 + endPt.y - 18,
                  opacity: this.pulseOp,
                  transform: [{ scale: this.pulseRing }],
                }]} />

                <Animated.View style={[$.pin, {
                  left: ROUTE_W / 2 + endPt.x - 16,
                  top: 50 + endPt.y - 46,
                  opacity: this.endPinOp,
                  transform: [{ scale: this.endPinScale }],
                }]}>
                  <View style={[$.pinHead, { backgroundColor: '#10B981' }]}>
                    <Text style={$.pinLetter}>B</Text>
                  </View>
                  <View style={[$.pinTail, { borderTopColor: '#10B981' }]} />
                </Animated.View>

                {/* Delivered badge */}
                <Animated.View style={[$.badge, {
                  left: ROUTE_W / 2 + endPt.x + 10,
                  top: 50 + endPt.y - 46,
                  opacity: this.checkOp,
                  transform: [{ scale: this.checkScale }],
                }]}>
                  <Text style={$.badgeText}>✓</Text>
                </Animated.View>

                {/* Van */}
                <Animated.View style={[$.van, {
                  opacity: this.vanOp,
                  transform: [{ translateX: vanX }, { translateY: Animated.add(vanY, this.vanBounce) }],
                }]}>
                  <View style={$.vanCargo}>
                    <View style={$.vanCargoStripe} />
                  </View>
                  <View style={$.vanCab}>
                    <View style={$.vanWindow} />
                  </View>
                  <View style={[$.vanW, { left: 2 }]} />
                  <View style={[$.vanW, { right: 2 }]} />
                </Animated.View>
              </View>

              {/* Loading */}
              <View style={$.dotsRow}>
                {this.dots.map((d, i) => (
                  <Animated.View key={i} style={[$.loadDot, {
                    opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
                    transform: [{ scale: d.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.3] }) }],
                  }]} />
                ))}
              </View>

            </View>
          </SafeAreaView>
        </Animated.View>
        <SafeAreaView edges={['bottom']} style={{ flex: 0, backgroundColor: P }}/>
      </Animated.View>
    );
  }
}

const $ = StyleSheet.create({
  root: { flex: 1, backgroundColor: P },
  scene: { flex: 1 },
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  gridWrap: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', opacity: 0.035 },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#FFF' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#FFF' },

  brandArea: { alignItems: 'center', marginBottom: 36 },
  logoCircle: { alignItems: 'center', width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)' },
  lTop: { width: 28, height: 6, backgroundColor: '#FBBF24', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  lBody: { width: 26, height: 18, backgroundColor: '#F59E0B', borderBottomLeftRadius: 3, borderBottomRightRadius: 3, alignItems: 'center', justifyContent: 'center' },
  lStripe: { width: 3, height: 18, backgroundColor: '#D97706', borderRadius: 1 },
  lPin: { width: 11, height: 11, borderRadius: 5.5, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginTop: -4 },
  lDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: P },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 16 },
  tLight: { fontSize: 32, fontWeight: '300', color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5 },
  tBold: { fontSize: 32, fontWeight: '900', color: '#FFF', letterSpacing: 3 },
  sub: { fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginTop: 8 },

  routeArea: { width: ROUTE_W, height: 100, marginBottom: 10 },
  rDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)' },

  pin: { position: 'absolute', alignItems: 'center', zIndex: 10 },
  pinHead: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 2 },
  pinLetter: { fontSize: 14, fontWeight: '900', color: '#FFF' },
  pinTail: { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -3 },

  pulseCircle: { position: 'absolute', width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#10B981', zIndex: 5 },

  badge: { position: 'absolute', width: 22, height: 22, borderRadius: 11, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', zIndex: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 2 },
  badgeText: { color: '#FFF', fontSize: 13, fontWeight: '900' },

  van: { position: 'absolute', top: 40, left: ROUTE_W / 2 - 12, flexDirection: 'row', alignItems: 'flex-end', zIndex: 8 },
  vanCargo: { width: 22, height: 14, backgroundColor: '#FBBF24', borderRadius: 2.5, overflow: 'hidden' },
  vanCargoStripe: { position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(217,119,6,0.3)' },
  vanCab: { width: 11, height: 11, backgroundColor: '#E8E0FF', borderTopRightRadius: 5, borderBottomRightRadius: 1.5, marginLeft: -1.5, overflow: 'hidden' },
  vanWindow: { width: 6, height: 5, backgroundColor: '#A5B4FC', borderRadius: 1, marginTop: 2, marginLeft: 3 },
  vanW: { position: 'absolute', bottom: -3, width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },

  dotsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  loadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.65)', marginHorizontal: 5 },
});

export default withV4Navigation(Splash);
