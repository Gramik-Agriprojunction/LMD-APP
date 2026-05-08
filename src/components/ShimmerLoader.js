import React, { Component } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export default class ShimmerLoader extends Component {
  constructor() {
    super();
    this.shimmer = new Animated.Value(0);
  }

  componentDidMount() { this.startShimmer(); }

  startShimmer = () => {
    const loop = () => {
      this.shimmer.setValue(0);
      Animated.timing(this.shimmer, { toValue: 1, duration: 1200, useNativeDriver: true }).start(() => loop());
    };
    loop();
  };

  render() {
    const tx = this.shimmer.interpolate({ inputRange: [0, 1], outputRange: [-width, width] });

    const shimmerOverlay = (
      <Animated.View style={[sh.shimmer, { transform: [{ translateX: tx }] }]}>
        <View style={sh.shimmerInner} />
      </Animated.View>
    );

    return (
      <View style={sh.wrap}>
        {/* Header skeleton */}
        <View style={sh.row}>
          <View style={[sh.block, { width: 38, height: 38, borderRadius: 19 }]}>{shimmerOverlay}</View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={[sh.block, { width: 80, height: 10, borderRadius: 5 }]}>{shimmerOverlay}</View>
            <View style={[sh.block, { width: 120, height: 14, borderRadius: 5, marginTop: 6 }]}>{shimmerOverlay}</View>
          </View>
        </View>

        {/* Rule skeleton */}
        <View style={[sh.block, { height: 48, borderRadius: 10, marginTop: 14 }]}>{shimmerOverlay}</View>

        {/* Earnings skeleton */}
        <View style={[sh.row, { marginTop: 10 }]}>
          <View style={[sh.block, { flex: 1, height: 80, borderRadius: 12 }]}>{shimmerOverlay}</View>
          <View style={{ width: 8 }} />
          <View style={[sh.block, { flex: 1, height: 80, borderRadius: 12 }]}>{shimmerOverlay}</View>
        </View>

        {/* Card skeleton */}
        <View style={[sh.block, { height: 160, borderRadius: 12, marginTop: 10 }]}>{shimmerOverlay}</View>

        {/* Delivery skeleton */}
        <View style={[sh.block, { height: 200, borderRadius: 12, marginTop: 10 }]}>{shimmerOverlay}</View>
        <View style={[sh.block, { height: 200, borderRadius: 12, marginTop: 10 }]}>{shimmerOverlay}</View>
      </View>
    );
  }
}

const sh = StyleSheet.create({
  wrap: { padding: 10, paddingTop: 14 },
  row: { flexDirection: 'row', alignItems: 'center' },
  block: { backgroundColor: '#E2E8F0', overflow: 'hidden' },
  shimmer: { ...StyleSheet.absoluteFillObject },
  shimmerInner: { width: 80, height: '100%', backgroundColor: 'rgba(255,255,255,0.4)', transform: [{ skewX: '-20deg' }] },
});
