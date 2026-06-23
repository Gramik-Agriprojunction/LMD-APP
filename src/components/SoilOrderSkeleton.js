import React, { Component } from 'react';
import {
  View, Animated, StyleSheet, Dimensions, ScrollView, StatusBar, TouchableOpacity, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { S, soilIcons as I } from '../utils/soilTheme';
import { screenFooterPadding } from '../utils/safeAreaInsets';

const W = Dimensions.get('window').width;
const PAD = 10;
const BANNER_RATIO = 665 / 1024;
const BANNER_FULL = Math.round(W * Math.max(BANNER_RATIO, 0.74));
const BANNER_OVERLAP = 56;
const PKG_TOP_GAP = 20;
const FOOTER_H = 52;
const SCREEN_BG = '#edf1f7';

class ShimmerBlock extends Component {
  constructor() {
    super();
    this.shimmer = new Animated.Value(0);
  }

  componentDidMount() {
    this._loop = Animated.loop(
      Animated.timing(this.shimmer, { toValue: 1, duration: 1200, useNativeDriver: true }),
    );
    this._loop.start();
  }

  componentWillUnmount() {
    this._loop?.stop();
  }

  render() {
    const { style, children } = this.props;
    const tx = this.shimmer.interpolate({ inputRange: [0, 1], outputRange: [-W, W] });
    return (
      <View style={[st.block, style]}>
        <Animated.View style={[st.shimmer, { transform: [{ translateX: tx }] }]}>
          <View style={st.shimmerBar} />
        </Animated.View>
        {children}
      </View>
    );
  }
}

export default class SoilOrderSkeleton extends Component {
  secHead = () => (
    <View style={st.secHead}>
      <ShimmerBlock style={st.secIco} />
      <ShimmerBlock style={st.secTitle} />
    </View>
  );

  render() {
    const { onBack } = this.props;
    const scrollPad = FOOTER_H + screenFooterPadding() + 12;

    return (
      <View style={st.root}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        <View style={[st.banner, { height: BANNER_FULL }]}>
          <ShimmerBlock style={StyleSheet.absoluteFill} />
        </View>

        <SafeAreaView edges={['top']} style={st.backWrap} pointerEvents="box-none">
          <TouchableOpacity onPress={onBack} activeOpacity={0.85} style={st.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Image source={I.back} style={st.backIco} />
          </TouchableOpacity>
        </SafeAreaView>

        <ScrollView
          style={st.scroll}
          contentContainerStyle={[st.scrollInner, {
            paddingTop: BANNER_FULL - BANNER_OVERLAP + PKG_TOP_GAP,
            paddingBottom: scrollPad,
          }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={st.section}>
            {this.secHead()}
            <View style={st.pkgCard}>
              <View style={st.pkgTop}>
                <ShimmerBlock style={st.pkgName} />
                <ShimmerBlock style={st.pkgPrice} />
              </View>
              <View style={st.tagRow}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <ShimmerBlock key={i} style={st.tag} />
                ))}
              </View>
              <View style={st.qtyRow}>
                <ShimmerBlock style={st.qtyLbl} />
                <ShimmerBlock style={st.qtyCtrl} />
              </View>
            </View>
            <View style={st.pkgCardSm}>
              <View style={st.pkgTop}>
                <ShimmerBlock style={st.pkgNameSm} />
                <ShimmerBlock style={st.pkgPriceSm} />
              </View>
              <View style={st.tagRow}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <ShimmerBlock key={`s${i}`} style={st.tag} />
                ))}
              </View>
            </View>
          </View>

          <View style={st.section}>
            {this.secHead()}
            <View style={st.farmerCard}>
              <ShimmerBlock style={st.farmerAvatar} />
              <View style={st.farmerTxt}>
                <ShimmerBlock style={st.farmerLine1} />
                <ShimmerBlock style={st.farmerLine2} />
              </View>
              <ShimmerBlock style={st.chev} />
            </View>
          </View>

          <View style={st.section}>
            {this.secHead()}
            <ShimmerBlock style={st.fieldLbl} />
            <ShimmerBlock style={st.inpRow} />
            <View style={st.row2}>
              <ShimmerBlock style={st.halfField} />
              <ShimmerBlock style={st.halfField} />
            </View>
            <ShimmerBlock style={st.fieldLbl} />
            <ShimmerBlock style={st.inpTall} />
            <ShimmerBlock style={st.fieldLbl} />
            <ShimmerBlock style={st.inpRow} />
          </View>

          <View style={st.section}>
            {this.secHead()}
            <ShimmerBlock style={st.dateCard} />
          </View>
        </ScrollView>

        <View style={[st.footer, { paddingBottom: screenFooterPadding() }]}>
          <ShimmerBlock style={st.payVia} />
          <ShimmerBlock style={st.orderBtn} />
        </View>
      </View>
    );
  }
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: SCREEN_BG },
  banner: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#CBD5E1', overflow: 'hidden' },
  backWrap: { position: 'absolute', top: 0, left: PAD, zIndex: 10, elevation: 10 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  backIco: { width: 15, height: 15, tintColor: S.TXT, resizeMode: 'contain' },
  scroll: { flex: 1 },
  scrollInner: { paddingHorizontal: PAD, gap: 8 },
  section: {
    backgroundColor: S.WHITE, borderRadius: 16, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#E8ECF1',
    shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  secHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  secIco: { width: 28, height: 28, borderRadius: 8 },
  secTitle: { width: 120, height: 14, borderRadius: 6 },
  block: { backgroundColor: '#E2E8F0', overflow: 'hidden' },
  shimmer: { ...StyleSheet.absoluteFillObject },
  shimmerBar: { width: 100, height: '100%', backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ skewX: '-18deg' }] },
  pkgCard: {
    height: 148, borderRadius: 14, padding: 12, marginBottom: 8,
    backgroundColor: '#D1D5DB', overflow: 'hidden',
  },
  pkgCardSm: { height: 88, borderRadius: 14, padding: 12, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  pkgTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pkgName: { width: 72, height: 14, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.35)' },
  pkgPrice: { width: 48, height: 14, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.35)' },
  pkgNameSm: { width: 64, height: 12, borderRadius: 5 },
  pkgPriceSm: { width: 44, height: 12, borderRadius: 5 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { width: 28, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.3)' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  qtyLbl: { width: 90, height: 12, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.35)' },
  qtyCtrl: { width: 88, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.35)' },
  farmerCard: {
    height: 72, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10,
    borderWidth: 1, borderColor: '#DDD6FE', borderStyle: 'dashed', backgroundColor: '#F5F3FF',
  },
  farmerAvatar: { width: 44, height: 44, borderRadius: 22 },
  farmerTxt: { flex: 1, gap: 6 },
  farmerLine1: { width: '55%', height: 12, borderRadius: 5 },
  farmerLine2: { width: '80%', height: 10, borderRadius: 5 },
  chev: { width: 14, height: 14, borderRadius: 4 },
  fieldLbl: { width: 64, height: 10, borderRadius: 4, marginBottom: 6 },
  inpRow: { height: 46, borderRadius: 10, marginBottom: 10 },
  inpTall: { height: 72, borderRadius: 10, marginBottom: 10 },
  row2: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  halfField: { flex: 1, height: 46, borderRadius: 10 },
  dateCard: { height: 52, borderRadius: 12 },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: PAD, paddingTop: 8, backgroundColor: SCREEN_BG,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F0',
  },
  payVia: { width: 108, height: FOOTER_H, borderRadius: 12 },
  orderBtn: { flex: 1, height: FOOTER_H, borderRadius: 14, backgroundColor: '#BBF7D0' },
});
