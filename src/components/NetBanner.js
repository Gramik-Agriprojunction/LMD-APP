import React, { Component } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

let NetInfo = null;
try { NetInfo = require('@react-native-community/netinfo').default; } catch (e) {}

export default class NetBanner extends Component {
  constructor() {
    super();
    this.state = { status: 'connected', visible: false };
    this.slideY = new Animated.Value(60);
  }

  componentDidMount() {
    if (!NetInfo) return;
    try {
      this.unsub = NetInfo.addEventListener(state => {
        if (!state.isConnected) {
          this.show('offline');
        } else if (state.isInternetReachable === false) {
          this.show('slow');
        } else {
          if (this.state.status !== 'connected' && this.state.visible) {
            this.show('connected');
            setTimeout(() => this.hide(), 2000);
          } else {
            this.hide();
          }
        }
      });
    } catch (e) {}
  }

  componentWillUnmount() { if (this.unsub) this.unsub(); }

  show = (status) => {
    this.setState({ status, visible: true }, () => {
      Animated.spring(this.slideY, { toValue: 0, friction: 8, useNativeDriver: true }).start();
    });
  };

  hide = () => {
    Animated.timing(this.slideY, { toValue: 60, duration: 300, useNativeDriver: true }).start(() => {
      this.setState({ visible: false });
    });
  };

  render() {
    if (!this.state.visible) return null;

    const { status } = this.state;
    const bg = status === 'offline' ? '#DC2626' : status === 'slow' ? '#EA580C' : '#16A34A';
    const msg = status === 'offline' ? 'No Internet Connection' : status === 'slow' ? 'Slow Internet Connection' : 'Back Online';

    return (
      <Animated.View style={[nb.wrap, { backgroundColor: bg, transform: [{ translateY: this.slideY }] }]}>
        <Text style={nb.text}>{msg}</Text>
      </Animated.View>
    );
  }
}

const nb = StyleSheet.create({
  wrap: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 8, paddingBottom: 12, alignItems: 'center', zIndex: 999 },
  text: { color: '#FFF', fontSize: 12, fontWeight: '600' },
});
